'use client'
import Link from 'next/link'
import { useEffect, useState, Suspense } from 'react'
import { useSDK } from '@metamask/sdk-react'
import { useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { createWalletClient, createPublicClient, custom, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'
import { CRECommandBox } from '@/components/CRECommandBox'

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL

const REDEEM_ABI = parseAbi([
    'function redeem(uint256 assetId, uint256 amount, string settlementDetails) public',
])

type AssetState = {
    asset_id: string
    asset_name: string
    issuer: string
    supply: number
    verified: boolean
    token_minted: number
    token_redeemed: number
    asset_type: string | null
    description: string | null
    serial_number: string | null
    reserve_price: number | null
    required_deposit: number | null
    auction_duration: number | null
    created_at: string
}

type WonAuction = {
    id: string
    asset_id: string
    asset_name: string | null
    asset_type: string | null
    winning_amount: number | null
    winner_address: string | null
    resolved_at: string | null
    contract_auction_id: number | null
    token_id: number | null
}

function deriveStatus(a: AssetState): string {
    if (a.token_minted > 0 && a.token_redeemed >= a.token_minted) return 'Redeemed'
    if (a.token_minted > 0) return 'Minted'
    if (a.verified) return 'Verified'
    return 'Pending Verification'
}

const STATUS_STYLES: Record<string, string> = {
    Minted: 'border-status-live/30 text-status-live',
    Verified: 'border-status-won/30 text-status-won',
    'Pending Verification': 'border-gold/30 text-gold',
    Redeemed: 'border-status-ended/30 text-status-ended',
    'In Auction': 'border-status-upcoming/30 text-status-upcoming',
}

const TIMELINE = ['Registered', 'Pending Verification', 'Verified', 'Minted']
const STATUS_STEP: Record<string, number> = {
    Registered: 0,
    'Pending Verification': 1,
    Verified: 2,
    Minted: 3,
    Redeemed: 3,
    'In Auction': 3,
}

const TYPE_ICON: Record<string, string> = {
    watch: '⌚', art: '🎨', gold: '🥇', 'real estate': '🏠', other: '📦',
}

// ---------------------------------------------------------------------------
// Diamond ornament
// ---------------------------------------------------------------------------
function Diamond({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
    return <span className={size === 'xs' ? 'text-gold/30 text-[6px]' : 'text-gold/40 text-[8px]'}>&#9670;</span>
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border ${STATUS_STYLES[status] ?? 'border-border text-dim'}`}>
            <Diamond size="xs" />
            {status}
        </span>
    )
}

// ---------------------------------------------------------------------------
// Asset list
// ---------------------------------------------------------------------------
function fmtPrice(n: number | null): string {
    if (n == null) return '—'
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AssetList({ assets, wonAuctions, loading, onSelect }: {
    assets: AssetState[]; wonAuctions: WonAuction[]; loading: boolean; onSelect: (id: string) => void
}) {
    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-start justify-between mb-10">
                    <div>
                        <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                        <h1 className="font-serif text-4xl font-semibold text-foreground mb-2">My Assets</h1>
                        <div className="flex items-center gap-2 text-dim text-sm font-serif">
                            <Diamond size="xs" />
                            <span>Manage your registered physical assets.</span>
                        </div>
                    </div>
                    <Link
                        href="/my-assets/register"
                        className="btn-ornate text-gold font-serif tracking-wider px-6 py-2.5 text-sm shrink-0"
                    >
                        + Register New Asset
                    </Link>
                </div>

                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
                        <span className="ml-3 text-dim font-serif text-sm">Loading assets…</span>
                    </div>
                )}

                {!loading && assets.length === 0 && wonAuctions.length === 0 && (
                    <div className="text-center py-24">
                        <p className="text-4xl mb-4">&#9670;</p>
                        <p className="font-serif text-foreground text-lg mb-1">No assets yet.</p>
                        <p className="text-dim text-sm font-serif">Register a physical asset or win an auction to get started.</p>
                    </div>
                )}

                {!loading && assets.length > 0 && (
                    <>
                        <h2 className="font-serif text-lg text-muted tracking-wider uppercase mb-4">Registered Assets</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                            {assets.map(asset => {
                                const status = deriveStatus(asset)
                                const icon = TYPE_ICON[asset.asset_type?.toLowerCase() ?? ''] ?? '📦'
                                return (
                                    <div key={asset.asset_id} className="card-hover border border-border overflow-hidden">
                                        <div className="h-32 bg-surface flex items-center justify-center text-6xl border-b border-border">
                                            {icon}
                                        </div>
                                        <div className="p-5">
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                {asset.asset_type && (
                                                    <span className="text-[10px] font-serif tracking-wider text-dim px-2 py-0.5 border border-gold/10">
                                                        {asset.asset_type}
                                                    </span>
                                                )}
                                                <StatusBadge status={status} />
                                            </div>

                                            <h3 className="font-serif text-foreground font-semibold mb-1 truncate">{asset.asset_name}</h3>
                                            <p className="text-dim text-xs font-serif mb-4">
                                                Registered {new Date(asset.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => onSelect(asset.asset_id)}
                                                className="btn-ornate-ghost w-full text-muted hover:text-foreground font-serif tracking-wider text-sm py-2"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {!loading && wonAuctions.length > 0 && (
                    <>
                        <h2 className="font-serif text-lg text-muted tracking-wider uppercase mb-4">Won via Auction</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {wonAuctions.map(auction => {
                                const icon = TYPE_ICON[auction.asset_type?.toLowerCase() ?? ''] ?? '📦'
                                return (
                                    <div key={auction.id} className="card-hover border border-border overflow-hidden">
                                        <div className="h-32 bg-surface flex items-center justify-center text-6xl border-b border-border relative">
                                            {icon}
                                            <div className="absolute top-3 right-3">
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border border-status-won/30 text-status-won">
                                                    <Diamond size="xs" />
                                                    Won
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-5">
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                {auction.asset_type && (
                                                    <span className="text-[10px] font-serif tracking-wider text-dim px-2 py-0.5 border border-gold/10">
                                                        {auction.asset_type}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="font-serif text-foreground font-semibold mb-1 truncate">
                                                {auction.asset_name ?? `Asset #${auction.asset_id}`}
                                            </h3>
                                            <p className="text-dim text-xs font-serif mb-1">
                                                Won for <span className="text-gold font-mono">{fmtPrice(auction.winning_amount)} USDC</span>
                                            </p>
                                            {auction.resolved_at && (
                                                <p className="text-dim text-xs font-serif mb-4">
                                                    {new Date(auction.resolved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            )}

                                            <Link
                                                href={`/auctions?auctionId=${auction.id}`}
                                                className="btn-ornate-ghost w-full text-muted hover:text-foreground font-serif tracking-wider text-sm py-2 block text-center"
                                            >
                                                View Auction
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Asset detail
// ---------------------------------------------------------------------------
function AssetDetail({ asset, onBack }: { asset: AssetState; onBack: () => void }) {
    const { account } = useSDK()
    const router = useRouter()
    const [redeeming, setRedeeming] = useState(false)
    const [redeemConfirming, setRedeemConfirming] = useState(false)
    const [redeemTxHash, setRedeemTxHash] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const status = deriveStatus(asset)
    const currentStep = STATUS_STEP[status] ?? 0
    const icon = TYPE_ICON[asset.asset_type?.toLowerCase() ?? ''] ?? '📦'
    const canRedeem = asset.token_minted > 0 && asset.token_redeemed < asset.token_minted

    const handleRedeem = async () => {
        if (!account) { setError('Wallet not connected'); return }
        setRedeeming(true)
        setError(null)
        try {
            const walletClient = createWalletClient({
                chain: sepolia,
                // biome-ignore lint/suspicious/noExplicitAny: browser provider
                transport: custom((window as any).ethereum),
            })
            const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

            await walletClient.switchChain({ id: sepolia.id })

            const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: REDEEM_ABI,
                functionName: 'redeem',
                args: [BigInt(asset.asset_id), 1n, 'Seller redeemed RWA NFT'],
                account: account as `0x${string}`,
            })

            setRedeeming(false)
            setRedeemConfirming(true)
            await publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })
            setRedeemConfirming(false)
            setRedeemTxHash(hash)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Transaction failed')
            setRedeeming(false)
            setRedeemConfirming(false)
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <button
                    type="button"
                    onClick={onBack}
                    className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-200 mb-8 inline-block"
                >
                    <span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
                    Back to My Assets
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Asset icon */}
                    <div className="frame-ornate h-64 flex items-center justify-center text-8xl">
                        {icon}
                    </div>

                    {/* Info */}
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            {asset.asset_type && (
                                <span className="text-[10px] font-serif tracking-wider text-dim px-2 py-0.5 border border-gold/10">
                                    {asset.asset_type}
                                </span>
                            )}
                            <StatusBadge status={status} />
                        </div>

                        <h1 className="font-serif text-2xl font-semibold text-foreground mb-3">{asset.asset_name}</h1>

                        {asset.description && (
                            <p className="text-muted font-serif text-sm leading-relaxed mb-5">{asset.description}</p>
                        )}

                        <div className="frame-ornate divide-y divide-border text-sm mb-4">
                            {[
                                { label: 'Status', value: status },
                                { label: 'Type', value: asset.asset_type },
                                { label: 'Serial / Certificate', value: asset.serial_number },
                                { label: 'On-chain ID', value: `#${asset.asset_id}` },
                            ].filter(r => r.value).map(row => (
                                <div key={row.label} className="flex justify-between px-4 py-3">
                                    <span className="text-dim font-serif tracking-wide text-xs">{row.label}</span>
                                    <span className="text-foreground font-mono text-xs">{row.value}</span>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="border border-status-error/30 px-4 py-2 text-status-error font-serif text-sm mb-3">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            {(status === 'Verified' || status === 'Minted') && (
                                <button
                                    type="button"
                                    onClick={() => router.push(`/auctions/create?assetId=${asset.asset_id}`)}
                                    className="btn-ornate w-full text-gold font-serif tracking-wider py-3"
                                >
                                    Create Auction
                                </button>
                            )}

                            {canRedeem && !redeemTxHash && (
                                <button
                                    type="button"
                                    onClick={handleRedeem}
                                    disabled={redeeming || redeemConfirming}
                                    className="btn-ornate-ghost w-full text-muted hover:text-foreground font-serif tracking-wider py-3 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {(redeeming || redeemConfirming) ? (
                                        <>
                                            <span className="animate-spin w-4 h-4 border-2 border-border border-t-muted rounded-full inline-block" />
                                            {redeemConfirming ? 'Confirming on-chain…' : 'Waiting for MetaMask…'}
                                        </>
                                    ) : 'Redeem Asset Token'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {redeemTxHash && (
                    <div className="mb-8">
                        <CRECommandBox
                            txHash={redeemTxHash}
                            steps={[{ label: 'TokensRedeemed', eventIndex: 1 }]}
                        />
                    </div>
                )}

                {/* Timeline */}
                <div className="frame-ornate p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-px flex-1 bg-gold/10" />
                        <h2 className="font-serif text-sm text-muted tracking-wider uppercase">Asset Timeline</h2>
                        <div className="h-px flex-1 bg-gold/10" />
                    </div>

                    <div className="flex items-center">
                        {TIMELINE.map((step, i) => (
                            <div key={step} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 flex items-center justify-center text-xs font-mono font-bold border ${
                                        i < currentStep
                                            ? 'border-status-live/40 text-status-live bg-status-live/10'
                                            : i === currentStep
                                            ? 'border-gold/40 text-gold bg-gold/10'
                                            : 'border-border text-dim'
                                    }`}>
                                        {i < currentStep ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs mt-2 text-center max-w-16 leading-tight font-serif ${
                                        i <= currentStep ? 'text-muted' : 'text-dim'
                                    }`}>
                                        {step}
                                    </span>
                                </div>
                                {i < TIMELINE.length - 1 && (
                                    <div className={`flex-1 h-px mx-2 mb-6 ${i < currentStep ? 'bg-status-live/30' : 'bg-border'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
function MyAssetsPageInner() {
    const { account, connected } = useSDK()
    const [assetId, setAssetId] = useQueryState('assetId')
    const [assets, setAssets] = useState<AssetState[]>([])
    const [wonAuctions, setWonAuctions] = useState<WonAuction[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!connected || !account) return
        setLoading(true)
        Promise.all([
            fetch(`/api/assets?seller=${account}`).then(r => r.json()),
            fetch(`/api/auctions?winner=${account}`).then(r => r.json()),
        ])
            .then(([assetsData, auctionsData]) => {
                setAssets(Array.isArray(assetsData) ? assetsData : [])
                setWonAuctions(Array.isArray(auctionsData) ? auctionsData.filter((a: any) => a.status === 'resolved') : [])
            })
            .catch(() => { setAssets([]); setWonAuctions([]) })
            .finally(() => setLoading(false))
    }, [connected, account])

    const selected = assets.find(a => a.asset_id === assetId)

    if (selected) return <AssetDetail asset={selected} onBack={() => setAssetId(null)} />
    return <AssetList assets={assets} wonAuctions={wonAuctions} loading={loading} onSelect={id => setAssetId(id)} />
}

export default function MyAssetsPage() {
    return (
        <Suspense>
            <MyAssetsPageInner />
        </Suspense>
    )
}
