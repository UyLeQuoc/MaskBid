'use client'
import { useState } from 'react'
import { useQueryState } from 'nuqs'
import { Suspense } from 'react'
import BidModal from '@/components/auction/BidModal'

const AUCTIONS = [
    {
        id: '1',
        name: 'Rolex Submariner 2023',
        type: 'Watch',
        reservePrice: '2,000',
        requiredDeposit: '200',
        endTime: '2h 14m',
        image: '⌚',
        status: 'Active',
        bidCount: 7,
        seller: '0xAbCd...1234',
        description: 'Rolex Submariner Date Ref. 126610LN in mint condition. Full set including box, papers, and certificate of authenticity. Verified by MaskBid verifier.',
        startTime: 'Feb 20, 2026 10:00 UTC',
    },
    {
        id: '2',
        name: 'Oil Painting — Coastal Sunrise',
        type: 'Art',
        reservePrice: '500',
        requiredDeposit: '50',
        endTime: '5h 42m',
        image: '🎨',
        status: 'Active',
        bidCount: 3,
        seller: '0xEfGh...5678',
        description: 'Original oil on canvas, 60x90cm. Signed by artist. Accompanied by gallery provenance certificate.',
        startTime: 'Feb 21, 2026 08:00 UTC',
    },
    {
        id: '3',
        name: '1kg Gold Bar (LBMA Certified)',
        type: 'Gold',
        reservePrice: '16,000',
        requiredDeposit: '1,600',
        endTime: '11h 00m',
        image: '🥇',
        status: 'Active',
        bidCount: 12,
        seller: '0xIjKl...9012',
        description: 'PAMP Suisse 1kg gold bar, 999.9 fine gold. LBMA certified with serial number and assay certificate.',
        startTime: 'Feb 21, 2026 06:00 UTC',
    },
    {
        id: '4',
        name: 'Vintage Patek Philippe 5711',
        type: 'Watch',
        reservePrice: '8,000',
        requiredDeposit: '800',
        endTime: '1d 3h',
        image: '⌚',
        status: 'Active',
        bidCount: 5,
        seller: '0xMnOp...3456',
        description: 'Patek Philippe Nautilus 5711 in excellent condition. Complete set with original box and papers.',
        startTime: 'Feb 20, 2026 14:00 UTC',
    },
    {
        id: '5',
        name: 'Abstract Canvas — Blue Phase',
        type: 'Art',
        reservePrice: '200',
        requiredDeposit: '20',
        endTime: '18h 20m',
        image: '🖼️',
        status: 'Active',
        bidCount: 2,
        seller: '0xQrSt...7890',
        description: 'Large format abstract canvas, acrylic on linen. Artist-signed verso with certificate of authenticity.',
        startTime: 'Feb 21, 2026 09:00 UTC',
    },
    {
        id: '6',
        name: '500g Silver Bullion Bar',
        type: 'Gold',
        reservePrice: '700',
        requiredDeposit: '70',
        endTime: '3h 05m',
        image: '🥈',
        status: 'Active',
        bidCount: 4,
        seller: '0xUvWx...1234',
        description: 'Valcambi 500g silver bar, 999 fine silver. Sealed in original packaging with assay card.',
        startTime: 'Feb 21, 2026 11:00 UTC',
    },
]

type Auction = typeof AUCTIONS[number]

function AuctionCard({ auction, onSelect, onBid }: { auction: Auction; onSelect: () => void; onBid: () => void }) {
    return (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-slate-300 transition-colors">
            <div className="h-44 bg-slate-100 flex items-center justify-center text-7xl">
                {auction.image}
            </div>
            <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{auction.type}</span>
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{auction.status}</span>
                </div>
                <h3 className="text-slate-900 font-semibold mb-3">{auction.name}</h3>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
                    <div>
                        <p className="text-slate-400 text-xs">Reserve Price</p>
                        <p className="text-slate-900 font-bold">{auction.reservePrice} USDC</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs">Ends in</p>
                        <p className="text-orange-500 font-medium">{auction.endTime}</p>
                    </div>
                    <div>
                        <p className="text-slate-400 text-xs">Deposit</p>
                        <p className="text-amber-600 font-medium">{auction.requiredDeposit} USDC</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400 text-xs">Sealed Bids</p>
                        <p className="text-slate-600 text-sm flex items-center justify-end gap-1">
                            <span>🔒</span> {auction.bidCount}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onSelect}
                        className="flex-1 text-center bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-900 text-sm font-medium py-2 rounded-2xl transition-colors"
                    >
                        View Details
                    </button>
                    <button
                        type="button"
                        onClick={onBid}
                        className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded-2xl transition-colors"
                    >
                        Place Bid
                    </button>
                </div>
            </div>
        </div>
    )
}

