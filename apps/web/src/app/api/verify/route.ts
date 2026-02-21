import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { env } from '@/configs/env'

const APP_ID = env.NEXT_PUBLIC_APP_ID!
const ACTION = env.NEXT_PUBLIC_ACTION
const CONTRACT_ADDRESS = env.CONTRACT_ADDRESS as `0x${string}`
const ADMIN_PRIVATE_KEY = env.ADMIN_PRIVATE_KEY as `0x${string}`
const RPC_URL = env.RPC_URL

const KYC_ABI = [
    {
        name: 'setKYCStatus',
        type: 'function',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'status', type: 'bool' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
] as const

export async function POST(req: NextRequest) {
    const { nullifier_hash, proof, merkle_root, verification_level, wallet_address } =
        await req.json()

// console JSON
console.log(JSON.stringify({
    nullifier_hash,
    proof,
    merkle_root,
    verification_level,
    action: ACTION,
    signal: "my_signal"
}, null, 2))

    // 1. Verify proof with World ID
    const wldRes = await fetch(`https://developer.worldcoin.org/api/v2/verify/${APP_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nullifier_hash,
            proof,
            merkle_root,
            verification_level,
            action: ACTION,
            signal: "my_signal"
        }),
    })

    if (!wldRes.ok) {
        const err = await wldRes.json()
        return NextResponse.json({ success: false, error: err }, { status: 400 })
    }

    // 2. Update KYC on-chain
    const account = privateKeyToAccount(ADMIN_PRIVATE_KEY)
    const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(RPC_URL),
    })
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URL),
    })

    const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: KYC_ABI,
        functionName: 'setKYCStatus',
        args: [wallet_address as `0x${string}`, true],
    })
    await publicClient.waitForTransactionReceipt({ hash })

    return NextResponse.json({ success: true, txHash: hash })
}
