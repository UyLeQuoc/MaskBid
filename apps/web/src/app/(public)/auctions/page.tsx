'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { BrowserProvider, Contract, Interface, type Eip1193Provider } from 'ethers'
import BidModal from '@/components/auction/BidModal'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { CRECommandBox } from '@/components/CRECommandBox'
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
// Diamond ornament
// ---------------------------------------------------------------------------
function Diamond({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
    return <span className={size === 'xs' ? 'text-gold/30 text-[6px]' : 'text-gold/40 text-[8px]'}>&#9670;</span>
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function PhaseBadge({ phase }: { phase: Phase }) {
    if (phase === 'live') return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border border-status-live/30 text-status-live">
            <span className="w-1 h-1 rounded-full bg-status-live animate-pulse inline-block" />
            Live
        </span>
    )
    if (phase === 'upcoming') return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border border-status-upcoming/30 text-status-upcoming">
            <Diamond size="xs" />
            Upcoming
        </span>
    )
    return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border border-status-ended/30 text-status-ended">
            <Diamond size="xs" />
            Ended
        </span>
    )
}

// ---------------------------------------------------------------------------
// Bid target
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
// Countdown
// ---------------------------------------------------------------------------
function Countdown({ targetMs, phase }: { targetMs: number; phase: Phase }) {
    if (phase === 'ended') return <span className="font-mono text-sm text-status-ended">Ended</span>
    const urgent = phase === 'live' && targetMs < 30 * 60 * 1000
    const color = phase === 'upcoming' ? 'text-status-upcoming' : urgent ? 'text-status-error' : 'text-gold'
    return (
        <span className={`font-mono font-bold text-sm ${color} ${urgent ? 'animate-pulse' : ''}`}>
            {formatMs(targetMs)}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Auction card
// ---------------------------------------------------------------------------
function AuctionCard({ auction, now, onView, onBid }: {
    auction: Auction; now: number; onView: () => void; onBid: () => void
}) {
    const phase = getPhase(auction, now)
    const startsAt = new Date(auction.started_at).getTime()
    const endsAt = new Date(auction.ends_at).getTime()
    const targetMs = phase === 'upcoming' ? startsAt - now : endsAt - now
    const name = auction.asset_name ?? `Asset #${auction.token_id ?? auction.asset_id}`
    const icon = TYPE_ICON[(auction.asset_type ?? '').toLowerCase()] ?? '📦'
    const countdownLabel = phase === 'upcoming' ? 'Starts in' : phase === 'live' ? 'Ends in' : 'Status'

    return (
        <div
            role="button"
            tabIndex={0}
            className="card-hover border border-border w-full text-left group cursor-pointer"
            onClick={onView}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView() } }}
        >
            {/* Asset icon area */}
            <div className="h-32 bg-surface flex items-center justify-center text-5xl relative border-b border-border">
                {icon}
                <div className="absolute top-3 left-3">
                    <PhaseBadge phase={phase} />
                </div>
                {auction.asset_type && (
                    <div className="absolute top-3 right-3">
                        <span className="text-[10px] font-serif tracking-wider text-dim px-2 py-1 border border-gold/10">
                            {auction.asset_type}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-4">
                <h3 className="font-serif text-foreground font-semibold mb-3 truncate">{name}</h3>

                {/* Divider */}
                <div className="flex items-center gap-2 mb-3" aria-hidden="true">
                    <div className="flex-1 h-px bg-gold/10" />
                    <Diamond size="xs" />
                    <div className="flex-1 h-px bg-gold/10" />
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-4 text-xs">
                    <div>
                        <p className="text-dim font-serif tracking-wide mb-0.5">Reserve</p>
                        <p className="font-mono text-foreground font-semibold">{fmtPrice(auction.reserve_price ?? auction.start_price)} <span className="text-dim font-normal">USDC</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-dim font-serif tracking-wide mb-0.5">{countdownLabel}</p>
                        <Countdown targetMs={targetMs} phase={phase} />
                    </div>
                    <div>
                        <p className="text-dim font-serif tracking-wide mb-0.5">Deposit</p>
                        <p className="font-mono text-gold font-semibold">{fmtPrice(auction.deposit_required ?? 0)} <span className="text-dim font-normal">USDC</span></p>
                    </div>
                    <div className="text-right">
                        <p className="text-dim font-serif tracking-wide mb-0.5">Sealed Bids</p>
                        <p className="font-mono text-foreground font-semibold">🔒 {auction.bid_count}</p>
                    </div>
                </div>

                {phase === 'ended' && auction.winner_address && (
                    <div className="mb-3 border border-status-won/20 px-3 py-2">
                        <span className="text-dim text-xs font-serif">Winner: </span>
                        <span className="font-mono text-status-won text-xs">
                            {auction.winner_address.slice(0, 8)}…{auction.winner_address.slice(-6)}
                        </span>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onView() }}
                        className="btn-ornate-ghost flex-1 text-sm font-serif tracking-wider text-muted hover:text-foreground py-2"
                    >
                        Details
                    </button>
                    {phase === 'live' && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onBid() }}
                            className="btn-ornate flex-1 text-sm font-serif tracking-wider text-gold py-2"
                        >
                            Place Bid
                        </button>
                    )}
                    {phase === 'upcoming' && (
                        <span className="flex-1 text-sm font-serif tracking-wider text-status-upcoming/50 border border-status-upcoming/10 py-2 text-center cursor-not-allowed">
                            Not Open Yet
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Test controls
// ---------------------------------------------------------------------------
type TestAction = { txHash: string; eventIndex: number; label: string }

function TestControls({ auction, phase }: { auction: Auction; phase: Phase }) {
    const [pending, setPending] = useState<'start' | 'end' | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [lastAction, setLastAction] = useState<TestAction | null>(null)

    if (phase === 'ended' || !auction.contract_auction_id) return null

    const call = async (fnName: 'setAuctionStartSoon' | 'setAuctionEndSoon', kind: 'start' | 'end') => {
        const contractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        if (!contractAddress) { setError('Auction contract not configured'); return }
        const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum
        if (!eth) { setError('MetaMask not found'); return }
        setPending(kind)
        setError(null)
        setLastAction(null)
        try {
            const provider = new BrowserProvider(eth)
            const signer = await provider.getSigner()
            const contract = new Contract(contractAddress, MaskBidAuctionABI, signer)
            const auctionIdBig = BigInt(auction.contract_auction_id ?? 0)
            const tx = await contract[fnName](auctionIdBig)
            const receipt = await tx.wait()

            const iface = new Interface(MaskBidAuctionABI)
            const targetEvent = kind === 'start' ? 'AuctionStartTimeUpdated' : 'AuctionEndTimeUpdated'
            let eventIndex = 0
            for (let i = 0; i < receipt.logs.length; i++) {
                try {
                    const parsed = iface.parseLog({ topics: [...receipt.logs[i].topics], data: receipt.logs[i].data })
                    if (parsed?.name === targetEvent) { eventIndex = i; break }
                } catch { /* skip */ }
            }

            setLastAction({ txHash: receipt.hash, eventIndex, label: targetEvent })
        } catch (e) {
            setError((e as Error).message)
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="frame-ornate-dark p-5 space-y-4">
            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gold/10" />
                <span className="font-serif text-xs text-gold/60 tracking-widest uppercase">Test Controls</span>
                <Diamond size="xs" />
                <span className="font-serif text-xs text-dim tracking-wider">admin · hackathon demo</span>
                <div className="flex-1 h-px bg-gold/10" />
            </div>

            <p className="text-xs text-dim font-serif leading-relaxed">
                <span className="text-gold/60">Set Start</span> sets startTime to{' '}
                <code className="font-mono text-gold/50 text-[10px]">now − 30s</code> (immediately active).{' '}
                <span className="text-gold/60">Set End</span> sets endTime to{' '}
                <code className="font-mono text-gold/50 text-[10px]">now + 30s</code> (ends soon).
                Run CRE after each to sync Supabase.
            </p>

            <div className="flex gap-3">
                <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => call('setAuctionStartSoon', 'start')}
                    className="btn-ornate flex-1 text-sm font-serif tracking-wider text-gold py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {pending === 'start' ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-gold/30 border-t-gold rounded-full inline-block" />
                            Setting…
                        </span>
                    ) : 'Set Start → now−30s'}
                </button>
                <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => call('setAuctionEndSoon', 'end')}
                    className="btn-ornate-ghost flex-1 text-sm font-serif tracking-wider text-muted hover:text-foreground py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {pending === 'end' ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-border border-t-muted rounded-full inline-block" />
                            Setting…
                        </span>
                    ) : 'Set End → now+30s'}
                </button>
            </div>

            {error && <p className="text-status-error text-xs break-all font-mono">{error}</p>}

            {lastAction && (
                <CRECommandBox
                    txHash={lastAction.txHash}
                    command="cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation"
                    steps={[{ label: lastAction.label, eventIndex: lastAction.eventIndex }]}
                    onDone={() => setLastAction(null)}
                />
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Auction detail
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

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back */}
                <button
                    type="button"
                    onClick={onBack}
                    className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-200 mb-8 inline-block"
                >
                    <span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
                    Back to Auctions
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left column */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Asset icon */}
                        <div className="frame-ornate h-64 flex items-center justify-center text-8xl">
                            {icon}
                        </div>

                        {/* Countdown */}
                        <div className="frame-ornate p-5 text-center">
                            <p className="text-xs font-serif tracking-widest uppercase text-dim mb-2">
                                {phase === 'upcoming' ? 'Bidding opens in' : phase === 'live' ? 'Bidding closes in' : 'Auction ended'}
                            </p>
                            {phase !== 'ended' ? (
                                <p className={`text-3xl font-mono font-bold ${
                                    phase === 'upcoming' ? 'text-status-upcoming' :
                                    targetMs < 30 * 60 * 1000 ? 'text-status-error' : 'text-gold'
                                }`}>
                                    {formatMs(targetMs)}
                                </p>
                            ) : (
                                <div>
                                    {auction.winner_address ? (
                                        <>
                                            <p className="text-xs font-serif text-dim mb-1">Winner</p>
                                            <p className="font-mono font-bold text-status-won text-sm break-all">{auction.winner_address}</p>
                                            {auction.winning_amount && (
                                                <p className="text-xs text-dim mt-1 font-mono">{fmtPrice(auction.winning_amount)} USDC</p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm font-serif text-dim">Awaiting resolution by Chainlink CRE</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Meta */}
                        <div className="frame-ornate divide-y divide-border text-sm">
                            {[
                                { label: 'Seller', value: `${auction.seller_address.slice(0, 8)}…${auction.seller_address.slice(-6)}` },
                                { label: 'Contract ID', value: auction.contract_auction_id != null ? `#${auction.contract_auction_id}` : null },
                                { label: 'Asset ID', value: `#${auction.asset_id}` },
                                { label: 'Token ID', value: auction.token_id != null ? `#${auction.token_id}` : null },
                                { label: 'Start', value: new Date(auction.started_at).toLocaleString() },
                                { label: 'End', value: new Date(auction.ends_at).toLocaleString() },
                            ].filter(r => r.value).map(r => (
                                <div key={r.label} className="flex justify-between px-4 py-3 gap-4">
                                    <span className="text-dim font-serif tracking-wide text-xs shrink-0">{r.label}</span>
                                    <span className="text-foreground font-mono text-xs text-right truncate">{r.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="lg:col-span-3 space-y-4">
                        {/* Title + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <PhaseBadge phase={phase} />
                            {auction.asset_type && (
                                <span className="text-[10px] font-serif tracking-wider text-dim px-3 py-1 border border-gold/10">
                                    {auction.asset_type}
                                </span>
                            )}
                        </div>

                        <h1 className="font-serif text-3xl font-semibold text-foreground">{name}</h1>

                        <div className="h-px bg-linear-to-r from-transparent via-gold/20 to-transparent" />

                        {/* Stats */}
                        <div className="frame-ornate p-6">
                            <div className="grid grid-cols-2 gap-6 mb-6">
                                <div>
                                    <p className="text-dim font-serif text-xs tracking-widest uppercase mb-1">Reserve Price</p>
                                    <p className="font-mono text-2xl font-bold text-foreground">
                                        {fmtPrice(auction.reserve_price ?? auction.start_price)}
                                        <span className="text-sm font-normal text-dim ml-1">USDC</span>
                                    </p>
                                    <p className="text-xs text-dim font-serif mt-0.5">Minimum to qualify</p>
                                </div>
                                <div>
                                    <p className="text-dim font-serif text-xs tracking-widest uppercase mb-1">Required Deposit</p>
                                    <p className="font-mono text-2xl font-bold text-gold">
                                        {fmtPrice(auction.deposit_required ?? 0)}
                                        <span className="text-sm font-normal text-dim ml-1">USDC</span>
                                    </p>
                                    <p className="text-xs text-dim font-serif mt-0.5">Refunded to losers</p>
                                </div>
                                <div>
                                    <p className="text-dim font-serif text-xs tracking-widest uppercase mb-1">Sealed Bids</p>
                                    <p className="font-mono text-xl font-bold text-foreground flex items-center gap-1.5">
                                        🔒 {auction.bid_count}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-dim font-serif text-xs tracking-widest uppercase mb-1">Status</p>
                                    <p className="font-serif text-xl font-semibold text-foreground capitalize">{auction.status}</p>
                                </div>
                            </div>

                            {phase === 'live' && (
                                <button
                                    type="button"
                                    onClick={onBid}
                                    className="btn-ornate w-full text-gold font-serif tracking-wider py-3.5 text-base"
                                >
                                    Place Sealed Bid
                                </button>
                            )}
                            {phase === 'upcoming' && (
                                <div className="w-full border border-status-upcoming/20 text-status-upcoming/60 font-serif tracking-wider py-3.5 text-center text-sm">
                                    Bidding opens in {formatMs(targetMs)}
                                </div>
                            )}
                            {phase === 'ended' && (
                                <div className="w-full border border-border text-dim font-serif tracking-wider py-3.5 text-center text-sm">
                                    Auction Closed
                                </div>
                            )}
                        </div>

                        {/* How it works */}
                        <div className="frame-ornate p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-gold/10" />
                                <h2 className="font-serif text-sm text-muted tracking-wider uppercase">How Sealed Bidding Works</h2>
                                <div className="h-px flex-1 bg-gold/10" />
                            </div>
                            <ol className="space-y-3 text-sm text-dim font-serif">
                                {[
                                    `Deposit ${fmtPrice(auction.deposit_required ?? 0)} USDC — required from all bidders as security.`,
                                    `Enter your bid (min ${fmtPrice(auction.reserve_price ?? 0)} USDC). It is RSA-encrypted before going on-chain.`,
                                    'When the auction ends, Chainlink CRE decrypts all bids in a secure enclave and selects the winner.',
                                    'Winner pays bid amount and receives the RWA token. Losers claim their deposit back.',
                                ].map((text, i) => (
                                    // biome-ignore lint/suspicious/noArrayIndexKey: ordered steps
                                    <li key={i} className="flex gap-3">
                                        <span className="text-gold/50 font-serif font-bold shrink-0">{i + 1}.</span>
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
// Auction list
// ---------------------------------------------------------------------------
function AuctionList({ onView, onBid }: {
    onView: (id: string) => void
    onBid: (target: BidTarget) => void
}) {
    const router = useRouter()
    const now = useNow()
    const { auctions, loading, error, refetch } = useAuctions()

    const [statusTab, setStatusTab] = useState<StatusTab>('all')
    const [typeFilter, setTypeFilter] = useState('All')

    const enriched = useMemo(() => auctions.map(a => ({ ...a, _phase: getPhase(a, now) })), [auctions, now])

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
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="pt-24 pb-12 border-b border-gold/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                            <h1 className="font-serif text-4xl font-semibold text-foreground mb-2">Auctions</h1>
                            <div className="flex items-center gap-2 text-dim text-sm font-serif">
                                <Diamond size="xs" />
                                <span>All bids are sealed and encrypted — only Chainlink CRE reveals the winner.</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/auctions/create')}
                            className="btn-ornate text-gold font-serif tracking-wider px-6 py-2.5 text-sm shrink-0"
                        >
                            + Create Auction
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Total', value: counts.all, color: 'text-foreground' },
                            { label: 'Live Now', value: counts.live, color: 'text-status-live' },
                            { label: 'Upcoming', value: counts.upcoming, color: 'text-status-upcoming' },
                            { label: 'Ended', value: counts.ended, color: 'text-status-ended' },
                        ].map(s => (
                            <div key={s.label} className="frame-ornate-dark px-4 py-3">
                                <p className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</p>
                                <p className="text-dim font-serif text-xs mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Status tabs */}
                <div className="flex gap-1 border border-border p-1 mb-4 w-fit">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setStatusTab(tab.key)}
                            className={`px-4 py-1.5 text-sm font-serif tracking-wider transition-all ${
                                statusTab === tab.key
                                    ? 'bg-gold/10 text-gold border border-gold/20'
                                    : 'text-dim hover:text-muted'
                            }`}
                        >
                            {tab.label}
                            {counts[tab.key] > 0 && (
                                <span className={`ml-1.5 text-xs font-mono ${
                                    statusTab === tab.key ? 'text-gold/60' : 'text-dim'
                                }`}>
                                    {counts[tab.key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Type filter */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {TYPE_TABS.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTypeFilter(t)}
                            className={`px-3 py-1 text-sm font-serif tracking-wider transition-colors border ${
                                typeFilter === t
                                    ? 'border-gold/40 text-gold bg-gold/5'
                                    : 'border-border text-dim hover:border-gold/20 hover:text-muted'
                            }`}
                        >
                            {TYPE_ICON[t.toLowerCase()] ? `${TYPE_ICON[t.toLowerCase()]} ` : ''}
                            {t}
                        </button>
                    ))}
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
                        <span className="ml-3 text-dim font-serif text-sm">Loading auctions…</span>
                    </div>
                )}

                {error && (
                    <div className="border border-status-error/30 px-4 py-3 mb-6 flex items-center justify-between">
                        <p className="text-status-error text-sm font-serif">Error: {error}</p>
                        <button type="button" onClick={refetch} className="text-gold text-sm font-serif hover:text-gold/70 transition-colors">Retry</button>
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="text-center py-24">
                        <p className="text-4xl mb-4">&#9670;</p>
                        <p className="font-serif text-foreground text-lg mb-1">No auctions found</p>
                        <p className="text-dim text-sm font-serif">Try a different filter or create one.</p>
                    </div>
                )}

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
