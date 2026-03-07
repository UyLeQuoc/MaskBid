import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/configs/env";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nxxxytncmfakqcbwlmbn.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// GET /api/bids?bidder=0x...
export async function GET(req: NextRequest) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const bidder = searchParams.get("bidder");

  if (!bidder) {
    return NextResponse.json({ error: "bidder query param required" }, { status: 400 });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch bids for this bidder
  const { data: bids, error } = await supabase
    .from("bids")
    .select("*")
    .ilike("bidder_address", bidder)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bids?.length) return NextResponse.json([]);

  // Fetch related auctions
  const auctionIds = [...new Set(bids.map((b) => b.auction_id))];
  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .in("id", auctionIds);
  const auctionMap = Object.fromEntries((auctions ?? []).map((a) => [a.id, a]));

  // Fetch asset names
  const assetIds = [...new Set((auctions ?? []).map((a) => a.asset_id))];
  const { data: assets } = await supabase
    .from("asset_states")
    .select("asset_id, asset_name, asset_type")
    .in("asset_id", assetIds);
  const assetMap = Object.fromEntries((assets ?? []).map((a) => [a.asset_id, a]));

  const result = bids.map((b) => {
    const auction = auctionMap[b.auction_id];
    const asset = auction ? assetMap[auction.asset_id] : null;
    return {
      id: b.id,
      auction_id: b.auction_id,
      bidder_address: b.bidder_address,
      status: b.status,
      escrow_tx_hash: b.escrow_tx_hash,
      refund_tx_hash: b.refund_tx_hash,
      created_at: b.created_at,
      // auction fields
      auction_status: auction?.status ?? null,
      contract_auction_id: auction?.contract_auction_id ?? null,
      reserve_price: auction?.reserve_price ?? null,
      deposit_required: auction?.deposit_required ?? null,
      seller_address: auction?.seller_address ?? null,
      started_at: auction?.started_at ?? null,
      ends_at: auction?.ends_at ?? null,
      winner_address: auction?.winner_address ?? null,
      winning_amount: auction?.winning_amount ?? null,
      // asset fields
      asset_name: asset?.asset_name ?? null,
      asset_type: asset?.asset_type ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { auctionId, encryptedData, hash, bidder, escrowTxHash } = body;

    if (!auctionId || !encryptedData || !hash || !bidder) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert bid into Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/bids`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "apikey": SUPABASE_SERVICE_ROLE_KEY!,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        auction_id: auctionId,
        bidder_address: bidder,
        encrypted_data: encryptedData,
        hashed_amount: hash,
        bid_hash: hash,
        escrow_tx_hash: escrowTxHash,
        status: "active",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to store bid:", error);
      return NextResponse.json(
        { error: "Failed to store bid" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error storing bid:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
