import { parseAbi } from "viem";
import { createSepoliaClients } from "../viemUtils";

const { walletClient, publicClient, account } = createSepoliaClients();

// ================================================
// ABI
// ================================================
const auctionAbi = parseAbi([
  "function finalizeAuction(uint256 auctionId, address winner, uint256 winningBid) external",
  "function auctions(uint256) external view returns (uint256 tokenId, uint256 tokenAmount, address seller, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime, uint8 state, address winner, uint256 winningBid, uint256 bidCount)",
  "event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 indexed winningBid)",
]);

// ================================================
// Configuration - UPDATE THESE VALUES
// ================================================
const AUCTION_CONTRACT = "0xYOUR_AUCTION_CONTRACT_ADDRESS" as `0x${string}`;

// Finalization parameters (normally set by CRE solver, manual for testing)
const finalizeParams = {
  auctionId: 1n,
  winner: "0xWINNER_ADDRESS" as `0x${string}`,
  winningBid: 1500_000000n, // 1500 USDC (6 decimals)
};

async function main() {
  console.log("Finalizing auction on MaskBidAuction...");
  console.log("Auction contract:", AUCTION_CONTRACT);
  console.log("Parameters:", finalizeParams);

  try {
    // Read auction state first
    const auction = await publicClient.readContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "auctions",
      args: [finalizeParams.auctionId],
    });

    const stateNames = ["Created", "Active", "Ended", "Finalized", "Cancelled"];
    console.log("Current auction state:", stateNames[auction[7]] || "Unknown");
    console.log("Bid count:", auction[10].toString());

    if (auction[7] === 3) {
      console.log("Auction already finalized!");
      return;
    }

    // Finalize
    const hash = await walletClient.writeContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "finalizeAuction",
      args: [
        finalizeParams.auctionId,
        finalizeParams.winner,
        finalizeParams.winningBid,
      ],
    });

    console.log("Finalize Auction tx Hash:", hash);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    console.log("Auction finalized successfully!");
    console.log("Block number:", receipt.blockNumber.toString());
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Winner:", finalizeParams.winner);
    console.log(
      "Winning bid:",
      finalizeParams.winningBid.toString(),
      "USDC units",
    );
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
