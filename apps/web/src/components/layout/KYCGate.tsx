'use client'
import { useSDK } from '@metamask/sdk-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'
import { KYCFlow } from '@/components/kyc/KYCFlow'

const CONTRACT_ADDRESS = env.NEXT_PUBLIC_ASSET_CONTRACT_ADDRESS as `0x${string}`
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

export function KYCGate({ children }: { children: React.ReactNode }) {
    const { sdk, connected, account } = useSDK()
    const [kycVerified, setKycVerified] = useState<boolean | null>(null)
    const prevAccount = useRef<string | null>(null)

    const checkKYC = useCallback(async (address: string) => {
        setKycVerified(null) // loading
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

    // Not connected
    if (!connected) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg aria-hidden="true" className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">Connect your wallet to continue</h2>
                    <p className="text-blue-600 text-sm mb-6">This page requires a connected wallet with KYC verification.</p>
                    <button
                        type="button"
                        onClick={() => sdk?.connect()}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-2xl transition-colors"
                    >
                        Connect Wallet
                    </button>
                </div>
            </div>
        )
    }

    // Checking KYC
    if (kycVerified === null) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <svg aria-hidden="true" className="animate-spin w-10 h-10 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-blue-600 text-sm">Checking verification status...</p>
                </div>
            </div>
        )
    }

    // Not KYC verified — show KYC flow
    if (!kycVerified) {
        return <KYCFlow />
    }

    // Verified — render children
    return <>{children}</>
}
