'use client'
import Link from 'next/link'
import { useState } from 'react'

type BidStatus = 'Active' | 'Pending Settlement' | 'Won' | 'Lost' | 'Claimed'

type Bid = {
    id: string
    name: string
    type: string
    reservePrice: string
    deposit: string
    myBid: string | null
    endTime: string
    status: BidStatus
}

const BIDS: Bid[] = [
    {
        id: '1',
        name: 'Rolex Submariner 2023',
        type: 'Watch',
        reservePrice: '2,000',
        deposit: '200',
        myBid: null,
        endTime: '2h 14m',
        status: 'Active',
    },
    {
        id: '2',
        name: 'Oil Painting — Coastal Sunrise',
        type: 'Art',
        reservePrice: '500',
        deposit: '50',
        myBid: '750',
        endTime: 'Ended',
        status: 'Won',
    },
    {
        id: '3',
        name: '1kg Gold Bar',
        type: 'Gold',
        reservePrice: '16,000',
        deposit: '1,600',
        myBid: null,
        endTime: 'Ended',
        status: 'Lost',
    },
    {
        id: '4',
        name: 'Vintage Patek Philippe',
        type: 'Watch',
        reservePrice: '8,000',
        deposit: '800',
        myBid: null,
        endTime: 'Ended',
        status: 'Claimed',
    },
]

