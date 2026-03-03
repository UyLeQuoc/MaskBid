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
    bid_count: number;
    // joined from asset_states
    asset_name: string | null;
    asset_type: string | null;
}

export function useAuctions() {
    const [auctions, setAuctions] = useState<Auction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAuctions = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auctions');
            if (!res.ok) throw new Error(`Failed to fetch auctions: ${res.status}`);
            const data = await res.json();
            setAuctions(Array.isArray(data) ? data : []);
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
