-- ============================================================================
-- Relax constraints to support the full auction event flow
-- ============================================================================

-- Allow empty encrypted_data and hashed_amount (event handler inserts before
-- the frontend fills in the encrypted bid data)
ALTER TABLE bids ALTER COLUMN encrypted_data SET DEFAULT '';
ALTER TABLE bids ALTER COLUMN encrypted_data DROP NOT NULL;
ALTER TABLE bids ALTER COLUMN hashed_amount SET DEFAULT '';
ALTER TABLE bids ALTER COLUMN hashed_amount DROP NOT NULL;

-- Add 'ended' to auction status (used by AuctionEnded event handler)
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_status_check
  CHECK (status IN ('active', 'ended', 'resolved', 'cancelled'));

-- Add 'refunded' to bid status (used by BidRefunded event handler)
ALTER TABLE bids DROP CONSTRAINT IF EXISTS bids_status_check;
ALTER TABLE bids ADD CONSTRAINT bids_status_check
  CHECK (status IN ('active', 'won', 'lost', 'refunded', 'cancelled'));
