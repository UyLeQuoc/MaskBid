'use client'
import { useSDK } from '@metamask/sdk-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL

const KYC_READ_ABI = [
    {
        name: 'isKYCVerified',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
    },
] as const

function truncateAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function Header() {
    const { sdk, connected, account } = useSDK()
    const [kycVerified, setKycVerified] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const prevAccount = useRef<string | null>(null)

    const checkKYC = useCallback(async (address: string) => {
        try {
            const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
            const verified = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: KYC_READ_ABI,
                functionName: 'isKYCVerified',
                args: [address as `0x${string}`],
            })
            setKycVerified(!!verified)
        } catch {
            setKycVerified(false)
        }
    }, [])

    useEffect(() => {
        if (connected && account && account !== prevAccount.current) {
            prevAccount.current = account
            checkKYC(account)
        }
        if (!connected) {
            prevAccount.current = null
            setKycVerified(false)
        }
    }, [connected, account, checkKYC])

    const handleConnect = async () => {
        try {
            await sdk?.connect()
        } catch {
            // ignore
        }
    }

    const handleDisconnect = () => {
        sdk?.disconnect()
        setKycVerified(false)
    }

    return (
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 text-slate-900 font-bold text-xl">
                        <span className="text-blue-600">Mask</span>
                        <span>Bid</span>
                    </Link>

                    {/* Nav */}
                    <nav className="hidden md:flex items-center gap-6">
                        <Link href="/auctions" className="text-slate-700 hover:text-slate-900 text-sm transition-colors">
                            Auctions
                        </Link>
                        {kycVerified && (
                            <>
                                <Link href="/dashboard" className="text-slate-700 hover:text-slate-900 text-sm transition-colors">
                                    Dashboard
                                </Link>
                                <Link href="/my-assets" className="text-slate-700 hover:text-slate-900 text-sm transition-colors">
                                    My Assets
                                </Link>
                                <Link href="/my-bids" className="text-slate-700 hover:text-slate-900 text-sm transition-colors">
                                    My Bids
                                </Link>
                                <Link href="/verifier" className="text-slate-700 hover:text-slate-900 text-sm transition-colors">
                                    Verifier
                                </Link>
                            </>
                        )}
                    </nav>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {connected && account ? (
                            <>
                                {/* KYC badge */}
                                <span
                                    className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                                        kycVerified
                                            ? 'bg-green-100 border border-green-200 text-green-600'
                                            : 'bg-orange-50 border border-orange-200 text-orange-500'
                                    }`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${kycVerified ? 'bg-green-600' : 'bg-orange-400'}`} />
                                    {kycVerified ? 'Verified' : 'Unverified'}
                                </span>

                                {/* Wallet address */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setMenuOpen(o => !o)}
                                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-100 border border-slate-200 rounded-2xl px-3 py-1.5 text-slate-900 text-sm font-mono transition-colors"
                                    >
                                        <span className="w-2 h-2 bg-green-600 rounded-full" />
                                        {truncateAddress(account)}
                                    </button>
                                    {menuOpen && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                                            {!kycVerified && (
                                                <Link
                                                    href="/dashboard"
                                                    onClick={() => setMenuOpen(false)}
                                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-orange-500 hover:text-orange-600 hover:bg-slate-50 transition-colors"
                                                >
                                                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                                                    Complete KYC
                                                </Link>
                                            )}
                                            {kycVerified && (
                                                <div className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-green-600 border-b border-slate-100">
                                                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                                                    KYC Verified
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { handleDisconnect(); setMenuOpen(false) }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={handleConnect}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-2xl transition-colors"
                            >
                                Connect Wallet
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
