import { parseAbi } from "viem";
import {
	createSepoliaClients,
	loadContractAddress,
} from "../viemUtils";

const { walletClient, publicClient, account } = createSepoliaClients();

// Updated ABI — registerAsset no longer requires ADMIN_ROLE, caller must be KYC-verified
const abi = parseAbi([
	"function registerAsset(string name, string symbol, string assetType, string description, string serialNumber, uint256 reservePrice, uint256 requiredDeposit, uint256 auctionDuration) public",
]);

const registerParams = {
	name: "Invoice-01",
	symbol: "IVC1",
	assetType: "invoice",
	description: "Sample invoice asset for testing",
	serialNumber: "INV-2026-001",
	reservePrice: 1000n,
	requiredDeposit: 100n,
	auctionDuration: 72n,
} as const;

async function main() {
	const CONTRACT_ADDRESS = loadContractAddress();
	if (
		!CONTRACT_ADDRESS ||
		CONTRACT_ADDRESS.trim() === "" ||
		!CONTRACT_ADDRESS.startsWith("0x") ||
		CONTRACT_ADDRESS.length !== 42
	) {
		console.error(
			"\nERROR: Tokenized Asset Platform address is not set or invalid!",
		);
		console.error(
			"Please update the assetAddress config.json under workflow directory.",
		);
		console.error("Script will exit now.\n");
		process.exit(1);
	}

	console.log("Preparing to call registerAsset function...");
	console.log("Contract address:", CONTRACT_ADDRESS);
	console.log("Caller (must be KYC-verified):", account.address);
	console.log("Parameters:", registerParams);

	try {
		const hash = await walletClient.writeContract({
			address: CONTRACT_ADDRESS,
			abi,
			functionName: "registerAsset",
			args: [
				registerParams.name,
				registerParams.symbol,
				registerParams.assetType,
				registerParams.description,
				registerParams.serialNumber,
				registerParams.reservePrice,
				registerParams.requiredDeposit,
				registerParams.auctionDuration,
			],
		});

		console.log("Asset Registration Transaction sent! Hash:", hash);

		const receipt = await publicClient.waitForTransactionReceipt({
			hash,
			confirmations: 1,
		});

		console.log("Transaction successful!");
		console.log("Block number:", receipt.blockNumber.toString());
		console.log("Gas used:", receipt.gasUsed.toString());
		console.log("\nNext step — run CRE to sync with Supabase:");
		console.log("  cd ../asset-log-trigger-workflow");
		console.log("  cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation");
		console.log("  → Select: 1 (LogTrigger)");
		console.log("  → Transaction hash:", hash);
		console.log("  → Event index: 0");
	} catch (error: any) {
		console.error("Call failed:", error);
		if (error.shortMessage) console.error("Error message:", error.shortMessage);
		if (error.cause) console.error("Detailed reason:", error.cause.message);
	}
}

main().catch(console.error);
