import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nxxxytncmfakqcbwlmbn.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
