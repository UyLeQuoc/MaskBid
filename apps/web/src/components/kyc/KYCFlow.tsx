"use client";
import { useSDK } from "@metamask/sdk-react";
import type { ISuccessResult } from "@worldcoin/idkit";
import { IDKitWidget, VerificationLevel } from "@worldcoin/idkit";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { env } from "@/configs/env";
import { Spinner } from "./Spinner";
import { StepIndicator } from "./StepIndicator";

const APP_ID = (env.NEXT_PUBLIC_APP_ID || "app_staging_b2602675085f2b2c08b0ea7c819802fe") as `app_${string}`;
const ACTION = env.NEXT_PUBLIC_ACTION;
const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL = env.NEXT_PUBLIC_RPC_URL;
const EXPLORER_URL = env.NEXT_PUBLIC_EXPLORER_URL;

export const KYC_READ_ABI = [
	{
		name: "isKYCVerified",
		type: "function",
		inputs: [{ name: "user", type: "address" }],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "view",
	},
] as const;

type FlowState =
	| "idle"
	| "connecting"
	| "checking_kyc"
	| "already_verified"
	| "needs_verification"
	| "verifying"
	| "submitting"
	| "bypassing"
	| "done"
	| "error";

function truncateAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/* ─── Icon wrapper ─── */
function IconBox({ children, variant = "gold" }: { children: React.ReactNode; variant?: "gold" | "green" | "red" | "amber" }) {
	const styles = {
		gold: "text-gold/60",
		green: "text-status-live",
		red: "text-status-error",
		amber: "text-gold",
	};
	return (
		<div className={`w-20 h-20 ${styles[variant]} flex items-center justify-center mx-auto mb-6`}>
			{children}
		</div>
	);
}

