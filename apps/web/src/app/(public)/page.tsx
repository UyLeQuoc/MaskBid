import Link from "next/link";
import { LogoMarquee } from "@/components/LogoMarquee";

/* ──────────────────────────── Data ──────────────────────────── */

const FEATURED_AUCTIONS = [
	{
		id: "1",
		name: "Rolex Submariner 2023",
		type: "Luxury Watch",
		reservePrice: "2,000",
		endTime: "02h 14m 37s",
		bidCount: 7,
		image: "/rolex.png",
	},
	{
		id: "2",
		name: "Oil Painting — Coastal Sunrise",
		type: "Fine Art",
		reservePrice: "500",
		endTime: "05h 42m 11s",
		bidCount: 3,
		image: "/oil-painting.png",
	},
	{
		id: "3",
		name: "1kg Gold Bar (LBMA)",
		type: "Gold",
		reservePrice: "16,000",
		endTime: "11h 00m 22s",
		bidCount: 12,
		image: "/goldbar.png",
	},
];

const STEPS = [
	{
		num: "I",
		title: "Verify Identity",
		desc: "Prove you are human with World ID. One person, one verified identity. No bots.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
				<path d="m9 12 2 2 4-4" />
			</svg>
		),
	},
	{
		num: "II",
		title: "Discover Assets",
		desc: "Browse tokenized real world assets — watches, art, gold, real estate — all verified on-chain.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
		),
	},
	{
		num: "III",
		title: "Place Sealed Bid",
		desc: "Your bid is RSA-encrypted client-side. Not even we can see it. Deposit USDC as commitment.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		),
	},
	{
		num: "IV",
		title: "The Reveal",
		desc: "Chainlink's secure enclave decrypts all bids simultaneously. Highest bidder wins. Losers refunded.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
			</svg>
		),
	},
];

const FEATURES = [
	{
		title: "Confidential Bids",
		desc: "Traditional auctions let bidders see and react to each other. MaskBid encrypts every bid with RSA encryption. Only Chainlink's secure enclave can decrypt them — all at once, at the moment of resolution. No front-running. No bid manipulation.",
		icon: (
			<svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		),
	},
	{
		title: "Real World Assets, On-Chain",
		desc: "Luxury watches. Fine art. Gold reserves. Real estate. Each asset is verified, tokenized as ERC-1155, and custodied on-chain. Full provenance. Full transparency. Fractional ownership enabled.",
		icon: (
			<svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
				<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
			</svg>
		),
	},
	{
		title: "Proof of Personhood",
		desc: "Every bidder is verified through World ID's zero-knowledge proof system. One human, one identity. No sybil attacks. No bot farms. Fair auctions for real people.",
		icon: (
			<svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		),
	},
];

const ROLES = [
	{
		role: "The Seller",
		desc: "List your verified real world asset for auction. Set your reserve price. Let the market decide.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M12 2L2 7l10 5 10-5-10-5z" />
				<path d="M2 17l10 5 10-5" />
				<path d="M2 12l10 5 10-5" />
			</svg>
		),
	},
	{
		role: "The Bidder",
		desc: "Browse assets. Place encrypted bids. Your strategy stays hidden until the final reveal.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		),
	},
	{
		role: "The Verifier",
		desc: "Inspect and verify real world assets. Ensure authenticity before tokenization.",
		icon: (
			<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
				<path d="m11 8v6" />
				<path d="M8 11h6" />
			</svg>
		),
	},
];

const STATS = [
	{ value: "12+", label: "Assets Tokenized" },
	{ value: "$2.4M+", label: "Total Value Locked" },
	{ value: "100%", label: "Bid Privacy" },
	{ value: "0", label: "Data Breaches" },
];

/* ──────────────────── Divider ──────────────────── */

/* eslint-disable @next/next/no-img-element */
function SectionDivider() {
	return (
		<div className="flex items-center justify-center py-6" aria-hidden="true">
			<div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/20" />
			<div className="flex items-center gap-1 mx-6">
				<img
					src="/pillar.png"
					alt=""
					className="h-28 w-auto brightness-0 invert opacity-[0.12]"
				/>
				<img
					src="/pillar.png"
					alt=""
					className="h-28 w-auto brightness-0 invert opacity-[0.12]"
				/>
			</div>
			<div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/20" />
		</div>
	);
}

/* ──────────────────────────── Page ──────────────────────────── */

