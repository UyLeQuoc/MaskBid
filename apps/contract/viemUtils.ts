import * as dotenv from "dotenv";
import { join } from "path";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

dotenv.config({ path: join(process.cwd(), ".env") });

export function loadPrivateKeyAndAccount() {
	const privateKey = process.env.PRIVATE_KEY;
	if (!privateKey) throw new Error("PRIVATE_KEY not found in .env");

	const account = privateKeyToAccount(
		privateKey.startsWith("0x")
			? (privateKey as `0x${string}`)
			: (`0x${privateKey}` as `0x${string}`),
	);
	return { account, privateKey };
}

export function loadAssetContractAddress(): `0x${string}` {
	const addr = process.env.ASSET_CONTRACT_ADDRESS;
	if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
		throw new Error(
			"ASSET_CONTRACT_ADDRESS not found or invalid in .env\n" +
				"Run 'bun run deploy' to deploy the contract first.",
		);
	}
	return addr as `0x${string}`;
}

export function createSepoliaClients() {
	const rpcUrl = process.env.TENDERLY_VIRTUAL_TESTNET_RPC_URL;
	if (!rpcUrl) throw new Error("TENDERLY_VIRTUAL_TESTNET_RPC_URL not found in .env");

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

	return { walletClient, publicClient, account, rpcUrl };
}