// ---------------------------------------------------------------------------
// Diamond ornament
// ---------------------------------------------------------------------------
function Diamond({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
    return <span className={size === 'xs' ? 'text-gold/30 text-[6px]' : 'text-gold/40 text-[8px]'}>&#9670;</span>
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<BidStatus, string> = {
    Active: 'border-status-live/30 text-status-live',
    'Pending Settlement': 'border-gold/30 text-gold',
    Won: 'border-status-won/30 text-status-won',
    Lost: 'border-status-error/30 text-status-error',
    Claimed: 'border-status-ended/30 text-status-ended',
}

function StatusBadge({ status }: { status: BidStatus }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border ${STATUS_STYLES[status]}`}>
            <Diamond size="xs" />
            {status}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Pay modal
// ---------------------------------------------------------------------------
function PayModal({ bid, onClose }: { bid: Bid; onClose: () => void }) {
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    function handlePay() {
        setLoading(true)
        setTimeout(() => { setLoading(false); setDone(true) }, 1800)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={done ? onClose : undefined} />
            <div className="relative glass-card w-full max-w-md border border-border">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                    <h2 className="font-serif text-foreground font-semibold">
                        {done ? 'Asset Claimed' : 'Pay & Claim Asset'}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-dim hover:text-muted text-lg leading-none transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 py-6">
                    {done ? (
                        <div className="text-center space-y-5">
                            <div className="flex items-center justify-center gap-3">
                                <div className="h-px flex-1 bg-gold/10" />
                                <span className="text-status-won text-2xl">&#9670;</span>
                                <div className="h-px flex-1 bg-gold/10" />
                            </div>
                            <h3 className="font-serif text-foreground font-semibold text-xl">Asset Claimed!</h3>
                            <p className="text-dim font-serif text-sm">
                                Asset token + deposit have been transferred to your wallet. Check{' '}
                                <span className="text-gold/70">My Assets</span> for your new holding.
                            </p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-ornate-ghost w-full text-muted hover:text-foreground font-serif tracking-wider py-3"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="text-center">
                                <div className="flex items-center justify-center gap-3 mb-3">
                                    <div className="h-px flex-1 bg-gold/10" />
                                    <span className="text-status-won text-xl">&#9670;</span>
                                    <div className="h-px flex-1 bg-gold/10" />
                                </div>
                                <p className="text-status-won font-serif font-semibold">You Won!</p>
                                <p className="text-dim font-serif text-sm mt-1">
                                    Pay your bid amount to receive the asset and your deposit back.
                                </p>
                            </div>

                            <div className="border border-border divide-y divide-border text-sm">
                                <div className="flex items-center justify-between px-4 py-3">
                                    <span className="text-dim font-serif">Bid amount (to seller)</span>
                                    <span className="font-mono text-foreground font-semibold flex items-center gap-1.5">
                                        🔒 <span className="line-through text-dim text-xs mr-1">encrypted</span>
                                        {bid.myBid} USDC
                                    </span>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-dim font-serif text-xs tracking-wider uppercase mb-2">You receive:</p>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-muted font-serif text-sm">Deposit refunded</span>
                                        <span className="font-mono text-status-won text-sm">+ {bid.deposit} USDC</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted font-serif text-sm">Asset token</span>
                                        <span className="font-serif text-status-won text-sm">+ {bid.name}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handlePay}
                                disabled={loading}
                                className="btn-ornate w-full text-gold font-serif tracking-wider py-3 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <span className="animate-spin w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full inline-block" />
                                        Processing…
                                    </>
                                ) : `Pay ${bid.myBid} USDC & Claim`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyBidsPage() {
    const [payTarget, setPayTarget] = useState<Bid | null>(null)

    const totalDepositsLocked = BIDS
        .filter(b => b.status === 'Active')
        .reduce((sum, b) => sum + Number(b.deposit.replace(/,/g, '')), 0)

    function getAction(bid: Bid) {
        switch (bid.status) {
            case 'Active': return { label: 'View Auction', clickable: true }
            case 'Pending Settlement': return { label: 'Awaiting CRE…', clickable: false }
            case 'Won': return { label: 'Pay & Claim', clickable: true }
            case 'Lost': return { label: 'Claim Deposit', clickable: true }
            case 'Claimed': return { label: '—', clickable: false }
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-10">
                    <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                    <h1 className="font-serif text-4xl font-semibold text-foreground mb-2">My Bids</h1>
                    <div className="flex items-center gap-2 text-dim text-sm font-serif">
                        <Diamond size="xs" />
                        <span>Track your sealed bids and claim winnings or deposits after settlement.</span>
                    </div>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-3 border border-gold/20 px-4 py-3 mb-8">
                    <Diamond />
                    <p className="text-muted font-serif text-sm leading-relaxed">
                        Your bid amounts are <span className="text-gold/70">encrypted</span> and never visible on-chain.
                        Only your deposit is locked. Chainlink CRE reveals the winner after each auction ends.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                    {[
                        { label: 'Active Bids', value: `${BIDS.filter(b => b.status === 'Active').length}`, color: 'text-status-live' },
                        { label: 'Deposits Locked', value: `${totalDepositsLocked.toLocaleString()} USDC`, color: 'text-gold' },
                        { label: 'Auctions Won', value: `${BIDS.filter(b => b.status === 'Won').length}`, color: 'text-status-won' },
                        { label: 'Deposits to Claim', value: `${BIDS.filter(b => b.status === 'Lost').length}`, color: 'text-status-error' },
                    ].map(stat => (
                        <div key={stat.label} className="frame-ornate-dark px-4 py-3">
                            <p className="text-dim font-serif text-xs tracking-wide mb-1">{stat.label}</p>
                            <p className={`font-mono font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div className="frame-ornate overflow-hidden mb-8">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left px-6 py-4 text-dim font-serif text-xs tracking-widest uppercase">Auction</th>
                                    <th className="text-left px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Type</th>
                                    <th className="text-right px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Reserve</th>
                                    <th className="text-right px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Deposit</th>
                                    <th className="text-right px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">My Bid</th>
                                    <th className="text-center px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Ends</th>
                                    <th className="text-center px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Status</th>
                                    <th className="text-right px-6 py-4 text-dim font-serif text-xs tracking-widest uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {BIDS.map(bid => {
                                    const action = getAction(bid)
                                    return (
                                        <tr key={bid.id} className="hover:bg-surface/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-foreground font-serif font-medium">{bid.name}</p>
                                            </td>
                                            <td className="px-4 py-4 text-dim font-serif">{bid.type}</td>
                                            <td className="px-4 py-4 text-right font-mono text-muted">
                                                {bid.reservePrice} <span className="text-dim text-xs">USDC</span>
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono">
                                                <span className={bid.status === 'Claimed' ? 'text-dim line-through' : 'text-gold'}>
                                                    {bid.deposit}
                                                </span>
                                                {bid.status !== 'Claimed' && <span className="text-dim text-xs ml-1">USDC</span>}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {bid.myBid ? (
                                                    <span className="font-mono text-foreground font-semibold">{bid.myBid} <span className="text-dim text-xs font-normal">USDC</span></span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-dim text-xs border border-border px-2 py-0.5 font-serif">
                                                        🔒 Sealed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center font-mono text-sm">
                                                <span className={bid.endTime === 'Ended' ? 'text-status-ended' : 'text-gold'}>
                                                    {bid.endTime}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <StatusBadge status={bid.status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {bid.status === 'Won' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayTarget(bid)}
                                                        className="text-sm font-serif text-gold/80 hover:text-gold tracking-wider transition-colors"
                                                    >
                                                        {action.label}
                                                    </button>
                                                ) : bid.status === 'Active' ? (
                                                    <Link
                                                        href={`/auctions?auctionId=${bid.id}`}
                                                        className="text-sm font-serif text-gold/60 hover:text-gold tracking-wider transition-colors"
                                                    >
                                                        {action.label}
                                                    </Link>
                                                ) : bid.status === 'Lost' ? (
                                                    <button
                                                        type="button"
                                                        className="text-sm font-serif text-muted hover:text-foreground tracking-wider transition-colors"
                                                    >
                                                        {action.label}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm font-serif text-dim">{action.label}</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer CTA */}
                <div className="text-center">
                    <Link
                        href="/auctions"
                        className="btn-ornate text-gold font-serif tracking-wider px-10 py-3 text-sm"
                    >
                        Browse More Auctions
                    </Link>
                </div>
            </div>

            {payTarget && (
                <PayModal bid={payTarget} onClose={() => setPayTarget(null)} />
            )}
        </div>
    )
}
