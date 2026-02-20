'use client'
import { useState } from 'react'

type Step = 'gate' | 'deposit' | 'bid' | 'success'

interface BidModalProps {
    auction: {
        id: string
        name: string
        reservePrice: string
        requiredDeposit: string
        endTime: string
    }
    onClose: () => void
}

// Mock auth state — in production this comes from wallet/KYC context
const MOCK_WALLET_CONNECTED = true
const MOCK_KYC_VERIFIED = true

export default function BidModal({ auction, onClose }: BidModalProps) {
    const [step, setStep] = useState<Step>(() => {
        if (!MOCK_WALLET_CONNECTED) return 'gate'
        if (!MOCK_KYC_VERIFIED) return 'gate'
        return 'deposit'
    })
    const [bidAmount, setBidAmount] = useState('')
    const [depositLoading, setDepositLoading] = useState(false)
    const [bidLoading, setBidLoading] = useState(false)

    const reserveNum = Number(auction.reservePrice.replace(/,/g, ''))

    function handleDeposit() {
        setDepositLoading(true)
        setTimeout(() => {
            setDepositLoading(false)
            setStep('bid')
        }, 1500)
    }

    function handleBid() {
        if (!bidAmount || Number(bidAmount) < reserveNum) return
        setBidLoading(true)
        setTimeout(() => {
            setBidLoading(false)
            setStep('success')
        }, 1800)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop — keep black overlay as specified */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={step === 'success' ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl">
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
                    {(['deposit', 'bid', 'success'] as const).map((s, i) => {
                        const labels = ['Deposit', 'Bid', 'Confirm']
                        const order = ['deposit', 'bid', 'success']
                        const currentIdx = order.indexOf(step)
                        const isActive = step === s
                        const isDone = currentIdx > i
                        return (
                            <div key={s} className="flex items-center flex-1">
                                <div className={`flex items-center gap-1.5 ${i < 2 ? 'flex-1' : ''}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {isDone ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs ${isActive ? 'text-slate-900' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
                                        {labels[i]}
                                    </span>
                                    {i < 2 && <div className="flex-1 h-px bg-slate-200 mx-2" />}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="px-6 pb-6 pt-4">
                    {/* GATE step */}
                    {step === 'gate' && (
                        <div className="text-center py-4 space-y-4">
                            {!MOCK_WALLET_CONNECTED ? (
                                <>
                                    <div className="text-4xl mb-2">🔗</div>
                                    <h3 className="text-slate-900 font-semibold text-lg">Connect your wallet</h3>
                                    <p className="text-slate-500 text-sm">You need a connected wallet to place bids.</p>
                                    <button
                                        type="button"
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                                    >
                                        Connect Wallet
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="text-4xl mb-2">🪪</div>
                                    <h3 className="text-slate-900 font-semibold text-lg">KYC Required</h3>
                                    <p className="text-slate-500 text-sm">You must complete identity verification before bidding.</p>
                                    <a
                                        href="/dashboard"
                                        className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors"
                                    >
                                        Go to Dashboard to Verify
                                    </a>
                                </>
                            )}
                        </div>
                    )}

                    {/* DEPOSIT step */}
                    {step === 'deposit' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-slate-900 font-semibold text-lg mb-1">Participation Deposit</h3>
                                <p className="text-slate-500 text-sm">Every bidder must deposit a fixed security amount to enter this auction.</p>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-sm">
                                <div className="flex items-start gap-2 text-slate-600">
                                    <span className="text-orange-500 shrink-0 mt-0.5">→</span>
                                    <span>If you don&apos;t win, you can claim this back after settlement.</span>
                                </div>
                                <div className="flex items-start gap-2 text-slate-600">
                                    <span className="text-orange-500 shrink-0 mt-0.5">→</span>
                                    <span>If you win, this deposit is held as insurance for the seller.</span>
                                </div>
                            </div>

                            {/* Amount box */}
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 flex items-center justify-between">
                                <span className="text-blue-700 text-sm font-medium">Deposit Amount</span>
                                <span className="text-slate-900 font-bold text-lg">{auction.requiredDeposit} <span className="text-slate-500 text-sm font-normal">USDC</span></span>
                            </div>
                            <p className="text-slate-400 text-xs -mt-2">Fixed for all bidders. Non-refundable only if you win.</p>

                            <button
                                type="button"
                                onClick={handleDeposit}
                                disabled={depositLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                            >
                                {depositLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Depositing...
                                    </>
                                ) : 'Approve & Deposit'}
                            </button>
                        </div>
                    )}

                    {/* BID step */}
                    {step === 'bid' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-slate-900 font-semibold text-lg mb-1">Your Sealed Bid</h3>
                            </div>

                            {/* Deposit confirmed */}
                            <div className="flex items-center gap-2 bg-green-100 border border-green-200 rounded-2xl px-4 py-3 text-sm">
                                <span className="text-green-600">✅</span>
                                <span className="text-green-600">Deposit locked: <span className="font-semibold">{auction.requiredDeposit} USDC</span></span>
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

                            {/* Chainlink info */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-start gap-2.5 text-xs text-slate-500">
                                <span className="text-blue-600 shrink-0 mt-0.5">🔒</span>
                                <span>Your bid will be encrypted with Chainlink&apos;s public key. No one — not even the seller — can read it until CRE reveals the winner.</span>
                            </div>

                            <button
                                type="button"
                                onClick={handleBid}
                                disabled={bidLoading || !bidAmount || Number(bidAmount) < reserveNum}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                            >
                                {bidLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Encrypting & submitting...
                                    </>
                                ) : 'Confirm Sealed Bid'}
                            </button>
                        </div>
                    )}

                    {/* SUCCESS step */}
                    {step === 'success' && (
                        <div className="text-center py-2 space-y-4">
                            <div className="text-5xl">✅</div>
                            <h3 className="text-slate-900 font-bold text-xl">Bid Submitted</h3>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-sm text-left">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Deposit locked</span>
                                    <span className="text-slate-900 font-medium">{auction.requiredDeposit} USDC</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Bid sealed</span>
                                    <span className="text-slate-700 flex items-center gap-1.5">🔒 Encrypted</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Results after</span>
                                    <span className="text-orange-500 font-medium">{auction.endTime}</span>
                                </div>
                            </div>

                            <p className="text-slate-400 text-xs">You&apos;ll be notified when Chainlink CRE reveals the winner.</p>

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
