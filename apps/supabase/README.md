# MaskBid Supabase Backend

Off-chain backend for the MaskBid decentralized auction platform. Provides database storage and three Edge Functions that bridge on-chain events to the web app.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Supabase                                  │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  asset-handler   │  │ auction-event-   │  │    solver       │  │
│  │                  │  │ handler          │  │                 │  │
│  │ Syncs asset      │  │ Syncs auction    │  │ Decrypts bids   │  │
│  │ lifecycle events │  │ events           │  │ Picks winner    │  │
│  └───────┬──────────┘  └───────┬──────────┘  └───────┬─────────┘  │
│          │                     │                     │            │
│          ▼                     ▼                     ▼            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                       │  │
│  │                                                             │  │
│  │  asset_states    │    auctions    │    bids                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
    CRE asset-log-       CRE auction-log-     CRE auction-
    trigger-workflow     trigger-workflow      workflow
         ▲                    ▲                    │
         │                    │                    ▼
    MaskBidAsset.sol     MaskBidAuction.sol    (calls solver
    (on-chain events)    (on-chain events)     via ConfidentialHTTP)
```

## Edge Functions

| Function | Purpose | Called By | JWT |
|----------|---------|-----------|-----|
| [`asset-handler`](functions/asset-handler/) | Sync asset lifecycle events to DB | CRE asset-log-trigger-workflow | Disabled |
| [`auction-event-handler`](functions/auction-event-handler/) | Sync auction events to DB | CRE auction-log-trigger-workflow | Disabled |
| [`solver`](functions/solver/) | Decrypt bids, pick winner, encode on-chain report | CRE auction-workflow (ConfidentialHTTP) | Disabled |

See each function's README for detailed API docs and request/response formats.

## Database Schema

Defined in [`migrations/20260224000000_init.sql`](migrations/20260224000000_init.sql).

### Tables

**asset_states** - RWA asset tracking
```
asset_id (PK) │ asset_name │ issuer │ supply │ uid │ verified
token_minted │ token_redeemed │ asset_type │ description │ serial_number
reserve_price │ required_deposit │ auction_duration
```

**auctions** - Auction records
```
id (PK) │ asset_id (FK) │ seller_address │ start_price │ reserve_price
status (active/resolved/cancelled) │ winner_address │ winning_amount
started_at │ ends_at │ resolved_at │ contract_auction_id
deposit_required │ token_id │ token_amount │ tx_hash_create │ tx_hash_finalize
```

**bids** - Encrypted bid records
```
id (PK, UUID) │ auction_id (FK) │ bidder_address │ encrypted_data
hashed_amount │ bid_hash │ escrow_tx_hash │ refund_tx_hash
status (active/won/lost/cancelled) │ won_at
```

### Helper Functions (PostgreSQL)

| Function | Purpose | Used By |
|----------|---------|---------|
| `increment_token_minted(asset_id, amount)` | Atomic mint counter | asset-handler |
| `increment_token_redeemed(asset_id, amount)` | Atomic redeem counter | asset-handler |
| `get_auction_bid_count(auction_id)` | Count active bids | Web app API |
| `has_bidder_placed_bid(auction_id, bidder)` | Check duplicate bids | Web app API |
| `get_ended_auctions()` | Find auctions past end time | CRE auction-workflow |

## Data Flow: Complete Auction Lifecycle

```
1. REGISTER ASSET
   Web UI → MaskBidAsset.registerAsset() → AssetRegistered event
     → CRE asset-log-trigger → asset-handler → asset_states table

2. VERIFY & MINT
   Web UI → MaskBidAsset.verifyAndMint() → AssetVerified + TokensMinted events
     → CRE asset-log-trigger → asset-handler → asset_states (verified=true, token_minted++)

3. CREATE AUCTION
   Web UI → MaskBidAuction.createAuction() → AuctionCreated event
     → CRE auction-log-trigger → auction-event-handler → auctions table

4. PLACE BID
   Web UI → RSA encrypt bid (crypto.ts) → MaskBidAuction.placeBid()
     → BidPlaced event → CRE auction-log-trigger → auction-event-handler → bids table
     → Web UI also POSTs encrypted_data to /api/bids → bids table

5. END AUCTION
   Time passes → anyone calls endAuction() → AuctionEnded event
     → CRE auction-log-trigger → auction-event-handler → auctions.ends_at updated

6. RESOLVE (ZK)
   CRE auction-workflow cron → get_ended_auctions()
     → ConfidentialHTTP → solver (decrypts bids, picks highest)
     → ABI-encoded report → on-chain _processReport()
     → AuctionFinalized event → auction-event-handler → auctions (resolved, winner set)

7. REFUND
   Losing bidder → claimRefund() → BidRefunded event
     → CRE auction-log-trigger → auction-event-handler → bids (status=refunded)
```

## Deployment

### Deploy all functions

```bash
cd apps/supabase
supabase functions deploy asset-handler --no-verify-jwt
supabase functions deploy auction-event-handler --no-verify-jwt
supabase functions deploy solver --no-verify-jwt
```

### Run migration (fresh DB)

```bash
supabase db reset --linked --yes
```

### Set secrets

```bash
supabase secrets set SOLVER_AUTH_TOKEN_DEV="sk_live_..."
supabase secrets set RSA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
supabase secrets set CRE_WEBHOOK_TOKEN="..."  # optional, for auction-event-handler auth
```

### Verify deployment

```bash
supabase functions list
supabase secrets list
```

## Testing

### Solver RSA decryption test

```bash
cd apps/supabase
bunx tsx test-solver.ts
```

This script encrypts a bid with the RSA public key (same as frontend), inserts test data, calls the solver, verifies decryption, and cleans up.

## Environment Variables

| Variable | Function | Source |
|----------|----------|--------|
| `SUPABASE_URL` | All | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Auto-injected by Supabase |
| `SOLVER_AUTH_TOKEN_DEV` | solver | Supabase Secrets |
| `RSA_PRIVATE_KEY` | solver | Supabase Secrets (PEM PKCS8) |
| `CRE_WEBHOOK_TOKEN` | auction-event-handler | Supabase Secrets (optional) |
