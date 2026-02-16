# How to Run — CRE Workflow with Supabase

This guide walks through setting up the off-chain backend (Supabase) and running the Chainlink CRE workflow locally.

---

## Prerequisites

- [pnpm](https://pnpm.io/) >= 10.0.0
- [CRE CLI](https://docs.chain.link/chainlink-automation) — installed and authenticated
- A funded Ethereum Sepolia wallet

---

## Step 1 — Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign up / log in.
2. Click **New project**, fill in:
   - **Name**: e.g. `maskbid`
   - **Database Password**: save this somewhere safe
   - **Region**: pick the closest one
3. Wait for the project to finish provisioning (~1 minute).

---

## Step 2 — Run the migration (create table)

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Copy the entire content of [`apps/supabase/migrations/20260216000000_create_asset_states.sql`](../../supabase/migrations/20260216000000_create_asset_states.sql) and paste it into the editor.
4. Click **Run** (or press `Cmd+Enter`).

This creates:

- Table `asset_states` (equivalent to the old DynamoDB `AssetState` table)
- Row-level security policy (service role only)
- Atomic functions `increment_token_minted` and `increment_token_redeemed`

---

## Step 3 — Deploy the Edge Function

### Via Supabase Dashboard

1. Go to **Edge Functions** in the sidebar.
2. Click **Deploy a new function**.
3. Name it `asset-handler`.
4. Paste the content of [`apps/supabase/functions/asset-handler/index.ts`](../../supabase/functions/asset-handler/index.ts).
5. Click **Deploy**.
6. After deploy, go to **Settings** of the function and **disable** JWT verification.

---

## Step 4 — Get your Supabase credentials

In the Supabase dashboard, go to **Settings → API**:

| Value                | Where to find                          |
| -------------------- | -------------------------------------- |
| **Project URL**      | `https://<project-ref>.supabase.co`    |
| **anon public key**  | Under "Project API keys"               |
| **service_role key** | Under "Project API keys" (keep secret) |

The Edge Function URL will be:

```
https://<project-ref>.supabase.co/functions/v1/asset-handler
```

---

## Step 5 — Update `config.json`

Copy the example config and fill in your values:

```bash
cp apps/cre-workflow/asset-log-trigger-workflow/config.json.example \
   apps/cre-workflow/asset-log-trigger-workflow/config.json
```

Edit `config.json`:

```json
{
  "schedule": "*/30 * * * * *",
  "url": "https://<project-ref>.supabase.co/functions/v1/asset-handler",
  "evms": [
    {
      "assetAddress": "0x<your deployed TokenizedAssetPlatform contract address>",
      "chainSelectorName": "ethereum-testnet-sepolia",
      "gasLimit": "1000000"
    }
  ]
}
```

> `config.json` is gitignored — safe to store your real values here.

---

## Step 6 — Update `.env`

```bash
cp apps/cre-workflow/.env.example apps/cre-workflow/.env
```

Edit `.env`:

```env
# Your Ethereum private key (funded on Sepolia for chain writes)
CRE_ETH_PRIVATE_KEY=<your private key, no 0x prefix>

# Target environment
CRE_TARGET=local-simulation
```

---

## Step 7 — Install dependencies

From the project root:

```bash
pnpm install
```

Then run the setup command for the workflow:

```bash
cd apps/cre-workflow/asset-log-trigger-workflow
pnpm run setup
```

---

## Step 8 — Simulate the workflow

Run from `apps/cre-workflow`:

```bash
cd apps/cre-workflow
cre workflow simulate asset-log-trigger-workflow --target local-simulation
```

You will be prompted to choose a trigger:

### Trigger 1 — LogTrigger (blockchain event → Supabase)

Simulates the flow: smart contract emits event → CRE detects → POST to Edge Function → Supabase Postgres updated.

```
? Select trigger: LogTrigger
? Transaction hash: <Sepolia tx hash that emitted AssetRegistered / AssetVerified / TokensMinted / TokensRedeemed>
? Event index: 0
```

To get a real tx hash, run one of the contract interaction scripts first:

```bash
cd apps/cre-workflow
npx tsx contracts/2_registerNewAsset.ts   # emits AssetRegistered
npx tsx contracts/3_verifyAsset.ts        # emits AssetVerified
npx tsx contracts/5_mint.ts              # emits TokensMinted
npx tsx contracts/6_redeem.ts            # emits TokensRedeemed
```

### Trigger 2 — HTTPTrigger (off-chain → on-chain UID update)

Simulates the reverse flow: off-chain service sends `{assetId, uid}` → CRE signs & writes to contract.

```
? Select trigger: HTTPTrigger
? Payload file path: ./http_trigger_payload.json
```

The file `http_trigger_payload.json` already contains a sample payload:

```json
{ "assetId": 1, "uid": "bca71bc9-d08e-48ef-8ad1-acefe95505a9" }
```

Add `--broadcast` to actually submit the transaction to Sepolia:

```bash
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
```

---

## Step 9 — Verify data in Supabase

After simulation, check the result in the dashboard:

1. Go to **Table Editor → asset_states**
2. Confirm the row was created/updated with the correct values.

Or query directly in **SQL Editor**:

```sql
SELECT * FROM asset_states ORDER BY created_at DESC;
```

---

## Troubleshooting

| Problem                                     | Fix                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Edge Function returns 500                   | Check **Edge Functions → Logs** in the Supabase dashboard                            |
| `increment_token_minted` function not found | Re-run the migration SQL in Step 2                                                   |
| CRE simulation fails with "region is null"  | This error is from the old Lambda code — ignore, the workflow now points to Supabase |
| JWT error on Edge Function call             | Make sure JWT verification is disabled on the `asset-handler` function               |
| `config.json not found`                     | Run `cp config.json.example config.json` in the workflow directory                   |
