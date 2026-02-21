'use client'
import { useState } from 'react'
import { useQueryState } from 'nuqs'
import { Suspense } from 'react'
import BidModal from '@/components/auction/BidModal'
import { useAuctions } from '@/hooks/useAuctions'

// Transform database auction to UI format
function transformAuction(auction: import('@/hooks/useAuctions').Auction) {
    const endsAt = new Date(auction.ends_at)
    const now = new Date()
    const diffMs = endsAt.getTime() - now.getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHrs / 24)

    let endTime: string
    if (diffMs <= 0) {
        endTime = 'Ended'
    } else if (diffDays > 0) {
        endTime = `${diffDays}d ${diffHrs % 24}h`
    } else {
        endTime = `${diffHrs}h ${Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))}m`
    }

    // Get asset type from asset_id (you might want to fetch this from asset_states table)
    const assetTypes: Record<string, string> = { '1': 'Watch', '2': 'Art', '3': 'Gold' }
    const type = assetTypes[auction.asset_id] || 'Asset'

    // Map emoji based on type
    const typeEmojis: Record<string, string> = { 'Watch': '⌚', 'Art': '🎨', 'Gold': '🥇' }
    const image = typeEmojis[type] || '📦'

    return {
        id: auction.id,
        name: `Asset #${auction.token_id || auction.asset_id}`, // Use asset name from asset_states in production
        type,
        reservePrice: auction.reserve_price?.toLocaleString() || auction.start_price.toLocaleString(),
        requiredDeposit: auction.deposit_required?.toLocaleString() || '100',
        endTime,
        image,
        status: auction.status === 'active' ? 'Active' : auction.status,
        bidCount: auction.bid_count || 0,
        seller: `${auction.seller_address.slice(0, 6)}...${auction.seller_address.slice(-4)}`,
        description: `Auction for asset ${auction.asset_id}. Seller: ${auction.seller_address}. Contract ID: ${auction.contract_auction_id}`,
        startTime: new Date(auction.started_at).toLocaleString(),
        contractAuctionId: auction.contract_auction_id,
        rawAuction: auction, // Keep reference for bidding
    }
}

type Auction = ReturnType<typeof transformAuction>

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
    const { auctions, loading, error } = useAuctions()

    // Transform auctions from database
    const displayAuctions = auctions.map(transformAuction)

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Live Auctions</h1>
                        <p className="text-slate-500">All bids are sealed and encrypted — only the reserve price is public.</p>
                    </div>
                    <button
                        onClick={() => window.location.href = '/auctions/create'}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-6 rounded-2xl transition-colors"
                    >
                        + Create Auction
                    </button>
                </div>

                {/* Sealed bid notice */}
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-8">
                    <span className="text-blue-600 mt-0.5">🔒</span>
                    <p className="text-blue-700 text-sm">
                        <span className="font-semibold">Dark Auction:</span> Bid amounts are encrypted with Chainlink Confidential HTTP. No one — not even the seller — can see bids until the auction ends. Winner is selected by Chainlink CRE.
                    </p>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-3 text-slate-500">Loading auctions...</span>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-8">
                        <p className="text-red-700 text-sm">Error loading auctions: {error}</p>
                        <p className="text-red-600 text-xs mt-1">Showing demo data instead.</p>
                    </div>
                )}

                {/* Empty state */}
                {!loading && auctions.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-8 text-center">
                        <p className="text-amber-700 text-lg font-medium">No active auctions found.</p>
                        <p className="text-amber-600 text-sm mt-2">Check back later or create a new auction.</p>
                    </div>
                )}

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
                    {displayAuctions.map(auction => (
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
                                {auction.contractAuctionId && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Contract ID</span>
                                        <span className="font-mono text-slate-700">#{auction.contractAuctionId}</span>
                                    </div>
                                )}
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
    const { auctions } = useAuctions()

    const displayAuctions = auctions.map(transformAuction)

    const selected = displayAuctions.find((a: Auction) => a.id === auctionId)

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
