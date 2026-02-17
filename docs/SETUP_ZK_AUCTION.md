# Setup Guide - Zero-Knowledge RWA Auction

This guide walks you through setting up the complete ZK Auction system with Supabase + Chainlink CRE.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Chainlink CRE  │────▶│  Supabase Edge   │────▶│  Supabase DB    │
│  (Confidential) │     │  Solver Function │     │  (encrypted     │
│                 │     │                  │     │   bids)         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
   ┌─────────────┐                              ┌─────────────┐
   │ Vault DON   │                              │ Bidder App  │
   │ (Secrets)   │                              │ (Next.js)   │
   └─────────────┘                              └─────────────┘
```

## Step-by-Step Setup

### Step 1: Database Setup

In Supabase Dashboard → SQL Editor, run:

```sql
-- First run the existing asset_states migration if not done
-- Then run:
\i supabase/migrations/20260216000001_create_bids_table.sql
```

Or run the migration directly:

```bash
supabase db push
```

### Step 2: Deploy Solver Edge Function

**Option A: Via Supabase Dashboard**

1. Go to **Edge Functions** → **Deploy a new function**
2. Name: `solver`
3. Paste code from `apps/supabase/functions/solver/index.ts`
4. Deploy
5. **Settings** → Disable JWT verification

**Option B: Via CLI**

```bash
supabase functions deploy solver
supabase secrets set SOLVER_AUTH_TOKEN_DEV="sk_live_$(openssl rand -hex 32)"
```

### Step 3: Generate RSA Keypair

The solver needs an RSA private key to decrypt bids:

```bash
# Generate private key
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048

# Extract public key (for bidders to encrypt)
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Set the private key in Supabase secrets
supabase secrets set RSA_PRIVATE_KEY="$(cat private_key.pem)"
```

### Step 4: Configure CRE Workflow

```bash
cd apps/cre-workflow/auction-workflow

# Copy config template
cp config.json.example config.json

# Edit config.json with your values:
# - solverUrl: https://<project-ref>.supabase.co/functions/v1/solver
# - auctionId: your auction ID
# - owner: your wallet address
```

### Step 5: Set Secrets

```bash
cd apps/cre-workflow

# Copy env template
cp .env.example .env

# Edit .env:
# - CRE_ETH_PRIVATE_KEY: your Sepolia private key
# - SOLVER_AUTH_TOKEN_DEV: must match what you set in Supabase
```

### Step 6: Install Dependencies

```bash
cd auction-workflow
bun install
```

### Step 7: Test the Solver Directly

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/solver \
  -H "Authorization: Bearer $SOLVER_AUTH_TOKEN_DEV" \
  -H "Content-Type: application/json" \
  -d '{
    "auctionId": "auction-001",
    "action": "resolve"
  }'
```

You should get `{"error":"No active bids found..."}` (expected - no bids yet).

### Step 8: Simulate CRE Workflow

```bash
cd apps/cre-workflow

# Dry run (no broadcast)
cre workflow simulate auction-workflow --target local-simulation

# With broadcast (requires Sepolia ETH)
cre workflow simulate auction-workflow --broadcast --target local-simulation
```

## Frontend Integration (Bidder App)

In your Next.js bidder app, encrypt bids client-side:

```typescript
// utils/crypto.ts
export async function encryptBid(
  amount: number,
  publicKeyPem: string,
): Promise<string> {
  // Use Web Crypto API or node-forge
  // Return base64-encoded encrypted data
  const encoder = new TextEncoder();
  const data = encoder.encode(
    JSON.stringify({ amount, nonce: crypto.randomUUID() }),
  );

  // Import public key
  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(publicKeyPem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    data,
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// Submit bid
async function submitBid(auctionId: string, amount: number) {
  const encryptedData = await encryptBid(amount, PUBLIC_KEY_PEM);
  const hashedAmount = await hashAmount(amount); // For verification

  await supabase.from("bids").insert({
    auction_id: auctionId,
    bidder_address: walletAddress,
    encrypted_data: encryptedData,
    hashed_amount: hashedAmount,
  });
}
```

## Testing the Full Flow

1. **Create an auction** (manually insert or via contract)
2. **Place bids** via bidder app (encrypted)
3. **Verify bids are encrypted** in Supabase table
4. **Trigger CRE workflow** to resolve auction
5. **Check auction table** - should show winner
6. **Check bids table** - should show won/lost status

## Troubleshooting

| Issue                                   | Solution                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| "Access Denied" from solver             | Check `SOLVER_AUTH_TOKEN_DEV` matches in both Supabase secrets and CRE .env    |
| "Module not found" for confidentialhttp | Make sure you're using SDK 1.0.9+                                              |
| Decryption fails                        | Verify RSA keypair is correct and bids were encrypted with matching public key |
| CRE simulation fails                    | Check `cre --version` is 1.0.10+                                               |

## Files Summary

| File                                                            | Purpose                            |
| --------------------------------------------------------------- | ---------------------------------- |
| `apps/supabase/functions/solver/index.ts`                       | Secure solver Edge Function        |
| `apps/supabase/migrations/20260216000001_create_bids_table.sql` | Bids/auctions tables               |
| `apps/cre-workflow/auction-workflow/main.ts`                    | CRE workflow with ConfidentialHTTP |
| `apps/cre-workflow/auction-workflow/config.json`                | Solver URL, auction config         |
| `apps/cre-workflow/secrets.yaml`                                | VaultDON secrets config            |
