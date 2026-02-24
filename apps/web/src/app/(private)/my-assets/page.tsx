'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSDK } from '@metamask/sdk-react'
import { useQueryState } from 'nuqs'
import { Suspense } from 'react'
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

function deriveStatus(a: AssetState): string {
    if (a.token_minted > 0 && a.token_redeemed >= a.token_minted) return 'Redeemed'
    if (a.token_minted > 0) return 'Minted'
    if (a.verified) return 'Verified'
    return 'Pending Verification'
}

const STATUS_COLORS: Record<string, string> = {
    'Minted': 'text-green-600 bg-green-100 border-green-200',
    'Verified': 'text-green-600 bg-green-100 border-green-200',
    'Pending Verification': 'text-orange-500 bg-orange-50 border-orange-200',
    'Redeemed': 'text-slate-500 bg-slate-100 border-slate-200',
    'In Auction': 'text-blue-600 bg-blue-50 border-blue-200',
}

const TIMELINE = ['Registered', 'Pending Verification', 'Verified', 'Minted']
const STATUS_STEP: Record<string, number> = {
    'Registered': 0,
    'Pending Verification': 1,
    'Verified': 2,
    'Minted': 3,
    'Redeemed': 3,
    'In Auction': 3,
}

type AssetIcon = Record<string, string>
const TYPE_ICON: AssetIcon = {
    watch: '⌚', art: '🎨', gold: '🥇', 'real estate': '🏠', other: '📦',
}

function AssetList({ assets, loading, onSelect }: { assets: AssetState[], loading: boolean, onSelect: (id: string) => void }) {
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

                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                )}

                {!loading && assets.length === 0 && (
                    <div className="text-center py-20 text-slate-400">
                        <p className="text-4xl mb-4">📦</p>
                        <p className="font-medium">No assets registered yet.</p>
                        <p className="text-sm mt-1">Register your first physical asset to get started.</p>
                    </div>
                )}

                {!loading && assets.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assets.map(asset => {
                            const status = deriveStatus(asset)
                            const icon = TYPE_ICON[asset.asset_type?.toLowerCase() ?? ''] ?? '📦'
                            return (
                                <div key={asset.asset_id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-slate-300 transition-colors">
                                    <div className="h-36 bg-slate-100 flex items-center justify-center text-6xl">
                                        {icon}
                                    </div>
                                    <div className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            {asset.asset_type && (
                                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{asset.asset_type}</span>
                                            )}
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[status]}`}>
                                                {status}
                                            </span>
                                        </div>
                                        <h3 className="text-slate-900 font-semibold mb-1">{asset.asset_name}</h3>
                                        <p className="text-slate-400 text-xs mb-4">
                                            Registered {new Date(asset.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => onSelect(asset.asset_id)}
                                            className="block w-full text-center bg-slate-100 border border-slate-200 text-slate-900 text-sm font-medium py-2 rounded-2xl transition-colors hover:bg-slate-200"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function AssetDetail({ asset, onBack }: { asset: AssetState, onBack: () => void }) {
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
                        {icon}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            {asset.asset_type && (
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{asset.asset_type}</span>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold mb-4">{asset.asset_name}</h1>
                        {asset.description && (
                            <p className="text-slate-600 text-sm leading-relaxed mb-6">{asset.description}</p>
                        )}

                        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 text-sm mb-4">
                            {[
                                { label: 'Status', value: status },
                                { label: 'Type', value: asset.asset_type },
                                { label: 'Serial / Certificate', value: asset.serial_number },
                                { label: 'On-chain ID', value: `#${asset.asset_id}` },
                            ].filter(r => r.value).map(row => (
                                <div key={row.label} className="flex justify-between px-4 py-3">
                                    <span className="text-slate-400">{row.label}</span>
                                    <span className="text-slate-900 font-medium">{row.value}</span>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-red-700 text-sm mb-3">
                                {error}
                            </div>
                        )}

                        {(status === 'Verified' || status === 'Minted') && (
                            <button
                                type="button"
                                onClick={() => router.push(`/auctions/create?assetId=${asset.asset_id}`)}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Create Auction
                            </button>
                        )}

                        {canRedeem && !redeemTxHash && (
                            <button
                                type="button"
                                onClick={handleRedeem}
                                disabled={redeeming || redeemConfirming}
                                className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                            >
                                {(redeeming || redeemConfirming) ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {redeemConfirming ? 'Confirming on-chain…' : 'Waiting for MetaMask…'}
                                    </>
                                ) : 'Redeem NFT'}
                            </button>
                        )}
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
    const { account, connected } = useSDK()
    const [assetId, setAssetId] = useQueryState('assetId')
    const [assets, setAssets] = useState<AssetState[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!connected || !account) return
        setLoading(true)
        fetch(`/api/assets?seller=${account}`)
            .then(r => r.json())
            .then((data: AssetState[]) => setAssets(Array.isArray(data) ? data : []))
            .catch(() => setAssets([]))
            .finally(() => setLoading(false))
    }, [connected, account])

    const selected = assets.find(a => a.asset_id === assetId)

    if (selected) {
        return <AssetDetail asset={selected} onBack={() => setAssetId(null)} />
    }

    return <AssetList assets={assets} loading={loading} onSelect={id => setAssetId(id)} />
}

export default function MyAssetsPage() {
    return (
        <Suspense>
            <MyAssetsPageInner />
        </Suspense>
    )
}