export default function LandingPage() {
	return (
		<div className="bg-background text-foreground">
			{/* ─── Hero ─── */}
			<section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
				{/* Background glow */}
				<div className="absolute inset-0 pointer-events-none" aria-hidden="true">
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/[0.03] rounded-full blur-[120px]" />
					<div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-gold/[0.02] rounded-full blur-[80px]" />
				</div>

				{/* Mask watermark */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src="/hero-mask.png"
					alt=""
					aria-hidden="true"
					className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] max-w-none pointer-events-none brightness-0 invert opacity-[0.04] animate-float"
				/>

				<div className="relative max-w-4xl mx-auto text-center pt-16">
					<div className="inline-flex items-center gap-4 text-gold/70 text-xs font-serif tracking-[0.3em] uppercase mb-8">
						<span className="w-8 h-px bg-gold/30" aria-hidden="true" />
						Sealed <span className="text-gold/30">&#9670;</span> Verified <span className="text-gold/30">&#9670;</span> Confidential
						<span className="w-8 h-px bg-gold/30" aria-hidden="true" />
					</div>

					<h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-semibold mb-6 leading-[1.1] tracking-tight">
						Every Bid Wears
						<br />
						<span className="text-gradient-gold">a Mask</span>
					</h1>

					<p className="text-lg sm:text-xl text-muted mb-10 max-w-xl mx-auto leading-relaxed">
						Sealed-bid auctions for real world assets.
						<br />
						No one sees. No one knows. Until the reveal.
					</p>

					<div className="flex flex-col sm:flex-row gap-6 justify-center">
						<Link
							href="/auctions"
							className="btn-ornate inline-flex items-center justify-center text-gold font-serif tracking-wider px-10 py-3 text-base cursor-pointer"
						>
							Explore Auctions
						</Link>
						<Link
							href="/#how-it-works"
							className="btn-ornate-ghost inline-flex items-center justify-center text-muted hover:text-foreground font-serif tracking-wider px-10 py-3 text-base cursor-pointer"
						>
							Learn More
						</Link>
					</div>

					{/* Scroll indicator */}
					<div className="mt-20 flex flex-col items-center gap-2" aria-hidden="true">
						<span className="text-gold/30 text-xs font-serif tracking-[0.2em] uppercase">Scroll</span>
						<div className="flex flex-col items-center gap-1">
							<span className="text-gold/30">&#9670;</span>
							<div className="w-px h-10 bg-gradient-to-b from-gold/30 to-transparent" />
						</div>
					</div>
				</div>
			</section>

			{/* ─── Tech Marquee ─── */}
			<LogoMarquee />

			{/* ─── Featured Auctions ─── */}
			<section className="py-24 px-4">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-14">
						<h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-3">Live Auctions</h2>
						<p className="text-muted text-sm">Place your sealed bid before the mask comes off.</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{FEATURED_AUCTIONS.map((auction) => (
							<div
								key={auction.id}
								className="frame-ornate cursor-pointer group p-6"
							>
								<div>
									{/* Lot number + status */}
									<div className="flex items-center justify-between mb-5">
										<span className="font-serif text-gold/50 text-xs tracking-[0.2em] uppercase">Lot {auction.id}</span>
										<span className="flex items-center gap-1.5 text-xs text-status-live font-serif tracking-wider uppercase">
											<span className="w-1.5 h-1.5 bg-status-live rounded-full animate-pulse" />
											Live
										</span>
									</div>

									{/* Image */}
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<div className="h-44 mb-5 overflow-hidden">
										<img
											src={auction.image}
											alt={auction.name}
											className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
										/>
									</div>

									{/* Title */}
									<h3 className="font-serif text-foreground text-lg font-medium mb-1 leading-snug group-hover:text-gold-light transition-colors duration-300">{auction.name}</h3>
									<p className="text-dim text-xs font-serif tracking-wider uppercase mb-5">{auction.type}</p>

									{/* Gold divider */}
									<div className="flex items-center gap-3 mb-5" aria-hidden="true">
										<div className="flex-1 h-px bg-gold/15" />
										<span className="text-gold/30 text-[8px]">&#9670;</span>
										<div className="flex-1 h-px bg-gold/15" />
									</div>

									{/* Price + Timer */}
									<div className="flex items-baseline justify-between mb-5">
										<div>
											<p className="text-dim text-[10px] font-serif tracking-[0.15em] uppercase mb-1">Reserve Price</p>
											<p className="font-mono text-foreground text-sm">{auction.reservePrice} <span className="text-dim">USDC</span></p>
										</div>
										<div className="text-right">
											<p className="text-dim text-[10px] font-serif tracking-[0.15em] uppercase mb-1">Closes In</p>
											<p className="font-mono text-gold text-sm">{auction.endTime}</p>
										</div>
									</div>

									{/* Sealed bids */}
									<div className="flex items-center justify-between pt-4 border-t border-border/50">
										<div className="flex items-center gap-2 text-xs text-dim">
											<svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
												<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
												<path d="M7 11V7a5 5 0 0 1 10 0v4" />
											</svg>
											<span className="text-sealed">&#9679;&#9679;&#9679;</span>
											<span className="font-serif tracking-wide">{auction.bidCount} sealed</span>
										</div>
										<span className="text-gold/60 text-xs font-serif tracking-wider uppercase group-hover:text-gold transition-colors duration-300">View &rarr;</span>
									</div>
								</div>
							</div>
						))}
					</div>

					<div className="text-center mt-12">
						<Link
							href="/auctions"
							className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-300 cursor-pointer"
						>
							<span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
							View all auctions
							<span className="text-gold/30 text-[8px] ml-1">&#9670;</span>
						</Link>
					</div>
				</div>
			</section>

			<SectionDivider />

			{/* ─── How It Works ─── */}
			<section id="how-it-works" className="py-24 px-4">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-16">
						<h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-3">The Ritual</h2>
						<p className="text-muted text-sm">Four steps. One winner. Complete privacy.</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
						{STEPS.map((step, i) => (
							<div key={step.num} className="relative">
								{/* Connector line */}
								{i < STEPS.length - 1 && (
									<div className="hidden lg:block absolute top-12 left-[calc(100%+0.5rem)] w-[calc(100%-2rem)] h-px bg-gradient-to-r from-gold/20 to-transparent" aria-hidden="true" />
								)}
								<div className="frame-ornate h-full p-6 group cursor-default">
									<div className="text-center mb-4">
										<span className="font-serif text-3xl text-gold/40 font-semibold">{step.num}</span>
									</div>
									<div className="flex justify-center mb-4">
										<div className="w-10 h-10 flex items-center justify-center text-gold">
											{step.icon}
										</div>
									</div>
									{/* Divider */}
									<div className="flex items-center gap-2 mb-4" aria-hidden="true">
										<div className="flex-1 h-px bg-gold/10" />
										<span className="text-gold/20 text-[6px]">&#9670;</span>
										<div className="flex-1 h-px bg-gold/10" />
									</div>
									<h3 className="font-serif text-foreground font-semibold text-base mb-2 text-center">{step.title}</h3>
									<p className="text-muted text-sm leading-relaxed text-center">{step.desc}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			<SectionDivider />

			{/* ─── Why MaskBid ─── */}
			<section className="py-24 px-4">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-16">
						<h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-3">Why the Mask Matters</h2>
						<p className="text-muted text-sm">We solved the three biggest problems in RWA auctions.</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{FEATURES.map((feature) => (
							<div
								key={feature.title}
								className="frame-ornate p-8 group cursor-default"
							>
								<div className="flex justify-center mb-5">
									<div className="w-14 h-14 flex items-center justify-center text-gold">
										{feature.icon}
									</div>
								</div>
								{/* Divider */}
								<div className="flex items-center gap-2 mb-5" aria-hidden="true">
									<div className="flex-1 h-px bg-gold/10" />
									<span className="text-gold/20 text-[6px]">&#9670;</span>
									<div className="flex-1 h-px bg-gold/10" />
								</div>
								<h3 className="font-serif text-foreground font-semibold text-xl mb-3 text-center">{feature.title}</h3>
								<p className="text-muted text-sm leading-relaxed text-center">{feature.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<SectionDivider />

			{/* ─── Three Roles ─── */}
			<section className="py-24 px-4">
				<div className="max-w-6xl mx-auto">
					<div className="text-center mb-16">
						<h2 className="font-serif text-3xl sm:text-4xl font-semibold mb-3">The Players</h2>
						<p className="text-muted text-sm">Everyone has a clear, enforceable role on MaskBid.</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{ROLES.map((item) => (
							<div
								key={item.role}
								className="frame-ornate p-8 text-center group cursor-default"
							>
								<div className="flex justify-center mb-5">
									<div className="w-14 h-14 flex items-center justify-center text-gold">
										{item.icon}
									</div>
								</div>
								{/* Divider */}
								<div className="flex items-center gap-2 mb-5" aria-hidden="true">
									<div className="flex-1 h-px bg-gold/10" />
									<span className="text-gold/20 text-[6px]">&#9670;</span>
									<div className="flex-1 h-px bg-gold/10" />
								</div>
								<h3 className="font-serif text-foreground font-semibold text-xl mb-3">{item.role}</h3>
								<p className="text-muted text-sm leading-relaxed">{item.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ─── Stats + CTA (merged so glow flows freely) ─── */}
			<section className="relative py-28 px-4">
				{/* Background glow — oversized so it bleeds into adjacent sections */}
				<div className="absolute -inset-32 pointer-events-none" aria-hidden="true">
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/[0.04] rounded-full blur-[150px]" />
				</div>

				{/* Stats */}
				<div className="relative max-w-5xl mx-auto mb-20">
					<div className="grid grid-cols-2 md:grid-cols-4 gap-8">
						{STATS.map((stat) => (
							<div key={stat.label} className="text-center">
								<p className="font-mono text-3xl sm:text-4xl font-semibold text-gold mb-2">{stat.value}</p>
								<p className="text-dim text-xs uppercase tracking-wider">{stat.label}</p>
							</div>
						))}
					</div>
				</div>

				<div className="relative max-w-3xl mx-auto text-center">
					<h2 className="font-serif text-4xl sm:text-5xl font-semibold mb-4">The Auction Awaits</h2>
					<p className="text-muted text-base mb-3">
						Connect your wallet. Verify your identity. Place your sealed bid.
					</p>
					<p className="text-dim text-sm mb-10">
						The arena is open. Your bid is your secret.
					</p>
					<Link
						href="/dashboard"
						className="btn-ornate inline-flex items-center justify-center text-gold font-serif tracking-wider px-14 py-4 text-lg cursor-pointer"
					>
						Enter the Arena
					</Link>
					<p className="text-dim text-xs mt-8">
						Built for Chainlink Convergence Hackathon 2026
					</p>
				</div>
			</section>
		</div>
	);
}
