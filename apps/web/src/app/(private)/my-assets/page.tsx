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
    Verified: 'text-green-600 bg-green-100 border-green-200',
    'Pending Verification': 'text-orange-500 bg-orange-50 border-orange-200',
    'In Auction': 'text-blue-600 bg-blue-50 border-blue-200',
}

const TIMELINE = ['Registered', 'Pending Verification', 'Verified', 'Minted', 'In Auction']
const STATUS_POSITION: Record<string, number> = {
    Registered: 0, 'Pending Verification': 1, Verified: 2, Minted: 3, 'In Auction': 4,
}

function AssetList({ onSelect }: { onSelect: (id: string) => void }) {
    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">My Assets</h1>
                        <p className="text-slate-500">Manage your registered physical assets.</p>
                    </div>
                    <Link
                        href="/my-assets/register"
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-2xl transition-colors"
                    >
                        + Register New Asset
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {ASSETS.map(asset => (
                        <div key={asset.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-slate-300 transition-colors">
                            <div className="h-36 bg-slate-100 flex items-center justify-center text-6xl">
                                {asset.image}
                            </div>
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{asset.type}</span>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[asset.status]}`}>
                                        {asset.status}
                                    </span>
                                </div>
                                <h3 className="text-slate-900 font-semibold mb-1">{asset.name}</h3>
                                <p className="text-slate-400 text-xs mb-4">Registered {asset.date}</p>
                                <button
                                    type="button"
                                    onClick={() => onSelect(asset.id)}
                                    className="block w-full text-center bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-900 text-sm font-medium py-2 rounded-2xl transition-colors"
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
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block transition-colors"
                >
                    ← Back to My Assets
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="h-64 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-8xl">
                        {asset.image}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{asset.type}</span>
                        </div>
                        <h1 className="text-2xl font-bold mb-4">{asset.name}</h1>
                        <p className="text-slate-600 text-sm leading-relaxed mb-6">{asset.description}</p>

                        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 text-sm">
                            {[
                                { label: 'Type', value: asset.type },
                                { label: 'Serial / Certificate', value: asset.serial },
                                { label: 'Registered Date', value: asset.date },
                                { label: 'Reserve Price', value: `Ξ ${asset.reservePrice}` },
                                { label: 'Status', value: asset.status },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between px-4 py-3">
                                    <span className="text-slate-400">{row.label}</span>
                                    <span className="text-slate-900 font-medium">{row.value}</span>
                                </div>
                            ))}
                        </div>

                        {asset.status === 'Verified' && (
                            <button
                                type="button"
                                onClick={() => console.log('Create auction stub')}
                                className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Create Auction
                            </button>
                        )}
                    </div>
                </div>

                {/* Timeline */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6">
                    <h2 className="text-slate-900 font-semibold mb-6">Asset Timeline</h2>
                    <div className="flex items-center">
                        {TIMELINE.map((step, i) => (
                            <div key={step} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                            i < currentStep
                                                ? 'bg-green-500 text-white'
                                                : i === currentStep
                                                ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                                                : 'bg-slate-100 text-slate-400'
                                        }`}
                                    >
                                        {i < currentStep ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs mt-2 text-center max-w-16 leading-tight ${
                                        i <= currentStep ? 'text-slate-700' : 'text-slate-400'
                                    }`}>
                                        {step}
                                    </span>
                                </div>
                                {i < TIMELINE.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-2 mb-6 ${i < currentStep ? 'bg-green-500' : 'bg-slate-200'}`} />
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
