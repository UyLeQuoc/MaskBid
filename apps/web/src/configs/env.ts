import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		ASSET_CONTRACT_ADDRESS: z.string(),
		ADMIN_PRIVATE_KEY: z.string(),
		RPC_URL: z.string(),
		SUPABASE_URL: z.string().optional(),
		SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
	},
	client: {
		NEXT_PUBLIC_APP_ID: z.string().optional(),
		NEXT_PUBLIC_ACTION: z.string().default("verify-kyc"),
		NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS: z.string(),
		NEXT_PUBLIC_RPC_URL: z.string(),
		NEXT_PUBLIC_EXPLORER_URL: z.string().default("https://sepolia.etherscan.io/tx"),
		// Auction contract address
		NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS: z.string().optional(),
		NEXT_PUBLIC_USDC_ADDRESS: z.string().default("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"), // Sepolia USDC
		// RSA public key for bid encryption
		NEXT_PUBLIC_RSA_PUBLIC_KEY: z.string().optional(),
		// Supabase configuration
		NEXT_PUBLIC_SUPABASE_URL: z.string().default("https://nxxxytncmfakqcbwlmbn.supabase.co"),
		NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eHh5dG5jbWZha3FjYndsbWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjUyNzEsImV4cCI6MjA4Njc0MTI3MX0.mpXw3zDpXuhdgfUW1K6as6gl9Ou2dk7jOZohDJB7LOg"),
	},
	runtimeEnv: {
		ASSET_CONTRACT_ADDRESS: process.env.ASSET_CONTRACT_ADDRESS,
		ADMIN_PRIVATE_KEY: process.env.ADMIN_PRIVATE_KEY,
		RPC_URL: process.env.RPC_URL,
		SUPABASE_URL: process.env.SUPABASE_URL,
		SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
		NEXT_PUBLIC_APP_ID: process.env.NEXT_PUBLIC_APP_ID,
		NEXT_PUBLIC_ACTION: process.env.NEXT_PUBLIC_ACTION,
		NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS,
		NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
		NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL,
		NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS,
		NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
		NEXT_PUBLIC_RSA_PUBLIC_KEY: process.env.NEXT_PUBLIC_RSA_PUBLIC_KEY,
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
	}
});
