'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { BrowserProvider, Contract, type Eip1193Provider } from 'ethers'
import BidModal from '@/components/auction/BidModal'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { env } from '@/configs/env'
import { useAuctions, type Auction } from '@/hooks/useAuctions'

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function useNow() {
    const [now, setNow] = useState(Date.now)
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])
    return now
}

type Phase = 'upcoming' | 'live' | 'ended'

function getPhase(auction: Auction, now: number): Phase {
    if (auction.status === 'cancelled' || auction.status === 'resolved' || auction.status === 'ended') return 'ended'
    const startsAt = new Date(auction.started_at).getTime()
    const endsAt = new Date(auction.ends_at).getTime()
    if (now < startsAt) return 'upcoming'
    if (now < endsAt) return 'live'
    return 'ended'
}

function formatMs(ms: number): string {
    if (ms <= 0) return '00:00'
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ${String(h % 24).padStart(2, '0')}h ${String(m % 60).padStart(2, '0')}m`
    if (h > 0) return `${String(h).padStart(2, '0')}h ${String(m % 60).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const TYPE_ICON: Record<string, string> = {
    watch: '⌚', art: '🎨', gold: '🥇', 'real estate': '🏠', other: '📦',
}

const TYPE_TABS = ['All', 'Watch', 'Art', 'Gold', 'Real Estate', 'Other']
type StatusTab = 'all' | 'upcoming' | 'live' | 'ended'

function fmtPrice(n: number) { return (n ?? 0).toLocaleString() }

// ---------------------------------------------------------------------------
// Bid target — matches BidModal duck type
// ---------------------------------------------------------------------------
type BidTarget = {
    id: string
    name: string
    reservePrice: string
    requiredDeposit: string
    endTime: string
    contractAuctionId: number | null
}

function toBidTarget(a: Auction, now: number): BidTarget {
    return {
        id: a.id,
        name: a.asset_name ?? `Asset #${a.token_id ?? a.asset_id}`,
        reservePrice: fmtPrice(a.reserve_price ?? a.start_price),
        requiredDeposit: fmtPrice(a.deposit_required ?? 0),
        endTime: formatMs(new Date(a.ends_at).getTime() - now),
        contractAuctionId: a.contract_auction_id,
    }
}

// ---------------------------------------------------------------------------
// Countdown cell — re-renders via parent now tick
// ---------------------------------------------------------------------------
function Countdown({ targetMs, phase }: { targetMs: number; phase: Phase }) {
    const remaining = targetMs
    if (phase === 'ended') {
        return <span className="text-slate-400 font-medium text-sm">Ended</span>
    }
    const urgent = phase === 'live' && remaining < 30 * 60 * 1000
    const color = phase === 'upcoming'
        ? 'text-indigo-500'
        : urgent ? 'text-red-500' : 'text-orange-500'
    return (
        <span className={`font-mono font-bold text-sm ${color} ${urgent ? 'animate-pulse' : ''}`}>
            {formatMs(remaining)}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Auction card
// ---------------------------------------------------------------------------
function AuctionCard({
    auction, now, onView, onBid,
}: {
    auction: Auction; now: number; onView: () => void; onBid: () => void
}) {
    const phase = getPhase(auction, now)
    const startsAt = new Date(auction.started_at).getTime()
    const endsAt = new Date(auction.ends_at).getTime()
    const targetMs = phase === 'upcoming' ? startsAt - now : endsAt - now

    const name = auction.asset_name ?? `Asset #${auction.token_id ?? auction.asset_id}`
    const icon = TYPE_ICON[(auction.asset_type ?? '').toLowerCase()] ?? '📦'

    const phaseBadge = {
        upcoming: <span className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">⏳ Upcoming</span>,
        live: (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                Live
            </span>
        ),
        ended: <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Ended</span>,
    }[phase]

    const countdownLabel = phase === 'upcoming' ? 'Starts in' : phase === 'live' ? 'Ends in' : 'Status'

    return (
        <button
            type="button"
            className={`bg-white border rounded-3xl overflow-hidden transition-all hover:shadow-md cursor-pointer group w-full text-left ${
                phase === 'live' ? 'border-green-200 hover:border-green-300' :
                phase === 'upcoming' ? 'border-indigo-200 hover:border-indigo-300' :
                'border-slate-200 hover:border-slate-300'
            }`}
            onClick={onView}
        >
            {/* Image area */}
            <div className={`h-36 flex items-center justify-center text-6xl relative ${
                phase === 'live' ? 'bg-green-50' :
                phase === 'upcoming' ? 'bg-indigo-50' :
                'bg-slate-100'
            }`}>
                {icon}
                <div className="absolute top-3 left-3">{phaseBadge}</div>
                {auction.asset_type && (
                    <div className="absolute top-3 right-3">
                        <span className="text-xs text-slate-500 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200">
                            {auction.asset_type}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-slate-900 mb-3 truncate">{name}</h3>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4 text-xs">
                    <div>
                        <p className="text-slate-400">Reserve Price</p>
                        <p className="text-slate-900 font-bold text-sm">{fmtPrice(auction.reserve_price ?? auction.start_price)} <span className="font-normal text-slate-400">USDC</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400">{countdownLabel}</p>
                        <Countdown targetMs={targetMs} phase={phase} />
                    </div>
                    <div>
                        <p className="text-slate-400">Deposit</p>
                        <p className="text-amber-600 font-semibold text-sm">{fmtPrice(auction.deposit_required ?? 0)} USDC</p>
                    </div>
                    <div className="text-right">
                        <p className="text-slate-400">Sealed Bids</p>
                        <p className="text-slate-600 font-medium text-sm flex items-center justify-end gap-1">
                            🔒 {auction.bid_count}
                        </p>
                    </div>
                </div>

                {phase === 'ended' && auction.winner_address && (
                    <div className="mb-3 bg-slate-50 rounded-xl px-3 py-2 text-xs">
                        <span className="text-slate-400">Winner: </span>
                        <span className="font-mono text-slate-700">
                            {auction.winner_address.slice(0, 8)}…{auction.winner_address.slice(-6)}
                        </span>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onView() }}
                        className="flex-1 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 py-2 rounded-2xl transition-colors"
                    >
                        Details
                    </button>
                    {phase === 'live' && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onBid() }}
                            className="flex-1 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-2xl transition-colors"
                        >
                            Place Bid
                        </button>
                    )}
                    {phase === 'upcoming' && (
                        <span className="flex-1 text-sm font-medium bg-indigo-50 text-indigo-400 py-2 rounded-2xl text-center cursor-not-allowed">
                            Not Open Yet
                        </span>
                    )}
                </div>
            </div>
        </button>
    )
}

// ---------------------------------------------------------------------------
// Test controls (hackathon demo) — set start/end to now+30s on-chain
// ---------------------------------------------------------------------------
function TestControls({ auction, phase }: { auction: Auction; phase: Phase }) {
    const [pending, setPending] = useState<'start' | 'end' | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [lastTx, setLastTx] = useState<string | null>(null)

    if (phase === 'ended' || !auction.contract_auction_id) return null

    const call = async (fnName: 'setAuctionStartSoon' | 'setAuctionEndSoon', kind: 'start' | 'end') => {
        const contractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        if (!contractAddress) { setError('Auction contract not configured'); return }
        const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum
        if (!eth) { setError('MetaMask not found'); return }
        setPending(kind)
        setError(null)
        try {
            const provider = new BrowserProvider(eth)
            const signer = await provider.getSigner()
            const contract = new Contract(contractAddress, MaskBidAuctionABI, signer)
            const auctionIdBig = BigInt(auction.contract_auction_id ?? 0)
            const tx = await contract[fnName](auctionIdBig)
            await tx.wait()
            setLastTx(tx.hash as string)
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-600 text-sm font-semibold">🧪 Test Controls</span>
                <span className="text-xs text-amber-500">(admin only — hackathon demo)</span>
            </div>
            <p className="text-xs text-amber-600 mb-4">
                Both functions set the time to <code className="bg-amber-100 px-1 rounded">block.timestamp + 30s</code> on-chain,
                then the CRE workflow syncs the new time to Supabase.
            </p>
            <div className="flex gap-3">
                <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => call('setAuctionStartSoon', 'start')}
                    className="flex-1 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white py-2.5 rounded-2xl transition-colors"
                >
                    {pending === 'start' ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full inline-block" />
                            Setting…
                        </span>
                    ) : 'Set Start → now+30s'}
                </button>
                <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => call('setAuctionEndSoon', 'end')}
                    className="flex-1 text-sm font-semibold bg-orange-500 hover:bg-orange-400 disabled:bg-orange-300 text-white py-2.5 rounded-2xl transition-colors"
                >
                    {pending === 'end' ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full inline-block" />
                            Setting…
                        </span>
                    ) : 'Set End → now+30s'}
                </button>
            </div>
            {error && <p className="text-red-600 text-xs mt-3 break-all">{error}</p>}
            {lastTx && (
                <p className="text-amber-600 text-xs mt-3">
                    ✓ Tx: <span className="font-mono">{lastTx.slice(0, 16)}…</span>
                    {' '}— now run <code className="bg-amber-100 px-1 rounded">cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation</code>
                </p>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Detail view
// ---------------------------------------------------------------------------
function AuctionDetail({ auction, now, onBack, onBid }: {
    auction: Auction; now: number; onBack: () => void; onBid: () => void
}) {
    const phase = getPhase(auction, now)
    const startsAt = new Date(auction.started_at).getTime()
    const endsAt = new Date(auction.ends_at).getTime()
    const targetMs = phase === 'upcoming' ? startsAt - now : endsAt - now

    const name = auction.asset_name ?? `Asset #${auction.token_id ?? auction.asset_id}`
    const icon = TYPE_ICON[(auction.asset_type ?? '').toLowerCase()] ?? '📦'

    const phaseBg = phase === 'live' ? 'bg-green-50' : phase === 'upcoming' ? 'bg-indigo-50' : 'bg-slate-100'

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <button type="button" onClick={onBack} className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block transition-colors">
                    ← Back to Auctions
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left col */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className={`h-64 ${phaseBg} border border-slate-200 rounded-3xl flex items-center justify-center text-8xl`}>
                            {icon}
                        </div>

                        {/* Countdown block */}
                        <div className={`rounded-3xl p-5 border text-center ${
                            phase === 'upcoming' ? 'bg-indigo-50 border-indigo-200' :
                            phase === 'live' ? 'bg-green-50 border-green-200' :
                            'bg-slate-100 border-slate-200'
                        }`}>
                            <p className="text-xs font-medium text-slate-500 mb-1">
                                {phase === 'upcoming' ? 'Bidding opens in' : phase === 'live' ? 'Bidding closes in' : 'Auction ended'}
                            </p>
                            {phase !== 'ended' ? (
                                <p className={`text-3xl font-mono font-bold ${
                                    phase === 'upcoming' ? 'text-indigo-600' :
                                    targetMs < 30 * 60 * 1000 ? 'text-red-500' : 'text-orange-500'
                                }`}>
                                    {formatMs(targetMs)}
                                </p>
                            ) : (
                                <div>
                                    {auction.winner_address ? (
                                        <>
                                            <p className="text-sm text-slate-500 mb-1">Winner</p>
                                            <p className="font-mono font-bold text-slate-900 text-sm break-all">{auction.winner_address}</p>
                                            {auction.winning_amount && (
                                                <p className="text-xs text-slate-400 mt-1">Winning bid: {fmtPrice(auction.winning_amount)} USDC</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-slate-500">Awaiting resolution by Chainlink CRE</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Meta */}
                        <div className="bg-white border border-slate-200 rounded-3xl divide-y divide-slate-100 text-sm">
                            {[
                                { label: 'Seller', value: `${auction.seller_address.slice(0, 8)}…${auction.seller_address.slice(-6)}` },
                                { label: 'Contract Auction ID', value: auction.contract_auction_id != null ? `#${auction.contract_auction_id}` : null },
                                { label: 'Asset ID', value: `#${auction.asset_id}` },
                                { label: 'Token ID', value: auction.token_id != null ? `#${auction.token_id}` : null },
                                { label: 'Start', value: new Date(auction.started_at).toLocaleString() },
                                { label: 'End', value: new Date(auction.ends_at).toLocaleString() },
                            ].filter(r => r.value).map(r => (
                                <div key={r.label} className="flex justify-between px-4 py-3 gap-4">
                                    <span className="text-slate-400 shrink-0">{r.label}</span>
                                    <span className="text-slate-800 font-medium font-mono text-right truncate">{r.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right col */}
                    <div className="lg:col-span-3 space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                            {auction.asset_type && (
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                                    {auction.asset_type}
                                </span>
                            )}
                            {phase === 'live' && (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                                    Live Auction
                                </span>
                            )}
                            {phase === 'upcoming' && (
                                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">⏳ Upcoming</span>
                            )}
                            {phase === 'ended' && (
                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">Ended</span>
                            )}
                        </div>

                        <h1 className="text-3xl font-bold">{name}</h1>

                        {/* Stats grid */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-6">
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Reserve Price</p>
                                    <p className="text-2xl font-bold">{fmtPrice(auction.reserve_price ?? auction.start_price)} <span className="text-base font-normal text-slate-400">USDC</span></p>
                                    <p className="text-xs text-slate-400 mt-0.5">Minimum to qualify</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Required Deposit</p>
                                    <p className="text-2xl font-bold text-amber-600">{fmtPrice(auction.deposit_required ?? 0)} <span className="text-base font-normal text-slate-400">USDC</span></p>
                                    <p className="text-xs text-slate-400 mt-0.5">Refunded to losers</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Sealed Bids</p>
                                    <p className="text-xl font-bold text-slate-900 flex items-center gap-1.5">🔒 {auction.bid_count}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs mb-1">Status</p>
                                    <p className="text-xl font-bold capitalize text-slate-900">{auction.status}</p>
                                </div>
                            </div>

                            {phase === 'live' && (
                                <button
                                    type="button"
                                    onClick={onBid}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-2xl transition-colors text-base"
                                >
                                    Place Sealed Bid
                                </button>
                            )}
                            {phase === 'upcoming' && (
                                <div className="w-full bg-indigo-50 border border-indigo-200 text-indigo-400 font-semibold py-3.5 rounded-2xl text-center text-base">
                                    Bidding opens in {formatMs(targetMs)}
                                </div>
                            )}
                            {phase === 'ended' && (
                                <div className="w-full bg-slate-50 border border-slate-200 text-slate-400 font-semibold py-3.5 rounded-2xl text-center text-base">
                                    Auction Closed
                                </div>
                            )}
                        </div>

                        {/* How it works */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5">
                            <h2 className="font-semibold mb-3 flex items-center gap-2">🔒 How Sealed Bidding Works</h2>
                            <ol className="space-y-2 text-sm text-slate-600">
                                {[
                                    `Deposit ${fmtPrice(auction.deposit_required ?? 0)} USDC — required from all bidders as security.`,
                                    `Enter your bid (min ${fmtPrice(auction.reserve_price ?? 0)} USDC). It is RSA-encrypted before going on-chain.`,
                                    'When the auction ends, Chainlink CRE decrypts all bids in a secure enclave and selects the winner.',
                                    'Winner pays bid amount and receives the RWA token. Losers claim their deposit back.',
                                ].map((text, i) => (
                                    // eslint-disable-next-line react/no-array-index-key
                                    <li key={text.slice(0, 20)} className="flex gap-3">
                                        <span className="text-blue-600 font-bold shrink-0">{i + 1}.</span>
                                        {text}
                                    </li>
                                ))}
                            </ol>
                        </div>

                        <TestControls auction={auction} phase={phase} />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main list
// ---------------------------------------------------------------------------
function AuctionList({
    onView, onBid,
}: {
    onView: (id: string) => void
    onBid: (target: BidTarget) => void
}) {
    const router = useRouter()
    const now = useNow()
    const { auctions, loading, error, refetch } = useAuctions()

    const [statusTab, setStatusTab] = useState<StatusTab>('all')
    const [typeFilter, setTypeFilter] = useState('All')

    const enriched = useMemo(() => auctions.map(a => ({
        ...a,
        _phase: getPhase(a, now),
    })), [auctions, now])

    const counts = useMemo(() => ({
        all: enriched.length,
        upcoming: enriched.filter(a => a._phase === 'upcoming').length,
        live: enriched.filter(a => a._phase === 'live').length,
        ended: enriched.filter(a => a._phase === 'ended').length,
    }), [enriched])

    const filtered = useMemo(() => enriched.filter(a => {
        if (statusTab !== 'all' && a._phase !== statusTab) return false
        if (typeFilter !== 'All') {
            const t = (a.asset_type ?? 'Other').toLowerCase()
            if (t !== typeFilter.toLowerCase()) return false
        }
        return true
    }), [enriched, statusTab, typeFilter])

    const STATUS_TABS: { key: StatusTab; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'live', label: 'Live' },
        { key: 'upcoming', label: 'Upcoming' },
        { key: 'ended', label: 'Ended' },
    ]

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            {/* Header */}
            <div className="bg-slate-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-1">Auctions</h1>
                            <p className="text-slate-400 text-sm flex items-center gap-2">
                                🔒 All bids are sealed and encrypted — only Chainlink CRE reveals the winner.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/auctions/create')}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-5 rounded-2xl transition-colors shrink-0"
                        >
                            + Create Auction
                        </button>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Total', value: counts.all, color: 'text-white' },
                            { label: 'Live Now', value: counts.live, color: 'text-green-400' },
                            { label: 'Upcoming', value: counts.upcoming, color: 'text-indigo-400' },
                            { label: 'Ended', value: counts.ended, color: 'text-slate-400' },
                        ].map(s => (
                            <div key={s.label} className="bg-slate-800 rounded-2xl px-4 py-3">
                                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Status tabs */}
                <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-2xl mb-4 w-fit">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStatusTab(tab.key)}
                            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                                statusTab === tab.key
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-900'
                            }`}
                        >
                            {tab.label}
                            {counts[tab.key] > 0 && (
                                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                                    statusTab === tab.key ? 'bg-white/20' : 'bg-slate-100'
                                }`}>
                                    {counts[tab.key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Type filter chips */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {TYPE_TABS.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                                typeFilter === t
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                            }`}
                        >
                            {TYPE_ICON[t.toLowerCase()] ? `${TYPE_ICON[t.toLowerCase()]} ` : ''}{t}
                        </button>
                    ))}
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <span className="ml-3 text-slate-400 text-sm">Loading auctions…</span>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between">
                        <p className="text-red-700 text-sm">Error: {error}</p>
                        <button type="button" onClick={refetch} className="text-red-600 text-sm underline">Retry</button>
                    </div>
                )}

                {/* Empty */}
                {!loading && filtered.length === 0 && (
                    <div className="text-center py-24">
                        <p className="text-4xl mb-3">🔍</p>
                        <p className="font-medium text-slate-600">No auctions found</p>
                        <p className="text-slate-400 text-sm mt-1">Try a different filter or create one.</p>
                    </div>
                )}

                {/* Grid */}
                {!loading && filtered.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map(auction => (
                            <AuctionCard
                                key={auction.id}
                                auction={auction}
                                now={now}
                                onView={() => onView(auction.id)}
                                onBid={() => onBid(toBidTarget(auction, now))}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
function AuctionsPageInner() {
    const now = useNow()
    const [auctionId, setAuctionId] = useQueryState('auctionId')
    const [bidTarget, setBidTarget] = useState<BidTarget | null>(null)
    const { auctions } = useAuctions()

    const selected = auctionId ? auctions.find(a => a.id === auctionId) ?? null : null

    return (
        <>
            {selected ? (
                <AuctionDetail
                    auction={selected}
                    now={now}
                    onBack={() => setAuctionId(null)}
                    onBid={() => setBidTarget(toBidTarget(selected, now))}
                />
            ) : (
                <AuctionList
                    onView={id => setAuctionId(id)}
                    onBid={target => setBidTarget(target)}
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
