import Link from 'next/link'

const FEATURED_AUCTIONS = [
    { id: '1', name: 'Rolex Submariner 2023', type: 'Watch', reservePrice: '2,000', endTime: '2h 14m', image: '⌚', bidCount: 7 },
    { id: '2', name: 'Oil Painting — Coastal Sunrise', type: 'Art', reservePrice: '500', endTime: '5h 42m', image: '🎨', bidCount: 3 },
    { id: '3', name: '1kg Gold Bar (LBMA Certified)', type: 'Gold', reservePrice: '16,000', endTime: '11h 00m', image: '🥇', bidCount: 12 },
]

export default function LandingPage() {
    return (
        <div className="bg-slate-50 text-slate-900">
            {/* Hero */}
            <section className="bg-linear-to-br from-slate-50 via-blue-50 to-slate-50 py-28 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                        Private · Verified · Bot-Free
                    </div>
                    <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
                        The Dark Auction for{' '}
                        <span className="text-blue-600">Real-World Assets.</span>
                    </h1>
                    <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto">
                        Sealed bids. Human-Locked NFTs. No sniping, no bots, no stolen assets.
                    </p>
                    <p className="text-sm text-slate-400 mb-10 max-w-xl mx-auto">
                        Powered by <span className="text-slate-600">Chainlink Confidential HTTP</span> for encrypted bids and <span className="text-slate-600">World ID</span> for identity-bound ownership.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/auctions"
                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-2xl transition-colors text-lg"
                        >
                            Browse Auctions
                        </Link>
                        <Link
                            href="/dashboard"
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-900 font-semibold px-8 py-4 rounded-2xl transition-colors text-lg"
                        >
                            Get Verified →
                        </Link>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-20 px-4 bg-slate-100/50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-3">How It Works</h2>
                    <p className="text-slate-400 text-center mb-12 text-sm">A sealed-bid auction where no one — not even the seller — sees bid amounts until settlement.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                step: '01', icon: '🌍',
                                title: 'Verify with World ID',
                                desc: 'Complete KYC via World ID. Only verified humans can bid or own assets — one person, one bid, no bots.',
                            },
                            {
                                step: '02', icon: '🔐',
                                title: 'Encrypt Your Bid',
                                desc: 'Enter your USDC bid amount. It\'s encrypted with Chainlink\'s public key before going on-chain. The seller only sees your escrow deposit.',
                            },
                            {
                                step: '03', icon: '⚖️',
                                title: 'CRE Settles Fairly',
                                desc: 'When the auction ends, Chainlink CRE decrypts all bids in a secure enclave and selects the highest bid above the reserve price.',
                            },
                            {
                                step: '04', icon: '🔒',
                                title: 'Human-Locked Transfer',
                                desc: 'The winning NFT transfers only to the verified winner. Hackers and unverified wallets are blocked at the contract level.',
                            },
                        ].map(item => (
                            <div key={item.step} className="bg-white border border-slate-200 rounded-3xl p-6">
                                <div className="text-3xl mb-4">{item.icon}</div>
                                <div className="text-blue-600 text-xs font-bold mb-2">STEP {item.step}</div>
                                <h3 className="text-slate-900 font-semibold text-lg mb-2">{item.title}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Key Differentiators */}
            <section className="py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-3">Why MaskBid?</h2>
                    <p className="text-slate-400 text-center mb-12 text-sm">We solved the three biggest problems in RWA auctions.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: '🔒',
                                title: 'No Bid Sniping',
                                color: 'from-blue-50 to-blue-100/50',
                                border: 'border-blue-200',
                                desc: 'Bids are encrypted with Chainlink Confidential HTTP. Nobody can see the current high bid and outbid at the last second.',
                            },
                            {
                                icon: '🤖',
                                title: 'No Bots',
                                color: 'from-purple-50 to-purple-100/50',
                                border: 'border-purple-200',
                                desc: 'World ID enforces one verified human = one bid per auction. Sybil attacks and bot farms are blocked at the identity layer.',
                            },
                            {
                                icon: '🛡️',
                                title: 'No Theft',
                                color: 'from-green-50 to-green-100/50',
                                border: 'border-green-200',
                                desc: 'Assets are Human-Locked NFTs. Even if your wallet key is stolen, the thief can\'t transfer the NFT without your World ID.',
                            },
                        ].map(item => (
                            <div key={item.title} className={`bg-linear-to-br ${item.color} border ${item.border} rounded-3xl p-8`}>
                                <div className="text-4xl mb-4">{item.icon}</div>
                                <h3 className="text-slate-900 font-bold text-xl mb-3">{item.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Roles */}
            <section className="py-20 px-4 bg-slate-100/50">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-4">Three Roles, One Ecosystem</h2>
                    <p className="text-slate-500 text-center mb-12">Everyone has a clear, enforceable role on MaskBid.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                            {
                                role: 'Verifier',
                                icon: '🛡️',
                                color: 'bg-white',
                                border: 'border-slate-200',
                                desc: 'Reviews physical assets and their documentation. Approves or rejects minting. Earns fees for trusted verification.',
                            },
                            {
                                role: 'Seller',
                                icon: '🏷️',
                                color: 'bg-white',
                                border: 'border-slate-200',
                                desc: 'Registers a physical asset, sets the reserve price and auction duration. Receives USDC payment after Chainlink CRE settles the auction.',
                            },
                            {
                                role: 'Bidder',
                                icon: '💰',
                                color: 'bg-white',
                                border: 'border-slate-200',
                                desc: 'KYC-verified human who submits an encrypted sealed bid with USDC escrow. Wins the NFT if their bid is highest above the reserve.',
                            },
                        ].map(item => (
                            <div key={item.role} className={`${item.color} border ${item.border} rounded-3xl p-8`}>
                                <div className="text-4xl mb-4">{item.icon}</div>
                                <h3 className="text-slate-900 font-bold text-xl mb-3">{item.role}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Featured Auctions */}
            <section className="py-20 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h2 className="text-3xl font-bold mb-1">Featured Auctions</h2>
                            <p className="text-slate-400 text-sm">Bids sealed · Winner selected by Chainlink CRE</p>
                        </div>
                        <Link href="/auctions" className="text-blue-600 hover:text-blue-700 text-sm transition-colors">
                            View all →
                        </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {FEATURED_AUCTIONS.map(auction => (
                            <div key={auction.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-slate-300 transition-colors">
                                <div className="h-40 bg-slate-100 flex items-center justify-center text-6xl">
                                    {auction.image}
                                </div>
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{auction.type}</span>
                                        <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Active</span>
                                    </div>
                                    <h3 className="text-slate-900 font-semibold mb-3">{auction.name}</h3>
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <div>
                                            <p className="text-slate-400 text-xs">Reserve Price</p>
                                            <p className="text-slate-900 font-bold">{auction.reservePrice} USDC</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-400 text-xs">Ends in</p>
                                            <p className="text-orange-500 font-medium">{auction.endTime}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <span>🔒</span>
                                        <span>{auction.bidCount} sealed bids</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="py-20 px-4 bg-slate-100/50">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-4xl font-bold mb-4">Ready to bid?</h2>
                    <p className="text-slate-500 mb-2">Complete World ID verification to access sealed auctions.</p>
                    <p className="text-slate-400 text-sm mb-8">1 person · 1 bid · No sniping · No bots</p>
                    <Link
                        href="/dashboard"
                        className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-10 py-4 rounded-2xl transition-colors text-lg"
                    >
                        Get Verified with World ID
                    </Link>
                </div>
            </section>
        </div>
    )
}
