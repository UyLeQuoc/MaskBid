import Link from 'next/link'

const ACTIVE_BIDS = [
    { id: '1', name: 'Rolex Submariner 2023', type: 'Watch', reservePrice: '2,000', deposit: '200', endTime: '2h 14m', status: 'Active' },
    { id: '2', name: 'Oil Painting — Coastal Sunrise', type: 'Art', reservePrice: '500', deposit: '50', endTime: '5h 42m', status: 'Active' },
    { id: '3', name: '1kg Gold Bar', type: 'Gold', reservePrice: '16,000', deposit: '1,600', endTime: '11h 00m', status: 'Active' },
]

const MY_ASSETS = [
    { id: '1', name: 'Vintage Patek Philippe', type: 'Watch', status: 'Pending Verification' },
    { id: '2', name: 'Abstract Canvas', type: 'Art', status: 'In Auction' },
]

const STATUS_COLORS: Record<string, string> = {
    Active: 'text-blue-600 bg-blue-50',
    'Pending Verification': 'text-orange-500 bg-orange-50',
    'In Auction': 'text-green-600 bg-green-100',
}

export default function DashboardPage() {
    const totalDepositsLocked = ACTIVE_BIDS.reduce((sum, b) => sum + Number(b.deposit.replace(/,/g, '')), 0)

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {[
                        { label: 'Active Bids', value: String(ACTIVE_BIDS.length), icon: '🔒', sub: 'Sealed & encrypted' },
                        { label: 'Assets Registered', value: String(MY_ASSETS.length), icon: '📦', sub: 'In your portfolio' },
                        { label: 'KYC Status', value: 'Verified', icon: '✅', sub: 'World ID verified' },
                        { label: 'Deposits Locked', value: `${totalDepositsLocked.toLocaleString()}`, icon: '💵', sub: 'Security deposits in active bids' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white border border-slate-200 rounded-3xl p-5">
                            <div className="text-2xl mb-2">{stat.icon}</div>
                            <p className="text-slate-400 text-xs mb-0.5">{stat.label}</p>
                            <p className="text-slate-900 font-bold text-xl">{stat.value}</p>
                            <p className="text-slate-300 text-xs mt-0.5">{stat.sub}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Active Bids */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-slate-900 font-semibold text-lg">My Active Bids</h2>
                            <Link href="/my-bids" className="text-blue-600 hover:text-blue-700 text-sm transition-colors">View all</Link>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 text-xs">
                                    <th className="text-left pb-3">Asset</th>
                                    <th className="text-right pb-3">Reserve</th>
                                    <th className="text-right pb-3">Deposit</th>
                                    <th className="text-right pb-3">Ends</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ACTIVE_BIDS.map(bid => (
                                    <tr key={bid.id}>
                                        <td className="py-3">
                                            <p className="text-slate-900 font-medium">{bid.name}</p>
                                            <p className="text-slate-400 text-xs">{bid.type}</p>
                                        </td>
                                        <td className="py-3 text-right text-slate-500 text-xs">{bid.reservePrice} USDC</td>
                                        <td className="py-3 text-right text-amber-600 text-xs font-medium">{bid.deposit} USDC</td>
                                        <td className="py-3 text-right text-orange-500 text-xs">{bid.endTime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-400">
                            <span>🔒</span>
                            <span>Your bid amounts are encrypted — only your security deposit is shown.</span>
                        </div>
                    </div>

                    {/* My Assets */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-slate-900 font-semibold text-lg">My Assets</h2>
                            <Link href="/my-assets" className="text-blue-600 hover:text-blue-700 text-sm transition-colors">View all</Link>
                        </div>
                        <div className="space-y-3">
                            {MY_ASSETS.map(asset => (
                                <div key={asset.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                                    <div>
                                        <p className="text-slate-900 font-medium text-sm">{asset.name}</p>
                                        <p className="text-slate-400 text-xs">{asset.type}</p>
                                    </div>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[asset.status]}`}>
                                        {asset.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-4">
                    <Link href="/my-assets/register" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-2xl transition-colors">
                        + Register Asset
                    </Link>
                    <Link href="/auctions" className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-900 font-semibold px-6 py-3 rounded-2xl transition-colors">
                        Browse Auctions
                    </Link>
                </div>
            </div>
        </div>
    )
}
