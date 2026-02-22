'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useSDK } from '@metamask/sdk-react'
import { createWalletClient, createPublicClient, custom, http, parseAbi } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'
import { CRECommandBox } from '@/components/CRECommandBox'

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL

const REGISTER_ABI = parseAbi([
    'function registerAsset(string name, string symbol, string assetType, string description, string serialNumber, uint256 reservePrice, uint256 requiredDeposit, uint256 auctionDuration) public',
])

function autoSymbol(name: string, type: string): string {
    const n = name.replace(/\s+/g, '').slice(0, 3).toUpperCase()
    const t = type.slice(0, 1).toUpperCase()
    return `${n}${t}` || 'RWA'
}

export default function RegisterAssetPage() {
    const { account } = useSDK()
    const [form, setForm] = useState({
        name: '',
        type: '',
        description: '',
        serial: '',
        reservePrice: '',
        requiredDeposit: '',
        auctionDuration: '72',
    })
    const [submitting, setSubmitting] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!account) { setError('Wallet not connected'); return }

        setSubmitting(true)
        setError(null)

        try {
            const walletClient = createWalletClient({
                chain: sepolia,
                transport: custom((window as any).ethereum),
            })
            const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

            await walletClient.switchChain({ id: sepolia.id })

            const symbol = autoSymbol(form.name, form.type)

            const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: REGISTER_ABI,
                functionName: 'registerAsset',
                args: [
                    form.name,
                    symbol,
                    form.type.toLowerCase(),
                    form.description,
                    form.serial,
                    BigInt(form.reservePrice || '0'),
                    BigInt(form.requiredDeposit || '0'),
                    BigInt(form.auctionDuration),
                ],
                account: account as `0x${string}`,
            })

            setSubmitting(false)
            setConfirming(true)
            await publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })
            setConfirming(false)
            setTxHash(hash)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Transaction failed')
            setSubmitting(false)
            setConfirming(false)
        }
    }

    if (txHash) {
        return (
            <div className="bg-slate-50 min-h-screen text-slate-900">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
                    <div className="text-center mb-8">
                        <div className="text-5xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold mb-2">Asset Registered On-Chain!</h2>
                        <p className="text-slate-500 text-sm">Now run the CRE command below to sync with Supabase. After that, the verifier will see your asset in the review queue.</p>
                    </div>

                    <CRECommandBox
                        txHash={txHash}
                        steps={[{ label: 'AssetRegistered', eventIndex: 0 }]}
                        onDone={() => { window.location.href = '/my-assets' }}
                    />

                    <div className="mt-6 text-center">
                        <Link href="/my-assets" className="text-blue-600 hover:text-blue-700 text-sm transition-colors">
                            ← Back to My Assets
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
                <Link href="/my-assets" className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block transition-colors">
                    ← Back to My Assets
                </Link>
                <h1 className="text-3xl font-bold mb-2">Register New Asset</h1>
                <p className="text-slate-500 mb-2">Submit a physical asset for verifier review. After approval, it will be minted as a Human-Locked NFT.</p>

                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-8">
                    <span className="text-blue-600 mt-0.5">ℹ️</span>
                    <p className="text-blue-700 text-sm">
                        You set the <span className="font-semibold">reserve price</span>, <span className="font-semibold">required deposit</span>, and <span className="font-semibold">auction duration</span> now. Bidders will submit encrypted sealed bids — you cannot see bid amounts during the auction.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-6 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Asset Name *</label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Rolex Submariner 2023"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Asset Type *</label>
                            <select
                                required
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="">Select type...</option>
                                <option value="Watch">Watch</option>
                                <option value="Art">Art</option>
                                <option value="Real Estate">Real Estate</option>
                                <option value="Gold">Gold</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
                            <textarea
                                required
                                rows={4}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Describe the asset in detail: condition, provenance, authenticity..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Serial / Certificate Number</label>
                            <input
                                type="text"
                                value={form.serial}
                                onChange={e => setForm(f => ({ ...f, serial: e.target.value }))}
                                placeholder="e.g. SUB-2023-00471"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Reserve Price (USDC) *</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="1"
                                    value={form.reservePrice}
                                    onChange={e => setForm(f => ({ ...f, reservePrice: e.target.value }))}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-20 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">USDC</span>
                            </div>
                            <p className="text-slate-400 text-xs mt-1.5">Minimum bid required. Bids below this are rejected by Chainlink CRE.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Required Deposit (USDC) *</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="1"
                                    value={form.requiredDeposit}
                                    onChange={e => setForm(f => ({ ...f, requiredDeposit: e.target.value }))}
                                    placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-20 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">USDC</span>
                            </div>
                            <p className="text-slate-400 text-xs mt-1.5">Fixed amount every bidder must deposit. Recommended: 5–10% of reserve price.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Auction Duration *</label>
                            <select
                                required
                                value={form.auctionDuration}
                                onChange={e => setForm(f => ({ ...f, auctionDuration: e.target.value }))}
                                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="24">24 hours</option>
                                <option value="48">48 hours</option>
                                <option value="72">72 hours (recommended)</option>
                                <option value="168">7 days</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-400 space-y-1">
                        <p>⚠️ <span className="text-slate-600 font-medium">As the seller, you will only see the number of bids</span> — not the amounts. Chainlink CRE decrypts all bids in a secure enclave and pays you the winning USDC amount after settlement.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || confirming || !account}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-colors text-lg flex items-center justify-center gap-2"
                    >
                        {(submitting || confirming) ? (
                            <>
                                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                {confirming ? 'Confirming on-chain…' : 'Waiting for MetaMask…'}
                            </>
                        ) : (
                            'Submit Asset for Verification'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
