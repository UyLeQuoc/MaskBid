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
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Verifier Dashboard</h1>
                    <p className="text-slate-500">Review and authenticate asset submissions.</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-6 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="mb-8">
                        <CRECommandBox
                            txHash={result.txHash}
                            steps={[{ label: 'AssetVerified', eventIndex: result.eventIndex }]}
                            onDone={() => { setResult(null); router.push('/verifier') }}
                        />
                    </div>
                )}

                {/* Pending Queue */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-5">
                        <h2 className="text-slate-900 font-semibold text-xl">Pending Verification</h2>
                        {!loading && (
                            <span className="bg-orange-50 text-orange-500 text-xs font-bold px-2.5 py-1 rounded-full">
                                {pending.length}
                            </span>
                        )}
                    </div>

                    {loading && (
                        <div className="flex items-center gap-3 py-8 text-slate-400">
                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Loading...
                        </div>
                    )}

                    {!loading && pending.length === 0 && (
                        <p className="text-slate-400 text-sm py-4">No assets pending verification.</p>
                    )}

                    <div className="space-y-4">
                        {pending.map(item => {
                            const isVerifying = verifying === item.asset_id
                            const isConfirming = confirming === item.asset_id
                            const busy = isVerifying || isConfirming
                            return (
                                <div key={item.asset_id} className="bg-white border border-slate-200 rounded-3xl p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                {item.asset_type && (
                                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.asset_type}</span>
                                                )}
                                                <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Pending</span>
                                            </div>
                                            <h3 className="text-slate-900 font-semibold text-lg mb-1">{item.asset_name}</h3>
                                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                                                {item.serial_number && (
                                                    <span>Serial: <span className="text-slate-600 font-mono">{item.serial_number}</span></span>
                                                )}
                                                <span>Submitted by: <span className="text-slate-600 font-mono">{`${item.issuer.slice(0, 6)}...${item.issuer.slice(-4)}`}</span></span>
                                                <span>ID: <span className="text-slate-600 font-mono">#{item.asset_id}</span></span>
                                            </div>
                                            {item.description && (
                                                <p className="text-slate-400 text-sm mt-2 max-w-xl line-clamp-2">{item.description}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleVerify(item)}
                                            disabled={busy}
                                            className="bg-green-600 hover:bg-green-500 disabled:bg-green-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-2xl transition-colors flex items-center gap-2 shrink-0"
                                        >
                                            {busy ? (
                                                <>
                                                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
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

                {/* Recently Verified */}
                <div>
                    <h2 className="text-slate-900 font-semibold text-xl mb-5">Recently Verified</h2>
                    {!loading && verified.length === 0 && (
                        <p className="text-slate-400 text-sm">No verified assets yet.</p>
                    )}
                    {verified.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 text-xs border-b border-slate-200">
                                        <th className="text-left px-6 py-4">Asset</th>
                                        <th className="text-left px-4 py-4">Type</th>
                                        <th className="text-left px-4 py-4">Owner</th>
                                        <th className="text-left px-4 py-4">Minted</th>
                                        <th className="text-right px-6 py-4">ID</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {verified.map(item => (
                                        <tr key={item.asset_id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                                                    <span className="text-slate-900 font-medium">{item.asset_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-slate-500">{item.asset_type ?? '—'}</td>
                                            <td className="px-4 py-4 font-mono text-slate-600">{`${item.issuer.slice(0, 6)}...${item.issuer.slice(-4)}`}</td>
                                            <td className="px-4 py-4 text-slate-600">{item.token_minted > 0 ? `${item.token_minted} NFT` : '—'}</td>
                                            <td className="px-6 py-4 text-right text-slate-400 font-mono">#{item.asset_id}</td>
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
