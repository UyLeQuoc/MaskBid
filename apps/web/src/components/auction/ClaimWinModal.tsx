'use client'
import { useState, useEffect } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import { USDCABI } from '@/abis/USDC'
import { MaskBidAuctionABI } from '@/abis/MaskBidAuction'
import { CRECommandBox } from '@/components/CRECommandBox'
import { env } from '@/configs/env'

type Step = 'info' | 'approve' | 'approving' | 'claiming' | 'success' | 'error'

interface ClaimWinModalProps {
    auctionId: number
    auctionName: string
    winningBid: number       // USDC units (6 decimals)
    depositPaid: number      // USDC units (6 decimals)
    claimDeadline: number    // unix timestamp
    onClose: () => void
    onSuccess?: () => void
}

function parseContractError(err: unknown): string {
    const msg = (err as any)?.reason || (err as any)?.message || String(err)
    if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) return 'Transaction was rejected in MetaMask.'
    if (msg.includes('Claim deadline has passed')) return 'The claim deadline has passed. Your deposit was forfeited.'
    if (msg.includes('Only winner can claim')) return 'Only the auction winner can claim.'
    if (msg.includes('ERC20: insufficient allowance') || msg.includes('allowance')) return 'USDC approval insufficient. Please approve again.'
    if (msg.includes('insufficient funds') || msg.includes('transfer amount exceeds balance')) return 'Insufficient USDC balance to complete the purchase.'
    const revertMatch = msg.match(/reason="([^"]+)"/)
    if (revertMatch) return revertMatch[1]
    if (msg.length > 150) return msg.slice(0, 150) + '...'
    return msg
}

