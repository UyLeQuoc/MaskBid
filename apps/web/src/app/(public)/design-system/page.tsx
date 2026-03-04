import Link from "next/link";

/* ──────────────── Section wrapper ──────────────── */

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
	return (
		<section id={id} className="py-16 border-b border-gold/10 last:border-0">
			<div className="flex items-center gap-3 mb-10">
				<div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/20" />
				<h2 className="font-serif text-2xl text-foreground font-semibold tracking-wide">{title}</h2>
				<div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/20" />
			</div>
			{children}
		</section>
	);
}

/* ──────────────── Color swatch ──────────────── */

function Swatch({ name, bg, textColor = "text-foreground" }: { name: string; bg: string; textColor?: string }) {
	return (
		<div className="flex flex-col items-center gap-2">
			<div className={`w-16 h-16 border border-border ${bg}`} />
			<span className={`text-xs font-mono ${textColor}`}>{name}</span>
		</div>
	);
}

/* ──────────────── Page ──────────────── */

export default function DesignSystemPage() {
	return (
		<div className="min-h-screen pt-24 pb-20">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="text-center mb-16">
					<p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-4">MaskBid</p>
					<h1 className="font-serif text-5xl sm:text-6xl font-semibold mb-4">
						Design System
					</h1>
					<div className="flex items-center justify-center gap-3 text-dim text-sm font-serif">
						<span className="h-px w-12 bg-gold/20" />
						<span className="text-gold/30 text-[8px]">&#9670;</span>
						<span>Renaissance Auction Theme</span>
						<span className="text-gold/30 text-[8px]">&#9670;</span>
						<span className="h-px w-12 bg-gold/20" />
					</div>
				</div>

				{/* ─── Table of Contents ─── */}
				<nav className="frame-ornate p-6 mb-16">
					<h3 className="font-serif text-lg text-foreground mb-4 text-center">Contents</h3>
					<div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
						{[
							["Colors", "colors"],
							["Typography", "typography"],
							["Buttons", "buttons"],
							["Cards & Frames", "cards"],
							["Badges & Status", "badges"],
							["Effects", "effects"],
							["Dividers", "dividers"],
							["Animations", "animations"],
							["Form Elements", "forms"],
						].map(([label, id]) => (
							<Link
								key={id}
								href={`#${id}`}
								className="text-muted hover:text-gold text-sm font-serif transition-colors duration-200 cursor-pointer"
							>
								<span className="text-gold/30 text-[6px] mr-1">&#9670;</span>
								{label}
							</Link>
						))}
					</div>
				</nav>

				{/* ─── 1. Colors ─── */}
				<Section title="Colors" id="colors">
					{/* Backgrounds */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-4">Backgrounds</h3>
					<div className="flex flex-wrap gap-4 mb-8">
						<Swatch name="primary" bg="bg-background" />
						<Swatch name="surface" bg="bg-surface" />
						<Swatch name="elevated" bg="bg-elevated" />
						<Swatch name="secondary" bg="bg-[#111118]" />
					</div>

					{/* Gold Palette */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-4">Gold Accent</h3>
					<div className="flex flex-wrap gap-4 mb-8">
						<Swatch name="gold-light" bg="bg-gold-light" textColor="text-gold-light" />
						<Swatch name="gold" bg="bg-gold" textColor="text-gold" />
						<Swatch name="gold-dark" bg="bg-gold-dark" textColor="text-gold-dark" />
						<Swatch name="gold-muted" bg="bg-gold-muted" textColor="text-gold" />
					</div>

					{/* Status */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-4">Status</h3>
					<div className="flex flex-wrap gap-4 mb-8">
						<Swatch name="live" bg="bg-status-live" textColor="text-status-live" />
						<Swatch name="upcoming" bg="bg-status-upcoming" textColor="text-status-upcoming" />
						<Swatch name="ended" bg="bg-status-ended" textColor="text-status-ended" />
						<Swatch name="won" bg="bg-status-won" textColor="text-status-won" />
						<Swatch name="error" bg="bg-status-error" textColor="text-status-error" />
					</div>

					{/* Text */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-4">Text Hierarchy</h3>
					<div className="space-y-2">
						<p className="text-foreground text-base">Primary text — <span className="font-mono text-xs text-muted">text-foreground / #f5f0e8</span></p>
						<p className="text-muted text-base">Secondary text — <span className="font-mono text-xs text-muted">text-muted / #8a8a9a</span></p>
						<p className="text-dim text-base">Tertiary text — <span className="font-mono text-xs text-dim">text-dim / #55556a</span></p>
						<p className="text-gold text-base">Gold accent — <span className="font-mono text-xs text-muted">text-gold / #c9a84c</span></p>
					</div>
				</Section>

				{/* ─── 2. Typography ─── */}
				<Section title="Typography" id="typography">
					{/* Serif */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Playfair Display (Serif)</h3>
					<div className="space-y-4 mb-10">
						<p className="font-serif text-6xl font-semibold text-foreground">The Auction Awaits</p>
						<p className="font-serif text-4xl font-semibold text-foreground">Every Bid Wears a Mask</p>
						<p className="font-serif text-2xl font-semibold text-foreground">Sealed-bid auctions for the real world</p>
						<p className="font-serif text-lg text-foreground">The arena is open. Your bid is your secret.</p>
						<p className="font-serif text-base text-muted">Four steps. One winner. Complete privacy.</p>
					</div>

					{/* Sans */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Inter (Sans-serif)</h3>
					<div className="space-y-3 mb-10">
						<p className="text-base text-foreground">Default body text uses Inter for readability.</p>
						<p className="text-sm text-muted">Secondary information at smaller sizes.</p>
						<p className="text-xs text-dim">Footnotes and metadata in tertiary color.</p>
					</div>

					{/* Mono */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">JetBrains Mono</h3>
					<div className="space-y-3">
						<p className="font-mono text-sm text-foreground">0x1a2B...3c4D</p>
						<p className="font-mono text-sm text-gold">$2,000 USDC</p>
						<p className="font-mono text-xs text-muted">02h 14m 37s remaining</p>
					</div>

					{/* Gold gradient */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mt-10 mb-6">Special: Gold Gradient Text</h3>
					<p className="font-serif text-4xl font-semibold text-gradient-gold">Every Bid Wears a Mask</p>
				</Section>

				{/* ─── 3. Buttons ─── */}
				<Section title="Buttons" id="buttons">
					{/* Primary */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Primary — btn-ornate</h3>
					<div className="flex flex-wrap gap-6 mb-10">
						<button type="button" className="btn-ornate text-gold font-serif tracking-wider px-10 py-3 text-base cursor-pointer">
							Explore Auctions
						</button>
						<button type="button" className="btn-ornate text-gold font-serif tracking-wider px-8 py-2 text-sm cursor-pointer">
							Enter the Hall
						</button>
						<button type="button" className="btn-ornate text-gold font-serif tracking-wider px-14 py-4 text-lg cursor-pointer">
							Enter the Arena
						</button>
					</div>

					{/* Ghost */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Ghost — btn-ornate-ghost</h3>
					<div className="flex flex-wrap gap-6 mb-10">
						<button type="button" className="btn-ornate-ghost text-muted hover:text-foreground font-serif tracking-wider px-10 py-3 text-base cursor-pointer">
							Learn More
						</button>
						<button type="button" className="btn-ornate-ghost text-muted hover:text-foreground font-serif tracking-wider px-8 py-2 text-sm cursor-pointer">
							Cancel
						</button>
					</div>

					{/* Text link */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Text Link</h3>
					<div className="flex flex-wrap gap-6">
						<span className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-300 cursor-pointer">
							<span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
							View all auctions
							<span className="text-gold/30 text-[8px] ml-1">&#9670;</span>
						</span>
					</div>
				</Section>

				{/* ─── 4. Cards & Frames ─── */}
				<Section title="Cards &amp; Frames" id="cards">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
						{/* frame-ornate */}
						<div className="frame-ornate p-6 group cursor-default">
							<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-2">frame-ornate</h3>
							<div className="flex items-center gap-2 mb-3" aria-hidden="true">
								<div className="flex-1 h-px bg-gold/10" />
								<span className="text-gold/20 text-[6px]">&#9670;</span>
								<div className="flex-1 h-px bg-gold/10" />
							</div>
							<p className="text-muted text-sm leading-relaxed">
								Scallop-cornered frame using SVG border-image. 12px border with curved corner cutouts. Hover to see the glow intensify.
							</p>
						</div>

						{/* frame-ornate-dark */}
						<div className="frame-ornate-dark p-6 group cursor-default">
							<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-2">frame-ornate-dark</h3>
							<div className="flex items-center gap-2 mb-3" aria-hidden="true">
								<div className="flex-1 h-px bg-gold/10" />
								<span className="text-gold/20 text-[6px]">&#9670;</span>
								<div className="flex-1 h-px bg-gold/10" />
							</div>
							<p className="text-muted text-sm leading-relaxed">
								Darker fill variant for sections with lighter backgrounds. Same scallop corners.
							</p>
						</div>

						{/* glass-card */}
						<div className="glass-card p-6 group cursor-default">
							<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-2">glass-card</h3>
							<div className="flex items-center gap-2 mb-3" aria-hidden="true">
								<div className="flex-1 h-px bg-gold/10" />
								<span className="text-gold/20 text-[6px]">&#9670;</span>
								<div className="flex-1 h-px bg-gold/10" />
							</div>
							<p className="text-muted text-sm leading-relaxed">
								Frosted glass effect with backdrop blur. Subtle border for floating panels.
							</p>
						</div>
					</div>

					{/* card-hover */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Hover Card</h3>
					<div className="max-w-sm">
						<div className="card-hover border border-border p-6 cursor-pointer">
							<h3 className="font-serif text-foreground font-semibold mb-2">card-hover</h3>
							<p className="text-muted text-sm">Hover to see the gold border glow and subtle lift effect.</p>
						</div>
					</div>
				</Section>

				{/* ─── 5. Badges & Status ─── */}
				<Section title="Badges &amp; Status" id="badges">
					{/* Status badges */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Auction Status</h3>
					<div className="flex flex-wrap gap-4 mb-10">
						{[
							{ label: "Live", color: "status-live" },
							{ label: "Upcoming", color: "status-upcoming" },
							{ label: "Ended", color: "status-ended" },
							{ label: "Won", color: "status-won" },
							{ label: "Error", color: "status-error" },
						].map((s) => (
							<span
								key={s.label}
								className={`inline-flex items-center gap-2 text-xs font-serif tracking-wider px-3 py-1.5 border border-${s.color}/30 text-${s.color}`}
							>
								<span className="text-[8px]">&#9670;</span>
								{s.label}
							</span>
						))}
					</div>

					{/* KYC badges */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">KYC Verification</h3>
					<div className="flex flex-wrap gap-4 mb-10">
						<span className="inline-flex items-center gap-2 text-xs font-serif tracking-wider px-4 h-9 border border-status-live/30 text-status-live">
							<span className="text-[8px]">&#9670;</span>
							Verified
						</span>
						<span className="inline-flex items-center gap-2 text-xs font-serif tracking-wider px-4 h-9 border border-gold/20 text-gold/70">
							<span className="text-[8px]">&#9670;</span>
							Unverified
						</span>
					</div>

					{/* Tech pills */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Tech Stack Pills</h3>
					<div className="flex flex-wrap gap-3">
						{["Chainlink", "World ID", "Ethereum", "Tenderly", "Supabase"].map((tech) => (
							<span
								key={tech}
								className="inline-flex items-center gap-2 text-xs font-serif tracking-wider text-dim px-3 py-1.5 border border-gold/10"
							>
								<span className="text-gold/25 text-[6px]">&#9670;</span>
								{tech}
							</span>
						))}
					</div>
				</Section>

				{/* ─── 6. Effects ─── */}
				<Section title="Effects" id="effects">
					{/* Sealed text */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Sealed / Masked Text</h3>
					<div className="flex gap-8 mb-10">
						<div>
							<p className="text-sealed text-2xl font-mono text-gold mb-2">$12,500.00</p>
							<p className="text-xs text-dim">text-sealed — blur increases on hover</p>
						</div>
						<div>
							<p className="text-2xl font-mono text-gold mb-2">$12,500.00</p>
							<p className="text-xs text-dim">Revealed (normal)</p>
						</div>
					</div>

					{/* Gold gradient text */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Gradient Gold Text</h3>
					<p className="text-gradient-gold font-serif text-3xl font-semibold mb-2">text-gradient-gold</p>
					<p className="text-xs text-dim">Linear gradient from gold-light through gold to gold-dark at 135deg.</p>

					{/* Noise grain */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mt-10 mb-6">Noise Grain Overlay</h3>
					<p className="text-muted text-sm">A fixed SVG feTurbulence texture at 3.5% opacity covers the entire page via <code className="font-mono text-gold/60">body::before</code>. Adds an aged canvas feel.</p>
				</Section>

				{/* ─── 7. Dividers ─── */}
				<Section title="Dividers" id="dividers">
					{/* Diamond divider */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Diamond Line</h3>
					<div className="flex items-center gap-2 mb-10" aria-hidden="true">
						<div className="flex-1 h-px bg-gold/10" />
						<span className="text-gold/20 text-[6px]">&#9670;</span>
						<div className="flex-1 h-px bg-gold/10" />
					</div>

					{/* Gold gradient line */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Gold Gradient Line</h3>
					<div className="h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent mb-10" />

					{/* Nav ornaments */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Nav-style Ornament</h3>
					<div className="flex items-center justify-center gap-1 mb-10">
						<span className="text-gold/20 mr-2 text-xs tracking-widest select-none">&#9472;&#9472;</span>
						<span className="text-muted text-sm font-serif">Item One</span>
						<span className="text-gold/30 text-[8px] mx-1">&#9670;</span>
						<span className="text-muted text-sm font-serif">Item Two</span>
						<span className="text-gold/30 text-[8px] mx-1">&#9670;</span>
						<span className="text-muted text-sm font-serif">Item Three</span>
						<span className="text-gold/20 ml-2 text-xs tracking-widest select-none">&#9472;&#9472;</span>
					</div>

					{/* Classical text separator */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mb-6">Classical Text Separator</h3>
					<div className="flex items-center justify-center gap-3 text-dim text-sm font-serif">
						<span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/20" />
						<span className="text-gold/30 text-[8px]">&#9670;</span>
						<span>Sealed</span>
						<span className="text-gold/30 text-[8px]">&#9670;</span>
						<span>Verified</span>
						<span className="text-gold/30 text-[8px]">&#9670;</span>
						<span>Confidential</span>
						<span className="text-gold/30 text-[8px]">&#9670;</span>
						<span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/20" />
					</div>

					{/* Pillar divider */}
					<h3 className="font-serif text-sm text-muted uppercase tracking-wider mt-10 mb-6">Pillar Divider</h3>
					<div className="flex items-center gap-1 my-4" aria-hidden="true">
						<div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/20" />
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src="/pillar.png" alt="" className="h-20 w-auto opacity-30" />
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src="/pillar.png" alt="" className="h-20 w-auto opacity-30" />
						<div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/20" />
					</div>
				</Section>

				{/* ─── 8. Animations ─── */}
				<Section title="Animations" id="animations">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
						{/* Fade in up */}
						<div className="frame-ornate p-6 text-center">
							<div className="animate-fade-in-up">
								<span className="font-serif text-gold text-lg">fade-in-up</span>
							</div>
							<p className="text-xs text-dim mt-2">0.6s ease-out</p>
						</div>

						{/* Shimmer */}
						<div className="frame-ornate p-6 text-center">
							<div className="animate-shimmer">
								<span className="font-serif text-gold text-lg">shimmer</span>
							</div>
							<p className="text-xs text-dim mt-2">2.5s ease-in-out infinite</p>
						</div>

						{/* Pulse gold */}
						<div className="frame-ornate p-6 text-center">
							<div className="animate-pulse-gold inline-block px-4 py-2 border border-gold/30">
								<span className="font-serif text-gold text-lg">pulse-gold</span>
							</div>
							<p className="text-xs text-dim mt-2">2s ease-in-out infinite</p>
						</div>

						{/* Float */}
						<div className="frame-ornate p-6 text-center">
							<div className="animate-float inline-block">
								<span className="font-serif text-gold text-lg">float</span>
							</div>
							<p className="text-xs text-dim mt-2">6s ease-in-out infinite</p>
						</div>
					</div>
				</Section>

				{/* ─── 9. Form Elements ─── */}
				<Section title="Form Elements" id="forms">
					<div className="max-w-md space-y-6">
						{/* Input */}
						<div>
							<label className="block text-sm font-serif text-muted mb-2 tracking-wide">Bid Amount</label>
							<input
								type="text"
								placeholder="0.00 USDC"
								className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim"
							/>
						</div>

						{/* Textarea */}
						<div>
							<label className="block text-sm font-serif text-muted mb-2 tracking-wide">Description</label>
							<textarea
								rows={3}
								placeholder="Describe the asset..."
								className="w-full bg-surface border border-border text-foreground text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim resize-none"
							/>
						</div>

						{/* Select-like */}
						<div>
							<label className="block text-sm font-serif text-muted mb-2 tracking-wide">Asset Type</label>
							<select className="w-full bg-surface border border-border text-foreground text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 appearance-none cursor-pointer">
								<option>Luxury Watch</option>
								<option>Fine Art</option>
								<option>Gold</option>
								<option>Real Estate</option>
							</select>
						</div>

						{/* Wallet address display */}
						<div>
							<label className="block text-sm font-serif text-muted mb-2 tracking-wide">Wallet Address</label>
							<div className="flex items-center gap-2 border border-gold/20 px-4 py-3">
								<span className="w-1.5 h-1.5 bg-status-live" />
								<span className="font-mono text-sm text-foreground">0x1a2B...3c4D</span>
							</div>
						</div>
					</div>
				</Section>

				{/* ─── CSS Class Reference ─── */}
				<Section title="CSS Class Reference" id="reference">
					<div className="overflow-x-auto">
						<table className="w-full text-sm text-left">
							<thead>
								<tr className="border-b border-gold/10">
									<th className="font-serif text-foreground py-3 pr-6">Class</th>
									<th className="font-serif text-foreground py-3 pr-6">Description</th>
									<th className="font-serif text-foreground py-3">Usage</th>
								</tr>
							</thead>
							<tbody className="text-muted">
								{[
									[".frame-ornate", "Scallop-cornered frame, 12px border", "Cards, panels"],
									[".frame-ornate-dark", "Dark fill variant of frame-ornate", "Cards on lighter bg"],
									[".btn-ornate", "Scallop button, 8px border, gold glow hover", "Primary CTA"],
									[".btn-ornate-ghost", "Subtle scallop button", "Secondary actions"],
									[".glass-card", "Frosted glass with backdrop blur", "Floating panels"],
									[".card-hover", "Gold border glow + lift on hover", "Interactive cards"],
									[".text-gradient-gold", "Gold gradient text fill", "Hero headings"],
									[".text-sealed", "Blur effect for hidden values", "Bid amounts"],
								].map(([cls, desc, use]) => (
									<tr key={cls} className="border-b border-border">
										<td className="font-mono text-gold/70 py-3 pr-6">{cls}</td>
										<td className="py-3 pr-6">{desc}</td>
										<td className="py-3">{use}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Section>
			</div>
		</div>
	);
}
