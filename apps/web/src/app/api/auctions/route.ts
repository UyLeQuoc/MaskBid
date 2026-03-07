import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/configs/env'

export async function GET(req: NextRequest) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const seller = searchParams.get('seller')
    const winner = searchParams.get('winner')

    let query = supabase.from('auctions').select('*').order('started_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (seller) query = query.ilike('seller_address', seller)
    if (winner) query = query.ilike('winner_address', winner)

    const { data: auctions, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!auctions?.length) return NextResponse.json([])

    // Join asset_states for asset name + type
    const assetIds = [...new Set(auctions.map((a) => a.asset_id))]
    const { data: assetStates } = await supabase
        .from('asset_states')
        .select('asset_id, asset_name, asset_type')
        .in('asset_id', assetIds)
    const assetMap = Object.fromEntries((assetStates ?? []).map((a) => [a.asset_id, a]))

    // Fetch bid counts in one query
    const auctionIds = auctions.map((a) => a.id)
    const { data: bids } = await supabase
        .from('bids')
        .select('auction_id')
        .in('auction_id', auctionIds)
        .eq('status', 'active')
    const bidCounts: Record<string, number> = {}
    for (const b of bids ?? []) {
        bidCounts[b.auction_id] = (bidCounts[b.auction_id] ?? 0) + 1
    }

    const result = auctions.map((a) => ({
        ...a,
        asset_name: assetMap[a.asset_id]?.asset_name ?? null,
        asset_type: assetMap[a.asset_id]?.asset_type ?? null,
        bid_count: bidCounts[a.id] ?? 0,
    }))

    return NextResponse.json(result)
}
