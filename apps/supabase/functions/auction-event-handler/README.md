# Auction Event Handler - Supabase Edge Function

Syncs on-chain auction events to the Supabase database. Called by the **auction-log-trigger-workflow** CRE workflow whenever `MaskBidAuction.sol` emits an event.

## Actions

| Action | Trigger Event | What It Does |
|--------|--------------|--------------|
| `AuctionCreated` | `MaskBidAuction.AuctionCreated` | Inserts new auction with UUID, converts USDC amounts |
| `BidPlaced` | `MaskBidAuction.BidPlaced` | Records bid with escrow tx hash |
| `AuctionEnded` | `MaskBidAuction.AuctionEnded` | Updates auction status |
| `AuctionFinalized` | `MaskBidAuction.AuctionFinalized` | Sets winner, marks bids as won/lost |
| `AuctionStartTimeUpdated` | `MaskBidAuction.AuctionStartTimeUpdated` | Updates `started_at` (test helper) |
| `AuctionEndTimeUpdated` | `MaskBidAuction.AuctionEndTimeUpdated` | Updates `ends_at` (test helper) |
| `BidRefunded` | `MaskBidAuction.BidRefunded` | Marks bid as refunded with tx hash |

## Request Format

```
POST https://<project-ref>.supabase.co/functions/v1/auction-event-handler
Content-Type: application/json
Authorization: Bearer <CRE_WEBHOOK_TOKEN>  (optional, if configured)
```

### AuctionCreated

```json
{
  "action": "AuctionCreated",
  "auctionId": 1,
  "tokenId": "42",
  "seller": "0xABC...",
  "tokenAmount": 1,
  "reservePrice": 100000000,
  "depositRequired": 10000000,
  "startTime": 1772600000,
  "endTime": 1772686400,
  "txHash": "0x..."
}
```

Note: `reservePrice` and `depositRequired` are in USDC raw units (6 decimals). The handler divides by 1e6.

### BidPlaced

```json
{
  "action": "BidPlaced",
  "auctionId": 1,
  "bidder": "0xDEF...",
  "bidHash": "0xabcdef...",
  "escrowAmount": 50000000,
  "txHash": "0x..."
}
```

### AuctionFinalized

```json
{
  "action": "AuctionFinalized",
  "auctionId": 1,
  "winner": "0xDEF...",
  "winningBid": 150000000,
  "txHash": "0x..."
}
```

## Connection with Other Components

```
MaskBidAuction.sol (on-chain)
  │ emits AuctionCreated / BidPlaced / AuctionEnded / AuctionFinalized / BidRefunded
  ▼
CRE auction-log-trigger-workflow (apps/cre-workflow/auction-log-trigger-workflow/)
  │ decodes event log, extracts params
  ▼
POST → auction-event-handler (this function)
  │ writes to Supabase
  ▼
auctions + bids tables (Supabase DB)
  │
  ▼
Web App API routes (apps/web/src/app/api/auctions/)
  │ reads auctions, joins asset_states and bids
  ▼
Frontend UI (Auction listing, Bid history, Dashboard)
```

### Relationship with Solver

After `AuctionEnded` syncs to the DB, the **auction-workflow** CRE cron picks up ended auctions via `get_ended_auctions()` and calls the **solver** function to decrypt bids and determine the winner. The solver then updates the DB, and the CRE workflow submits the result on-chain, which emits `AuctionFinalized` — completing the cycle.

```
AuctionEnded event → auction-event-handler → DB (status = active, ends_at past)
                                                  ▼
                              auction-workflow cron (get_ended_auctions)
                                                  ▼
                                            solver function
                                        (decrypt bids, pick winner)
                                                  ▼
                                  on-chain _processReport() → AuctionFinalized event
                                                  ▼
                              auction-log-trigger → auction-event-handler
                                        (status = resolved, winner set)
```

## Deployment

```bash
cd apps/supabase
supabase functions deploy auction-event-handler --no-verify-jwt
```

JWT verification must be **disabled** because CRE workflows call this function without Supabase auth headers.

## Environment Variables

- `SUPABASE_URL` - Auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected
- `CRE_WEBHOOK_TOKEN` (optional) - If set, validates `Authorization: Bearer <token>` header

## Known Issue

The `AuctionEnded` handler sets `status: "ended"` but the DB CHECK constraint only allows `('active', 'resolved', 'cancelled')`. This will cause a constraint violation. Fix: either add `'ended'` to the CHECK constraint or keep status as `'active'` (the solver uses `ends_at <= now()` to find ended auctions).
