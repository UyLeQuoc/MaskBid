'use client'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider, Contract, type Eip1193Provider } from 'ethers'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import ClaimWinModal from '@/components/auction/ClaimWinModal'
import { env } from '@/configs/env'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type BidStatus = 'active' | 'won' | 'lost' | 'refunded' | 'cancelled'

interface MyBid {
    id: string
    auction_id: string
    bidder_address: string
    status: BidStatus
    escrow_tx_hash: string | null
    refund_tx_hash: string | null
    created_at: string
    auction_status: string | null
    contract_auction_id: number | null
    reserve_price: number | null
    deposit_required: number | null
    seller_address: string | null
    started_at: string | null
    ends_at: string | null
    winner_address: string | null
    winning_amount: number | null
    asset_name: string | null
    asset_type: string | null
}

type ClaimTarget = {
    auctionId: number
    auctionName: string
    winningBid: number
    depositPaid: number
    claimDeadline: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtPrice(n: number | null): string {
    if (n == null) return '—'
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTime(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    const diff = d.getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const hours = Math.floor(diff / 3_600_000)
    const mins = Math.floor((diff % 3_600_000) / 60_000)
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
    return `${hours}h ${mins}m`
}

const TYPE_ICON: Record<string, string> = { watch: '\u231A', art: '\uD83C\uDFA8', 'real estate': '\uD83C\uDFE0', gold: '\uD83E\uDE99' }

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
    active: 'border-status-live/30 text-status-live',
    won: 'border-status-won/30 text-status-won',
    lost: 'border-status-error/30 text-status-error',
    refunded: 'border-status-ended/30 text-status-ended',
    cancelled: 'border-dim/30 text-dim',
}

const STATUS_LABELS: Record<BidStatus, string> = {
    active: 'Active',
    won: 'Won',
    lost: 'Lost',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
}

function StatusBadge({ status }: { status: BidStatus }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border ${STATUS_STYLES[status]}`}>
            <Diamond size="xs" />
            {STATUS_LABELS[status]}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyBidsPage() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [bids, setBids] = useState<MyBid[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null)
    const [refunding, setRefunding] = useState<string | null>(null)

    // Detect connected wallet
    useEffect(() => {
        const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum
        if (!eth) return
        const provider = new BrowserProvider(eth)
        provider.listAccounts().then(accounts => {
            if (accounts.length > 0) setWalletAddress(accounts[0].address)
        }).catch(() => {})

        const onAccountsChanged = (accounts: string[]) => {
            setWalletAddress(accounts[0] ?? null)
        }
        ;(eth as any).on?.('accountsChanged', onAccountsChanged)
        return () => { (eth as any).removeListener?.('accountsChanged', onAccountsChanged) }
    }, [])

    // Fetch bids for connected wallet
    const fetchBids = useCallback(async () => {
        if (!walletAddress) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/bids?bidder=${walletAddress}`)
            if (!res.ok) throw new Error(`Failed to fetch bids: ${res.status}`)
            const data = await res.json()
            setBids(Array.isArray(data) ? data : [])
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }, [walletAddress])

    useEffect(() => { fetchBids() }, [fetchBids])

    // Claim win handler — read on-chain data then open modal
    const handleClaimWin = async (bid: MyBid) => {
        if (bid.contract_auction_id == null) return
        const auctionContractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum
        if (!eth || !auctionContractAddress) return
        try {
            const provider = new BrowserProvider(eth)
            const contract = new Contract(auctionContractAddress, MaskBidAuctionABI, provider)
            const data = await contract.getAuction(BigInt(bid.contract_auction_id))
            setClaimTarget({
                auctionId: bid.contract_auction_id,
                auctionName: bid.asset_name ?? `Auction #${bid.contract_auction_id}`,
                winningBid: Number(data.winningBid),
                depositPaid: Number(data.depositRequired),
                claimDeadline: Number(data.claimDeadline),
            })
        } catch { /* ignore read errors */ }
    }

    // Claim refund handler
    const handleClaimRefund = async (bid: MyBid) => {
        if (bid.contract_auction_id == null) return
        const auctionContractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        const eth = (window as Window & { ethereum?: Eip1193Provider }).ethereum
        if (!eth || !auctionContractAddress) return
        setRefunding(bid.id)
        try {
            const provider = new BrowserProvider(eth)
            const signer = await provider.getSigner()
            const contract = new Contract(auctionContractAddress, MaskBidAuctionABI, signer)
            const tx = await contract.claimRefund(BigInt(bid.contract_auction_id))
            await tx.wait()
            fetchBids()
        } catch (err) {
            const msg = (err as any)?.reason || (err as any)?.message || String(err)
            if (!msg.includes('user rejected') && !msg.includes('ACTION_REJECTED')) {
                alert(`Refund failed: ${msg.length > 100 ? msg.slice(0, 100) + '...' : msg}`)
            }
        } finally {
            setRefunding(null)
        }
    }

    // Stats
    const activeBids = bids.filter(b => b.status === 'active')
    const wonBids = bids.filter(b => b.status === 'won')
    const lostBids = bids.filter(b => b.status === 'lost')
    const totalDepositsLocked = activeBids.reduce((sum, b) => sum + (b.deposit_required ?? 0), 0)

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

                {/* Not connected */}
                {!walletAddress && (
                    <div className="frame-ornate p-10 text-center">
                        <p className="text-muted font-serif mb-2">Connect your wallet to view your bids.</p>
                        <p className="text-dim text-sm font-serif">Use MetaMask to connect.</p>
                    </div>
                )}

                {/* Connected */}
                {walletAddress && (
                    <>
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
                                { label: 'Active Bids', value: `${activeBids.length}`, color: 'text-status-live' },
                                { label: 'Deposits Locked', value: `${fmtPrice(totalDepositsLocked)} USDC`, color: 'text-gold' },
                                { label: 'Auctions Won', value: `${wonBids.length}`, color: 'text-status-won' },
                                { label: 'Deposits to Claim', value: `${lostBids.length}`, color: 'text-status-error' },
                            ].map(stat => (
                                <div key={stat.label} className="frame-ornate-dark px-4 py-3">
                                    <p className="text-dim font-serif text-xs tracking-wide mb-1">{stat.label}</p>
                                    <p className={`font-mono font-bold ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Loading */}
                        {loading && (
                            <div className="frame-ornate p-10 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold mx-auto mb-3" />
                                <p className="text-muted font-serif text-sm">Loading your bids...</p>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="border border-status-error/30 px-4 py-3 mb-8">
                                <p className="text-status-error text-sm">{error}</p>
                            </div>
                        )}

                        {/* Empty state */}
                        {!loading && !error && bids.length === 0 && (
                            <div className="frame-ornate p-10 text-center">
                                <p className="text-muted font-serif mb-4">You haven&apos;t placed any bids yet.</p>
                                <Link
                                    href="/auctions"
                                    className="btn-ornate text-gold font-serif tracking-wider px-8 py-2.5 text-sm"
                                >
                                    Browse Auctions
                                </Link>
                            </div>
                        )}

                        {/* Table */}
                        {!loading && bids.length > 0 && (
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
                                            {bids.map(bid => (
                                                <BidRow
                                                    key={bid.id}
                                                    bid={bid}
                                                    refunding={refunding === bid.id}
                                                    onClaimWin={() => handleClaimWin(bid)}
                                                    onClaimRefund={() => handleClaimRefund(bid)}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Footer CTA */}
                        <div className="text-center">
                            <Link
                                href="/auctions"
                                className="btn-ornate text-gold font-serif tracking-wider px-10 py-3 text-sm"
                            >
                                Browse More Auctions
                            </Link>
                        </div>
                    </>
                )}
            </div>

            {claimTarget && (
                <ClaimWinModal
                    auctionId={claimTarget.auctionId}
                    auctionName={claimTarget.auctionName}
                    winningBid={claimTarget.winningBid}
                    depositPaid={claimTarget.depositPaid}
                    claimDeadline={claimTarget.claimDeadline}
                    onClose={() => { setClaimTarget(null); fetchBids() }}
                />
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Bid row
// ---------------------------------------------------------------------------
function BidRow({ bid, refunding, onClaimWin, onClaimRefund }: {
    bid: MyBid; refunding: boolean; onClaimWin: () => void; onClaimRefund: () => void
}) {
    const name = bid.asset_name ?? `Auction #${bid.contract_auction_id ?? bid.auction_id.slice(0, 8)}`
    const icon = TYPE_ICON[(bid.asset_type ?? '').toLowerCase()] ?? '\uD83D\uDCE6'
    const isWinner = bid.status === 'won' || (
        bid.winner_address?.toLowerCase() === bid.bidder_address.toLowerCase()
    )

    // Determine action
    let action: { label: string; type: 'link' | 'claim-win' | 'refund' | 'refunding' | 'none' } = { label: '—', type: 'none' }
    if (bid.status === 'active') {
        action = { label: 'View Auction', type: 'link' }
    } else if (bid.status === 'won' && isWinner) {
        action = { label: 'Claim Win', type: 'claim-win' }
    } else if (bid.status === 'lost') {
        action = { label: 'Claim Deposit', type: 'refund' }
    } else if (bid.status === 'refunded') {
        action = { label: 'Refunded', type: 'none' }
    }

    return (
        <tr className="hover:bg-surface/50 transition-colors">
            <td className="px-6 py-4">
                <div className="flex items-center gap-2.5">
                    <span className="text-lg">{icon}</span>
                    <p className="text-foreground font-serif font-medium">{name}</p>
                </div>
            </td>
            <td className="px-4 py-4 text-dim font-serif">{bid.asset_type ?? '—'}</td>
            <td className="px-4 py-4 text-right font-mono text-muted">
                {fmtPrice(bid.reserve_price)} <span className="text-dim text-xs">USDC</span>
            </td>
            <td className="px-4 py-4 text-right font-mono">
                <span className={bid.status === 'refunded' ? 'text-dim line-through' : 'text-gold'}>
                    {fmtPrice(bid.deposit_required)}
                </span>
                {bid.status !== 'refunded' && <span className="text-dim text-xs ml-1">USDC</span>}
            </td>
            <td className="px-4 py-4 text-right">
                {bid.status === 'won' && bid.winning_amount ? (
                    <span className="font-mono text-foreground font-semibold">
                        {fmtPrice(bid.winning_amount)} <span className="text-dim text-xs font-normal">USDC</span>
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-dim text-xs border border-border px-2 py-0.5 font-serif">
                        Sealed
                    </span>
                )}
            </td>
            <td className="px-4 py-4 text-center font-mono text-sm">
                <span className={bid.ends_at && new Date(bid.ends_at).getTime() > Date.now() ? 'text-gold' : 'text-status-ended'}>
                    {fmtTime(bid.ends_at)}
                </span>
            </td>
            <td className="px-4 py-4 text-center">
                <StatusBadge status={bid.status} />
            </td>
            <td className="px-6 py-4 text-right">
                {action.type === 'link' && (
                    <Link
                        href={`/auctions?auctionId=${bid.auction_id}`}
                        className="text-sm font-serif text-gold/60 hover:text-gold tracking-wider transition-colors"
                    >
                        {action.label}
                    </Link>
                )}
                {action.type === 'claim-win' && (
                    <button
                        type="button"
                        onClick={onClaimWin}
                        className="text-sm font-serif text-gold/80 hover:text-gold tracking-wider transition-colors"
                    >
                        {action.label}
                    </button>
                )}
                {action.type === 'refund' && (
                    <button
                        type="button"
                        onClick={onClaimRefund}
                        disabled={refunding}
                        className="text-sm font-serif text-muted hover:text-foreground tracking-wider transition-colors disabled:opacity-40"
                    >
                        {refunding ? (
                            <span className="flex items-center gap-1.5">
                                <span className="animate-spin w-3 h-3 border border-gold/30 border-t-gold rounded-full inline-block" />
                                Refunding...
                            </span>
                        ) : action.label}
                    </button>
                )}
                {action.type === 'none' && (
                    <span className="text-sm font-serif text-dim">{action.label}</span>
                )}
            </td>
        </tr>
    )
}
