'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useSDK } from '@metamask/sdk-react'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AssetState = {
    asset_id: string
    asset_name: string
    issuer: string
    verified: boolean
    token_minted: number
    token_redeemed: number
    asset_type: string | null
    created_at: string
}

type WonAuction = {
    id: string
    asset_name: string | null
    asset_type: string | null
    winning_amount: number | null
    status: string
}

type MyBid = {
    id: string
    auction_id: string
    status: string
    deposit_required: number | null
    asset_name: string | null
    asset_type: string | null
    reserve_price: number | null
    ends_at: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function deriveAssetStatus(a: AssetState): string {
    if (a.token_minted > 0 && a.token_redeemed >= a.token_minted) return 'Redeemed'
    if (a.token_minted > 0) return 'Minted'
    if (a.verified) return 'Verified'
    return 'Pending Verification'
}

function fmtTime(iso: string | null): string {
    if (!iso) return '—'
    const diff = new Date(iso).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const hours = Math.floor(diff / 3_600_000)
    const mins = Math.floor((diff % 3_600_000) / 60_000)
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`
    return `${hours}h ${mins}m`
}

const STATUS_MAP: Record<string, { border: string; text: string }> = {
    Minted: { border: 'border-status-live/30', text: 'text-status-live' },
    Verified: { border: 'border-status-won/30', text: 'text-status-won' },
    'Pending Verification': { border: 'border-gold/20', text: 'text-gold' },
    Redeemed: { border: 'border-status-ended/30', text: 'text-status-ended' },
}

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL

const KYC_READ_ABI = [
    {
        name: 'isKYCVerified',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
    },
] as const

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
    const { account } = useSDK()
    const [assets, setAssets] = useState<AssetState[]>([])
    const [bids, setBids] = useState<MyBid[]>([])
    const [wonAuctions, setWonAuctions] = useState<WonAuction[]>([])
    const [kycVerified, setKycVerified] = useState<boolean | null>(null)
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        if (!account) return
        setLoading(true)
        try {
            const [assetsRes, bidsRes, wonRes] = await Promise.all([
                fetch(`/api/assets?seller=${account}`),
                fetch(`/api/bids?bidder=${account}`),
                fetch(`/api/auctions?winner=${account}`),
            ])
            const assetsData = await assetsRes.json()
            const bidsData = await bidsRes.json()
            const wonData = await wonRes.json()
            setAssets(Array.isArray(assetsData) ? assetsData : [])
            setBids(Array.isArray(bidsData) ? bidsData : [])
            setWonAuctions(Array.isArray(wonData) ? wonData.filter((a: any) => a.status === 'resolved') : [])
        } catch {
            setAssets([])
            setBids([])
            setWonAuctions([])
        } finally {
            setLoading(false)
        }
    }, [account])

    // Check KYC
    useEffect(() => {
        if (!account) return
        const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
        publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: KYC_READ_ABI,
            functionName: 'isKYCVerified',
            args: [account as `0x${string}`],
        }).then(v => setKycVerified(!!v)).catch(() => setKycVerified(false))
    }, [account])

    useEffect(() => { fetchData() }, [fetchData])

    // Derived stats
    const activeBids = bids.filter(b => b.status === 'active')
    const wonBids = bids.filter(b => b.status === 'won')
    const totalDepositsLocked = activeBids.reduce((sum, b) => sum + (b.deposit_required ?? 0), 0)

    return (
        <div className="min-h-screen pt-24 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-10">
                    <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                    <h1 className="font-serif text-3xl font-semibold text-foreground">Dashboard</h1>
                    {account && (
                        <p className="text-dim text-xs font-mono mt-1">{account}</p>
                    )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {[
                        {
                            label: 'Active Bids',
                            value: loading ? '—' : String(activeBids.length),
                            sub: activeBids.length > 0 ? `${wonBids.length} won` : 'Sealed & encrypted',
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                            ),
                        },
                        {
                            label: 'My Assets',
                            value: loading ? '—' : String(assets.length + wonAuctions.length),
                            sub: loading ? 'In your portfolio' : [
                                assets.length > 0 ? `${assets.length} registered` : '',
                                wonAuctions.length > 0 ? `${wonAuctions.length} won` : '',
                            ].filter(Boolean).join(', ') || 'In your portfolio',
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                            ),
                        },
                        {
                            label: 'KYC Status',
                            value: kycVerified === null ? '—' : kycVerified ? 'Verified' : 'Not Verified',
                            sub: kycVerified ? 'World ID verified' : 'Complete KYC to bid',
                            icon: (
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                </svg>
                            ),
                        },
                        {
                            label: 'Deposits Locked',
                            value: loading ? '—' : totalDepositsLocked.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                            sub: 'USDC in active bids',
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

                        {loading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold" />
                            </div>
                        )}

                        {!loading && activeBids.length === 0 && (
                            <p className="text-dim font-serif text-sm py-6 text-center">No active bids.</p>
                        )}

                        {!loading && activeBids.length > 0 && (
                            <>
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
                                        {activeBids.slice(0, 5).map((bid) => (
                                            <tr key={bid.id} className="border-b border-border last:border-0">
                                                <td className="py-3">
                                                    <p className="text-foreground font-medium text-sm">{bid.asset_name ?? `Auction`}</p>
                                                    <p className="text-dim text-xs">{bid.asset_type ?? '—'}</p>
                                                </td>
                                                <td className="py-3 text-right text-muted font-mono text-xs">
                                                    {bid.reserve_price?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}
                                                </td>
                                                <td className="py-3 text-right text-gold font-mono text-xs">
                                                    {bid.deposit_required?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}
                                                </td>
                                                <td className="py-3 text-right text-gold/60 font-mono text-xs">
                                                    {fmtTime(bid.ends_at)}
                                                </td>
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
                            </>
                        )}
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

                        {loading && (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold" />
                            </div>
                        )}

                        {!loading && assets.length === 0 && wonAuctions.length === 0 && (
                            <p className="text-dim font-serif text-sm py-6 text-center">No assets yet.</p>
                        )}

                        {!loading && (
                            <div className="space-y-3">
                                {assets.slice(0, 5).map((asset) => {
                                    const status = deriveAssetStatus(asset)
                                    const colors = STATUS_MAP[status] || { border: 'border-border', text: 'text-muted' }
                                    return (
                                        <Link
                                            key={asset.asset_id}
                                            href={`/my-assets?assetId=${asset.asset_id}`}
                                            className="flex items-center justify-between border border-border hover:border-gold/15 px-4 py-3 transition-colors"
                                        >
                                            <div>
                                                <p className="text-foreground font-medium text-sm">{asset.asset_name}</p>
                                                <p className="text-dim text-xs">{asset.asset_type ?? '—'}</p>
                                            </div>
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-serif tracking-wider px-2.5 py-1 border ${colors.border} ${colors.text}`}>
                                                <span className="text-[6px]">&#9670;</span>
                                                {status}
                                            </span>
                                        </Link>
                                    )
                                })}
                                {wonAuctions.slice(0, 5 - assets.length).map((auction) => (
                                    <Link
                                        key={auction.id}
                                        href={`/auctions?auctionId=${auction.id}`}
                                        className="flex items-center justify-between border border-border hover:border-gold/15 px-4 py-3 transition-colors"
                                    >
                                        <div>
                                            <p className="text-foreground font-medium text-sm">{auction.asset_name ?? 'Won Asset'}</p>
                                            <p className="text-dim text-xs">{auction.asset_type ?? '—'}</p>
                                        </div>
                                        <span className="inline-flex items-center gap-1.5 text-xs font-serif tracking-wider px-2.5 py-1 border border-status-won/30 text-status-won">
                                            <span className="text-[6px]">&#9670;</span>
                                            Won
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
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
    )
}