export function KYCFlow() {
	const { sdk, connected, account } = useSDK();
	const [flowState, setFlowState] = useState<FlowState>("idle");
	const [txHash, setTxHash] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [worldIdFailed, setWorldIdFailed] = useState(false);
	const isDisconnecting = useRef(false);

	const checkKYCStatus = useCallback(async (address: string) => {
		setFlowState("checking_kyc");
		try {
			const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
			const verified = await publicClient.readContract({
				address: CONTRACT_ADDRESS,
				abi: KYC_READ_ABI,
				functionName: "isKYCVerified",
				args: [address as `0x${string}`],
			});
			setFlowState(verified ? "already_verified" : "needs_verification");
		} catch (e) {
			console.error("Failed to check KYC status:", e);
			setErrorMsg("Unable to check KYC status. Please try again.");
			setFlowState("error");
		}
	}, []);

	useEffect(() => {
		if (connected && account && flowState === "connecting") {
			checkKYCStatus(account);
		}
	}, [connected, account, flowState, checkKYCStatus]);

	useEffect(() => {
		if (!connected) {
			isDisconnecting.current = false;
			return;
		}
		if (account && flowState === "idle" && !isDisconnecting.current) {
			checkKYCStatus(account);
		}
	}, [connected, account, flowState, checkKYCStatus]);

	const handleConnect = async () => {
		setFlowState("connecting");
		try {
			await sdk?.connect();
		} catch {
			setFlowState("idle");
			setErrorMsg("Failed to connect wallet. Please try again.");
		}
	};

	const handleVerify = async (proof: ISuccessResult) => {
		if (!account) return;
		setFlowState("submitting");
		setWorldIdFailed(false);
		try {
			const res = await fetch("/api/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...proof, wallet_address: account }),
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				if (data.worldIdFailed) setWorldIdFailed(true);
				const errDetail = data.error?.detail || data.error?.code || (typeof data.error === "string" ? data.error : null);
				throw new Error(errDetail || "Verification failed");
			}
			setTxHash(data.txHash);

			const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
			const addr = account as `0x${string}`;
			let confirmed = false;
			for (let i = 0; i < 30; i++) {
				await new Promise((r) => setTimeout(r, 2000));
				const verified = await publicClient.readContract({
					address: CONTRACT_ADDRESS,
					abi: KYC_READ_ABI,
					functionName: "isKYCVerified",
					args: [addr],
				});
				if (verified) {
					confirmed = true;
					break;
				}
			}
			if (!confirmed) throw new Error("Transaction submitted but on-chain confirmation timed out. Check the explorer.");

			setFlowState("done");
		} catch (e: unknown) {
			setErrorMsg(e instanceof Error ? e.message : "An unexpected error occurred");
			setFlowState("error");
		}
	};

	const handleBypass = async () => {
		if (!account) return;
		setFlowState("bypassing");
		setWorldIdFailed(false);
		try {
			const res = await fetch("/api/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ bypass: true, wallet_address: account }),
			});
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error || "Bypass failed");
			}
			setTxHash(data.txHash);

			const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
			const addr = account as `0x${string}`;
			let confirmed = false;
			for (let i = 0; i < 30; i++) {
				await new Promise((r) => setTimeout(r, 2000));
				const verified = await publicClient.readContract({
					address: CONTRACT_ADDRESS,
					abi: KYC_READ_ABI,
					functionName: "isKYCVerified",
					args: [addr],
				});
				if (verified) {
					confirmed = true;
					break;
				}
			}
			if (!confirmed) throw new Error("Transaction submitted but on-chain confirmation timed out.");
			setFlowState("done");
		} catch (e: unknown) {
			setErrorMsg(e instanceof Error ? e.message : "Bypass failed");
			setFlowState("error");
		}
	};

	const handleDisconnect = () => {
		isDisconnecting.current = true;
		sdk?.disconnect();
		setFlowState("idle");
		setTxHash(null);
		setErrorMsg(null);
	};

	const handleRetry = () => {
		setErrorMsg(null);
		setWorldIdFailed(false);
		if (connected && account) {
			checkKYCStatus(account);
		} else {
			setFlowState("idle");
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center p-4">
			<div className="w-full max-w-lg">
				{/* Header */}
				<div className="text-center mb-8">
					<h1 className="font-serif text-3xl font-semibold text-foreground mb-2">Identity Verification</h1>
					<div className="flex items-center justify-center gap-2 text-dim text-xs font-serif">
						<span className="h-px w-8 bg-gold/20" />
						<span>Powered by World ID</span>
						<span className="h-px w-8 bg-gold/20" />
					</div>
				</div>

				<StepIndicator currentState={flowState} />

				{/* Main card */}
				<div className="frame-ornate p-8">
					{/* ── Idle / Connecting ── */}
					{(flowState === "idle" || flowState === "connecting") && (
						<div className="text-center">
							<IconBox>
								<svg aria-hidden="true" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
								</svg>
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Connect Your Wallet</h2>
							<p className="text-muted text-sm mb-8">
								Connect MetaMask to begin the KYC process. Your wallet address will be bound to your World ID proof.
							</p>
							<button
								type="button"
								onClick={handleConnect}
								disabled={flowState === "connecting"}
								className="btn-ornate w-full text-gold font-serif tracking-wider py-3 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								{flowState === "connecting" ? (
									<>
										<Spinner className="w-4 h-4" />
										Connecting...
									</>
								) : (
									"Connect Wallet"
								)}
							</button>
						</div>
					)}

					{/* ── Checking KYC ── */}
					{flowState === "checking_kyc" && (
						<div className="text-center">
							<IconBox>
								<Spinner className="w-10 h-10" />
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Checking KYC Status</h2>
							<p className="text-muted text-sm">Reading on-chain verification status...</p>
						</div>
					)}

					{/* ── Already Verified ── */}
					{flowState === "already_verified" && (
						<div className="text-center">
							<IconBox variant="green">
								<svg aria-hidden="true" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
								</svg>
							</IconBox>
							<span className="inline-flex items-center gap-2 text-xs font-serif tracking-wider px-3 py-1.5 border border-status-live/30 text-status-live mb-4">
								<span className="text-[8px]">&#9670;</span>
								KYC Verified
							</span>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Already Verified</h2>
							<p className="text-muted text-sm">
								Your address <span className="font-mono text-foreground">{account && truncateAddress(account)}</span> is already KYC verified on-chain.
							</p>
						</div>
					)}

					{/* ── Needs Verification / Verifying ── */}
					{(flowState === "needs_verification" || flowState === "verifying") && (
						<div className="text-center">
							<IconBox>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src="/fingerprint.svg" alt="" className="w-20 h-20 brightness-0 invert opacity-60" />
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Verify Your Identity</h2>
							<p className="text-muted text-sm mb-8">
								Use World ID to prove your unique humanity. Your wallet{" "}
								<span className="font-mono text-foreground">{account && truncateAddress(account)}</span> will be bound to the proof.
							</p>
							<IDKitWidget
								app_id={APP_ID}
								action={ACTION}
								verification_level={VerificationLevel.Device}
								handleVerify={handleVerify}
								onSuccess={() => {}}
							>
								{({ open }) => (
									<button
										type="button"
										onClick={() => {
											setFlowState("verifying");
											open();
										}}
										className="btn-ornate w-full text-gold font-serif tracking-wider py-3 cursor-pointer flex items-center justify-center gap-2"
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img src="/worldcoin.svg" alt="" className="w-5 h-5 invert brightness-[0.8] sepia saturate-[5] hue-rotate-[10deg]" />
										Verify with World ID
									</button>
								)}
							</IDKitWidget>
						</div>
					)}

					{/* ── Submitting ── */}
					{flowState === "submitting" && (
						<div className="text-center">
							<IconBox>
								<Spinner className="w-10 h-10" />
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Updating KYC On-Chain</h2>
							<p className="text-muted text-sm">Verifying your World ID proof and waiting for on-chain confirmation...</p>
						</div>
					)}

					{/* ── Bypassing ── */}
					{flowState === "bypassing" && (
						<div className="text-center">
							<IconBox variant="amber">
								<Spinner className="w-10 h-10" />
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Bypassing Verification</h2>
							<p className="text-gold/60 text-sm">Skipping World ID for testing. Waiting for on-chain confirmation...</p>
						</div>
					)}

					{/* ── Done ── */}
					{flowState === "done" && (
						<div className="text-center">
							<IconBox variant="green">
								<svg aria-hidden="true" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Verification Complete</h2>
							<p className="text-muted text-sm mb-6">
								Your wallet <span className="font-mono text-foreground">{account && truncateAddress(account)}</span> is now KYC verified on-chain.
							</p>
							{txHash && (
								<a
									href={`${EXPLORER_URL}/${txHash}`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 text-gold/60 hover:text-gold text-sm font-serif transition-colors"
								>
									<span className="text-gold/30 text-[8px]">&#9670;</span>
									View transaction on Sepolia
									<svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
								</a>
							)}
						</div>
					)}

					{/* ── Error ── */}
					{flowState === "error" && (
						<div className="text-center">
							<IconBox variant="red">
								<svg aria-hidden="true" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
								</svg>
							</IconBox>
							<h2 className="font-serif text-xl font-semibold text-foreground mb-2">Verification Failed</h2>
							{errorMsg && (
								<div className="border border-status-error/20 px-4 py-3 mb-4 text-left">
									<p className="text-status-error text-xs font-mono break-all">{errorMsg}</p>
								</div>
							)}
							<button
								type="button"
								onClick={handleRetry}
								className="btn-ornate w-full text-gold font-serif tracking-wider py-3 cursor-pointer mb-3"
							>
								Try Again
							</button>
							{worldIdFailed && (
								<button
									type="button"
									onClick={handleBypass}
									className="btn-ornate-ghost w-full text-gold/60 hover:text-gold font-serif tracking-wider py-3 cursor-pointer text-sm"
								>
									Skip World ID (Testing Only)
								</button>
							)}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-center gap-2 mt-6">
					<span className="h-px w-8 bg-gold/10" />
					<p className="text-dim text-xs font-serif tracking-wide">
						Secured by World ID
						<span className="text-gold/20 text-[6px] mx-2">&#9670;</span>
						Sepolia Testnet
					</p>
					<span className="h-px w-8 bg-gold/10" />
				</div>
			</div>
		</div>
	);
}
