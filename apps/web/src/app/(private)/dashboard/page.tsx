import Link from "next/link";

const ACTIVE_BIDS = [
	{ id: "1", name: "Rolex Submariner 2023", type: "Watch", reservePrice: "2,000", deposit: "200", endTime: "2h 14m", status: "Active" },
	{ id: "2", name: "Oil Painting — Coastal Sunrise", type: "Art", reservePrice: "500", deposit: "50", endTime: "5h 42m", status: "Active" },
	{ id: "3", name: "1kg Gold Bar", type: "Gold", reservePrice: "16,000", deposit: "1,600", endTime: "11h 00m", status: "Active" },
];

const MY_ASSETS = [
	{ id: "1", name: "Vintage Patek Philippe", type: "Watch", status: "Pending Verification" },
	{ id: "2", name: "Abstract Canvas", type: "Art", status: "In Auction" },
];

const STATUS_MAP: Record<string, { border: string; text: string }> = {
	Active: { border: "border-status-live/30", text: "text-status-live" },
	"Pending Verification": { border: "border-gold/20", text: "text-gold" },
	"In Auction": { border: "border-status-live/30", text: "text-status-live" },
};

export default function DashboardPage() {
	const totalDepositsLocked = ACTIVE_BIDS.reduce((sum, b) => sum + Number(b.deposit.replace(/,/g, "")), 0);

	return (
		<div className="min-h-screen pt-24 pb-16">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Header */}
				<div className="mb-10">
					<p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
					<h1 className="font-serif text-3xl font-semibold text-foreground">Dashboard</h1>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
					{[
						{
							label: "Active Bids",
							value: String(ACTIVE_BIDS.length),
							sub: "Sealed & encrypted",
							icon: (
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
									<path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
								</svg>
							),
						},
						{
							label: "Assets Registered",
							value: String(MY_ASSETS.length),
							sub: "In your portfolio",
							icon: (
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
									<path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
								</svg>
							),
						},
						{
							label: "KYC Status",
							value: "Verified",
							sub: "World ID verified",
							icon: (
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
									<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
								</svg>
							),
						},
						{
							label: "Deposits Locked",
							value: `${totalDepositsLocked.toLocaleString()}`,
							sub: "USDC in active bids",
							icon: (
								<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
									<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							),
						},
					].map((stat) => (
						<div key={stat.label} className="frame-ornate p-5">
							<div className="text-gold/40 mb-3">{stat.icon}</div>
							<p className="text-dim text-xs font-serif tracking-wide mb-0.5">{stat.label}</p>
							<p className="text-foreground font-serif font-semibold text-xl">{stat.value}</p>
							<p className="text-dim text-xs mt-1">{stat.sub}</p>
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
					{/* Active Bids */}
					<div className="frame-ornate p-6">
						<div className="flex items-center justify-between mb-5">
							<h2 className="font-serif text-foreground font-semibold text-lg">My Active Bids</h2>
							<Link href="/my-bids" className="text-gold/60 hover:text-gold text-sm font-serif transition-colors cursor-pointer">
								<span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
								View all
							</Link>
						</div>
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-gold/10">
									<th className="text-left pb-3 text-dim text-xs font-serif tracking-wide">Asset</th>
									<th className="text-right pb-3 text-dim text-xs font-serif tracking-wide">Reserve</th>
									<th className="text-right pb-3 text-dim text-xs font-serif tracking-wide">Deposit</th>
									<th className="text-right pb-3 text-dim text-xs font-serif tracking-wide">Ends</th>
								</tr>
							</thead>
							<tbody>
								{ACTIVE_BIDS.map((bid) => (
									<tr key={bid.id} className="border-b border-border last:border-0">
										<td className="py-3">
											<p className="text-foreground font-medium text-sm">{bid.name}</p>
											<p className="text-dim text-xs">{bid.type}</p>
										</td>
										<td className="py-3 text-right text-muted font-mono text-xs">{bid.reservePrice}</td>
										<td className="py-3 text-right text-gold font-mono text-xs">{bid.deposit}</td>
										<td className="py-3 text-right text-gold/60 font-mono text-xs">{bid.endTime}</td>
									</tr>
								))}
							</tbody>
						</table>
						<div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-dim">
							<svg className="w-3.5 h-3.5 text-gold/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
							</svg>
							<span>Your bid amounts are encrypted — only your security deposit is shown.</span>
						</div>
					</div>

					{/* My Assets */}
					<div className="frame-ornate p-6">
						<div className="flex items-center justify-between mb-5">
							<h2 className="font-serif text-foreground font-semibold text-lg">My Assets</h2>
							<Link href="/my-assets" className="text-gold/60 hover:text-gold text-sm font-serif transition-colors cursor-pointer">
								<span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
								View all
							</Link>
						</div>
						<div className="space-y-3">
							{MY_ASSETS.map((asset) => {
								const colors = STATUS_MAP[asset.status] || { border: "border-border", text: "text-muted" };
								return (
									<div key={asset.id} className="flex items-center justify-between border border-border hover:border-gold/15 px-4 py-3 transition-colors">
										<div>
											<p className="text-foreground font-medium text-sm">{asset.name}</p>
											<p className="text-dim text-xs">{asset.type}</p>
										</div>
										<span className={`inline-flex items-center gap-1.5 text-xs font-serif tracking-wider px-2.5 py-1 border ${colors.border} ${colors.text}`}>
											<span className="text-[6px]">&#9670;</span>
											{asset.status}
										</span>
									</div>
								);
							})}
						</div>
					</div>
				</div>

				{/* Quick Actions */}
				<div className="flex flex-wrap gap-4">
					<Link
						href="/my-assets/register"
						className="btn-ornate text-gold font-serif tracking-wider px-8 py-2.5 cursor-pointer"
					>
						Register Asset
					</Link>
					<Link
						href="/auctions"
						className="btn-ornate-ghost text-muted hover:text-foreground font-serif tracking-wider px-8 py-2.5 cursor-pointer"
					>
						Browse Auctions
					</Link>
				</div>
			</div>
		</div>
	);
}
