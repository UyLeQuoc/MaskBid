import Link from 'next/link'

export function Footer() {
    return (
        <footer className="bg-white border-t border-slate-200 text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    {/* Col 1: Logo + tagline */}
                    <div>
                        <div className="text-slate-900 font-bold text-xl mb-3">
                            <span className="text-blue-600">Mask</span>Bid
                        </div>
                        <p className="text-sm leading-relaxed">
                            Bid on verified real-world assets, powered by World ID.
                        </p>
                    </div>

                    {/* Col 2: Links */}
                    <div>
                        <h3 className="text-slate-900 text-sm font-semibold mb-4">Explore</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/auctions" className="hover:text-slate-900 transition-colors">
                                    Auctions
                                </Link>
                            </li>
                            <li>
                                <Link href="/#how-it-works" className="hover:text-slate-900 transition-colors">
                                    How It Works
                                </Link>
                            </li>
                            <li>
                                <Link href="/#about" className="hover:text-slate-900 transition-colors">
                                    About
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Col 3: Tech stack */}
                    <div>
                        <h3 className="text-slate-900 text-sm font-semibold mb-4">Powered by</h3>
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-full">
                                World ID
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-full">
                                Chainlink
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-full">
                                Ethereum / Sepolia
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-200 pt-6 text-center text-xs">
                    &copy; 2026 MaskBid. All rights reserved.
                </div>
            </div>
        </footer>
    )
}
