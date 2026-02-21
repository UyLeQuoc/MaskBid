'use client'

const PENDING = [
    {
        id: '1', name: 'Omega Speedmaster Moonwatch', type: 'Watch',
        submitter: '0xAaBb...1122', submitted: 'Feb 18, 2026',
        serial: 'OMG-311.30.42-001',
    },
    {
        id: '2', name: 'Contemporary Sculpture — Form IV', type: 'Art',
        submitter: '0xCcDd...3344', submitted: 'Feb 19, 2026',
        serial: 'ART-SC-2023-07',
    },
]

const VERIFIED = [
    { id: '3', name: 'Rolex Submariner 2023', type: 'Watch', owner: '0x1111...aaaa', verifiedDate: 'Feb 10, 2026' },
    { id: '4', name: 'Oil Painting — Coastal Sunrise', type: 'Art', owner: '0x2222...bbbb', verifiedDate: 'Feb 5, 2026' },
    { id: '5', name: '1kg Gold Bar', type: 'Gold', owner: '0x3333...cccc', verifiedDate: 'Jan 28, 2026' },
]

export default function VerifierPage() {
    return (
        <div className="bg-slate-50 min-h-screen text-slate-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-1">Verifier Dashboard</h1>
                    <p className="text-slate-500">Review and authenticate asset submissions.</p>
                </div>

                {/* Pending Queue */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-5">
                        <h2 className="text-slate-900 font-semibold text-xl">Pending Verification</h2>
                        <span className="bg-orange-50 text-orange-500 text-xs font-bold px-2.5 py-1 rounded-full">
                            {PENDING.length}
                        </span>
                    </div>

                    <div className="space-y-4">
                        {PENDING.map(item => (
                            <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{item.type}</span>
                                            <span className="text-xs font-medium text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Pending</span>
                                        </div>
                                        <h3 className="text-slate-900 font-semibold text-lg mb-1">{item.name}</h3>
                                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                                            <span>Serial: <span className="text-slate-600 font-mono">{item.serial}</span></span>
                                            <span>Submitted by: <span className="text-slate-600 font-mono">{item.submitter}</span></span>
                                            <span>Date: <span className="text-slate-600">{item.submitted}</span></span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => console.log('View documents stub', item.id)}
                                            className="bg-slate-100 hover:bg-slate-100 border border-slate-200 text-slate-900 text-sm font-medium px-4 py-2 rounded-2xl transition-colors"
                                        >
                                            View Docs
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => console.log('Verify asset stub', item.id)}
                                            className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2 rounded-2xl transition-colors"
                                        >
                                            Verify Asset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recently Verified */}
                <div>
                    <h2 className="text-slate-900 font-semibold text-xl mb-5">Recently Verified</h2>
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-slate-400 text-xs border-b border-slate-200">
                                    <th className="text-left px-6 py-4">Asset</th>
                                    <th className="text-left px-4 py-4">Type</th>
                                    <th className="text-left px-4 py-4">Owner</th>
                                    <th className="text-right px-6 py-4">Verified Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {VERIFIED.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 bg-green-600 rounded-full" />
                                                <span className="text-slate-900 font-medium">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-slate-500">{item.type}</td>
                                        <td className="px-4 py-4 font-mono text-slate-600">{item.owner}</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{item.verifiedDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
