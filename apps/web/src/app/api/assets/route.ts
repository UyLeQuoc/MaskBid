import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/configs/env'

export async function GET(req: NextRequest) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const { searchParams } = new URL(req.url)
    const seller = searchParams.get('seller')
    const status = searchParams.get('status')

    let query = supabase.from('asset_states').select('*')

    if (seller) query = query.ilike('issuer', seller)
    if (status === 'pending') query = query.eq('verified', false)
    if (status === 'verified') query = query.eq('verified', true)

    const { data, error } = await query

    if (error) {
        console.error('[assets] error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
}
