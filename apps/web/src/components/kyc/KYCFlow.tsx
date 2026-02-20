'use client'
import { useSDK } from '@metamask/sdk-react'
import type { ISuccessResult } from '@worldcoin/idkit'
import { IDKitWidget, VerificationLevel } from '@worldcoin/idkit'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'
import { Spinner } from './Spinner'
import { StepIndicator } from './StepIndicator'

const APP_ID = (env.NEXT_PUBLIC_APP_ID || 'app_staging_b2602675085f2b2c08b0ea7c819802fe') as `app_${string}`
const ACTION = env.NEXT_PUBLIC_ACTION
const CONTRACT_ADDRESS = env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`
const RPC_URL = env.NEXT_PUBLIC_RPC_URL
const EXPLORER_URL = env.NEXT_PUBLIC_EXPLORER_URL

export const KYC_READ_ABI = [
    {
        name: 'isKYCVerified',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
    },
] as const

type FlowState =
    | 'idle'
    | 'connecting'
    | 'checking_kyc'
    | 'already_verified'
    | 'needs_verification'
    | 'verifying'
    | 'submitting'
    | 'done'
    | 'error'

function truncateAddress(address: string) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function KYCFlow() {
    const { sdk, connected, account } = useSDK()
    const [flowState, setFlowState] = useState<FlowState>('idle')
    const [txHash, setTxHash] = useState<string | null>(null)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const isDisconnecting = useRef(false)

    const checkKYCStatus = useCallback(async (address: string) => {
        setFlowState('checking_kyc')
        try {
            const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
            const verified = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: KYC_READ_ABI,
                functionName: 'isKYCVerified',
                args: [address as `0x${string}`],
            })
            setFlowState(verified ? 'already_verified' : 'needs_verification')
        } catch (e) {
            console.error('Failed to check KYC status:', e)
            setErrorMsg('Unable to check KYC status. Please try again.')
            setFlowState('error')
        }
    }, [])

    useEffect(() => {
        if (connected && account && flowState === 'connecting') {
            checkKYCStatus(account)
        }
    }, [connected, account, flowState, checkKYCStatus])

    useEffect(() => {
        if (!connected) {
            isDisconnecting.current = false
            return
        }
        if (account && flowState === 'idle' && !isDisconnecting.current) {
            checkKYCStatus(account)
        }
    }, [connected, account, flowState, checkKYCStatus])

    const handleConnect = async () => {
        setFlowState('connecting')
        try {
            await sdk?.connect()
        } catch {
            setFlowState('idle')
            setErrorMsg('Failed to connect wallet. Please try again.')
        }
    }

    const handleVerify = async (proof: ISuccessResult) => {
        if (!account) return
        setFlowState('submitting')
        try {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...proof, wallet_address: account }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
                throw new Error(data.error?.detail || data.error || 'Verification failed')
            }
            setTxHash(data.txHash)

            const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC_URL) })
            const addr = account as `0x${string}`
            let confirmed = false
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000))
                const verified = await publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: KYC_READ_ABI,
                    functionName: 'isKYCVerified',
                    args: [addr],
                })
                if (verified) { confirmed = true; break }
            }
            if (!confirmed) throw new Error('Transaction submitted but on-chain confirmation timed out. Check the explorer.')

            setFlowState('done')
        } catch (e: unknown) {
            setErrorMsg(e instanceof Error ? e.message : 'An unexpected error occurred')
            setFlowState('error')
        }
    }

    const handleDisconnect = () => {
        isDisconnecting.current = true
        sdk?.disconnect()
        setFlowState('idle')
        setTxHash(null)
        setErrorMsg(null)
    }

    const handleRetry = () => {
        setErrorMsg(null)
        if (connected && account) {
            checkKYCStatus(account)
        } else {
            setFlowState('idle')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">MaskBid KYC</h1>
                    <p className="text-blue-600 text-sm">Identity verification powered by World ID</p>
                </div>

                <StepIndicator currentState={flowState} />

                {connected && account && (
                    <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2 mb-4 text-slate-900 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-600 rounded-full" />
                            <span className="font-mono">{truncateAddress(account)}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleDisconnect}
                            className="text-blue-600 hover:text-blue-700 text-xs transition-colors"
                        >
                            Disconnect
                        </button>
                    </div>
                )}

                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">

                    {(flowState === 'idle' || flowState === 'connecting') && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg aria-hidden="true" className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connect Your Wallet</h2>
                            <p className="text-blue-600 text-sm mb-8">Connect MetaMask to begin the KYC process. Your wallet address will be bound to your World ID proof.</p>
                            <button
                                type="button"
                                onClick={handleConnect}
                                disabled={flowState === 'connecting'}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
                            >
                                {flowState === 'connecting' ? (
                                    <>
                                        <Spinner className="w-4 h-4" />
                                        Connecting...
                                    </>
                                ) : (
                                    'Connect Wallet'
                                )}
                            </button>
                        </div>
                    )}

                    {flowState === 'checking_kyc' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Spinner className="w-10 h-10 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Checking KYC Status</h2>
                            <p className="text-blue-600 text-sm">Reading on-chain verification status for your address...</p>
                        </div>
                    )}

                    {flowState === 'already_verified' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg aria-hidden="true" className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                </svg>
                            </div>
                            <div className="inline-flex items-center gap-1.5 bg-green-100 border border-green-200 text-green-600 text-xs font-medium px-3 py-1 rounded-full mb-4">
                                <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                                KYC Verified
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Already Verified</h2>
                            <p className="text-blue-600 text-sm">
                                Your address <span className="font-mono text-slate-900">{account && truncateAddress(account)}</span> is already KYC verified on-chain.
                            </p>
                        </div>
                    )}

                    {(flowState === 'needs_verification' || flowState === 'verifying') && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg aria-hidden="true" className="w-10 h-10 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Verify Your Identity</h2>
                            <p className="text-blue-600 text-sm mb-8">
                                Use World ID to prove your unique humanity. Your wallet{' '}
                                <span className="font-mono text-slate-900">{account && truncateAddress(account)}</span> will be bound to the proof.
                            </p>
                            <IDKitWidget
                                app_id={APP_ID}
                                action={ACTION}
                                verification_level={VerificationLevel.Device}
                                handleVerify={handleVerify}
                                onSuccess={() => {}}
                            >
                                {({ open }) => (
                                    <button
                                        type="button"
                                        onClick={() => { setFlowState('verifying'); open() }}
                                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                                        </svg>
                                        Verify with World ID
                                    </button>
                                )}
                            </IDKitWidget>
                        </div>
                    )}

                    {flowState === 'submitting' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Spinner className="w-10 h-10 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Updating KYC On-Chain</h2>
                            <p className="text-blue-600 text-sm">Verifying your World ID proof and waiting for on-chain confirmation. This may take up to a minute...</p>
                        </div>
                    )}

                    {flowState === 'done' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                                <svg aria-hidden="true" className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">KYC Verification Complete!</h2>
                            <p className="text-blue-600 text-sm mb-6">
                                Your wallet <span className="font-mono text-slate-900">{account && truncateAddress(account)}</span> is now KYC verified on-chain.
                            </p>
                            {txHash && (
                                <a
                                    href={`${EXPLORER_URL}/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm underline transition-colors"
                                >
                                    View transaction on Sepolia
                                    <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            )}
                        </div>
                    )}

                    {flowState === 'error' && (
                        <div className="text-center">
                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg aria-hidden="true" className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-semibold text-slate-900 mb-2">Verification Failed</h2>
                            <p className="text-red-600 text-sm mb-6">{errorMsg || 'An unexpected error occurred.'}</p>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-2xl transition-all"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>

                <p className="text-center text-blue-600/50 text-xs mt-6">
                    Secured by World ID · Sepolia Testnet
                </p>
            </div>
        </div>
    )
}
