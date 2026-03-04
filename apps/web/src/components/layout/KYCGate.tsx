"use client";
import { useSDK } from "@metamask/sdk-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { env } from "@/configs/env";
import { KYCFlow } from "@/components/kyc/KYCFlow";
import { Spinner } from "@/components/kyc/Spinner";

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL = env.NEXT_PUBLIC_RPC_URL;

const KYC_READ_ABI = [
	{
		name: "isKYCVerified",
		type: "function",
		inputs: [{ name: "user", type: "address" }],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "view",
	},
] as const;

export function KYCGate({ children }: { children: React.ReactNode }) {
	const { sdk, connected, account } = useSDK();
	const [kycVerified, setKycVerified] = useState<boolean | null>(null);
	const prevAccount = useRef<string | null>(null);

	const checkKYC = useCallback(async (address: string) => {
		setKycVerified(null); // loading
		try {
			const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
			const verified = await publicClient.readContract({
				address: CONTRACT_ADDRESS,
				abi: KYC_READ_ABI,
				functionName: "isKYCVerified",
				args: [address as `0x${string}`],
			});
			setKycVerified(!!verified);
		} catch {
			setKycVerified(false);
		}
	}, []);

	useEffect(() => {
		if (connected && account && account !== prevAccount.current) {
			prevAccount.current = account;
			checkKYC(account);
		}
		if (!connected) {
			prevAccount.current = null;
			setKycVerified(false);
		}
	}, [connected, account, checkKYC]);

	// Not connected
	if (!connected) {
		return (
			<div className="min-h-screen flex items-center justify-center p-4">
				<div className="text-center max-w-sm">
					<div className="w-20 h-20 border border-gold/20 flex items-center justify-center mx-auto mb-6">
						<svg aria-hidden="true" className="w-10 h-10 text-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
						</svg>
					</div>
					<h2 className="font-serif text-2xl font-semibold text-foreground mb-3">Connect Your Wallet</h2>
					<p className="text-muted text-sm mb-8">This page requires a connected wallet with KYC verification.</p>
					<button
						type="button"
						onClick={() => sdk?.connect()}
						className="btn-ornate text-gold font-serif tracking-wider px-8 py-2.5 cursor-pointer"
					>
						Connect Wallet
					</button>
				</div>
			</div>
		);
	}

	// Checking KYC
	if (kycVerified === null) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<Spinner className="w-10 h-10 text-gold mx-auto mb-4" />
					<p className="text-muted text-sm font-serif">Checking verification status...</p>
				</div>
			</div>
		);
	}

	// Not KYC verified — show KYC flow
	if (!kycVerified) {
		return <KYCFlow />;
	}

	// Verified — render children
	return <>{children}</>;
}
