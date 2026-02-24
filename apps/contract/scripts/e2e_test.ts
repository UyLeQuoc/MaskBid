/**
 * E2E Test: Full MaskBid Auction Lifecycle on Tenderly Fork
 *
 * This script deploys both contracts and runs through the entire auction flow:
 *   1. Deploy TokenizedAssetPlatform
 *   2. Deploy MaskBidAuction (using real Sepolia USDC)
 *   3. Register + Verify + Mint an RWA asset
 *   4. Fund test accounts with ETH and USDC via Tenderly APIs
 *   5. Create an auction (seller escrows RWA token)
 *   6. Place bids (bidders escrow USDC)
 *   7. End the auction
 *   8. Finalize the auction (admin sets winner)
 *   9. Losing bidder claims refund
 *
 * Usage:
 *   cd apps/cre-workflow/contracts
 *   bun run scripts/e2e_test.ts
 */

import * as fs from "fs";
import { join } from "path";
import {
  type Abi,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbi,
  toBytes,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadPrivateKeyAndAccount, loadSepoliaRpcUrl } from "../viemUtils";

// ================================================================
// SETUP
// ================================================================
const rpcUrl = loadSepoliaRpcUrl();
const { account: admin } = loadPrivateKeyAndAccount();

// Real Sepolia USDC (Circle official)
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

// Generate two additional test accounts (bidder1 = winner, bidder2 = loser)
const bidder1Key = generatePrivateKey();
const bidder1 = privateKeyToAccount(bidder1Key);
const bidder2Key = generatePrivateKey();
const bidder2 = privateKeyToAccount(bidder2Key);

const adminWallet = createWalletClient({
  account: admin,
  chain: sepolia,
  transport: http(rpcUrl),
});

const bidder1Wallet = createWalletClient({
  account: bidder1,
  chain: sepolia,
  transport: http(rpcUrl),
});

const bidder2Wallet = createWalletClient({
  account: bidder2,
  chain: sepolia,
  transport: http(rpcUrl),
});

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
});

// ERC-20 ABI (for USDC interactions)
const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
]);

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

async function tenderlyRpc(method: string, params: any[]) {
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  return resp.json();
}

async function fundEth(address: `0x${string}`, label: string) {
  await tenderlyRpc("tenderly_setBalance", [
    [address],
    "0x56BC75E2D63100000", // 100 ETH in hex wei
  ]);
  console.log(`  💰 Funded ${label} (${address.slice(0, 10)}...) with 100 ETH`);
}

async function fundUsdc(address: `0x${string}`, label: string, amount: string) {
  await tenderlyRpc("tenderly_setErc20Balance", [USDC, address, amount]);
  console.log(`  💵 Funded ${label} with USDC`);
}

const step = (n: number, msg: string) =>
  console.log(`\n${"=".repeat(60)}\n  STEP ${n}: ${msg}\n${"=".repeat(60)}`);

const ok = (msg: string) => console.log(`  ✅ ${msg}`);

