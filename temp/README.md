# ZK Auction Test Setup

## Files

- `test_auction_data.sql` - SQL to insert test auction data into Supabase

## Test Data

The SQL creates:
- 1 Asset: `asset-001` (Real Estate Token)
- 1 Auction: `auction-test-001` (linked to asset-001)
- 3 Encrypted Bids:
  | Bidder | Amount (encrypted) | Expected Result |
  |--------|-------------------|-----------------|
  | BidderA | 5000 | Loses |
  | BidderB | 8000 | **Winner** |
  | BidderC | 3000 | Loses |

## How to Run

1. Run `test_auction_data.sql` in Supabase SQL Editor
2. Verify data:
   ```sql
   SELECT bidder_address, encrypted_data, status, auction_id
   FROM bids
   WHERE auction_id = 'auction-test-001';
   ```
3. Run CRE workflow simulation
4. Check results:
   ```sql
   SELECT * FROM auctions WHERE id = 'auction-test-001';
   ```

## Expected Result

After CRE workflow runs:
- Auction status: `resolved`
- Winner: `0xBidderB1234567890123456789012345678901234`
- Winning amount: `8000`

## Reset Script

To re-run the test, reset the auction and bids:

```sql
-- Reset auction and bids for re-testing
UPDATE bids
SET status = 'active', won_at = NULL
WHERE auction_id = 'auction-test-001';

UPDATE auctions
SET status = 'active',
    winner_address = NULL,
    winning_amount = NULL,
    resolved_at = NULL
WHERE id = 'auction-test-001';
```

Then run the CRE workflow again:
```bash
cd /Users/nikola/Developer/hackathon/MaskBid/apps/cre-workflow
cre workflow simulate auction-workflow --target local-simulation
```
