# Asset Handler - Supabase Edge Function

Syncs on-chain RWA asset lifecycle events to the Supabase database. Called by the **asset-log-trigger-workflow** CRE workflow whenever `MaskBidAsset.sol` emits an event.

## Actions

| Action | Trigger Event | What It Does |
|--------|--------------|--------------|
| `AssetRegistered` | `MaskBidAsset.AssetRegistered` | Inserts new asset into `asset_states` |
| `AssetVerified` | `MaskBidAsset.AssetVerified` | Sets `verified = true/false` |
| `TokensMinted` | `MaskBidAsset.TokensMinted` | Atomically increments `token_minted` counter |
| `TokensRedeemed` | `MaskBidAsset.TokensRedeemed` | Atomically increments `token_redeemed` counter |
| `read` | Manual / API | Returns asset state by `assetId` |
| `sendNotification` | CRE HTTP trigger | POSTs `{assetId, uid}` to an external API |

## Request Format

```
POST https://<project-ref>.supabase.co/functions/v1/asset-handler
Content-Type: application/json
```

### AssetRegistered

```json
{
  "action": "AssetRegistered",
  "assetId": "1",
  "issuer": "0xABC...",
  "assetName": "Manhattan Office Tower",
  "assetType": "real_estate",
  "description": "Class A office building",
  "serialNumber": "RWA-2026-001",
  "reservePrice": 1000000,
  "requiredDeposit": 50000,
  "auctionDuration": 72
}
```

### AssetVerified

```json
{
  "action": "AssetVerified",
  "assetId": "1",
  "isValid": true
}
```

### TokensMinted / TokensRedeemed

```json
{
  "action": "TokensMinted",
  "assetId": "1",
  "amount": 100
}
```

### read

```json
{
  "action": "read",
  "assetId": "1"
}
```

## Connection with Other Components

```
MaskBidAsset.sol (on-chain)
  │ emits AssetRegistered / AssetVerified / TokensMinted / TokensRedeemed
  ▼
CRE asset-log-trigger-workflow (apps/cre-workflow/asset-log-trigger-workflow/)
  │ decodes event log, extracts params
  ▼
POST → asset-handler (this function)
  │ writes to Supabase
  ▼
asset_states table (Supabase DB)
  │
  ▼
Web App API routes (apps/web/src/app/api/assets/)
  │ reads asset_states
  ▼
Frontend UI (My Assets, Verifier, Auction Create)
```

## Deployment

```bash
cd apps/supabase
supabase functions deploy asset-handler --no-verify-jwt
```

JWT verification must be **disabled** because CRE workflows call this function without Supabase auth headers.

## Environment Variables

Uses the default Supabase-provided variables (no extra secrets needed):
- `SUPABASE_URL` - Auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected
