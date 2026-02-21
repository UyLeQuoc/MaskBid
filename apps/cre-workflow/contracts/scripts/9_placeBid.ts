import { keccak256, parseAbi, toBytes } from "viem";
import { createSepoliaClients } from "../viemUtils";

const { walletClient, publicClient, account } = createSepoliaClients();

// ================================================
// ABI
// ================================================
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const auctionAbi = parseAbi([
  "function placeBid(uint256 auctionId, bytes32 bidHash) external",
  "function auctions(uint256) external view returns (uint256 tokenId, uint256 tokenAmount, address seller, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime, uint8 state, address winner, uint256 winningBid, uint256 bidCount)",
  "event BidPlaced(uint256 indexed auctionId, address indexed bidder, bytes32 indexed bidHash, uint256 escrowAmount)",
]);

// ================================================
// Configuration - UPDATE THESE VALUES
// ================================================
const AUCTION_CONTRACT = "0xYOUR_AUCTION_CONTRACT_ADDRESS" as `0x${string}`;
const USDC_ADDRESS =
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

// Bid parameters
const bidParams = {
  auctionId: 1n,
  // The actual bid amount (encrypted off-chain, only hash stored on-chain)
  bidAmount: 1500_000000n, // 1500 USDC
};

async function main() {
  console.log("Placing bid on MaskBidAuction...");
  console.log("Auction contract:", AUCTION_CONTRACT);
  console.log("Auction ID:", bidParams.auctionId.toString());

  try {
    // Step 1: Read auction details to get deposit required
    const auction = await publicClient.readContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "auctions",
      args: [bidParams.auctionId],
    });

    const depositRequired = auction[4]; // depositRequired field
    console.log("Deposit required:", depositRequired.toString(), "USDC units");

    // Step 2: Check USDC balance
    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log("USDC balance:", balance.toString());

    if (balance < depositRequired) {
      console.error("Insufficient USDC balance for deposit!");
      process.exit(1);
    }

    // Step 3: Approve USDC for auction contract
    const allowance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, AUCTION_CONTRACT],
    });

    if (allowance < depositRequired) {
      console.log("Approving USDC for auction contract...");
      const approveHash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [AUCTION_CONTRACT, depositRequired],
      });

      await publicClient.waitForTransactionReceipt({
        hash: approveHash,
        confirmations: 1,
      });
      console.log("USDC approval confirmed!");
    }

    // Step 4: Create bid hash (keccak256 of encrypted bid data)
    // In production, this would be RSA-encrypted bid amount
    const nonce = Math.random().toString(36).substring(2, 15);
    const bidPayload = JSON.stringify({
      amount: bidParams.bidAmount.toString(),
      nonce,
      bidder: account.address,
    });
    const bidHash = keccak256(toBytes(bidPayload));
    console.log("Bid hash:", bidHash);

    // Step 5: Place bid
    const hash = await walletClient.writeContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "placeBid",
      args: [bidParams.auctionId, bidHash],
    });

    console.log("Place Bid tx Hash:", hash);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    console.log("Bid placed successfully!");
    console.log("Block number:", receipt.blockNumber.toString());
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("⚠️  Save your bid payload for verification:", bidPayload);
  } catch (error: any) {
    console.error("Failed:", error);
    if (error.shortMessage) {
      console.error("Error message:", error.shortMessage);
    }
    if (error.cause) {
      console.error("Detailed reason:", error.cause.message);
    }
  }
}

main().catch(console.error);
