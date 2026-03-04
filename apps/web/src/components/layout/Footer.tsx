import Link from "next/link";

export function Footer() {
	return (
		<footer className="bg-[#08080c] text-muted">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
					{/* Col 1: Logo + tagline */}
					<div>
						<div className="font-serif text-xl font-semibold mb-3">
							<span className="text-gold">Mask</span>
							<span className="text-foreground">Bid</span>
						</div>
						<p className="text-sm leading-relaxed text-muted max-w-xs">
							Sealed-bid auctions for the real world. Every bid
							wears a mask.
						</p>
					</div>

					{/* Col 2: Links */}
					<div>
						<h3 className="text-foreground text-sm font-medium mb-4 tracking-wide uppercase">
							Explore
						</h3>
						<ul className="space-y-3 text-sm">
							<li>
								<Link
									href="/auctions"
									className="hover:text-foreground transition-colors duration-200 cursor-pointer"
								>
									Auctions
								</Link>
							</li>
							<li>
								<Link
									href="/#how-it-works"
									className="hover:text-foreground transition-colors duration-200 cursor-pointer"
								>
									How It Works
								</Link>
							</li>
							<li>
								<Link
									href="/dashboard"
									className="hover:text-foreground transition-colors duration-200 cursor-pointer"
								>
									Dashboard
								</Link>
							</li>
						</ul>
					</div>

					{/* Col 3: Tech stack */}
					<div>
						<h3 className="text-foreground text-sm font-medium mb-4 tracking-wide uppercase">
							Powered By
						</h3>
						<div className="flex flex-wrap gap-3">
							{["Chainlink", "World ID", "Ethereum"].map(
								(tech) => (
									<span
										key={tech}
										className="inline-flex items-center gap-2 text-xs font-serif tracking-wider text-dim px-3 py-1.5 border border-gold/10"
									>
										<span className="text-gold/25 text-[6px]">&#9670;</span>
										{tech}
									</span>
								),
							)}
						</div>
					</div>
				</div>

				{/* Bottom */}
				<div className="border-t border-gold/20 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
					<p className="text-xs text-dim">
						&copy; 2026 MaskBid. All rights reserved.
					</p>
					<p className="text-xs text-dim">
						Built for Chainlink Convergence Hackathon 2026
					</p>
				</div>
			</div>
		</footer>
	);
}
