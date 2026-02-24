'use client'
import { useState, useEffect } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import { USDCABI } from '@/abis/USDC'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { env } from '@/configs/env'
import { encryptBid, generateBidHash } from '@/lib/crypto'

type Step = 'connect' | 'approve' | 'deposit' | 'bid' | 'submitting' | 'success' | 'error'

interface BidModalProps {
    auction: {
        id: string
        name: string
        reservePrice: string
        requiredDeposit: string
        endTime: string
        contractAuctionId?: number | null
    }
    onClose: () => void
    onSuccess?: () => void
}

export default function BidModal({ auction, onClose, onSuccess }: BidModalProps) {
    const [step, setStep] = useState<Step>('connect')
    const [error, setError] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [walletAddress, setWalletAddress] = useState<string | null>(null)
    const [bidAmount, setBidAmount] = useState('')
    const [isApproved, setIsApproved] = useState(false)

    const reserveNum = Number(auction.reservePrice.replace(/,/g, ''))
    const depositNum = Number(auction.requiredDeposit.replace(/,/g, ''))

    const auctionContractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
    const usdcAddress = env.NEXT_PUBLIC_USDC_ADDRESS

    // Check if wallet is already connected on mount
    useEffect(() => {
        checkConnection()
    }, [])

    const checkConnection = async () => {
        if (typeof window === 'undefined' || !(window as any).ethereum) return

        try {
            const provider = new BrowserProvider((window as any).ethereum)
            const accounts = await provider.listAccounts()
            if (accounts.length > 0) {
                setWalletAddress(accounts[0].address)
                setStep('approve')
            }
        } catch {
            // Not connected
        }
    }

    const connectWallet = async () => {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            setError('MetaMask not installed')
            return
        }

        try {
            const provider = new BrowserProvider((window as any).ethereum)
            await provider.send('eth_requestAccounts', [])
            const signer = await provider.getSigner()
            const address = await signer.getAddress()
            setWalletAddress(address)
            setStep('approve')
            setError(null)
        } catch (err) {
            setError('Failed to connect wallet: ' + (err as Error).message)
        }
    }

    const approveUSDC = async () => {
        if (!walletAddress || !auctionContractAddress) return

        setStep('deposit')
        setError(null)

        try {
            const provider = new BrowserProvider((window as any).ethereum)
            const signer = await provider.getSigner()
            const usdcContract = new Contract(usdcAddress, USDCABI, signer)

            // Convert deposit to USDC units (6 decimals)
            const depositUnits = BigInt(Math.floor(depositNum * 1e6))

            const tx = await usdcContract.approve(auctionContractAddress, depositUnits)
            const receipt = await tx.wait()

            setTxHash(receipt.hash)
            setIsApproved(true)
            setStep('bid')
        } catch (err) {
            setError('Failed to approve USDC: ' + (err as Error).message)
            setStep('error')
        }
    }

    const placeBid = async () => {
        if (!walletAddress || !bidAmount || !auction.contractAuctionId) {
            setError('Missing required information')
            return
        }

        setStep('submitting')
        setError(null)

        try {
            // Step 1: Encrypt the bid
            const { encryptedData, hash } = await encryptBid(Number(bidAmount), walletAddress)

            // Step 2: Generate bid hash for on-chain
            const bidHash = await generateBidHash(
                BigInt(auction.contractAuctionId),
                walletAddress,
                encryptedData
            )

            // Step 3: Place bid on-chain
            const provider = new BrowserProvider((window as any).ethereum)
            const signer = await provider.getSigner()
            const auctionContract = new Contract(auctionContractAddress!, MaskBidAuctionABI, signer)

            const tx = await auctionContract.placeBid(
                BigInt(auction.contractAuctionId),
                bidHash
            )
            const receipt = await tx.wait()

            // Step 4: Store encrypted bid to Supabase (via API)
            await storeEncryptedBid(
                auction.id,
                encryptedData,
                hash,
                walletAddress,
                receipt.hash
            )

            setTxHash(receipt.hash)
            setStep('success')
            onSuccess?.()
        } catch (err) {
            setError('Failed to place bid: ' + (err as Error).message)
            setStep('error')
        }
    }

    const storeEncryptedBid = async (
        auctionId: string,
        encryptedData: string,
        hash: string,
        bidder: string,
        escrowTxHash: string
    ) => {
        try {
            const response = await fetch('/api/bids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auctionId,
                    encryptedData,
                    hash,
                    bidder,
                    escrowTxHash,
                }),
            })

            if (!response.ok) {
                console.error('Failed to store bid in database')
            }
        } catch (err) {
            console.error('Error storing bid:', err)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={step === 'success' || step === 'error' ? onClose : undefined}
            />

            <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
                    <div>
                        <p className="text-slate-400 text-xs mb-0.5">Bidding on</p>
                        <h2 className="text-slate-900 font-semibold">{auction.name}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-xl leading-none transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-0 px-6 pt-4 pb-2">
                    {(['approve', 'deposit', 'bid', 'success'] as const).map((s, i) => {
                        const labels = ['Approve', 'Deposit', 'Bid', 'Done']
                        const order = ['approve', 'deposit', 'bid', 'submitting', 'success']
                        const currentIdx = order.indexOf(step)
                        const isActive = step === s || (s === 'bid' && step === 'submitting')
                        const isDone = currentIdx > order.indexOf(s)
                        return (
                            <div key={s} className="flex items-center flex-1">
                                <div className={`flex items-center gap-1.5 ${i < 3 ? 'flex-1' : ''}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {isDone ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs ${isActive ? 'text-slate-900' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
                                        {labels[i]}
                                    </span>
                                    {i < 3 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-6 pb-6 pt-4">
                    {/* Error display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    {/* CONNECT step */}
                    {step === 'connect' && (
                        <div className="text-center py-4 space-y-4">
                            <div className="text-4xl mb-2">🔗</div>
                            <h3 className="text-slate-900 font-semibold text-lg">Connect your wallet</h3>
                            <p className="text-slate-500 text-sm">Connect your MetaMask wallet to place bids.</p>
                            <button
                                type="button"
                                onClick={connectWallet}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Connect MetaMask
                            </button>
                        </div>
                    )}

                    {/* APPROVE step */}
                    {step === 'approve' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-slate-900 font-semibold text-lg mb-1">Approve USDC</h3>
                                <p className="text-slate-500 text-sm">Approve the auction contract to spend {auction.requiredDeposit} USDC as your deposit.</p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 flex items-center justify-between">
                                <span className="text-blue-700 text-sm font-medium">Deposit Amount</span>
                                <span className="text-slate-900 font-bold text-lg">{auction.requiredDeposit} <span className="text-slate-500 text-sm font-normal">USDC</span></span>
                            </div>

                            <button
                                type="button"
                                onClick={approveUSDC}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Approve USDC
                            </button>
                        </div>
                    )}

                    {/* DEPOSIT step - loading */}
                    {step === 'deposit' && (
                        <div className="text-center py-8 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <h3 className="text-slate-900 font-semibold">Approving USDC...</h3>
                            <p className="text-slate-500 text-sm">Please confirm the transaction in MetaMask.</p>
                        </div>
                    )}

                    {/* BID step */}
                    {step === 'bid' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-slate-900 font-semibold text-lg mb-1">Your Sealed Bid</h3>
                            </div>

                            <div className="flex items-center gap-2 bg-green-100 border border-green-200 rounded-2xl px-4 py-3 text-sm">
                                <span className="text-green-600">✅</span>
                                <span className="text-green-600">Deposit approved: <span className="font-semibold">{auction.requiredDeposit} USDC</span></span>
                            </div>

                            <p className="text-slate-500 text-sm">Enter the amount you&apos;re willing to pay if you win. This is your actual bid.</p>

                            <div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={reserveNum}
                                        step="1"
                                        value={bidAmount}
                                        onChange={e => setBidAmount(e.target.value)}
                                        placeholder={String(reserveNum)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-20 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-lg font-semibold"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">USDC</span>
                                </div>
                                <p className="text-slate-400 text-xs mt-1.5">Minimum: {auction.reservePrice} USDC</p>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-xs text-slate-500">
                                <span className="text-blue-600 shrink-0 mt-0.5">🔒</span>
                                <span>Your bid will be encrypted with RSA before submission. Only the Chainlink CRE enclave can decrypt it.</span>
                            </div>

                            <button
                                type="button"
                                onClick={placeBid}
                                disabled={!bidAmount || Number(bidAmount) < reserveNum}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Confirm Sealed Bid
                            </button>
                        </div>
                    )}

                    {/* SUBMITTING step */}
                    {step === 'submitting' && (
                        <div className="text-center py-8 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <h3 className="text-slate-900 font-semibold">Encrypting & Submitting...</h3>
                            <p className="text-slate-500 text-sm">Your bid is being encrypted and submitted on-chain.</p>
                        </div>
                    )}

                    {/* SUCCESS step */}
                    {step === 'success' && (
                        <div className="text-center py-2 space-y-4">
                            <div className="text-5xl">✅</div>
                            <h3 className="text-slate-900 font-bold text-xl">Bid Submitted!</h3>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-sm text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Deposit locked</span>
                                    <span className="text-slate-900 font-medium">{auction.requiredDeposit} USDC</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Bid sealed</span>
                                    <span className="text-slate-700 flex items-center gap-1.5">🔒 Encrypted</span>
                                </div>
                            </div>

                            {txHash && (
                                <a
                                    href={`${env.NEXT_PUBLIC_EXPLORER_URL}/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 text-sm underline block"
                                >
                                    View on Explorer
                                </a>
                            )}

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    {/* ERROR step */}
                    {step === 'error' && (
                        <div className="text-center py-4 space-y-4">
                            <div className="text-5xl">❌</div>
                            <h3 className="text-slate-900 font-semibold text-lg">Something went wrong</h3>
                            <p className="text-slate-500 text-sm">{error || 'Failed to process your bid.'}</p>
                            <button
                                type="button"
                                onClick={() => setStep(isApproved ? 'bid' : 'approve')}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