// ================================================================
// MAIN
// ================================================================
async function main() {
  console.log("🚀 MaskBid E2E Test on Tenderly Fork");
  console.log(`  Admin:   ${admin.address}`);
  console.log(`  Bidder1: ${bidder1.address}`);
  console.log(`  Bidder2: ${bidder2.address}`);
  console.log(`  USDC:    ${USDC}`);
  console.log(`  RPC:     ${rpcUrl.slice(0, 60)}...`);

  // Fund test accounts with ETH
  await fundEth(admin.address, "Admin");
  await fundEth(bidder1.address, "Bidder1");
  await fundEth(bidder2.address, "Bidder2");

  // Fund test accounts with USDC (10,000 USDC each = 10,000 * 10^6)
  const usdcAmount = "0x" + 10_000_000_000n.toString(16); // 10,000 USDC
  await fundUsdc(admin.address, "Admin", usdcAmount);
  await fundUsdc(bidder1.address, "Bidder1", usdcAmount);
  await fundUsdc(bidder2.address, "Bidder2", usdcAmount);

  // Verify USDC balances
  for (const [addr, label] of [
    [admin.address, "Admin"],
    [bidder1.address, "Bidder1"],
    [bidder2.address, "Bidder2"],
  ] as const) {
    const bal = await publicClient.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [addr],
    });
    console.log(`  ${label} USDC: ${(bal / 1_000_000n).toString()} USDC`);
  }

  // ----------------------------------------------------------
  step(1, "Deploy TokenizedAssetPlatform (RWA)");
  // ----------------------------------------------------------
  const rwaAbi = loadAbi("TokenizedAssetPlatform");
  const rwaBytecode = loadBytecode("TokenizedAssetPlatform");
  const DUMMY_FORWARDER = "0x15fC6ae953E024d975e77382eEeC56A9101f9F88";

  const rwaHash = await adminWallet.deployContract({
    abi: rwaAbi,
    bytecode: rwaBytecode,
    args: [DUMMY_FORWARDER],
  });
  const rwaReceipt = await publicClient.waitForTransactionReceipt({
    hash: rwaHash,
  });
  const RWA = rwaReceipt.contractAddress!;
  ok(`TokenizedAssetPlatform deployed at: ${RWA}`);

  // ----------------------------------------------------------
  step(2, "Deploy MaskBidAuction");
  // ----------------------------------------------------------
  const auctionAbi = loadAbi("MaskBidAuction");
  const auctionBytecode = loadBytecode("MaskBidAuction");

  const auctionHash = await adminWallet.deployContract({
    abi: auctionAbi,
    bytecode: auctionBytecode,
    args: [USDC, RWA, DUMMY_FORWARDER],
  });
  const auctionReceipt = await publicClient.waitForTransactionReceipt({
    hash: auctionHash,
  });
  const AUCTION = auctionReceipt.contractAddress!;
  ok(`MaskBidAuction deployed at: ${AUCTION}`);

  // ----------------------------------------------------------
  step(3, "Register + Verify + Mint RWA Asset");
  // ----------------------------------------------------------
  const rwaFuncsAbi = parseAbi([
    "function registerAsset(string name, string symbol, string assetType, uint256 initialSupply, string assetUid, address issuer) public",
    "function verifyAsset(uint256 assetId, bool isValid, string verificationDetails) public",
    "function mint(address to, uint256 assetId, uint256 amount, string reason) public",
    "function balanceOf(address account, uint256 id) public view returns (uint256)",
    "function setApprovalForAll(address operator, bool approved) external",
  ]);

  let hash = await adminWallet.writeContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "registerAsset",
    args: [
      "Luxury-Watch-Rolex",
      "LWR",
      "luxury_goods",
      0n,
      "rwa-uid-001",
      admin.address,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Registered RWA asset (tokenId=1): Luxury-Watch-Rolex");

  hash = await adminWallet.writeContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "verifyAsset",
    args: [1n, true, "Authenticated by MaskBid Verifier"],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Asset verified ✓");

  hash = await adminWallet.writeContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "mint",
    args: [admin.address, 1n, 1n, "Mint single RWA token for auction"],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Minted 1 RWA token to seller");

  const sellerBalance = await publicClient.readContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "balanceOf",
    args: [admin.address, 1n],
  });
  console.log(`  📦 Seller RWA token balance: ${sellerBalance}`);

  // ----------------------------------------------------------
  step(4, "Create Auction (Seller escrows RWA token)");
  // ----------------------------------------------------------
  // Approve auction contract
  hash = await adminWallet.writeContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "setApprovalForAll",
    args: [AUCTION, true],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Approved auction contract for RWA transfers");

  const auctionFuncsAbi = parseAbi([
    "function createAuction(uint256 tokenId, uint256 tokenAmount, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime) external returns (uint256)",
    "function placeBid(uint256 auctionId, bytes32 bidHash) external",
    "function endAuction(uint256 auctionId) external",
    "function finalizeAuction(uint256 auctionId, address winner, uint256 winningBid) external",
    "function claimRefund(uint256 auctionId) external",
    "function getAuction(uint256 auctionId) external view returns (uint256, uint256, address, uint256, uint256, uint256, uint256, uint8, address, uint256, uint256)",
    "function getAuctionState(uint256 auctionId) external view returns (uint8)",
  ]);

  // Get the current block timestamp from the fork
  // Mine a fresh block first to sync Tenderly's timestamp
  await tenderlyRpc("evm_mine", []);
  const block = await publicClient.getBlock();
  const now = Number(block.timestamp);
  console.log(`  ⏰ Current block time: ${new Date(now * 1000).toISOString()}`);

  // Use offsets from the current block timestamp
  const startOffset = 10; // start in 10 seconds
  const endOffset = 30; // end in 30 seconds

  hash = await adminWallet.writeContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "createAuction",
    args: [
      1n, // tokenId
      1n, // tokenAmount (single RWA token)
      500_000000n, // reservePrice: 500 USDC
      100_000000n, // depositRequired: 100 USDC per bid
      BigInt(now + startOffset), // starts in 10 seconds
      BigInt(now + startOffset + 3600), // must be >= 1 hour per contract
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Auction created! (auctionId=1)");

  const sellerBalanceAfter = await publicClient.readContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "balanceOf",
    args: [admin.address, 1n],
  });
  console.log(
    `  📦 Seller RWA balance after escrow: ${sellerBalanceAfter} (should be 0)`,
  );

  // Advance time past the startTime
  console.log("  ⏳ Fast-forwarding to auction start...");
  await tenderlyRpc("evm_increaseTime", [
    "0x" + (startOffset + 5).toString(16),
  ]); // +15 seconds
  await tenderlyRpc("evm_mine", []);

  // ----------------------------------------------------------
  step(5, "Place Bids (Bidders escrow USDC)");
  // ----------------------------------------------------------
  // Bidder 1 approves USDC and places bid
  hash = await bidder1Wallet.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [AUCTION, 100_000000n],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const bidHash1 = keccak256(
    toBytes(
      JSON.stringify({
        amount: "1500000000",
        nonce: "bid1_secret",
        bidder: bidder1.address,
      }),
    ),
  );
  hash = await bidder1Wallet.writeContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "placeBid",
    args: [1n, bidHash1],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok(`Bidder1 placed sealed bid ✓`);

  // Bidder 2 approves USDC and places bid
  hash = await bidder2Wallet.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [AUCTION, 100_000000n],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const bidHash2 = keccak256(
    toBytes(
      JSON.stringify({
        amount: "800000000",
        nonce: "bid2_secret",
        bidder: bidder2.address,
      }),
    ),
  );
  hash = await bidder2Wallet.writeContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "placeBid",
    args: [1n, bidHash2],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok(`Bidder2 placed sealed bid ✓`);

  // Check auction state
  const auctionData = await publicClient.readContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "getAuction",
    args: [1n],
  });
  const stateNames = ["Created", "Active", "Ended", "Finalized", "Cancelled"];
  console.log(
    `  📊 Auction state: ${stateNames[auctionData[7]]}, bids: ${auctionData[10]}`,
  );

  // ----------------------------------------------------------
  step(6, "End Auction");
  // ----------------------------------------------------------
  console.log("  ⏳ Fast-forwarding past auction end time (1 hour)...");
  await tenderlyRpc("evm_increaseTime", ["0xe10"]); // +3600 seconds (1 hour)
  await tenderlyRpc("evm_mine", []);

  hash = await adminWallet.writeContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "endAuction",
    args: [1n],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Auction ended!");

  const stateAfterEnd = await publicClient.readContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "getAuctionState",
    args: [1n],
  });
  console.log(`  📊 Auction state: ${stateNames[stateAfterEnd]}`);

  // ----------------------------------------------------------
  step(7, "Finalize Auction (Bidder1 wins!)");
  // ----------------------------------------------------------
  hash = await adminWallet.writeContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "finalizeAuction",
    args: [1n, bidder1.address, 1500_000000n],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Auction finalized! 🎉");

  // Check winner got the RWA token
  const winnerRwa = await publicClient.readContract({
    address: RWA,
    abi: rwaFuncsAbi,
    functionName: "balanceOf",
    args: [bidder1.address, 1n],
  });
  console.log(`  🏆 Winner RWA balance: ${winnerRwa} (should be 1)`);

  // Check seller received USDC (winner's deposit)
  const sellerUsdc = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [admin.address],
  });
  console.log(
    `  💰 Seller USDC balance: ${(sellerUsdc / 1_000_000n).toString()} USDC`,
  );

  // ----------------------------------------------------------
  step(8, "Losing Bidder Claims Refund");
  // ----------------------------------------------------------
  const bidder2Before = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [bidder2.address],
  });

  hash = await bidder2Wallet.writeContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "claimRefund",
    args: [1n],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  ok("Bidder2 refund claimed!");

  const bidder2After = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [bidder2.address],
  });
  console.log(
    `  💸 Bidder2 USDC: ${(bidder2Before / 1_000_000n).toString()} → ${(bidder2After / 1_000_000n).toString()} USDC (refunded ${((bidder2After - bidder2Before) / 1_000_000n).toString()} USDC)`,
  );

  // ----------------------------------------------------------
  step(9, "Final State Summary");
  // ----------------------------------------------------------
  const finalAuction = await publicClient.readContract({
    address: AUCTION,
    abi: auctionFuncsAbi,
    functionName: "getAuction",
    args: [1n],
  });

  console.log("\n  📋 FINAL AUCTION STATE:");
  console.log(`     State:        ${stateNames[finalAuction[7]]}`);
  console.log(`     Winner:       ${finalAuction[8]}`);
  console.log(
    `     Winning Bid:  ${(finalAuction[9] / 1_000_000n).toString()} USDC`,
  );
  console.log(`     Bid Count:    ${finalAuction[10]}`);
  console.log(`     Token ID:     ${finalAuction[0]}`);
  console.log(`     Token Amount: ${finalAuction[1]}`);

  console.log("\n\n🎉 E2E TEST COMPLETE — ALL STEPS PASSED!\n");
  console.log("  Contract Addresses:");
  console.log(`    RWA:      ${RWA}`);
  console.log(`    Auction:  ${AUCTION}`);
  console.log(`    USDC:     ${USDC}`);
}

main().catch((err) => {
  console.error("\n❌ E2E TEST FAILED:", err);
  process.exit(1);
});
