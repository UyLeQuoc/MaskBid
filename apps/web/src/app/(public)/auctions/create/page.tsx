'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrowserProvider, Contract } from 'ethers'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { env } from '@/configs/env'

type Step = 'connect' | 'approve' | 'form' | 'creating' | 'success' | 'error'

export default function CreateAuctionPage() {
    const router = useRouter()
    const [step, setStep] = useState<Step>('connect')
    const [error, setError] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<string | null>(null)
    const [walletAddress, setWalletAddress] = useState<string | null>(null)

    // Form state
    const [tokenId, setTokenId] = useState('')
    const [tokenAmount, setTokenAmount] = useState('1')
    const [reservePrice, setReservePrice] = useState('')
    const [depositRequired, setDepositRequired] = useState('')
    const [durationHours, setDurationHours] = useState('24')

    const connectWallet = async () => {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            setError('MetaMask not installed')
            return
        }

        try {
            const provider = new BrowserProvider((window as any).ethereum)
            const signer = await provider.getSigner()
            const address = await signer.getAddress()
            setWalletAddress(address)
            setStep('form')
        } catch (err) {
            setError('Failed to connect wallet: ' + (err as Error).message)
        }
    }

    const createAuction = async () => {
        if (!walletAddress) {
            setError('Wallet not connected')
            return
        }

        const contractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
        if (!contractAddress) {
            setError('Auction contract not configured')
            return
        }

        setStep('creating')
        setError(null)

        try {
            const provider = new BrowserProvider((window as any).ethereum)
            const signer = await provider.getSigner()
            const contract = new Contract(contractAddress, MaskBidAuctionABI, signer)

            // Calculate timestamps
            const now = Math.floor(Date.now() / 1000)
            const startTime = now
            const endTime = now + (parseInt(durationHours) * 3600)

            // Convert to USDC units (6 decimals)
            const reservePriceUnits = BigInt(Math.floor(parseFloat(reservePrice) * 1e6))
            const depositRequiredUnits = BigInt(Math.floor(parseFloat(depositRequired) * 1e6))

            const tx = await contract.createAuction(
                BigInt(tokenId),
                BigInt(tokenAmount),
                reservePriceUnits,
                depositRequiredUnits,
                BigInt(startTime),
                BigInt(endTime)
            )

            const receipt = await tx.wait()
            setTxHash(receipt.hash)
            setStep('success')
        } catch (err) {
            setError('Failed to create auction: ' + (err as Error).message)
            setStep('error')
        }
    }

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <button
                    onClick={() => router.push('/auctions')}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-6 inline-block"
                >
                    ← Back to Auctions
                </button>

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
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Token ID
                            </label>
                            <input
                                type="number"
                                value={tokenId}
                                onChange={(e) => setTokenId(e.target.value)}
                                placeholder="Your RWA token ID"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">The token ID from your asset</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Token Amount
                            </label>
                            <input
                                type="number"
                                value={tokenAmount}
                                onChange={(e) => setTokenAmount(e.target.value)}
                                min="1"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Reserve Price (USDC)
                            </label>
                            <input
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
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Required Deposit (USDC)
                            </label>
                            <input
                                type="number"
                                value={depositRequired}
                                onChange={(e) => setDepositRequired(e.target.value)}
                                placeholder="100"
                                min="1"
                                step="1"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-slate-400 text-xs mt-1">Deposit required from all bidders</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Duration (hours)
                            </label>
                            <input
                                type="number"
                                value={durationHours}
                                onChange={(e) => setDurationHours(e.target.value)}
                                min="1"
                                max="720"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <p className="text-blue-700 text-sm">
                                <span className="font-semibold">Note:</span> Your RWA token will be escrowed in the auction contract until the auction ends or is cancelled.
                            </p>
                        </div>

                        <button
                            onClick={createAuction}
                            disabled={!tokenId || !reservePrice || !depositRequired}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors"
                        >
                            Create Auction
                        </button>
                    </div>
                )}

                {step === 'creating' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <h2 className="text-xl font-semibold mb-2">Creating Auction...</h2>
                        <p className="text-slate-500">Please wait while your auction is being created on-chain.</p>
                    </div>
                )}

                {step === 'success' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="text-5xl mb-4">🎉</div>
                        <h2 className="text-xl font-semibold mb-2">Auction Created!</h2>
                        <p className="text-slate-500 mb-4">Your auction has been created successfully.</p>
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
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => router.push('/auctions')}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-2xl transition-colors"
                            >
                                View Auctions
                            </button>
                            <button
                                onClick={() => {
                                    setStep('form')
                                    setTokenId('')
                                    setReservePrice('')
                                    setDepositRequired('')
                                    setTxHash(null)
                                }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 px-6 rounded-2xl transition-colors"
                            >
                                Create Another
                            </button>
                        </div>
                    </div>
                )}

                {step === 'error' && (
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
                        <div className="text-5xl mb-4">❌</div>
                        <h2 className="text-xl font-semibold mb-2">Failed to Create Auction</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <button
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
