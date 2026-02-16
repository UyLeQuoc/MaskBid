# ZK Auction Solver - Supabase Edge Function

This Edge Function implements the **Secure Solver** component of the Zero-Knowledge RWA Auction architecture.

## What It Does

1. **Receives encrypted bids** from the Supabase database
2. **Validates authorization** - Only accepts requests with the `SOLVER_AUTH_TOKEN_DEV` from Chainlink's Confidential Enclave
3. **Decrypts bids** using the RSA private key (only the solver has this key)
4. **Determines the winner** - Highest bid wins
5. **Updates the database** - Marks winner and updates auction status

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Chainlink CRE  │────▶│  Supabase Edge   │────▶│  Supabase DB    │
│   Enclave       │     │  Function        │     │  (bids table)   │
│                 │     │  (This Code)     │     │                 │
│ Holds:          │     │                  │     │ Stores:         │
│ SOLVER_AUTH_    │────▶│ Validates token  │◄────│ Encrypted bids  │
│ TOKEN_DEV       │     │ Decrypts bids    │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │ RSA Private  │
                                                 │ Key (env)    │
                                                 └──────────────┘
```

## Deployment

### 1. Set Environment Variables

In your Supabase Dashboard:

Go to **Edge Functions → solver → Settings → Environment Variables**

Add:
```
SOLVER_AUTH_TOKEN_DEV=sk_live_your_very_long_random_token
RSA_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
```

Or deploy via CLI:
```bash
supabase functions deploy solver
supabase secrets set SOLVER_AUTH_TOKEN_DEV="sk_live_..."
supabase secrets set RSA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

### 2. Deploy the Function

**Via Dashboard:**
1. Go to **Edge Functions**
2. Click **Deploy a new function**
3. Name: `solver`
4. Paste the code from `index.ts`
5. Click **Deploy**
6. Go to **Settings** and **disable JWT verification** (CRE calls it without auth headers)

**Via CLI:**
```bash
cd /Users/nikola/Developer/hackathon/MaskBid
supabase functions deploy solver --project-ref <your-project-ref>
```

### 3. Test the Solver

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/solver \
  -H "Authorization: Bearer sk_live_your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "auctionId": "auction-001",
    "action": "resolve"
  }'
```

**Expected unauthorized response (without token):**
```json
{
  "error": "Access Denied: Enclave Signature Missing",
  "message": "This endpoint only accepts requests from authorized Chainlink Confidential Enclaves"
}
```

## Database Schema

The solver expects these tables (see migration `20260216000001_create_bids_table.sql`):

### `auctions` table
- `id` - Auction ID
- `asset_id` - Linked asset
- `status` - 'active', 'resolved', 'cancelled'
- `winner_address` - Set after resolution
- `winning_amount` - Set after resolution

### `bids` table
- `auction_id` - Which auction
- `bidder_address` - Who bid
- `encrypted_data` - RSA-encrypted bid amount
- `hashed_amount` - For verification
- `status` - 'active', 'won', 'lost'

## Security Model

| Security Property | Implementation |
|------------------|----------------|
| Token Storage | Supabase Secrets (Deno.env) |
| RSA Key Storage | Supabase Secrets (Deno.env) |
| Authorization | Header check against `SOLVER_AUTH_TOKEN_DEV` |
| Encryption | RSA-OAEP for bid data |
| Access Control | Only service_role can read/write bids |

## Integration with CRE Workflow

The CRE workflow calls this solver via ConfidentialHTTP:

```typescript
// In auction-workflow/main.ts
const req = {
  request: {
    url: "https://<project-ref>.supabase.co/functions/v1/solver",
    method: "POST",
    multiHeaders: {
      "Authorization": { values: ["Bearer {{.solver_auth_token}}"] },
    },
    bodyString: JSON.stringify({ auctionId: "auction-001", action: "resolve" }),
  },
  vaultDonSecrets: [{ key: "solver_auth_token", owner: config.owner }],
  encryptOutput: true,
};
```

The `{{.solver_auth_token}}` is replaced by the Chainlink Enclave at runtime.

## Troubleshooting

### "Access Denied" Error
- Check `SOLVER_AUTH_TOKEN_DEV` is set in Supabase secrets
- Ensure the token in CRE secrets.yaml matches

### "No active bids found"
- Check bids exist in database: `SELECT * FROM bids WHERE auction_id = 'auction-001';`
- Verify bid status is 'active'

### Decryption Fails
- Ensure `RSA_PRIVATE_KEY` is set correctly
- Check bids were encrypted with the corresponding public key

## Local Development

```bash
# Start Supabase locally
supabase start

# Serve the function locally
supabase functions serve solver --env-file ./supabase/.env.local

# Test locally
curl -X POST http://localhost:54321/functions/v1/solver \
  -H "Authorization: Bearer sk_live_test_token" \
  -H "Content-Type: application/json" \
  -d '{"auctionId": "test-001", "action": "resolve"}'
```