function formatDeadlineCountdown(deadline: number): string {
    const now = Math.floor(Date.now() / 1000)
    const remaining = deadline - now
    if (remaining <= 0) return 'Expired'
    const hours = Math.floor(remaining / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    return `${hours}h ${minutes}m remaining`
}

function formatUsdc(units: number): string {
    return (units / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ClaimWinModal({
    auctionId,
    auctionName,
    winningBid,
    depositPaid,
    claimDeadline,
    onClose,
    onSuccess,
}: ClaimWinModalProps) {
    const [step, setStep] = useState<Step>('info')
    const [error, setError] = useState<string | null>(null)
    const [claimTxHash, setClaimTxHash] = useState<string | null>(null)
    const [countdown, setCountdown] = useState(formatDeadlineCountdown(claimDeadline))

    const remainingDue = Math.max(0, winningBid - depositPaid)
    const auctionContractAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
    const usdcAddress = env.NEXT_PUBLIC_USDC_ADDRESS

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown(formatDeadlineCountdown(claimDeadline))
        }, 30_000)
        return () => clearInterval(timer)
    }, [claimDeadline])

    const approveAndClaim = async () => {
        if (!auctionContractAddress) return
        setError(null)

        try {
            const provider = new BrowserProvider((window as any).ethereum)
            const signer = await provider.getSigner()

            if (remainingDue > 0) {
                setStep('approving')
                const usdcContract = new Contract(usdcAddress, USDCABI, signer)
                const approveTx = await usdcContract.approve(auctionContractAddress, BigInt(remainingDue))
                await approveTx.wait()
            }

            setStep('claiming')
            const auctionContract = new Contract(auctionContractAddress, MaskBidAuctionABI, signer)
            const claimTx = await auctionContract.claimWin(BigInt(auctionId))
            const receipt = await claimTx.wait()
            setClaimTxHash(receipt?.hash ?? claimTx.hash)

            setStep('success')
        } catch (err) {
            setError(parseContractError(err))
            setStep('error')
        }
    }

    const isExpired = Math.floor(Date.now() / 1000) > claimDeadline

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={step === 'success' || step === 'error' ? onClose : undefined}
            />

            <div className="relative glass-card w-full max-w-lg overflow-y-auto max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gold/10">
                    <div>
                        <p className="text-dim text-xs font-serif tracking-widest uppercase mb-0.5">You Won</p>
                        <h2 className="text-foreground font-serif font-semibold">{auctionName}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-dim hover:text-gold text-lg leading-none transition-colors duration-200"
                    >
                        ✕
                    </button>
                </div>

                <div className="px-6 pb-6 pt-4 space-y-4">
                    {/* Error display */}
                    {error && (
                        <div className="bg-surface border border-status-error/30 px-4 py-3">
                            <p className="text-status-error text-sm">{error}</p>
                        </div>
                    )}

                    {/* INFO / APPROVE step */}
                    {(step === 'info' || step === 'approve') && (
                        <>
                            <div className="bg-surface border border-gold/20 p-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted font-serif">Winning bid</span>
                                    <span className="text-foreground font-mono font-semibold">{formatUsdc(winningBid)} USDC</span>
                                </div>
                                <div className="h-px bg-gold/10" />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted font-serif">Deposit already paid</span>
                                    <span className="text-foreground font-mono">{formatUsdc(depositPaid)} USDC</span>
                                </div>
                                <div className="h-px bg-gold/10" />
                                <div className="flex items-center justify-between">
                                    <span className="text-gold font-serif font-semibold">Balance due now</span>
                                    <span className="text-gold font-mono font-bold text-base">{formatUsdc(remainingDue)} USDC</span>
                                </div>
                            </div>

                            <div className={`bg-surface border px-4 py-3 flex items-center justify-between text-sm ${
                                isExpired ? 'border-status-error/30' : 'border-status-upcoming/30'
                            }`}>
                                <span className="text-muted font-serif">Claim deadline</span>
                                <span className={`font-mono text-xs ${isExpired ? 'text-status-error' : 'text-status-upcoming'}`}>
                                    {countdown}
                                </span>
                            </div>

                            {isExpired ? (
                                <div className="bg-surface border border-status-error/30 px-4 py-3">
                                    <p className="text-status-error text-sm font-serif">
                                        The claim window has expired. Your deposit has been forfeited.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-muted text-sm font-serif">
                                        {remainingDue > 0
                                            ? `Pay the remaining ${formatUsdc(remainingDue)} USDC to receive your RWA token. You will first approve USDC, then confirm the claim.`
                                            : 'Your deposit covers the full winning bid. Confirm to receive your RWA token.'}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={approveAndClaim}
                                        className="btn-ornate text-gold font-serif tracking-wider w-full py-3"
                                    >
                                        {remainingDue > 0 ? 'Approve & Claim Win' : 'Claim Win'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="btn-ornate-ghost text-muted hover:text-foreground font-serif tracking-wider w-full py-2 text-sm"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                        </>
                    )}

                    {/* APPROVING step */}
                    {step === 'approving' && (
                        <div className="text-center py-10 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto" />
                            <h3 className="text-foreground font-serif font-semibold">Approving USDC...</h3>
                            <p className="text-muted text-sm">Please confirm the approval in MetaMask.</p>
                        </div>
                    )}

                    {/* CLAIMING step */}
                    {step === 'claiming' && (
                        <div className="text-center py-10 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto" />
                            <h3 className="text-foreground font-serif font-semibold">Claiming your win...</h3>
                            <p className="text-muted text-sm">Transferring USDC and receiving your RWA token.</p>
                        </div>
                    )}

                    {/* SUCCESS step */}
                    {step === 'success' && (
                        <div className="py-4 space-y-4">
                            <div className="text-center space-y-2">
                                <div className="text-status-live font-serif text-4xl">&#9670;</div>
                                <h3 className="text-foreground font-serif font-bold text-xl">Claim Complete!</h3>
                                <p className="text-muted text-sm">Your RWA token has been transferred to your wallet.</p>
                            </div>
                            <div className="bg-surface border border-status-live/20 p-4 space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted font-serif">Total paid</span>
                                    <span className="text-foreground font-mono font-semibold">{formatUsdc(winningBid)} USDC</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted font-serif">Token received</span>
                                    <span className="text-status-live font-mono text-xs flex items-center gap-1">
                                        <span className="text-[8px]">&#9670;</span> In your wallet
                                    </span>
                                </div>
                            </div>
                            {claimTxHash && (
                                <CRECommandBox
                                    txHash={claimTxHash}
                                    steps={[
                                        { label: 'WinClaimed (skip 0-3: USDC + ERC1155 transfers)', eventIndex: 4 },
                                    ]}
                                    command="cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => { onSuccess?.(); onClose() }}
                                className="btn-ornate text-gold font-serif tracking-wider w-full py-3"
                            >
                                Done
                            </button>
                        </div>
                    )}

                    {/* ERROR step */}
                    {step === 'error' && (
                        <div className="text-center py-6 space-y-4">
                            <div className="text-status-error font-serif text-4xl">&#10005;</div>
                            <h3 className="text-foreground font-serif font-semibold text-lg">Something went wrong</h3>
                            <p className="text-muted text-sm">{error || 'Failed to complete the claim.'}</p>
                            <button
                                type="button"
                                onClick={() => { setStep('info'); setError(null) }}
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
