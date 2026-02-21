'use client'
import Link from 'next/link'
import { useState } from 'react'

type BidStatus = 'Active' | 'Pending Settlement' | 'Won' | 'Lost' | 'Claimed'

type Bid = {
    id: string
    name: string
    type: string
    reservePrice: string
    deposit: string
    myBid: string | null
    endTime: string
    status: BidStatus
}

const BIDS: Bid[] = [
    {
        id: '1',
        name: 'Rolex Submariner 2023',
        type: 'Watch',
        reservePrice: '2,000',
        deposit: '200',
        myBid: null,
        endTime: '2h 14m',
        status: 'Active',
    },
    {
        id: '2',
        name: 'Oil Painting — Coastal Sunrise',
        type: 'Art',
        reservePrice: '500',
        deposit: '50',
        myBid: '750',
        endTime: 'Ended',
        status: 'Won',
    },
    {
        id: '3',
        name: '1kg Gold Bar',
        type: 'Gold',
        reservePrice: '16,000',
        deposit: '1,600',
        myBid: null,
        endTime: 'Ended',
        status: 'Lost',
    },
    {
        id: '4',
        name: 'Vintage Patek Philippe',
        type: 'Watch',
        reservePrice: '8,000',
        deposit: '800',
        myBid: null,
        endTime: 'Ended',
        status: 'Claimed',
    },
]

const STATUS_STYLES: Record<BidStatus, string> = {
    Active: 'text-blue-600 bg-blue-50',
    'Pending Settlement': 'text-amber-600 bg-amber-50',
    Won: 'text-green-600 bg-green-100',
    Lost: 'text-red-600 bg-red-50',
    Claimed: 'text-slate-400 bg-slate-100',
}

