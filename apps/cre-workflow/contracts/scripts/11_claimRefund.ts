import { parseAbi } from "viem";
import { createSepoliaClients } from "../viemUtils";

const { walletClient, publicClient, account } = createSepoliaClients();

// ================================================
// ABI
// ================================================
const auctionAbi = parseAbi([
  "function claimRefund(uint256 auctionId) external",
  "function auctions(uint256) external view returns (uint256 tokenId, uint256 tokenAmount, address seller, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime, uint8 state, address winner, uint256 winningBid, uint256 bidCount)",
  "event BidRefunded(uint256 indexed auctionId, address indexed bidder, uint256 amount)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
]);

// ================================================
// Configuration - UPDATE THESE VALUES
// ================================================
const AUCTION_CONTRACT = "0xYOUR_AUCTION_CONTRACT_ADDRESS" as `0x${string}`;
const USDC_ADDRESS =
  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as `0x${string}`;

const refundParams = {
  auctionId: 1n,
};

async function main() {
  console.log("Claiming refund from MaskBidAuction...");
  console.log("Auction contract:", AUCTION_CONTRACT);
  console.log("Auction ID:", refundParams.auctionId.toString());
  console.log("Claimer:", account.address);

  try {
    // Check auction state
    const auction = await publicClient.readContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "auctions",
      args: [refundParams.auctionId],
    });

    const stateNames = ["Created", "Active", "Ended", "Finalized", "Cancelled"];
    console.log("Auction state:", stateNames[auction[7]] || "Unknown");

    if (auction[7] !== 3 && auction[7] !== 4) {
      console.error("Auction must be Finalized or Cancelled to claim refund");
      process.exit(1);
    }

    // Check USDC balance before
    const balanceBefore = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });

    // Claim refund
    const hash = await walletClient.writeContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "claimRefund",
      args: [refundParams.auctionId],
    });

    console.log("Claim Refund tx Hash:", hash);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    // Check USDC balance after
    const balanceAfter = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });

    const refunded = balanceAfter - balanceBefore;

    console.log("Refund claimed successfully!");
    console.log("Block number:", receipt.blockNumber.toString());
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("USDC refunded:", refunded.toString(), "units");
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
