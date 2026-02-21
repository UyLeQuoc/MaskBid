-- Migration: Add on-chain auction contract tracking fields
-- Extends existing auctions and bids tables with blockchain references

-- ============================================================================
-- ADD COLUMNS TO AUCTIONS TABLE
-- ============================================================================
ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS contract_auction_id INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_required    NUMERIC,
  ADD COLUMN IF NOT EXISTS token_id            INTEGER,
  ADD COLUMN IF NOT EXISTS token_amount        INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tx_hash_create      TEXT,
  ADD COLUMN IF NOT EXISTS tx_hash_finalize    TEXT;

-- Index for looking up auctions by on-chain ID
CREATE INDEX IF NOT EXISTS idx_auctions_contract_id
  ON auctions(contract_auction_id);

-- ============================================================================
-- ADD COLUMNS TO BIDS TABLE
-- ============================================================================
ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS bid_hash         TEXT,
  ADD COLUMN IF NOT EXISTS escrow_tx_hash   TEXT,
  ADD COLUMN IF NOT EXISTS refund_tx_hash   TEXT;

-- ============================================================================
-- FUNCTION: Get auctions ready for finalization
-- Used by CRE workflow to find auctions that have ended and need resolution
-- ============================================================================
CREATE OR REPLACE FUNCTION get_ended_auctions()
RETURNS TABLE (
  auction_id      TEXT,
  asset_id        TEXT,
  seller_address  TEXT,
  start_price     NUMERIC,
  reserve_price   NUMERIC,
  ends_at         TIMESTAMPTZ,
  contract_auction_id INTEGER,
  bid_count       INTEGER
) AS $$
  SELECT
    a.id AS auction_id,
    a.asset_id,
    a.seller_address,
    a.start_price,
    a.reserve_price,
    a.ends_at,
    a.contract_auction_id,
    (SELECT COUNT(*)::INTEGER FROM bids b WHERE b.auction_id = a.id AND b.status = 'active') AS bid_count
  FROM auctions a
  WHERE a.status = 'active'
    AND a.ends_at <= now()
  ORDER BY a.ends_at ASC;
$$ LANGUAGE sql SECURITY DEFINER;
