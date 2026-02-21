import * as fs from "fs";
import { join } from "path";
import { type Abi, createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { loadPrivateKeyAndAccount, loadSepoliaRpcUrl } from "../viemUtils";

// ================================================================
// CONFIGURATION
// ================================================================
// Sepolia testnet USDC
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
// Dummy forwarder for local testing
const DUMMY_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";

const rpcUrl = loadSepoliaRpcUrl();
const { account } = loadPrivateKeyAndAccount();

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl),
});

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

// ================================================================
// HELPERS
// ================================================================
function loadAbi(name: string): Abi {
  const abiPath = join(process.cwd(), "output", `${name}.abi`);
  return JSON.parse(fs.readFileSync(abiPath, "utf8").trim()) as Abi;
}

function loadBytecode(name: string): `0x${string}` {
  const binPath = join(process.cwd(), "output", `${name}.bin`);
  let raw = fs.readFileSync(binPath, "utf8").trim();
  if (!raw.startsWith("0x")) raw = "0x" + raw;
  return raw as `0x${string}`;
}

function updateEnvFile(filePath: string, envVars: Record<string, string>) {
  const fullPath = join(process.cwd(), "../../..", filePath);

  let content = "";
  if (fs.existsSync(fullPath)) {
    content = fs.readFileSync(fullPath, "utf8");
  }

  const lines = content.split("\n");
  const newLines = [...lines];

  for (const [key, value] of Object.entries(envVars)) {
    const index = newLines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) {
      newLines[index] = `${key}=${value}`;
    } else {
      newLines.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(fullPath, newLines.join("\n"));
  console.log(`✅ Updated ${filePath} with new contract addresses`);
}

// ================================================================
// MAIN DEPLOYMENT
// ================================================================
async function main() {
  console.log("🚀 Starting Full Deployment to Tenderly Fork");
  console.log(`   Deployer: ${account.address}`);
  console.log(`   RPC:      ${rpcUrl.slice(0, 50)}...`);

  // 1. Deploy RWA Contract
  console.log("\n📦 Deploying TokenizedAssetPlatform (RWA)...");
  const rwaAbi = loadAbi("TokenizedAssetPlatform");
  const rwaBytecode = loadBytecode("TokenizedAssetPlatform");

  const rwaHash = await walletClient.deployContract({
    abi: rwaAbi,
    bytecode: rwaBytecode,
    args: [DUMMY_FORWARDER],
  });
  const rwaReceipt = await publicClient.waitForTransactionReceipt({
    hash: rwaHash,
  });
  const rwaAddress = rwaReceipt.contractAddress!;
  console.log(`   ✅ Deployed RWA at: ${rwaAddress}`);

  // 2. Deploy Auction Contract
  console.log("\n🔨 Deploying MaskBidAuction...");
  const auctionAbi = loadAbi("MaskBidAuction");
  const auctionBytecode = loadBytecode("MaskBidAuction");

  const auctionHash = await walletClient.deployContract({
    abi: auctionAbi,
    bytecode: auctionBytecode,
    args: [USDC_ADDRESS, rwaAddress, DUMMY_FORWARDER],
  });
  const auctionReceipt = await publicClient.waitForTransactionReceipt({
    hash: auctionHash,
  });
  const auctionAddress = auctionReceipt.contractAddress!;
  console.log(`   ✅ Deployed Auction at: ${auctionAddress}`);

  // 3. Update Environment Variables
  console.log("\n📝 Updating .env files...");

  const bidderAppEnv = {
    NEXT_PUBLIC_RWA_CONTRACT_ADDRESS: rwaAddress,
    NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS: auctionAddress,
    NEXT_PUBLIC_USDC_ADDRESS: USDC_ADDRESS,
  };
  updateEnvFile("apps/bidder-app/.env", bidderAppEnv);

  const creWorkflowEnv = {
    RWA_CONTRACT_ADDRESS: rwaAddress,
    AUCTION_CONTRACT_ADDRESS: auctionAddress,
    USDC_ADDRESS: USDC_ADDRESS,
  };
  updateEnvFile("apps/cre-workflow/.env", creWorkflowEnv);

  console.log("\n🎉 Deployment Complete!");
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
