'use client'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { Suspense } from 'react'

const ASSETS = [
    {
        id: '1', name: 'Rolex Submariner 2023', type: 'Watch', status: 'Verified', image: '⌚', date: 'Jan 10, 2026',
        description: 'Rolex Submariner Date Ref. 126610LN in mint condition. Full set including box, papers, and certificate of authenticity.',
        serial: 'SUB-2023-00471', reservePrice: '2.0',
    },
    {
        id: '2', name: 'Oil Painting — Coastal Sunrise', type: 'Art', status: 'Pending Verification', image: '🎨', date: 'Feb 3, 2026',
        description: 'Original oil on canvas, 60x90cm. Signed by artist. Accompanied by gallery provenance certificate.',
        serial: 'ART-CS-2021-88', reservePrice: '0.5',
    },
    {
        id: '3', name: '1kg Gold Bar (LBMA Certified)', type: 'Gold', status: 'In Auction', image: '🥇', date: 'Dec 15, 2025',
        description: 'PAMP Suisse 1kg gold bar, 999.9 fine gold. LBMA certified with serial number and assay certificate.',
        serial: 'PAMP-1KG-00392', reservePrice: '16.0',
    },
]

const STATUS_COLORS: Record<string, string> = {
    Verified: 'text-green-300 bg-green-500/20 border-green-500/30',
    'Pending Verification': 'text-orange-300 bg-orange-500/20 border-orange-500/30',
    'In Auction': 'text-blue-300 bg-blue-500/20 border-blue-500/30',
}

const TIMELINE = ['Registered', 'Pending Verification', 'Verified', 'Minted', 'In Auction']
const STATUS_POSITION: Record<string, number> = {
    Registered: 0, 'Pending Verification': 1, Verified: 2, Minted: 3, 'In Auction': 4,
}

function AssetList({ onSelect }: { onSelect: (id: string) => void }) {
    return (
        <div className="bg-slate-900 min-h-screen text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">My Assets</h1>
                        <p className="text-white/50">Manage your registered physical assets.</p>
                    </div>
                    <Link
                        href="/my-assets/register"
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
                    >
                        + Register New Asset
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ASSETS.map(asset => (
                        <div key={asset.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors">
                            <div className="h-36 bg-white/5 flex items-center justify-center text-6xl">
                                {asset.image}
                            </div>
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-white/50 bg-white/10 px-2 py-0.5 rounded-full">{asset.type}</span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[asset.status]}`}>
                                        {asset.status}
                                    </span>
                                </div>
                                <h3 className="text-white font-semibold mb-1">{asset.name}</h3>
                                <p className="text-white/40 text-xs mb-4">Registered {asset.date}</p>
                                <button
                                    type="button"
                                    onClick={() => onSelect(asset.id)}
                                    className="block w-full text-center bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                                >
                                    View Details
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function AssetDetail({ asset, onBack }: { asset: typeof ASSETS[number]; onBack: () => void }) {
    const currentStep = STATUS_POSITION[asset.status] ?? 0

    return (
        <div className="bg-slate-900 min-h-screen text-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block transition-colors"
                >
                    ← Back to My Assets
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="h-64 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-8xl">
                        {asset.image}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-medium text-white/50 bg-white/10 px-2 py-0.5 rounded-full">{asset.type}</span>
                        </div>
                        <h1 className="text-2xl font-bold mb-4">{asset.name}</h1>
                        <p className="text-white/60 text-sm leading-relaxed mb-6">{asset.description}</p>

                        <div className="bg-white/5 border border-white/10 rounded-xl divide-y divide-white/5 text-sm">
                            {[
                                { label: 'Type', value: asset.type },
                                { label: 'Serial / Certificate', value: asset.serial },
                                { label: 'Registered Date', value: asset.date },
                                { label: 'Reserve Price', value: `Ξ ${asset.reservePrice}` },
                                { label: 'Status', value: asset.status },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between px-4 py-3">
                                    <span className="text-white/40">{row.label}</span>
                                    <span className="text-white font-medium">{row.value}</span>
                                </div>
                            ))}
                        </div>

                        {asset.status === 'Verified' && (
                            <button
                                type="button"
                                onClick={() => console.log('Create auction stub')}
                                className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
                            >
                                Create Auction
                            </button>
                        )}
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h2 className="text-white font-semibold mb-6">Asset Timeline</h2>
                    <div className="flex items-center">
                        {TIMELINE.map((step, i) => (
                            <div key={step} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                            i < currentStep
                                                ? 'bg-green-500 text-white'
                                                : i === currentStep
                                                ? 'bg-blue-600 text-white ring-4 ring-blue-900'
                                                : 'bg-white/10 text-white/30'
                                        }`}
                                    >
                                        {i < currentStep ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs mt-2 text-center max-w-16 leading-tight ${
                                        i <= currentStep ? 'text-white/70' : 'text-white/25'
                                    }`}>
                                        {step}
                                    </span>
                                </div>
                                {i < TIMELINE.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 mb-6 ${i < currentStep ? 'bg-green-500' : 'bg-white/10'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function MyAssetsPageInner() {
    const [assetId, setAssetId] = useQueryState('assetId')

    const selected = ASSETS.find(a => a.id === assetId)

    if (selected) {
        return <AssetDetail asset={selected} onBack={() => setAssetId(null)} />
    }

    return <AssetList onSelect={id => setAssetId(id)} />
}

export default function MyAssetsPage() {
    return (
        <Suspense>
            <MyAssetsPageInner />
        </Suspense>
    )
}
