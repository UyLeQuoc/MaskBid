import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/configs/env'

export async function GET(req: NextRequest) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const seller = searchParams.get('seller')
    const status = searchParams.get('status')

    const params = new URLSearchParams({ select: '*' })
    if (seller) params.append('issuer', `eq.${seller}`)
    if (status === 'pending') params.append('verified', 'eq.false')
    if (status === 'verified') params.append('verified', 'eq.true')

    const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/asset_states?${params}`,
        {
            headers: {
                apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
        }
    )

    if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json(data)
}