function AuctionList({ onSelect, onBid }: { onSelect: (id: string) => void; onBid: (auction: Auction) => void }) {
    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2">Live Auctions</h1>
                    <p className="text-slate-500">All bids are sealed and encrypted — only the reserve price is public.</p>
                </div>

                {/* Sealed bid notice */}
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-8">
                    <span className="text-blue-600 mt-0.5">🔒</span>
                    <p className="text-blue-700 text-sm">
                        <span className="font-semibold">Dark Auction:</span> Bid amounts are encrypted with Chainlink Confidential HTTP. No one — not even the seller — can see bids until the auction ends. Winner is selected by Chainlink CRE.
                    </p>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap gap-3 mb-8">
                    {['All', 'Watch', 'Art', 'Gold', 'Real Estate'].map(filter => (
                        <button
                            key={filter}
                            type="button"
                            className={`px-4 py-2 rounded-2xl text-sm font-medium transition-colors ${
                                filter === 'All'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {AUCTIONS.map(auction => (
                        <AuctionCard
                            key={auction.id}
                            auction={auction}
                            onSelect={() => onSelect(auction.id)}
                            onBid={() => onBid(auction)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function AuctionDetail({ auction, onBack, onBid }: { auction: Auction; onBack: () => void; onBid: () => void }) {
    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block transition-colors"
                >
                    ← Back to Auctions
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Left */}
                    <div>
                        <div className="h-72 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-8xl mb-6">
                            {auction.image}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-3xl p-6">
                            <h2 className="text-slate-900 font-semibold mb-3">Description</h2>
                            <p className="text-slate-600 text-sm leading-relaxed">{auction.description}</p>
                            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Seller</span>
                                    <span className="font-mono text-slate-700">{auction.seller}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Auction Started</span>
                                    <span className="text-slate-700">{auction.startTime}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">{auction.type}</span>
                            <span className="text-xs font-medium text-green-600 bg-green-100 px-2.5 py-1 rounded-full">{auction.status}</span>
                        </div>
                        <h1 className="text-3xl font-bold">{auction.name}</h1>

                        {/* Key stats */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-6">
                            <div className="grid grid-cols-2 gap-5 mb-6">
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Reserve Price</p>
                                    <p className="text-2xl font-bold text-slate-900">{auction.reservePrice} <span className="text-base font-normal text-slate-500">USDC</span></p>
                                    <p className="text-slate-400 text-xs mt-0.5">Minimum bid to qualify</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Time Remaining</p>
                                    <p className="text-2xl font-bold text-orange-500">{auction.endTime}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Required Deposit</p>
                                    <p className="text-xl font-bold text-amber-600">{auction.requiredDeposit} <span className="text-base font-normal text-slate-500">USDC</span></p>
                                    <p className="text-slate-400 text-xs mt-0.5">Required from all bidders as security. Non-winners receive it back.</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Sealed Bids</p>
                                    <p className="text-slate-900 font-bold text-lg">{auction.bidCount}</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={onBid}
                                className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Place Sealed Bid (KYC Required)
                            </button>
                        </div>

                        {/* How sealed bidding works */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5">
                            <h2 className="text-slate-900 font-semibold mb-3 flex items-center gap-2">
                                <span>🔒</span> How Sealed Bidding Works
                            </h2>
                            <ol className="space-y-2.5 text-sm text-slate-600">
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold shrink-0">1.</span>
                                    Deposit {auction.requiredDeposit} USDC as security (required from all bidders).
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold shrink-0">2.</span>
                                    Enter your bid amount (must be ≥ {auction.reservePrice} USDC). It is encrypted before going on-chain.
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold shrink-0">3.</span>
                                    When the auction ends, Chainlink CRE decrypts all bids in a secure enclave and selects the highest bidder.
                                </li>
                                <li className="flex gap-3">
                                    <span className="text-blue-600 font-bold shrink-0">4.</span>
                                    Winner pays bid amount and receives NFT + deposit back. Losers claim deposit back.
                                </li>
                            </ol>
                        </div>

                        {/* Bid activity */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5">
                            <h2 className="text-slate-900 font-semibold mb-3">Bid Activity</h2>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Total sealed bids submitted</span>
                                <span className="text-slate-900 font-bold">{auction.bidCount}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-400">
                                <span>🔒</span>
                                <span>Individual bid amounts are encrypted and will only be revealed by Chainlink CRE after the auction ends.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function AuctionsPageInner() {
    const [auctionId, setAuctionId] = useQueryState('auctionId')
    const [bidTarget, setBidTarget] = useState<Auction | null>(null)

    const selected = AUCTIONS.find(a => a.id === auctionId)

    return (
        <>
            {selected ? (
                <AuctionDetail
                    auction={selected}
                    onBack={() => setAuctionId(null)}
                    onBid={() => setBidTarget(selected)}
                />
            ) : (
                <AuctionList
                    onSelect={id => setAuctionId(id)}
                    onBid={auction => setBidTarget(auction)}
                />
            )}

            {bidTarget && (
                <BidModal
                    auction={bidTarget}
                    onClose={() => setBidTarget(null)}
                />
            )}
        </>
    )
}

export default function AuctionsPage() {
    return (
        <Suspense>
            <AuctionsPageInner />
        </Suspense>
    )
}
