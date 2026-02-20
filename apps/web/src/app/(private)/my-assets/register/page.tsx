'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function RegisterAssetPage() {
    const [form, setForm] = useState({
        name: '',
        type: '',
        description: '',
        serial: '',
        reservePrice: '',
        requiredDeposit: '',
        auctionDuration: '72',
    })
    const [submitted, setSubmitted] = useState(false)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log('Register asset (stub):', form)
        setSubmitted(true)
    }

    if (submitted) {
        return (
            <div className="bg-slate-900 min-h-screen text-white flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold mb-2">Asset Submitted!</h2>
                    <p className="text-white/50 mb-6">Your asset has been submitted for verifier review. Once verified, it will be minted as a Human-Locked NFT and listed for auction.</p>
                    <Link href="/my-assets" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                        Back to My Assets
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-900 min-h-screen text-white">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
                <Link href="/my-assets" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block transition-colors">
                    ← Back to My Assets
                </Link>
                <h1 className="text-3xl font-bold mb-2">Register New Asset</h1>
                <p className="text-white/50 mb-2">Submit a physical asset for verifier review. After approval, it will be minted as a Human-Locked NFT.</p>

                {/* Info */}
                <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 mb-8">
                    <span className="text-blue-400 mt-0.5">ℹ️</span>
                    <p className="text-blue-200 text-sm">
                        You set the <span className="font-semibold">reserve price</span>, <span className="font-semibold">required deposit</span>, and <span className="font-semibold">auction duration</span> now. Bidders will submit encrypted sealed bids — you cannot see bid amounts during the auction.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Asset Name *</label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Rolex Submariner 2023"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Asset Type *</label>
                            <select
                                required
                                value={form.type}
                                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="">Select type...</option>
                                <option value="Watch">Watch</option>
                                <option value="Art">Art</option>
                                <option value="Real Estate">Real Estate</option>
                                <option value="Gold">Gold</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Description *</label>
                            <textarea
                                required
                                rows={4}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Describe the asset in detail: condition, provenance, authenticity..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Serial / Certificate Number</label>
                            <input
                                type="text"
                                value={form.serial}
                                onChange={e => setForm(f => ({ ...f, serial: e.target.value }))}
                                placeholder="e.g. SUB-2023-00471"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Reserve Price (USDC) *
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="1"
                                    value={form.reservePrice}
                                    onChange={e => setForm(f => ({ ...f, reservePrice: e.target.value }))}
                                    placeholder="0"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">USDC</span>
                            </div>
                            <p className="text-white/30 text-xs mt-1.5">Minimum bid required to qualify. Bids below this are rejected by Chainlink CRE.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Required Deposit (USDC) *
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    step="1"
                                    value={form.requiredDeposit}
                                    onChange={e => setForm(f => ({ ...f, requiredDeposit: e.target.value }))}
                                    placeholder="0"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">USDC</span>
                            </div>
                            <p className="text-white/30 text-xs mt-1.5">Fixed amount every bidder must deposit to enter. Non-winners get it back. Recommended: 5–10% of your reserve price.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Auction Duration *</label>
                            <select
                                required
                                value={form.auctionDuration}
                                onChange={e => setForm(f => ({ ...f, auctionDuration: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            >
                                <option value="24">24 hours</option>
                                <option value="48">48 hours</option>
                                <option value="72">72 hours (recommended)</option>
                                <option value="168">7 days</option>
                            </select>
                            <p className="text-white/30 text-xs mt-1.5">Auction starts automatically after your asset is verified and minted on-chain.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Upload Documents</label>
                            <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-white/20 transition-colors cursor-pointer">
                                <p className="text-white/30 text-sm">📎 Click to upload or drag & drop</p>
                                <p className="text-white/20 text-xs mt-1">PDF, JPG, PNG up to 10MB — certificate, photos, provenance docs</p>
                                <input type="file" className="hidden" multiple accept=".pdf,.jpg,.jpeg,.png" />
                            </div>
                        </div>
                    </div>

                    {/* Seller note */}
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/40 space-y-1">
                        <p>⚠️ <span className="text-white/60 font-medium">As the seller, you will only see the number of bids</span> — not the amounts. Chainlink CRE decrypts all bids in a secure enclave and pays you the winning USDC amount after settlement.</p>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
                    >
                        Submit Asset for Verification
                    </button>
                </form>
            </div>
        </div>
    )
}
