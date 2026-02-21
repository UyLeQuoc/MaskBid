'use client'

import { useState, useCallback } from 'react'
import { useMaskBidAuction } from '@/hooks/useMaskBidAuction'
import { useUSDC } from '@/hooks/useUSDC'
import { encryptBid, generateBidHash } from '@/lib/crypto'
import { env } from '@/configs/env'

type Step = 'approve' | 'deposit' | 'bid' | 'success' | 'error'

interface BidFormProps {
  auction: {
    id: string
    contractAuctionId?: bigint
    name: string
    reservePrice: string
    requiredDeposit: string
    endTime: string
  }
  bidderAddress: string
  onClose: () => void
  onSuccess?: () => void
}

export default function BidForm({ auction, bidderAddress, onClose, onSuccess }: BidFormProps) {
  const [step, setStep] = useState<Step>('approve')
  const [error, setError] = useState<string | null>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [txHash, setTxHash] = useState<string | null>(null)

  const { approve, getAllowance, parseUSDC } = useUSDC()
  const { placeBid } = useMaskBidAuction()

  const auctionAddress = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS
  const depositAmount = parseUSDC(auction.requiredDeposit.replace(/,/g, ''))
  const reserveNum = Number(auction.reservePrice.replace(/,/g, ''))

  // Check if USDC is already approved
  const checkAllowance = useCallback(async () => {
    if (!auctionAddress) return false
    const allowance = await getAllowance(bidderAddress, auctionAddress)
    return allowance !== null && allowance >= depositAmount
  }, [auctionAddress, bidderAddress, depositAmount, getAllowance])

  // Step 1: Approve USDC spending
  const handleApprove = async () => {
    setError(null)
    if (!auctionAddress) {
      setError('Auction contract not configured')
      return
    }

    const hash = await approve(auctionAddress, depositAmount)
    if (hash) {
      setTxHash(hash)
      setStep('deposit')
    } else {
      setError('Failed to approve USDC')
      setStep('error')
    }
  }

  // Step 2: Place deposit and bid
  const handlePlaceBid = async () => {
    setError(null)
    if (!bidAmount || Number(bidAmount) < reserveNum) {
      setError(`Bid must be at least ${auction.reservePrice} USDC`)
      return
    }

    if (!auction.contractAuctionId) {
      setError('Invalid auction ID')
      return
    }

    try {
      // Encrypt the bid
      const { encryptedData, hash } = await encryptBid(Number(bidAmount), bidderAddress)

      // Generate bid hash for on-chain
      const bidHash = await generateBidHash(auction.contractAuctionId, bidderAddress, encryptedData)

      // Place bid on-chain
      const txHash = await placeBid(auction.contractAuctionId, bidHash)

      if (txHash) {
        setTxHash(txHash)
        // Store encrypted bid to Supabase (would be done via API)
        await storeEncryptedBid(auction.id, encryptedData, hash, bidderAddress, txHash)
        setStep('success')
        onSuccess?.()
      } else {
        setError('Failed to place bid')
        setStep('error')
      }
    } catch (err) {
      setError((err as Error).message)
      setStep('error')
    }
  }

  // Store encrypted bid to backend
  const storeEncryptedBid = async (
    auctionId: string,
    encryptedData: string,
    hash: string,
    bidder: string,
    escrowTxHash: string
  ) => {
    try {
      // This would be an API call to your backend
      // For now, we'll just log it
      console.log('Storing encrypted bid:', {
        auctionId,
        encryptedData: encryptedData.slice(0, 50) + '...',
        hash,
        bidder,
        escrowTxHash,
      })
    } catch (err) {
      console.error('Failed to store encrypted bid:', err)
    }
  }

  const getStepNumber = () => {
    switch (step) {
      case 'approve': return 1
      case 'deposit': return 2
      case 'bid': return 2
      case 'success': return 3
      case 'error': return 0
    }
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-6">
        {['Approve', 'Deposit & Bid', 'Done'].map((label, i) => (
          <div key={label} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              getStepNumber() > i + 1 ? 'bg-green-500 text-white' :
              getStepNumber() === i + 1 ? 'bg-blue-600 text-white' :
              'bg-slate-200 text-slate-500'
            }`}>
              {getStepNumber() > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`ml-2 text-sm ${
              getStepNumber() === i + 1 ? 'text-slate-900 font-medium' : 'text-slate-500'
            }`}>
              {label}
            </span>
            {i < 2 && <div className="w-12 h-0.5 mx-3 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Approve USDC */}
      {step === 'approve' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Approve USDC</h3>
          <p className="text-slate-500 text-sm">
            First, approve the auction contract to spend {auction.requiredDeposit} USDC as your deposit.
          </p>
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Deposit Amount</span>
              <span className="font-semibold">{auction.requiredDeposit} USDC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Your Address</span>
              <span className="font-mono text-slate-700">{bidderAddress.slice(0, 6)}...{bidderAddress.slice(-4)}</span>
            </div>
          </div>
          <button
            onClick={handleApprove}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Approve USDC
          </button>
        </div>
      )}

      {/* Step 2: Place Bid */}
      {(step === 'deposit' || step === 'bid') && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Place Your Bid</h3>
          <p className="text-slate-500 text-sm">
            Enter your bid amount. This will be encrypted and only revealed by Chainlink CRE when the auction ends.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Bid Amount (USDC)
            </label>
            <div className="relative">
              <input
                type="number"
                min={reserveNum}
                step="1"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder={`Minimum ${auction.reservePrice}`}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-16 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">USDC</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Minimum bid: {auction.reservePrice} USDC</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl">🔒</span>
              <div>
                <p className="text-blue-900 font-medium text-sm">Encrypted Bidding</p>
                <p className="text-blue-700 text-xs mt-1">
                  Your bid will be encrypted with RSA before submission. Only the Chainlink CRE enclave can decrypt it.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handlePlaceBid}
            disabled={!bidAmount || Number(bidAmount) < reserveNum}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Place Encrypted Bid
          </button>
        </div>
      )}

      {/* Step 3: Success */}
      {step === 'success' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl mb-2">🎉</div>
          <h3 className="text-lg font-semibold">Bid Placed Successfully!</h3>
          <p className="text-slate-500 text-sm">
            Your encrypted bid has been submitted. Good luck!
          </p>
          {txHash && (
            <a
              href={`${env.NEXT_PUBLIC_EXPLORER_URL}/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-600 hover:text-blue-700 text-sm underline"
            >
              View on Explorer
            </a>
          )}
          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold py-3 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="space-y-4 text-center">
          <div className="text-5xl mb-2">❌</div>
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="text-slate-500 text-sm">
            {error || 'Failed to process your bid. Please try again.'}
          </p>
          <button
            onClick={() => setStep('approve')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
