import { parseAbi } from "viem";
import { createSepoliaClients } from "../viemUtils";

const { walletClient, publicClient, account } = createSepoliaClients();

// ================================================
// ABI - Only the needed functions
// ================================================
const erc1155Abi = parseAbi([
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) external view returns (bool)",
]);

const auctionAbi = parseAbi([
  "function createAuction(uint256 tokenId, uint256 tokenAmount, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime) external returns (uint256)",
  "event AuctionCreated(uint256 indexed auctionId, uint256 indexed tokenId, address indexed seller, uint256 tokenAmount, uint256 reservePrice, uint256 depositRequired, uint256 startTime, uint256 endTime)",
]);

// ================================================
// Configuration - UPDATE THESE VALUES
// ================================================
const AUCTION_CONTRACT = "0xYOUR_AUCTION_CONTRACT_ADDRESS" as `0x${string}`;
const RWA_TOKEN_ADDRESS = "0xYOUR_RWA_TOKEN_ADDRESS" as `0x${string}`;

// Auction parameters
const auctionParams = {
  tokenId: 1n, // RWA token ID from TokenizedAssetPlatform
  tokenAmount: 100n, // Amount of ERC-1155 tokens to auction
  reservePrice: 1000_000000n, // 1000 USDC (6 decimals)
  depositRequired: 100_000000n, // 100 USDC deposit per bid
  // Start 5 minutes from now, end 2 hours from now
  startTime: BigInt(Math.floor(Date.now() / 1000) + 300),
  endTime: BigInt(Math.floor(Date.now() / 1000) + 7500),
};

async function main() {
  console.log("Creating auction on MaskBidAuction...");
  console.log("Auction contract:", AUCTION_CONTRACT);
  console.log("Parameters:", {
    ...auctionParams,
    startTime: new Date(Number(auctionParams.startTime) * 1000).toISOString(),
    endTime: new Date(Number(auctionParams.endTime) * 1000).toISOString(),
  });

  try {
    // Step 1: Approve the auction contract to transfer RWA tokens
    const isApproved = await publicClient.readContract({
      address: RWA_TOKEN_ADDRESS,
      abi: erc1155Abi,
      functionName: "isApprovedForAll",
      args: [account.address, AUCTION_CONTRACT],
    });

    if (!isApproved) {
      console.log("Approving auction contract for RWA token transfers...");
      const approveHash = await walletClient.writeContract({
        address: RWA_TOKEN_ADDRESS,
        abi: erc1155Abi,
        functionName: "setApprovalForAll",
        args: [AUCTION_CONTRACT, true],
      });

      await publicClient.waitForTransactionReceipt({
        hash: approveHash,
        confirmations: 1,
      });
      console.log("Approval confirmed!");
    } else {
      console.log("Already approved for RWA token transfers.");
    }

    // Step 2: Create the auction
    const hash = await walletClient.writeContract({
      address: AUCTION_CONTRACT,
      abi: auctionAbi,
      functionName: "createAuction",
      args: [
        auctionParams.tokenId,
        auctionParams.tokenAmount,
        auctionParams.reservePrice,
        auctionParams.depositRequired,
        auctionParams.startTime,
        auctionParams.endTime,
      ],
    });

    console.log("Create Auction tx Hash:", hash);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    });

    console.log("Auction created successfully!");
    console.log("Block number:", receipt.blockNumber.toString());
    console.log("Gas used:", receipt.gasUsed.toString());

    // Parse logs to get auction ID
    console.log("Logs:", receipt.logs);
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
