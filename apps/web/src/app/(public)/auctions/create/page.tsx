'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrowserProvider, Contract, Interface } from 'ethers'
import { useSDK } from '@metamask/sdk-react'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { env } from '@/configs/env'
import { CRECommandBox } from '@/components/CRECommandBox'

type Step = 'connect' | 'form' | 'approving' | 'creating' | 'success' | 'error'

const ERC1155_APPROVAL_ABI = [
    'function setApprovalForAll(address operator, bool approved) external',
    'function isApprovedForAll(address account, address operator) external view returns (bool)',
    'function balanceOf(address account, uint256 id) external view returns (uint256)',
] as const

type EthProvider = ConstructorParameters<typeof BrowserProvider>[0] & {
    request: (args: { method: string }) => Promise<unknown>
}

function getEthereum(): EthProvider | null {
    if (typeof window === 'undefined') return null
    return ((window as Window & { ethereum?: EthProvider }).ethereum) ?? null
}

function toDatetimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultStartTime(): string {
    return toDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000))
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
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-sm font-serif text-muted tracking-wide mb-2">{label}</label>
            {children}
            {hint && <p className="text-dim text-xs font-serif mt-1.5">{hint}</p>}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
function CreateAuctionForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { connected, account } = useSDK()

    const assetId = searchParams.get('assetId') ?? ''

    const [step, setStep] = useState<Step>('connect')
    const [error, setError] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [auctionId, setAuctionId] = useState<string | null>(null)
    const [auctionEventIndex, setAuctionEventIndex] = useState(0)

    const [tokenId, setTokenId] = useState(assetId)
    const tokenAmount = '1'
    const [reservePrice, setReservePrice] = useState('')
    const [depositRequired, setDepositRequired] = useState('')
    const [startTimeLocal, setStartTimeLocal] = useState(defaultStartTime)
    const [durationHours, setDurationHours] = useState('24')

    useEffect(() => {
        if (connected && account && step === 'connect') setStep('form')
    }, [connected, account, step])

    const connectWallet = async () => {
        const eth = getEthereum()
        if (!eth) { setError('MetaMask not installed'); return }
        try {
            await eth.request({ method: 'eth_requestAccounts' })
            setStep('form')
        } catch (err) {
            setError(`Failed to connect wallet: ${(err as Error).message}`)
        }
    }

    const createAuction = async () => {
        if (!account) { setError('Wallet not connected'); return }

        const parsedTokenId = Number(tokenId)
        if (!Number.isInteger(parsedTokenId) || parsedTokenId <= 0) {
            setError('Token ID must be a positive integer'); return
        }
        const parsedReservePrice = Number(reservePrice)
        if (!Number.isFinite(parsedReservePrice) || parsedReservePrice <= 0) {
            setError('Reserve price must be greater than 0'); return
        }
        const parsedDepositRequired = Number(depositRequired)
        if (!Number.isFinite(parsedDepositRequired) || parsedDepositRequired <= 0) {
            setError('Required deposit must be greater than 0'); return
        }
        const parsedDurationHours = Number(durationHours)
        if (!Number.isFinite(parsedDurationHours) || parsedDurationHours < 1) {
            setError('Duration must be at least 1 hour'); return
        }

        const startTimestampMs = new Date(startTimeLocal).getTime()
        if (Number.isNaN(startTimestampMs)) { setError('Invalid start time'); return }
        if (startTimestampMs <= Date.now()) { setError('Start time must be in the future'); return }

        const contractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        if (!contractAddress) { setError('Auction contract not configured'); return }

        const eth = getEthereum()
        if (!eth) { setError('MetaMask not found'); return }

        setError(null)

        try {
            const provider = new BrowserProvider(eth)
            const signer = await provider.getSigner()

            const assetContractAddress = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS
            if (!assetContractAddress) { setError('Asset contract not configured'); return }

            const assetContract = new Contract(assetContractAddress, ERC1155_APPROVAL_ABI, signer)
            const balance: bigint = await assetContract.balanceOf(account, BigInt(parsedTokenId))
            if (balance < BigInt(tokenAmount)) {
                setError('You do not own enough of this RWA token to create the auction')
                setStep('form')
                return
            }
            const isApproved = await assetContract.isApprovedForAll(account, contractAddress)
            if (!isApproved) {
                setStep('approving')
                const approveTx = await assetContract.setApprovalForAll(contractAddress, true)
                await approveTx.wait()
            }

            setStep('creating')

            const auctionContract = new Contract(contractAddress, MaskBidAuctionABI, signer)
            const startTime = Math.floor(startTimestampMs / 1000)
            const endTime = startTime + Math.floor(parsedDurationHours) * 3600
            const reservePriceUnits = BigInt(Math.round(parsedReservePrice * 1e6))
            const depositRequiredUnits = BigInt(Math.round(parsedDepositRequired * 1e6))

            const tx = await auctionContract.createAuction(
                BigInt(parsedTokenId),
                BigInt(tokenAmount),
                reservePriceUnits,
                depositRequiredUnits,
                BigInt(startTime),
                BigInt(endTime)
            )

            const receipt = await tx.wait()
            setTxHash(receipt.hash)

            const iface = new Interface(MaskBidAuctionABI)
            for (let i = 0; i < receipt.logs.length; i++) {
                const log = receipt.logs[i]
                try {
                    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
                    if (parsed?.name === 'AuctionCreated') {
                        setAuctionId(parsed.args.auctionId.toString())
                        setAuctionEventIndex(i)
                        break
                    }
                } catch { /* skip */ }
            }

            setStep('success')
        } catch (err) {
            setError(`Failed to create auction: ${(err as Error).message}`)
            setStep('error')
        }
    }

    const minStartTime = toDatetimeLocal(new Date(Date.now() + 60 * 1000))
    const canSubmit = !!(tokenId && reservePrice && depositRequired && startTimeLocal)

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Back links */}
                <div className="flex gap-4 mb-8">
                    {assetId && (
                        <button
                            type="button"
                            onClick={() => router.push('/my-assets')}
                            className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-200"
                        >
                            <span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
                            Back to My Assets
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => router.push('/auctions')}
                        className="text-gold/60 hover:text-gold text-sm font-serif tracking-wider transition-colors duration-200"
                    >
                        <span className="text-gold/30 text-[8px] mr-1">&#9670;</span>
                        Back to Auctions
                    </button>
                </div>

                {/* Page header */}
                <div className="mb-10">
                    <p className="text-gold/50 font-mono text-xs tracking-widest uppercase mb-2">MaskBid</p>
                    <h1 className="font-serif text-4xl font-semibold text-foreground mb-2">Create Auction</h1>
                    <div className="flex items-center gap-2 text-dim text-sm font-serif">
                        <Diamond size="xs" />
                        <span>List your RWA asset for a sealed-bid auction</span>
                    </div>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="border border-status-error/30 px-4 py-3 mb-6">
                        <p className="text-status-error text-sm font-serif">{error}</p>
                    </div>
                )}

                {/* Connect step */}
                {step === 'connect' && (
                    <div className="frame-ornate p-10 text-center">
                        <div className="text-5xl mb-6">&#9670;</div>
                        <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Connect Wallet</h2>
                        <p className="text-dim font-serif text-sm mb-8">Connect your MetaMask wallet to create an auction.</p>
                        <button
                            type="button"
                            onClick={connectWallet}
                            className="btn-ornate text-gold font-serif tracking-wider px-10 py-3 text-base"
                        >
                            Connect MetaMask
                        </button>
                    </div>
                )}

                {/* Form step */}
                {step === 'form' && (
                    <div className="frame-ornate p-8 space-y-6">
                        <Field label="Token ID" hint="The ERC-1155 token ID from your minted asset">
                            <input
                                type="number"
                                value={tokenId}
                                onChange={(e) => setTokenId(e.target.value)}
                                placeholder="e.g. 1"
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim"
                            />
                        </Field>

                        <div className="h-px bg-gold/10" />

                        <Field label="Reserve Price (USDC)" hint="Minimum bid required to win">
                            <input
                                type="number"
                                value={reservePrice}
                                onChange={(e) => setReservePrice(e.target.value)}
                                placeholder="1000"
                                min="1"
                                step="1"
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim"
                            />
                        </Field>

                        <Field label="Required Deposit (USDC)" hint="Bidders must lock this USDC as security — refunded to losers">
                            <input
                                type="number"
                                value={depositRequired}
                                onChange={(e) => setDepositRequired(e.target.value)}
                                placeholder="100"
                                min="1"
                                step="1"
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200 placeholder:text-dim"
                            />
                        </Field>

                        <div className="h-px bg-gold/10" />

                        <Field label="Start Time" hint="When bidding opens (must be in the future)">
                            <input
                                type="datetime-local"
                                value={startTimeLocal}
                                min={minStartTime}
                                onChange={(e) => setStartTimeLocal(e.target.value)}
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200"
                            />
                        </Field>

                        <Field label="Duration (hours)" hint="How long the auction runs after start (minimum 1 hour)">
                            <input
                                type="number"
                                value={durationHours}
                                onChange={(e) => setDurationHours(e.target.value)}
                                min="1"
                                max="720"
                                className="w-full bg-surface border border-border text-foreground font-mono text-sm px-4 py-3 focus:border-gold/40 focus:outline-none transition-colors duration-200"
                            />
                        </Field>

                        <div className="flex items-center gap-2 border border-gold/10 px-4 py-3">
                            <Diamond size="xs" />
                            <p className="text-dim font-serif text-xs leading-relaxed">
                                Your RWA token will be escrowed in the auction contract until the auction ends or is cancelled.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={createAuction}
                            disabled={!canSubmit}
                            className="btn-ornate w-full text-gold font-serif tracking-wider py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Create Auction
                        </button>
                    </div>
                )}

                {/* Approving step */}
                {step === 'approving' && (
                    <div className="frame-ornate p-10 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-6" />
                        <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Approving Token Transfer</h2>
                        <p className="text-dim font-serif text-sm">Please confirm the approval transaction in MetaMask. This allows the auction contract to escrow your token.</p>
                    </div>
                )}

                {/* Creating step */}
                {step === 'creating' && (
                    <div className="frame-ornate p-10 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-6" />
                        <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Creating Auction…</h2>
                        <p className="text-dim font-serif text-sm">Please wait while your auction is being created on-chain.</p>
                    </div>
                )}

                {/* Success step */}
                {step === 'success' && (
                    <div className="space-y-5">
                        <div className="frame-ornate p-10 text-center">
                            {/* Diamond ornament */}
                            <div className="flex items-center justify-center gap-3 mb-6">
                                <div className="h-px w-12 bg-gold/20" />
                                <span className="text-gold/40 text-xl">&#9670;</span>
                                <div className="h-px w-12 bg-gold/20" />
                            </div>

                            <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Auction Created</h2>
                            <p className="text-dim font-serif text-sm mb-2">Your auction has been created successfully.</p>

                            {auctionId && (
                                <p className="font-mono text-sm text-gold mb-4">
                                    Auction ID: <span className="font-bold">#{auctionId}</span>
                                </p>
                            )}

                            {txHash && (
                                <a
                                    href={`${env.NEXT_PUBLIC_EXPLORER_URL}/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-xs text-gold/60 hover:text-gold transition-colors block mb-6 break-all"
                                >
                                    {txHash}
                                </a>
                            )}

                            <div className="flex gap-3 justify-center flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => router.push('/auctions')}
                                    className="btn-ornate text-gold font-serif tracking-wider px-6 py-2.5 text-sm"
                                >
                                    View Auctions
                                </button>
                                {assetId && (
                                    <button
                                        type="button"
                                        onClick={() => router.push('/my-assets')}
                                        className="btn-ornate-ghost text-muted hover:text-foreground font-serif tracking-wider px-6 py-2.5 text-sm"
                                    >
                                        Back to My Assets
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStep('form')
                                        setTokenId(assetId)
                                        setReservePrice('')
                                        setDepositRequired('')
                                        setStartTimeLocal(defaultStartTime())
                                        setTxHash(null)
                                        setAuctionId(null)
                                    }}
                                    className="btn-ornate-ghost text-muted hover:text-foreground font-serif tracking-wider px-6 py-2.5 text-sm"
                                >
                                    Create Another
                                </button>
                            </div>
                        </div>

                        {txHash && (
                            <CRECommandBox
                                txHash={txHash}
                                command="cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation"
                                steps={[{ label: 'AuctionCreated', eventIndex: auctionEventIndex }]}
                                onDone={() => router.push('/auctions')}
                            />
                        )}
                    </div>
                )}

                {/* Error step */}
                {step === 'error' && (
                    <div className="frame-ornate p-10 text-center">
                        <div className="text-status-error text-4xl mb-6">&#9670;</div>
                        <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">Failed to Create Auction</h2>
                        <p className="text-dim font-serif text-sm mb-8">{error}</p>
                        <button
                            type="button"
                            onClick={() => setStep('form')}
                            className="btn-ornate text-gold font-serif tracking-wider px-8 py-3"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function CreateAuctionPage() {
    return (
        <Suspense>
            <CreateAuctionForm />
        </Suspense>
    )
}
