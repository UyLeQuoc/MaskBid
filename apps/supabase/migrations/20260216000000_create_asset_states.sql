-- Migration: Create asset_states table
-- Replaces AWS DynamoDB "AssetState" table

CREATE TABLE asset_states (
  asset_id       TEXT        PRIMARY KEY,
  asset_name     TEXT        NOT NULL,
  issuer         TEXT        NOT NULL,
  supply         NUMERIC     NOT NULL DEFAULT 0,
  uid            UUID        NOT NULL DEFAULT gen_random_uuid(),
  verified       BOOLEAN     NOT NULL DEFAULT false,
  token_minted   NUMERIC     NOT NULL DEFAULT 0,
  token_redeemed NUMERIC     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
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
