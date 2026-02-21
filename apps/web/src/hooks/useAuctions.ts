"use client";

import { useState, useEffect, useCallback } from "react";

export interface Auction {
  id: string;
  asset_id: string;
  seller_address: string;
  start_price: number;
  reserve_price: number;
  status: "active" | "ended" | "resolved" | "cancelled";
  winner_address: string | null;
  winning_amount: number | null;
  started_at: string;
  ends_at: string;
  contract_auction_id: number | null;
  deposit_required: number | null;
  token_id: number | null;
  bid_count?: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nxxxytncmfakqcbwlmbn.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eHh5dG5jbWZha3FjYndsbWJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjUyNzEsImV4cCI6MjA4Njc0MTI3MX0.mpXw3zDpXuhdgfUW1K6as6gl9Ou2dk7jOZohDJB7LOg";

export function useAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/auctions?status=eq.active&select=*`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch auctions: ${response.status}`);
      }

      const data = await response.json();

      // Fetch bid counts for each auction
      const auctionsWithBidCount = await Promise.all(
        data.map(async (auction: Auction) => {
          const bidResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/get_auction_bid_count?p_auction_id=${auction.id}`,
            {
              method: "POST",
              headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ p_auction_id: auction.id }),
            }
          );
          const bidCount = bidResponse.ok ? await bidResponse.json() : 0;
          return { ...auction, bid_count: bidCount };
        })
      );

      setAuctions(auctionsWithBidCount);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  return { auctions, loading, error, refetch: fetchAuctions };
}
