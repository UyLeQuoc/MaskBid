-- Migration: Add metadata columns to asset_states
-- These fields are captured from the updated AssetRegistered event via CRE

ALTER TABLE asset_states
  ADD COLUMN asset_type       TEXT,
  ADD COLUMN description      TEXT,
  ADD COLUMN serial_number    TEXT,
  ADD COLUMN reserve_price    NUMERIC,
  ADD COLUMN required_deposit NUMERIC,
  ADD COLUMN auction_duration INTEGER DEFAULT 72;
