import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		CONTRACT_ADDRESS: z.string(),
		ADMIN_PRIVATE_KEY: z.string(),
		RPC_URL: z.string(),
	},
	client: {
		NEXT_PUBLIC_APP_ID: z.string().optional(),
		NEXT_PUBLIC_ACTION: z.string().default("verify-kyc"),
		NEXT_PUBLIC_CONTRACT_ADDRESS: z.string(),
		NEXT_PUBLIC_RPC_URL: z.string(),
		NEXT_PUBLIC_EXPLORER_URL: z.string().default("https://sepolia.etherscan.io/tx"),
	},
	runtimeEnv: {
		CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
		ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY,
		RPC_URL: process.env.RPC_URL,
		NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID,
		NEXT_PUBLIC_ACTION: process.env.NEXT_PUBLIC_ACTION,
		NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
		NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
		NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL,
	}
});
