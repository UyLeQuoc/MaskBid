'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useSDK } from '@metamask/sdk-react'
import { useRouter } from 'next/navigation'
import { createWalletClient, createPublicClient, custom, http, parseAbi, toEventSelector } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'
import { CRECommandBox } from '@/components/CRECommandBox'

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL

const REGISTER_ABI = parseAbi([
    'function registerAsset(string name, string symbol, string assetType, string description, string serialNumber, uint256 reservePrice, uint256 requiredDeposit, uint256 auctionDuration) public',
])

const ASSET_REGISTERED_TOPIC = toEventSelector(
    'AssetRegistered(uint256,address,string,string,string,string,string,uint256,uint256,uint256)'
)

function autoSymbol(name: string, type: string): string {
    const n = name.replace(/\s+/g, '').slice(0, 3).toUpperCase()
    const t = type.slice(0, 1).toUpperCase()
    return `${n}${t}` || 'RWA'
}

// ---------------------------------------------------------------------------
// Diamond ornament
// ---------------------------------------------------------------------------
function Diamond({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
    return <span className={size === 'xs' ? 'text-gold/30 text-[6px]' : 'text-gold/40 text-[8px]'}>&#9670;</span>
}

// ---------------------------------------------------------------------------
// Form field wrapper
// ---------------------------------------------------------------------------
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-serif text-muted tracking-wide mb-2">{label}</label>
            {children}
            {hint && <p className="text-dim text-xs font-serif mt-1.5">{hint}</p>}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RegisterAssetPage() {
    const { account } = useSDK()
    const router = useRouter()
    const [form, setForm] = useState({ name: '', type: '', description: '', serial: '' })
    const [submitting, setSubmitting] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [eventIndex, setEventIndex] = useState(0)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault()
        if (!account) { setError('Wallet not connected'); return }

        setSubmitting(true)
        setError(null)

        try {
            const walletClient = createWalletClient({
                chain: sepolia,
                // biome-ignore lint/suspicious/noExplicitAny: browser provider
                transport: custom((window as any).ethereum),
            })
            const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })

            await walletClient.switchChain({ id: sepolia.id })

            const symbol = autoSymbol(form.name, form.type)

            const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: REGISTER_ABI,
                functionName: 'registerAsset',
                args: [form.name, symbol, form.type.toLowerCase(), form.description, form.serial, 0n, 0n, 0n],
                account: account as `0x${string}`,
            })

            setSubmitting(false)
            setConfirming(true)
            const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })
            setConfirming(false)

            const idx = receipt.logs.findIndex(
                log => log.topics[0]?.toLowerCase() === ASSET_REGISTERED_TOPIC.toLowerCase()
            )
            setEventIndex(idx >= 0 ? idx : 0)
            setTxHash(hash)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Transaction failed')
            setSubmitting(false)
            setConfirming(false)
        }
    }

    // Success state
    if (txHash) {
        return (
            <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
                <div className="max-w-2xl mx-auto px-4 sm:px-6">
                    <div className="frame-ornate p-10 text-center mb-6">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <div className="h-px flex-1 bg-gold/10" />
                            <span className="text-status-live text-2xl">&#9670;</span>
                            <div className="h-px flex-1 bg-gold/10" />
                        </div>
                        <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Asset Registered On-Chain!</h2>
                        <p className="text-dim font-serif text-sm leading-relaxed">
                            Now run the CRE command below to sync with Supabase.
                            After that, the verifier will see your asset in the review queue.
                        </p>
                    </div>

                    <CRECommandBox
                        txHash={txHash}
                        steps={[{ label: 'AssetRegistered', eventIndex }]}
                        onDone={() => router.push('/my-assets')}
                    />

                    <div className="mt-6 text-center">
                        <Link
                            href="/my-assets"
                            className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-200"
                        >
                            <span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
                            Back to My Assets
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const isSubmitting = submitting || confirming

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                {/* Back */}
                <Link
                    href="/my-assets"
                    className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-200 mb-8 inline-block"
                >
                    <span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
                    Back to My Assets
                </Link>

                {/* Page header */}
                <div className="mb-10">
                    <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                    <h1 className="font-serif text-4xl font-semibold text-foreground mb-2">Register New Asset</h1>
                    <div className="flex items-center gap-2 text-dim text-sm font-serif">
                        <Diamond size="xs" />
                        <span>Submit a physical asset for verifier review. After approval, it will be minted as a tokenized RWA.</span>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="border border-status-error/30 px-4 py-3 mb-6">
                        <p className="text-status-error font-serif text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="frame-ornate p-8 space-y-6 mb-6">
                        <Field id="name" label="Asset Name *" hint="Full name of the physical asset">
                            <input
                                id="name"
                                type="text"
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Rolex Submariner 2023"
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim"
                            />
                        </Field>

                        <div className="h-px bg-gold/10" />

                        <Field id="type" label="Asset Type *">
                            <select
                                id="type"
                                required
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full bg-surface border border-border text-foreground text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 appearance-none cursor-pointer"
                            >
                                <option value="">Select type…</option>
                                <option value="Watch">Watch</option>
                                <option value="Art">Art</option>
                                <option value="Real Estate">Real Estate</option>
                                <option value="Gold">Gold</option>
                                <option value="Other">Other</option>
                            </select>
                        </Field>

                        <Field id="description" label="Description *" hint="Describe condition, provenance, authenticity…">
                            <textarea
                                id="description"
                                required
                                rows={4}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Describe the asset in detail: condition, provenance, authenticity..."
                                className="w-full bg-surface border border-border text-foreground text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim resize-none"
                            />
                        </Field>

                        <div className="h-px bg-gold/10" />

                        <Field id="serial" label="Serial / Certificate Number" hint="Optional — used for verifier authentication">
                            <input
                                id="serial"
                                type="text"
                                value={form.serial}
                                onChange={e => setForm(f => ({ ...f, serial: e.target.value }))}
                                placeholder="e.g. SUB-2023-00471"
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim"
                            />
                        </Field>
                    </div>

                    {/* Note */}
                    <div className="flex items-start gap-3 border border-gold/10 px-4 py-3 mb-6">
                        <Diamond />
                        <p className="text-dim font-serif text-xs leading-relaxed">
                            Submitting this asset will call the <span className="font-mono text-gold/50 text-[10px]">registerAsset</span> function on-chain.
                            A verifier will review and approve before minting. This requires a MetaMask transaction on Sepolia.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !account}
                        className="btn-ornate w-full text-gold font-serif tracking-wider py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="animate-spin w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full inline-block" />
                                {confirming ? 'Confirming on-chain…' : 'Waiting for MetaMask…'}
                            </>
                        ) : 'Submit Asset for Verification'}
                    </button>
                </form>
            </div>
        </div>
    )
}
