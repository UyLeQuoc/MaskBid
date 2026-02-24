-- ============================================================================
-- MaskBid: Full schema migration
-- ============================================================================

-- ============================================================================
-- ASSET_STATES TABLE
-- ============================================================================
CREATE TABLE asset_states (
  asset_id        TEXT        PRIMARY KEY,
  asset_name      TEXT        NOT NULL,
  issuer          TEXT        NOT NULL,
  supply          NUMERIC     NOT NULL DEFAULT 0,
  uid             UUID        NOT NULL DEFAULT gen_random_uuid(),
  verified        BOOLEAN     NOT NULL DEFAULT false,
  token_minted    NUMERIC     NOT NULL DEFAULT 0,
  token_redeemed  NUMERIC     NOT NULL DEFAULT 0,
  asset_type      TEXT,
  description     TEXT,
  serial_number   TEXT,
  reserve_price   NUMERIC,
  required_deposit NUMERIC,
  auction_duration INTEGER    DEFAULT 72,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_states_updated_at
  BEFORE UPDATE ON asset_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: only service_role can access (Edge Function uses service_role key)
ALTER TABLE asset_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON asset_states
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic increment for TokensMinted (avoids read-modify-write race condition)
CREATE OR REPLACE FUNCTION increment_token_minted(p_asset_id TEXT, p_amount NUMERIC)
RETURNS void AS $$
  UPDATE asset_states
  SET token_minted = token_minted + p_amount
  WHERE asset_id = p_asset_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Atomic increment for TokensRedeemed
CREATE OR REPLACE FUNCTION increment_token_redeemed(p_asset_id TEXT, p_amount NUMERIC)
RETURNS void AS $$
  UPDATE asset_states
  SET token_redeemed = token_redeemed + p_amount
  WHERE asset_id = p_asset_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================================
-- AUCTIONS TABLE
-- ============================================================================
CREATE TABLE auctions (
  id                  TEXT        PRIMARY KEY,
  asset_id            TEXT        NOT NULL REFERENCES asset_states(asset_id),
  seller_address      TEXT        NOT NULL,
  start_price         NUMERIC     NOT NULL DEFAULT 0,
  reserve_price       NUMERIC,
  status              TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  winner_address      TEXT,
  winning_amount      NUMERIC,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at             TIMESTAMPTZ NOT NULL,
  resolved_at         TIMESTAMPTZ,
  contract_auction_id INTEGER,
  deposit_required    NUMERIC,
  token_id            INTEGER,
  token_amount        INTEGER     DEFAULT 1,
  tx_hash_create      TEXT,
  tx_hash_finalize    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_ends_at ON auctions(ends_at);
CREATE INDEX idx_auctions_contract_id ON auctions(contract_auction_id);

-- ============================================================================
-- BIDS TABLE
-- ============================================================================
CREATE TABLE bids (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id      TEXT        NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_address  TEXT        NOT NULL,
  encrypted_data  TEXT        NOT NULL,
  hashed_amount   TEXT        NOT NULL,
  bid_hash        TEXT,
  escrow_tx_hash  TEXT,
  refund_tx_hash  TEXT,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  won_at          TIMESTAMPTZ
);

CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_bidder ON bids(bidder_address);
CREATE INDEX idx_bids_status ON bids(status);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_auctions_all" ON auctions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_bids_all" ON bids
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_read_active_auctions" ON auctions
  FOR SELECT TO anon
  USING (status = 'active');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_auction_bid_count(p_auction_id TEXT)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM bids WHERE auction_id = p_auction_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_bidder_placed_bid(p_auction_id TEXT, p_bidder_address TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM bids
    WHERE auction_id = p_auction_id
    AND bidder_address = p_bidder_address
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_ended_auctions()
RETURNS TABLE (
  auction_id          TEXT,
  asset_id            TEXT,
  seller_address      TEXT,
  start_price         NUMERIC,
  reserve_price       NUMERIC,
  ends_at             TIMESTAMPTZ,
  contract_auction_id INTEGER,
  bid_count           INTEGER
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
