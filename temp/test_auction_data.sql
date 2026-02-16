-- Test data for ZK Auction flow
-- Run this in Supabase SQL Editor

-- 1. Create test asset (required for foreign key)
INSERT INTO asset_states (asset_id, asset_name, issuer, supply)
VALUES (
  'asset-001',
  'Test Real Estate Token',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  10000
) ON CONFLICT (asset_id) DO NOTHING;

-- 2. Create test auction
INSERT INTO auctions (id, asset_id, seller_address, start_price, status, started_at, ends_at)
VALUES (
  'auction-test-001',
  'asset-001',
  '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  1000,
  'active',
  now(),
  now() + interval '1 hour'
) ON CONFLICT (id) DO NOTHING;

-- 3. Insert encrypted bids (base64 encoded JSON for demo)
-- Decodes to: {"amount": 5000, "nonce": "1234"} etc.
INSERT INTO bids (auction_id, bidder_address, encrypted_data, hashed_amount, status)
VALUES
  (
    'auction-test-001',
    '0xBidderA1234567890123456789012345678901234',
    'eyJhbW91bnQiOiA1MDAwLCAibm9uY2UiOiAiMTIzNCJ9',
    '0xabc123',
    'active'
  ),
  (
    'auction-test-001',
    '0xBidderB1234567890123456789012345678901234',
    'eyJhbW91bnQiOiA4MDAwLCAibm9uY2UiOiAiNTY3OCJ9',
    '0xdef456',
    'active'
  ),
  (
    'auction-test-001',
    '0xBidderC1234567890123456789012345678901234',
    'eyJhbW91bnQiOiAzMDAwLCAibm9uY2UiOiAiOTAwMCJ9',
    '0xghi789',
    'active'
  )
ON CONFLICT DO NOTHING;

-- Verify data was inserted
SELECT 'Asset created:' as info, asset_id, asset_name FROM asset_states WHERE asset_id = 'asset-001';
SELECT 'Auction created:' as info, id, status FROM auctions WHERE id = 'auction-test-001';
SELECT 'Bids created:' as info, count(*) as bid_count FROM bids WHERE auction_id = 'auction-test-001';
SELECT bidder_address, encrypted_data FROM bids WHERE auction_id = 'auction-test-001';
