'use client'
import { useEffect, useState } from 'react'
import { useSDK } from '@metamask/sdk-react'
import { useRouter } from 'next/navigation'
import { createWalletClient, createPublicClient, custom, http, parseAbi, toEventSelector } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'
import { CRECommandBox } from '@/components/CRECommandBox'

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL

const VERIFY_ABI = parseAbi([
    'function verifyAndMint(uint256 assetId, string verificationDetails) public',
])

const ASSET_VERIFIED_TOPIC = toEventSelector(
    'AssetVerified(uint256,bool,string)'
)

type AssetState = {
    asset_id: string
    asset_name: string
    issuer: string
    verified: boolean
    token_minted: number
    asset_type: string | null
    serial_number: string | null
    description: string | null
    created_at: string
}

type VerifyResult = {
    assetId: string
    txHash: string
    eventIndex: number
}

function Diamond({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
    return <span className={size === 'xs' ? 'text-gold/30 text-[6px]' : 'text-gold/40 text-[8px]'}>&#9670;</span>
}

export default function VerifierPage() {
    const { account } = useSDK()
    const router = useRouter()
    const [pending, setPending] = useState<AssetState[]>([])
    const [verified, setVerified] = useState<AssetState[]>([])
    const [loading, setLoading] = useState(true)
    const [verifying, setVerifying] = useState<string | null>(null)
    const [confirming, setConfirming] = useState<string | null>(null)
    const [result, setResult] = useState<VerifyResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchAssets = () => {
        setLoading(true)
        Promise.all([
            fetch('/api/assets?status=pending').then(r => r.json()),
            fetch('/api/assets?status=verified').then(r => r.json()),
        ])
            .then(([p, v]) => {
                setPending(Array.isArray(p) ? p : [])
                setVerified(Array.isArray(v) ? v : [])
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchAssets() }, [])

    const handleVerify = async (asset: AssetState) => {
        if (!account) { setError('Wallet not connected'); return }
        setVerifying(asset.asset_id)
        setConfirming(null)
        setError(null)
        setResult(null)

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
                abi: VERIFY_ABI,
                functionName: 'verifyAndMint',
                args: [BigInt(asset.asset_id), 'Verified by admin'],
                account: account as `0x${string}`,
            })

            setVerifying(null)
            setConfirming(asset.asset_id)

            const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })
            setConfirming(null)

            const idx = receipt.logs.findIndex(
                log => log.topics[0]?.toLowerCase() === ASSET_VERIFIED_TOPIC.toLowerCase()
            )

            setResult({ assetId: asset.asset_id, txHash: hash, eventIndex: idx >= 0 ? idx : 0 })
            fetchAssets()
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Transaction failed')
            setVerifying(null)
            setConfirming(null)
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-10">
                    <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                    <h1 className="font-serif text-4xl font-semibold text-foreground mb-2">Verifier Dashboard</h1>
                    <div className="flex items-center gap-2 text-dim text-sm font-serif">
                        <Diamond size="xs" />
                        <span>Review and authenticate asset submissions.</span>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="border border-status-error/30 px-4 py-3 mb-6">
                        <p className="text-status-error font-serif text-sm">{error}</p>
                    </div>
                )}

                {/* CRE result box */}
                {result && (
                    <div className="mb-8">
                        <CRECommandBox
                            txHash={result.txHash}
                            steps={[{ label: 'AssetVerified', eventIndex: result.eventIndex }]}
                            onDone={() => { setResult(null); router.push('/verifier') }}
                        />
                    </div>
                )}

                {/* ── Pending Queue ── */}
                <div className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-px flex-1 bg-gold/10" />
                        <h2 className="font-serif text-sm text-muted tracking-wider uppercase">Pending Verification</h2>
                        {!loading && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border border-gold/30 text-gold">
                                <Diamond size="xs" />
                                {pending.length}
                            </span>
                        )}
                        <div className="h-px flex-1 bg-gold/10" />
                    </div>

                    {loading && (
                        <div className="flex items-center gap-3 py-10 text-dim font-serif text-sm">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gold" />
                            Loading…
                        </div>
                    )}

                    {!loading && pending.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-dim font-serif text-sm">No assets pending verification.</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {pending.map(item => {
                            const isVerifying = verifying === item.asset_id
                            const isConfirming = confirming === item.asset_id
                            const busy = isVerifying || isConfirming
                            return (
                                <div key={item.asset_id} className="frame-ornate p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                                        <div className="min-w-0">
                                            {/* Badges */}
                                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                                {item.asset_type && (
                                                    <span className="text-[10px] font-serif tracking-wider text-dim px-2 py-0.5 border border-gold/10">
                                                        {item.asset_type}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-serif tracking-wider px-3 py-1 border border-gold/30 text-gold">
                                                    <Diamond size="xs" />
                                                    Pending
                                                </span>
                                            </div>

                                            <h3 className="font-serif text-foreground font-semibold text-lg mb-2">{item.asset_name}</h3>

                                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-dim font-serif">
                                                {item.serial_number && (
                                                    <span>Serial: <span className="font-mono text-muted">{item.serial_number}</span></span>
                                                )}
                                                <span>
                                                    Submitted by:{' '}
                                                    <span className="font-mono text-muted">
                                                        {`${item.issuer.slice(0, 6)}…${item.issuer.slice(-4)}`}
                                                    </span>
                                                </span>
                                                <span>ID: <span className="font-mono text-muted">#{item.asset_id}</span></span>
                                            </div>

                                            {item.description && (
                                                <p className="text-dim font-serif text-xs mt-2 max-w-xl line-clamp-2 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleVerify(item)}
                                            disabled={busy}
                                            className="btn-ornate text-gold font-serif tracking-wider px-6 py-2.5 text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {busy ? (
                                                <>
                                                    <span className="animate-spin w-3.5 h-3.5 border-2 border-gold/30 border-t-gold rounded-full inline-block" />
                                                    {isConfirming ? 'Confirming…' : 'Waiting for MetaMask…'}
                                                </>
                                            ) : 'Verify Asset'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ── Recently Verified ── */}
                <div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-px flex-1 bg-gold/10" />
                        <h2 className="font-serif text-sm text-muted tracking-wider uppercase">Recently Verified</h2>
                        <div className="h-px flex-1 bg-gold/10" />
                    </div>

                    {!loading && verified.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-dim font-serif text-sm">No verified assets yet.</p>
                        </div>
                    )}

                    {verified.length > 0 && (
                        <div className="frame-ornate overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="text-left px-6 py-4 text-dim font-serif text-xs tracking-widest uppercase">Asset</th>
                                        <th className="text-left px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Type</th>
                                        <th className="text-left px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Owner</th>
                                        <th className="text-left px-4 py-4 text-dim font-serif text-xs tracking-widest uppercase">Minted</th>
                                        <th className="text-right px-6 py-4 text-dim font-serif text-xs tracking-widest uppercase">ID</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {verified.map(item => (
                                        <tr key={item.asset_id} className="hover:bg-surface/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 bg-status-live inline-block shrink-0" />
                                                    <span className="font-serif text-foreground font-medium">{item.asset_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-dim font-serif">{item.asset_type ?? '—'}</td>
                                            <td className="px-4 py-4 font-mono text-muted text-xs">
                                                {`${item.issuer.slice(0, 6)}…${item.issuer.slice(-4)}`}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-muted text-xs">
                                                {item.token_minted > 0 ? (
                                                    <span className="text-status-live">{item.token_minted} token</span>
                                                ) : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-dim text-xs">
                                                #{item.asset_id}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
