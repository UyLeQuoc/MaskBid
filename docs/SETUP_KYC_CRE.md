# KYC Flow — World ID + Chainlink CRE Setup

World ID proof verification happens **inside Chainlink CRE consensus** (not a centralized server), then `kyc-handler` writes `setKYCStatus` on-chain.

---

## Architecture

```
Browser (IDKit)
  → World ID proof
  → POST to CRE HTTP trigger  (or CRECommandBox for local sim)
  → CRE nodes each call worldcoin.org/api/v2/verify in consensus
  → CRE calls kyc-handler Edge Function
  → kyc-handler calls setKYCStatus(wallet, true) on-chain
  → Browser polls isKYCVerified() → done
```

---

## New Files

| File | Purpose |
|------|---------|
| `apps/cre-workflow/kyc-verification-workflow/main.ts` | CRE workflow: verify proof in consensus → call kyc-handler |
| `apps/cre-workflow/kyc-verification-workflow/workflow.yaml` | CRE workflow config (HTTP trigger) |
| `apps/cre-workflow/kyc-verification-workflow/config.json` | Runtime config (kycHandlerUrl, worldIdAppId, etc.) |
| `apps/supabase/functions/kyc-handler/index.ts` | Edge Function: receives wallet, writes setKYCStatus on-chain |

---

## 1 — Deploy `kyc-handler` Edge Function

```bash
cd apps/supabase
supabase functions deploy kyc-handler
```

Set secrets:

```bash
supabase secrets set ADMIN_PRIVATE_KEY=0x...       # wallet with ADMIN_ROLE on contract
supabase secrets set ASSET_CONTRACT_ADDRESS=0x...  # MaskBidAsset contract
supabase secrets set RPC_URL=https://virtual.sepolia.eu.rpc.tenderly.co/...
```

---

## 2 — Configure CRE workflow

```bash
cp apps/cre-workflow/kyc-verification-workflow/config.json.example \
   apps/cre-workflow/kyc-verification-workflow/config.json
```

Edit `config.json`:

```json
{
  "kycHandlerUrl": "https://<project>.supabase.co/functions/v1/kyc-handler",
  "worldIdAppId": "app_staging_b2602675085f2b2c08b0ea7c819802fe",
  "worldIdAction": "verify-kyc",
  "worldIdSignal": "my_signal"
}
```

Install deps:

```bash
cd apps/cre-workflow/kyc-verification-workflow
bun install
```

---

## 3 — Web app env

```bash
# apps/web/.env

# Leave empty for local dev (shows CRECommandBox)
NEXT_PUBLIC_CRE_KYC_URL=

# Production only — set to CRE HTTP trigger URL when deployed
# NEXT_PUBLIC_CRE_KYC_URL=https://cre-node.example.com/trigger/...
```

---

## Local dev flow (no CRE node)

1. Go to `/kyc` in the browser
2. Connect MetaMask → click **Verify with World ID** → complete IDKit
3. UI shows **CRECommandBox** with the full terminal command (JSON payload pre-filled)
4. Copy the command → run in a new terminal:

```bash
cd apps/cre-workflow && cre workflow simulate kyc-verification-workflow \
  --target local-simulation --trigger-index 0 --non-interactive \
  --http-payload '{"nullifier_hash":"0x...","proof":"0x...","merkle_root":"0x...","verification_level":"device","wallet_address":"0x..."}'
```

5. Click **Done** in the UI → browser polls `isKYCVerified()` → confirmation

---

## Production flow (CRE node deployed)

Set `NEXT_PUBLIC_CRE_KYC_URL` to the CRE HTTP trigger endpoint.
After IDKit, the browser automatically POSTs the proof → UI shows "Sending to Chainlink CRE…" → then "Confirming On-Chain…" → done.

---

## UI States

| State | Label | What's happening |
|-------|-------|-----------------|
| `submitting` | Sending to Chainlink CRE | POSTing proof to CRE HTTP trigger |
| `cre_ready` | Proof Ready | No CRE URL — shows CRECommandBox for local sim |
| `cre_polling` | Confirming On-Chain | Polling `isKYCVerified()` every 2s, max 60s |
| `done` | Verification Complete | `isKYCVerified` returned `true` |