function PayModal({ bid, onClose }: { bid: typeof BIDS[number]; onClose: () => void }) {
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    function handlePay() {
        setLoading(true)
        setTimeout(() => {
            setLoading(false)
            setDone(true)
        }, 1800)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={done ? onClose : undefined} />
            <div className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
                    <h2 className="text-slate-900 font-semibold">{done ? 'Payment Complete' : 'Pay & Claim NFT'}</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none transition-colors">✕</button>
                </div>

                <div className="px-6 py-6">
                    {done ? (
                        <div className="text-center space-y-4">
                            <div className="text-5xl">✅</div>
                            <h3 className="text-slate-900 font-bold text-xl">NFT Claimed!</h3>
                            <p className="text-slate-500 text-sm">NFT + deposit transferred to your wallet. Check &apos;My Assets&apos; for your new asset.</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-center mb-2">
                                <div className="text-3xl mb-1">🏆</div>
                                <p className="text-green-600 font-semibold">You Won!</p>
                                <p className="text-slate-500 text-sm mt-1">To receive your NFT and deposit back, pay your bid amount.</p>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Bid amount (goes to seller)</span>
                                    <span className="text-slate-900 font-semibold flex items-center gap-1.5">
                                        🔒 <span className="line-through text-slate-400 mr-1">encrypted</span> {bid.myBid} USDC
                                    </span>
                                </div>
                                <div className="border-t border-slate-200 pt-3">
                                    <p className="text-slate-400 text-xs mb-2">You will receive:</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-600">Deposit refunded</span>
                                        <span className="text-green-600 font-medium">+ {bid.deposit} USDC</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-slate-600">Asset NFT</span>
                                        <span className="text-green-600 font-medium">+ {bid.name}</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handlePay}
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Processing...
                                    </>
                                ) : `Pay ${bid.myBid} USDC & Claim`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function MyBidsPage() {
    const [payTarget, setPayTarget] = useState<typeof BIDS[number] | null>(null)

    const totalDepositsLocked = BIDS
        .filter(b => b.status === 'Active')
        .reduce((sum, b) => sum + Number(b.deposit.replace(/,/g, '')), 0)

    function getAction(bid: typeof BIDS[number]) {
        switch (bid.status) {
            case 'Active': return { label: 'View', style: 'text-blue-600 hover:text-blue-700' }
            case 'Pending Settlement': return { label: 'Waiting...', style: 'text-amber-600 cursor-default' }
            case 'Won': return { label: 'Pay & Claim', style: 'text-green-600 hover:text-green-700 font-semibold' }
            case 'Lost': return { label: 'Claim Deposit', style: 'text-orange-500 hover:text-orange-600 font-semibold' }
            case 'Claimed': return { label: '—', style: 'text-slate-300' }
        }
    }

    function handleAction(bid: typeof BIDS[number]) {
        if (bid.status === 'Won') {
            setPayTarget(bid)
        }
    }

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-1">My Bids</h1>
                    <p className="text-slate-500">Track your sealed bids and claim winnings or deposits after settlement.</p>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-8">
                    <span className="text-blue-600 mt-0.5">🔒</span>
                    <p className="text-blue-700 text-sm">
                        Your bid amounts are <span className="font-semibold">encrypted</span> and never visible on-chain. Only your deposit is locked. Chainlink CRE will reveal the winner after each auction ends.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Active Bids', value: `${BIDS.filter(b => b.status === 'Active').length}` },
                        { label: 'Deposits Locked', value: `${totalDepositsLocked.toLocaleString()} USDC` },
                        { label: 'Auctions Won', value: `${BIDS.filter(b => b.status === 'Won').length}` },
                        { label: 'Deposits to Claim', value: `${BIDS.filter(b => b.status === 'Lost').length}` },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-4">
                            <p className="text-slate-400 text-xs mb-1">{stat.label}</p>
                            <p className="text-slate-900 font-bold">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden mb-8">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-200">
                                    <th className="text-left px-6 py-4">Auction</th>
                                    <th className="text-left px-4 py-4">Type</th>
                                    <th className="text-right px-4 py-4">Reserve</th>
                                    <th className="text-right px-4 py-4">Deposit</th>
                                    <th className="text-right px-4 py-4">My Bid</th>
                                    <th className="text-center px-4 py-4">Ends</th>
                                    <th className="text-center px-4 py-4">Status</th>
                                    <th className="text-right px-6 py-4">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {BIDS.map(bid => {
                                    const action = getAction(bid)
                                    return (
                                        <tr key={bid.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-slate-900 font-medium">{bid.name}</p>
                                            </td>
                                            <td className="px-4 py-4 text-slate-500">{bid.type}</td>
                                            <td className="px-4 py-4 text-right text-slate-700">{bid.reservePrice} USDC</td>
                                            <td className="px-4 py-4 text-right">
                                                <span className={bid.status === 'Claimed' ? 'text-slate-300 line-through' : 'text-amber-600'}>
                                                    {bid.deposit} USDC
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {bid.myBid ? (
                                                    <span className="text-slate-900 font-medium">{bid.myBid} USDC</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-400 text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                                                        🔒 Sealed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={bid.endTime === 'Ended' ? 'text-slate-400' : 'text-orange-500'}>
                                                    {bid.endTime}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[bid.status]}`}>
                                                    {bid.status === 'Won' ? '🏆 Won' : bid.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {bid.status === 'Won' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction(bid)}
                                                        className={`text-sm transition-colors ${action.style}`}
                                                    >
                                                        {action.label}
                                                    </button>
                                                ) : bid.status === 'Active' ? (
                                                    <Link
                                                        href={`/auctions?auctionId=${bid.id}`}
                                                        className={`text-sm transition-colors ${action.style}`}
                                                    >
                                                        {action.label}
                                                    </Link>
                                                ) : (
                                                    <span className={`text-sm ${action.style}`}>{action.label}</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="text-center">
                    <Link href="/auctions" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-2xl transition-colors">
                        Browse More Auctions
                    </Link>
                </div>
            </div>

            {payTarget && (
                <PayModal bid={payTarget} onClose={() => setPayTarget(null)} />
            )}
        </div>
    )
}
