'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrowserProvider, Contract, Interface } from 'ethers'
import { useSDK } from '@metamask/sdk-react'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { env } from '@/configs/env'

type Step = 'connect' | 'form' | 'approving' | 'creating' | 'success' | 'error'

const ERC1155_APPROVAL_ABI = [
    'function setApprovalForAll(address operator, bool approved) external',
    'function isApprovedForAll(address account, address operator) external view returns (bool)',
    'function balanceOf(address account, uint256 id) external view returns (uint256)',
] as const

type EthProvider = Parameters<typeof BrowserProvider>[0] & {
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

function CreateAuctionForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { connected, account } = useSDK()

    const assetId = searchParams.get('assetId') ?? ''

    const [step, setStep] = useState<Step>('connect')
    const [error, setError] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [auctionId, setAuctionId] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    // Form state
    const [tokenId, setTokenId] = useState(assetId)
    const tokenAmount = '1'
    const [reservePrice, setReservePrice] = useState('')
    const [depositRequired, setDepositRequired] = useState('')
    const [startTimeLocal, setStartTimeLocal] = useState(defaultStartTime)
    const [durationHours, setDurationHours] = useState('24')

    // Auto-skip connect step when already connected
    useEffect(() => {
        if (connected && account && step === 'connect') {
            setStep('form')
        }
    }, [connected, account, step])

    const connectWallet = async () => {
        const eth = getEthereum()
        if (!eth) {
            setError('MetaMask not installed')
            return
        }
        try {
            await eth.request({ method: 'eth_requestAccounts' })
            setStep('form')
        } catch (err) {
            setError(`Failed to connect wallet: ${(err as Error).message}`)
        }
    }

    const createAuction = async () => {
        if (!account) {
            setError('Wallet not connected')
            return
        }

        // Basic client-side validation mirroring contract requirements
        const parsedTokenId = Number(tokenId)
        if (!Number.isInteger(parsedTokenId) || parsedTokenId <= 0) {
            setError('Token ID must be a positive integer')
            return
        }

        const parsedReservePrice = Number(reservePrice)
        if (!Number.isFinite(parsedReservePrice) || parsedReservePrice <= 0) {
            setError('Reserve price must be greater than 0')
            return
        }

        const parsedDepositRequired = Number(depositRequired)
        if (!Number.isFinite(parsedDepositRequired) || parsedDepositRequired <= 0) {
            setError('Required deposit must be greater than 0')
            return
        }

        const parsedDurationHours = Number(durationHours)
        if (!Number.isFinite(parsedDurationHours) || parsedDurationHours < 1) {
            setError('Duration must be at least 1 hour')
            return
        }

        const startTimestampMs = new Date(startTimeLocal).getTime()
        if (Number.isNaN(startTimestampMs)) {
            setError('Invalid start time')
            return
        }
        if (startTimestampMs <= Date.now()) {
            setError('Start time must be in the future')
            return
        }

        const contractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        if (!contractAddress) {
            setError('Auction contract not configured')
            return
        }

        const eth = getEthereum()
        if (!eth) {
            setError('MetaMask not found')
            return
        }

        setError(null)

        try {
            const provider = new BrowserProvider(eth)
            const signer = await provider.getSigner()

            const assetContractAddress = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS
            if (!assetContractAddress) {
                setError('Asset contract not configured')
                return
            }

            // Check ERC-1155 approval; request it if missing
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

            // Parse auctionId from AuctionCreated event
            const iface = new Interface(MaskBidAuctionABI)
            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
                    if (parsed?.name === 'AuctionCreated') {
                        setAuctionId(parsed.args.auctionId.toString())
                        break
                    }
                } catch {
                    // skip non-matching logs
                }
            }

            setStep('success')
        } catch (err) {
            setError(`Failed to create auction: ${(err as Error).message}`)
            setStep('error')
        }
    }

    const minStartTime = toDatetimeLocal(new Date(Date.now() + 60 * 1000))

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex gap-4 mb-6">
                    {assetId && (
                        <button
                            type="button"
                            onClick={() => router.push('/my-assets')}
                            className="text-blue-600 hover:text-blue-700 text-sm transition-colors"
                        >
                            ← Back to My Assets
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => router.push('/auctions')}
                        className="text-slate-500 hover:text-slate-700 text-sm transition-colors"
                    >
                        ← Back to Auctions
                    </button>
                </div>

                <h1 className="text-3xl font-bold mb-2">Create Auction</h1>
                <p className="text-slate-500 mb-8">List your RWA asset for sealed-bid auction.</p>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {step === 'connect' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="text-5xl mb-4">🔗</div>
                        <h2 className="text-xl font-semibold mb-2">Connect Wallet</h2>
                        <p className="text-slate-500 mb-6">Connect your MetaMask wallet to create an auction.</p>
                        <button
                            type="button"
                            onClick={connectWallet}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-2xl transition-colors"
                        >
                            Connect MetaMask
                        </button>
                    </div>
                )}

                {step === 'form' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6">
                        <div>
                            <label htmlFor="tokenId" className="block text-sm font-medium text-slate-700 mb-2">
                                Token ID
                            </label>
                            <input
                                id="tokenId"
                                type="number"
                                value={tokenId}
                                onChange={(e) => setTokenId(e.target.value)}
                                placeholder="Your RWA token ID"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">The token ID from your asset</p>
                        </div>

                        <div>
                            <label htmlFor="reservePrice" className="block text-sm font-medium text-slate-700 mb-2">
                                Reserve Price (USDC)
                            </label>
                            <input
                                id="reservePrice"
                                type="number"
                                value={reservePrice}
                                onChange={(e) => setReservePrice(e.target.value)}
                                placeholder="1000"
                                min="1"
                                step="1"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">Minimum bid required to win</p>
                        </div>

                        <div>
                            <label htmlFor="depositRequired" className="block text-sm font-medium text-slate-700 mb-2">
                                Required Deposit (USDC)
                            </label>
                            <input
                                id="depositRequired"
                                type="number"
                                value={depositRequired}
                                onChange={(e) => setDepositRequired(e.target.value)}
                                placeholder="100"
                                min="1"
                                step="1"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">Bidders must lock this USDC as security (refunded to losers)</p>
                        </div>

                        <div>
                            <label htmlFor="startTime" className="block text-sm font-medium text-slate-700 mb-2">
                                Start Time
                            </label>
                            <input
                                id="startTime"
                                type="datetime-local"
                                value={startTimeLocal}
                                min={minStartTime}
                                onChange={(e) => setStartTimeLocal(e.target.value)}
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">When bidding opens (must be in the future)</p>
                        </div>

                        <div>
                            <label htmlFor="durationHours" className="block text-sm font-medium text-slate-700 mb-2">
                                Duration (hours)
                            </label>
                            <input
                                id="durationHours"
                                type="number"
                                value={durationHours}
                                onChange={(e) => setDurationHours(e.target.value)}
                                min="1"
                                max="720"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">How long the auction runs after start (minimum 1 hour)</p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-blue-700 text-sm">
                                <span className="font-semibold">Note:</span> Your RWA token will be escrowed in the auction contract until the auction ends or is cancelled.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={createAuction}
                            disabled={!tokenId || !reservePrice || !depositRequired || !startTimeLocal}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors"
                        >
                            Create Auction
                        </button>
                    </div>
                )}

                {step === 'approving' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Approving Token Transfer</h2>
                        <p className="text-slate-500">Please confirm the approval transaction in MetaMask. This allows the auction contract to escrow your token.</p>
                    </div>
                )}

                {step === 'creating' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold mb-2">Creating Auction...</h2>
                        <p className="text-slate-500">Please wait while your auction is being created on-chain.</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="space-y-4">
                        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                            <div className="text-5xl mb-4">🎉</div>
                            <h2 className="text-xl font-semibold mb-2">Auction Created!</h2>
                            <p className="text-slate-500 mb-1">Your auction has been created successfully.</p>
                            {auctionId && (
                                <p className="text-slate-700 font-mono text-sm mb-4">Auction ID: <span className="font-bold">{auctionId}</span></p>
                            )}
                            {txHash && (
                                <a
                                    href={`${env.NEXT_PUBLIC_EXPLORER_URL}/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 text-sm underline block mb-6"
                                >
                                    View on Explorer
                                </a>
                            )}
                            <div className="flex gap-3 justify-center flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => router.push('/auctions')}
                                    className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-2xl transition-colors"
                                >
                                    View Auctions
                                </button>
                                {assetId && (
                                    <button
                                        type="button"
                                        onClick={() => router.push('/my-assets')}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-2xl transition-colors"
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
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-2xl transition-colors"
                                >
                                    Create Another
                                </button>
                            </div>
                        </div>

                        {/* CRE Workflow Command Box */}
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <span className="text-slate-300 text-sm font-semibold">Next Step: Trigger CRE Auction Workflow</span>
                                    {auctionId && (
                                        <p className="text-slate-500 text-xs mt-0.5">
                                            First update <code className="text-amber-400">apps/cre-workflow/auction-workflow/config.json</code> → set <code className="text-amber-400">"auctionId": "{auctionId}"</code>
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const cmd = `cd apps/cre-workflow\ncre workflow simulate auction-workflow --target local-simulation`
                                        navigator.clipboard.writeText(cmd).then(() => {
                                            setCopied(true)
                                            setTimeout(() => setCopied(false), 2000)
                                        })
                                    }}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <pre className="text-green-400 font-mono text-sm overflow-x-auto whitespace-pre">{`cd apps/cre-workflow\ncre workflow simulate auction-workflow --target local-simulation`}</pre>
                            <p className="text-slate-500 text-xs mt-3">
                                With broadcast to Sepolia: append <code className="text-slate-400">--broadcast</code> to the command above.
                            </p>
                        </div>
                    </div>
                )}

                {step === 'error' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="text-5xl mb-4">❌</div>
                        <h2 className="text-xl font-semibold mb-2">Failed to Create Auction</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <button
                            type="button"
                            onClick={() => setStep('form')}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-2xl transition-colors"
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
