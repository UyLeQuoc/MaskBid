'use client'
import { useState, useEffect } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import { USDCABI } from '@/abis/USDC'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { env } from '@/configs/env'
import { encryptBid, generateBidHash } from '@/lib/crypto'
import { CRECommandBox } from '@/components/CRECommandBox'

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

function parseContractError(err: unknown): string {
    const msg = (err as any)?.reason || (err as any)?.message || String(err)

    if (msg.includes('Seller cannot bid')) return 'You cannot bid on your own auction. Please switch to a different wallet.'
    if (msg.includes('Auction not active')) return 'This auction is not currently active. It may have ended or not started yet.'
    if (msg.includes('Already bid')) return 'You have already placed a bid on this auction.'
    if (msg.includes('Insufficient deposit') || msg.includes('insufficient funds')) return 'Insufficient USDC balance for the required deposit.'
    if (msg.includes('Not KYC verified') || msg.includes('KYC')) return 'Your wallet is not KYC verified. Please complete World ID verification first.'
    if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) return 'Transaction was rejected in MetaMask.'
    if (msg.includes('Auction ended')) return 'This auction has already ended.'
    if (msg.includes('ERC20: insufficient allowance') || msg.includes('allowance')) return 'USDC approval insufficient. Please approve again.'

    const revertMatch = msg.match(/reason="([^"]+)"/)
    if (revertMatch) return revertMatch[1]

    if (msg.length > 150) return msg.slice(0, 150) + '...'
    return msg
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

    useEffect(() => {
        if (typeof window === 'undefined' || !(window as any).ethereum) return
        const provider = new BrowserProvider((window as any).ethereum)
        provider.listAccounts().then(accounts => {
            if (accounts.length > 0) {
                setWalletAddress(accounts[0].address)
                setStep('approve')
            }
        }).catch(() => {})
    }, [])

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
            setError(`Failed to connect wallet: ${(err as Error).message}`)
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
            const depositUnits = BigInt(Math.floor(depositNum * 1e6))
            const tx = await usdcContract.approve(auctionContractAddress, depositUnits)
            const receipt = await tx.wait()
            setTxHash(receipt.hash)
            setIsApproved(true)
            setStep('bid')
        } catch (err) {
            setError(parseContractError(err))
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
            const { encryptedData, hash } = await encryptBid(Number(bidAmount), walletAddress)
            const bidHash = await generateBidHash(
                BigInt(auction.contractAuctionId),
                walletAddress,
                encryptedData
            )
            const provider = new BrowserProvider((window as any).ethereum)
            const signer = await provider.getSigner()
            const auctionContract = new Contract(auctionContractAddress!, MaskBidAuctionABI, signer)
            const tx = await auctionContract.placeBid(BigInt(auction.contractAuctionId), bidHash)
            const receipt = await tx.wait()
            await storeEncryptedBid(auction.id, encryptedData, hash, walletAddress, receipt.hash)
            setTxHash(receipt.hash)
            setStep('success')
            onSuccess?.()
        } catch (err) {
            setError(parseContractError(err))
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
                body: JSON.stringify({ auctionId, encryptedData, hash, bidder, escrowTxHash }),
            })
            if (!response.ok) {
                console.error('Failed to store bid in database')
            }
        } catch (err) {
            console.error('Error storing bid:', err)
        }
    }

    const stepOrder = ['approve', 'deposit', 'bid', 'submitting', 'success']
    const currentIdx = stepOrder.indexOf(step)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {step === 'success' || step === 'error' ? (
                <button
                    type="button"
                    aria-label="Close modal"
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default w-full"
                    onClick={onClose}
                />
            ) : (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            )}

            <div className="relative glass-card w-full max-w-md max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gold/10">
                    <div>
                        <p className="text-dim text-xs font-serif tracking-widest uppercase mb-0.5">Bidding on</p>
                        <h2 className="text-foreground font-serif font-semibold">{auction.name}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-dim hover:text-gold text-lg leading-none transition-colors duration-200"
                    >
                        ✕
                    </button>
                </div>

                {/* Step indicators */}
                <div className="flex items-center gap-0 px-6 pt-4 pb-2">
                    {(['approve', 'deposit', 'bid', 'success'] as const).map((s, i) => {
                        const labels = ['Approve', 'Deposit', 'Bid', 'Done']
                        const isActive = step === s || (s === 'bid' && step === 'submitting')
                        const isDone = currentIdx > stepOrder.indexOf(s)
                        return (
                            <div key={s} className="flex items-center flex-1">
                                <div className={`flex items-center gap-1.5 ${i < 3 ? 'flex-1' : ''}`}>
                                    <div className={`w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 border ${
                                        isDone
                                            ? 'border-status-live/50 text-status-live'
                                            : isActive
                                            ? 'border-gold/60 text-gold'
                                            : 'border-border text-dim'
                                    }`}>
                                        {isDone ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs font-serif tracking-wider ${
                                        isActive ? 'text-gold' : isDone ? 'text-status-live' : 'text-dim'
                                    }`}>
                                        {labels[i]}
                                    </span>
                                    {i < 3 && <div className="flex-1 h-px bg-gold/10 mx-2" />}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-6 pb-6 pt-4">
                    {/* Error display */}
                    {error && (
                        <div className="bg-surface border border-status-error/30 px-4 py-3 mb-4">
                            <p className="text-status-error text-sm">{error}</p>
                        </div>
                    )}

                    {/* CONNECT step */}
                    {step === 'connect' && (
                        <div className="text-center py-6 space-y-4">
                            <div className="text-gold/40 font-serif text-4xl mb-2">&#9670;</div>
                            <h3 className="text-foreground font-serif font-semibold text-lg">Connect your wallet</h3>
                            <p className="text-muted text-sm">Connect your MetaMask wallet to place bids.</p>
                            <button
                                type="button"
                                onClick={connectWallet}
                                className="btn-ornate text-gold font-serif tracking-wider w-full py-3"
                            >
                                Connect MetaMask
                            </button>
                        </div>
                    )}

                    {/* APPROVE step */}
                    {step === 'approve' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-foreground font-serif font-semibold text-lg mb-1">Approve USDC</h3>
                                <p className="text-muted text-sm">Approve the auction contract to spend {auction.requiredDeposit} USDC as your deposit.</p>
                            </div>

                            <div className="bg-surface border border-gold/20 px-4 py-4 flex items-center justify-between">
                                <span className="text-muted text-sm font-serif">Deposit Amount</span>
                                <span className="text-foreground font-mono font-bold text-lg">{auction.requiredDeposit} <span className="text-dim text-sm font-normal">USDC</span></span>
                            </div>

                            <button
                                type="button"
                                onClick={approveUSDC}
                                className="btn-ornate text-gold font-serif tracking-wider w-full py-3"
                            >
                                Approve USDC
                            </button>
                        </div>
                    )}

                    {/* DEPOSIT step - loading */}
                    {step === 'deposit' && (
                        <div className="text-center py-10 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto" />
                            <h3 className="text-foreground font-serif font-semibold">Approving USDC...</h3>
                            <p className="text-muted text-sm">Please confirm the transaction in MetaMask.</p>
                        </div>
                    )}

                    {/* BID step */}
                    {step === 'bid' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-foreground font-serif font-semibold text-lg mb-1">Your Sealed Bid</h3>
                            </div>

                            <div className="flex items-center gap-2 bg-surface border border-status-live/30 px-4 py-3 text-sm">
                                <span className="text-status-live text-[8px]">&#9670;</span>
                                <span className="text-status-live font-serif">Deposit approved: <span className="font-semibold font-mono">{auction.requiredDeposit} USDC</span></span>
                            </div>

                            <p className="text-muted text-sm">Enter the amount you&apos;re willing to pay if you win. This is your actual bid.</p>

                            <div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min={reserveNum}
                                        step="1"
                                        value={bidAmount}
                                        onChange={e => setBidAmount(e.target.value)}
                                        placeholder={String(reserveNum)}
                                        className="w-full bg-surface border border-border text-foreground font-mono placeholder-dim focus:outline-none focus:border-gold/40 transition-colors px-4 py-3 pr-20 text-lg font-semibold"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim text-sm">USDC</span>
                                </div>
                                <p className="text-dim text-xs mt-1.5 font-mono">Minimum: {auction.reservePrice} USDC</p>
                            </div>

                            <div className="bg-surface border border-gold/10 px-4 py-3 flex items-start gap-2.5 text-xs text-muted">
                                <span className="text-gold/40 shrink-0 mt-0.5 text-[8px]">&#9670;</span>
                                <span className="font-serif">Your bid will be encrypted with RSA before submission. Only the Chainlink CRE enclave can decrypt it.</span>
                            </div>

                            {bidAmount && Number(bidAmount) > 0 && (
                                <div className="bg-surface border border-gold/10 px-4 py-3 flex items-center justify-between text-sm">
                                    <span className="text-muted font-serif">Your bid (sealed)</span>
                                    <span className="text-sealed font-mono text-gold">{bidAmount} USDC</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={placeBid}
                                disabled={!bidAmount || Number(bidAmount) < reserveNum}
                                className="btn-ornate text-gold font-serif tracking-wider w-full py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Confirm Sealed Bid
                            </button>
                        </div>
                    )}

                    {/* SUBMITTING step */}
                    {step === 'submitting' && (
                        <div className="text-center py-10 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto" />
                            <h3 className="text-foreground font-serif font-semibold">Encrypting & Submitting...</h3>
                            <p className="text-muted text-sm">Your bid is being encrypted and submitted on-chain.</p>
                        </div>
                    )}

                    {/* SUCCESS step */}
                    {step === 'success' && (
                        <div className="space-y-4">
                            <div className="text-center py-2">
                                <div className="text-status-live font-serif text-4xl mb-2">&#9670;</div>
                                <h3 className="text-foreground font-serif font-bold text-xl">Bid Submitted!</h3>
                                <p className="text-muted text-sm mt-1">Your sealed bid has been placed successfully.</p>
                            </div>

                            <div className="bg-surface border border-gold/10 p-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted font-serif">Deposit locked</span>
                                    <span className="text-foreground font-mono font-medium">{auction.requiredDeposit} USDC</span>
                                </div>
                                <div className="h-px bg-gold/10" />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted font-serif">Bid sealed</span>
                                    <span className="text-gold font-mono text-xs flex items-center gap-1.5">
                                        <span className="text-[8px]">&#9670;</span> Encrypted
                                    </span>
                                </div>
                            </div>

                            {txHash && (
                                <CRECommandBox
                                    txHash={txHash}
                                    command="cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation"
                                    steps={[
                                        { label: 'Sync BidPlaced event', eventIndex: 1 },
                                    ]}
                                    onDone={onClose}
                                />
                            )}
                        </div>
                    )}

                    {/* ERROR step */}
                    {step === 'error' && (
                        <div className="text-center py-6 space-y-4">
                            <div className="text-status-error font-serif text-4xl">&#10005;</div>
                            <h3 className="text-foreground font-serif font-semibold text-lg">Something went wrong</h3>
                            <p className="text-muted text-sm">{error || 'Failed to process your bid.'}</p>
                            <button
                                type="button"
                                onClick={() => setStep(isApproved ? 'bid' : 'approve')}
                                className="btn-ornate text-gold font-serif tracking-wider w-full py-3"
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
