import * as fs from "fs";
import { join } from "path";
import type { Abi } from "viem";
import { createSepoliaClients } from "../viemUtils";

const { walletClient, publicClient } = createSepoliaClients();

// ================================================
// Load ABI and bytecode for MaskBidAuction
// Run `bun run build:auction` first to generate these
// ================================================
const abiPath = join(process.cwd(), "output", "MaskBidAuction.abi");
if (!fs.existsSync(abiPath)) {
  throw new Error(
    `Cannot find ABI file at ${abiPath}\nRun 'bun run build:auction' first.`,
  );
}

let abi: Abi;
try {
  const abiRaw = fs.readFileSync(abiPath, "utf8").trim();
  abi = JSON.parse(abiRaw) as Abi;
} catch (e) {
  throw new Error(`ABI file format error: ${abiPath}\n${e}`);
}

const bytecodePath = join(process.cwd(), "output", "MaskBidAuction.bin");
if (!fs.existsSync(bytecodePath)) {
  throw new Error(`Cannot find bytecode file at ${bytecodePath}`);
}

let bytecodeRaw = fs.readFileSync(bytecodePath, "utf8").trim();
if (!bytecodeRaw.startsWith("0x")) {
  bytecodeRaw = "0x" + bytecodeRaw;
}

const bytecode = bytecodeRaw as `0x${string}`;

// ================================================
// Configuration
// ================================================
// USDC on Sepolia (Circle official)
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// MaskBidAsset address - load from config
import { loadAssetContractAddress } from "../viemUtils";
const RWA_TOKEN_ADDRESS = loadAssetContractAddress();

// Chainlink CRE Forwarder on Eth Sepolia
const FORWARDER_ADDRESS = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";

async function main() {
  console.log("Deploying MaskBidAuction contract...");
  console.log("USDC address:", USDC_ADDRESS);
  console.log("RWA Token address:", RWA_TOKEN_ADDRESS);
  console.log("CRE Forwarder address:", FORWARDER_ADDRESS);

  try {
    const hash = await walletClient.deployContract({
      abi,
      bytecode,
      args: [USDC_ADDRESS, RWA_TOKEN_ADDRESS, FORWARDER_ADDRESS],
    });

    console.log("Deploy tx Hash:", hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log("Contract MaskBidAuction deployed successfully!");
    console.log("Contract deployed at:", receipt.contractAddress);
    console.log("Block number:", receipt.blockNumber);
  } catch (error) {
    console.error("Failed to deploy:", error);
    process.exit(1);
  }
}

main();
