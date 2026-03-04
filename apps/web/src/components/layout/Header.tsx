"use client";
import { useSDK } from "@metamask/sdk-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { env } from "@/configs/env";

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

function truncateAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Header() {
	const { sdk, connected, account } = useSDK();
	const [kycVerified, setKycVerified] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const prevAccount = useRef<string | null>(null);

	useEffect(() => {
		const handleScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const checkKYC = useCallback(async (address: string) => {
		try {
			const publicClient = createPublicClient({
				chain: sepolia,
				transport: http(RPC_URL),
			});
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

	const handleConnect = async () => {
		try {
			await sdk?.connect();
		} catch {
			// ignore
		}
	};

	const handleDisconnect = () => {
		sdk?.disconnect();
		setKycVerified(false);
	};

	/* Diamond separator between nav items */
	const NavDiamond = () => (
		<span className="text-gold/30 text-[8px] select-none">&#9670;</span>
	);

	const navLinks = [
		{ href: "/auctions", label: "Auctions", requiresKyc: false },
		{ href: "/#how-it-works", label: "The Ritual", requiresKyc: false },
		{ href: "/dashboard", label: "Dashboard", requiresKyc: true },
		{ href: "/my-assets", label: "My Assets", requiresKyc: true },
		{ href: "/my-bids", label: "My Bids", requiresKyc: true },
	];

	const visibleLinks = navLinks.filter(
		(link) => !link.requiresKyc || kycVerified,
	);

	return (
		<header
			className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
				scrolled
					? "bg-[#08080c]/90 backdrop-blur-xl border-b border-gold/10"
					: "bg-transparent"
			}`}
		>
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-clip">
				<div className="relative flex items-center justify-between h-18">
					{/* Logo */}
					<Link
						href="/"
						className="group flex items-center gap-2 cursor-pointer"
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src="/logo.svg"
							alt="MaskBid"
							className="h-8 w-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
						/>
						<div className="flex items-baseline">
							<span className="font-serif text-xl font-semibold text-gold">
								Mask
							</span>
							<span className="font-serif text-xl font-semibold text-foreground">
								Bid
							</span>
						</div>
					</Link>

					{/* Center Nav — absolutely centered */}
					<nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
						{/* Left ornament */}
						<span className="text-gold/20 mr-2 text-xs tracking-widest select-none">
							&#9472;&#9472;
						</span>
						{visibleLinks.map((link, i) => (
							<div key={link.href} className="flex items-center gap-1">
								{i > 0 && <NavDiamond />}
								<Link
									href={link.href}
									className="text-muted hover:text-gold text-sm font-serif tracking-wide transition-colors duration-300 px-2 py-1 cursor-pointer"
								>
									{link.label}
								</Link>
							</div>
						))}
						{/* Right ornament */}
						<span className="text-gold/20 ml-2 text-xs tracking-widest select-none">
							&#9472;&#9472;
						</span>
					</nav>

					{/* Right side */}
					<div className="flex items-center gap-3">
						{connected && account ? (
							<>
								{/* KYC badge — matched height with wallet */}
								<span
									className={`hidden sm:inline-flex items-center justify-center gap-2 text-xs font-serif tracking-wider px-4 h-9 border ${
										kycVerified
											? "border-status-live/30 text-status-live"
											: "border-gold/20 text-gold/70"
									}`}
								>
									<span className="text-[8px]">&#9670;</span>
									{kycVerified ? "Verified" : "Unverified"}
								</span>

								{/* Wallet address */}
								<div className="relative min-w-[150px]">
									<button
										type="button"
										onClick={() => setMenuOpen((o) => !o)}
										className="flex items-center justify-center gap-2 border border-gold/20 hover:border-gold/40 w-full px-4 h-9 text-foreground text-sm font-mono transition-all duration-300 cursor-pointer"
									>
										<span
											className={`w-1.5 h-1.5 ${
												kycVerified ? "bg-status-live" : "bg-gold"
											}`}
										/>
										{truncateAddress(account)}
									</button>
									{menuOpen && (
										<div className="absolute right-0 mt-1 w-full bg-[#0a0a10] border border-gold/20 shadow-2xl shadow-black/50">
											{!kycVerified && (
												<Link
													href="/dashboard"
													onClick={() => setMenuOpen(false)}
													className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-serif text-gold hover:bg-gold/5 transition-colors duration-200 cursor-pointer border-b border-gold/10"
												>
													<span className="text-[8px]">&#9670;</span>
													Complete KYC
												</Link>
											)}
											{kycVerified && (
												<div className="flex items-center gap-2.5 px-4 py-3 text-sm font-serif text-status-live border-b border-gold/10">
													<span className="text-[8px]">&#9670;</span>
													KYC Verified
												</div>
											)}
											<button
												type="button"
												onClick={() => {
													handleDisconnect();
													setMenuOpen(false);
												}}
												className="w-full text-left px-4 py-3 text-sm font-serif text-muted hover:text-foreground hover:bg-gold/5 transition-colors duration-200 cursor-pointer"
											>
												Disconnect
											</button>
										</div>
									)}
								</div>
							</>
						) : (
							<button
								type="button"
								onClick={handleConnect}
								className="btn-ornate text-gold text-sm font-serif tracking-wider px-6 py-1.5 cursor-pointer"
							>
								Enter the Hall
							</button>
						)}

						{/* Mobile menu toggle */}
						<button
							type="button"
							onClick={() => setMenuOpen((o) => !o)}
							className="md:hidden text-muted hover:text-gold transition-colors duration-200 cursor-pointer p-1"
							aria-label="Menu"
						>
							<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<path d="M4 8h16M4 16h16" strokeLinecap="round" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			{/* Mobile nav drawer */}
			{menuOpen && (
				<div className="md:hidden border-t border-gold/10 bg-[#08080c]/95 backdrop-blur-xl">
					<nav className="max-w-7xl mx-auto px-4 py-4 space-y-1">
						{visibleLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								onClick={() => setMenuOpen(false)}
								className="block text-muted hover:text-gold text-sm font-serif tracking-wide transition-colors duration-200 px-3 py-2.5 border-b border-gold/5 last:border-0 cursor-pointer"
							>
								<span className="text-gold/30 text-[8px] mr-2">&#9670;</span>
								{link.label}
							</Link>
						))}
					</nav>
				</div>
			)}
		</header>
	);
}
