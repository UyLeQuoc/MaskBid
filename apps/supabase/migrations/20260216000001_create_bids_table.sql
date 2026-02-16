-- Migration: Create bids and auctions tables for ZK Auction
-- These tables store encrypted bids that can only be decrypted by the authorized solver

-- ============================================================================
-- AUCTIONS TABLE
-- ============================================================================
CREATE TABLE auctions (
  id             TEXT        PRIMARY KEY,
  asset_id       TEXT        NOT NULL REFERENCES asset_states(asset_id),
  seller_address TEXT        NOT NULL,
  start_price    NUMERIC     NOT NULL DEFAULT 0,
  reserve_price  NUMERIC,
  status         TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  winner_address TEXT,
  winning_amount NUMERIC,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at        TIMESTAMPTZ NOT NULL,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for active auctions
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_ends_at ON auctions(ends_at);

-- ============================================================================
-- BIDS TABLE
-- Stores encrypted bids - the solver has the private key to decrypt
-- ============================================================================
CREATE TABLE bids (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id      TEXT        NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_address  TEXT        NOT NULL,
  -- encrypted_data contains the encrypted bid amount
  -- Format: RSA encrypted JSON { amount: number, nonce: string }
  encrypted_data  TEXT        NOT NULL,
  -- hashed_amount allows the contract to verify without revealing
  hashed_amount   TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  won_at          TIMESTAMPTZ
);

-- Indexes for bid queries
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_bidder ON bids(bidder_address);
CREATE INDEX idx_bids_status ON bids(status);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Service role (Edge Functions) can do everything
CREATE POLICY "service_role_auctions_all" ON auctions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bids_all" ON bids
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Anonymous users can only read active auctions (not bids)
CREATE POLICY "anon_read_active_auctions" ON auctions
  FOR SELECT TO anon
  USING (status = 'active');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get bid count for an auction
CREATE OR REPLACE FUNCTION get_auction_bid_count(p_auction_id TEXT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM bids WHERE auction_id = p_auction_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if bidder has already bid on auction
CREATE OR REPLACE FUNCTION has_bidder_placed_bid(p_auction_id TEXT, p_bidder_address TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM bids
    WHERE auction_id = p_auction_id
    AND bidder_address = p_bidder_address
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;
