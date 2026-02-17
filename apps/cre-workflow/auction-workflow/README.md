# Zero-Knowledge RWA Auction Workflow

## Overview

This CRE workflow implements the **"Authorized Enclave" Pattern** for private RWA (Real World Asset) auctions using Chainlink's **ConfidentialHTTP Capability**.

### The Problem

In traditional blockchain auctions:

- Bids are visible on-chain (no privacy)
- MEV bots can front-run
- No way to prove fair winner selection without revealing all bids

### The Solution: Authorized Enclave Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ZERO-KNOWLEDGE AUCTION FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Bidders                    Vault (Supabase)              Solver           │
│      │                            │                         │               │
│      │── Encrypt bids ───────────▶│                         │               │
│      │   (client-side)            │                         │               │
│      │                            │── Store encrypted ─────▶│               │
│      │                            │   bids                  │               │
│      │                            │                         │               │
│      │                            │         [ LOCKED ]      │               │
│      │                            │                         │               │
│   Auction Ends                    │                         │               │
│      │                            │                         │               │
│      │◀── Trigger ────────────────┴─────────────────────────┘               │
│      │         (Chainlink Enclave with SOLVER_AUTH_TOKEN)                   │
│      │                                                                      │
│      │── Decrypt & Sort ──▶ Winner selected                                  │
│      │    (inside enclave)                                                   │
│      │                                                                      │
│      │── Write result to chain ──▶ On-chain settlement                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Security Properties

| Property                 | Implementation                                                 |
| ------------------------ | -------------------------------------------------------------- |
| **Credential Isolation** | `SOLVER_AUTH_TOKEN` only exists in VaultDON and Secure Enclave |
| **Template Injection**   | Token is referenced as `{{.solver_auth_token}}`, never in code |
| **Response Encryption**  | Winner data encrypted until Chainlink consensus                |
| **Enclave Attestation**  | Solver only accepts requests from verified Chainlink enclaves  |

## Architecture Components

### 1. The Vault (Supabase)

- Stores **encrypted** bids
- Has data, but **no decryption keys**
- Serves as bid repository only

### 2. The Solver (Secure Backend)

- Located at: `apps/supabase/functions/solver/index.ts`
- Holds **decryption logic** and **private key**
- **Locked by default** - rejects all unauthorized traffic
- Only unlocks when presented with valid `SOLVER_AUTH_TOKEN` from enclave
- Deploy to Supabase: `supabase functions deploy solver`

### 3. The Key (Chainlink Enclave)

- CRE workflow runs inside **hardware enclave**
- Holds `SOLVER_AUTH_TOKEN` injected securely from VaultDON
- Acts as the "hardware key" that unlocks the solver

## Files

| File              | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `main.ts`         | Workflow code using ConfidentialHTTPClient |
| `config.json`     | Solver URL, auction ID, schedule           |
| `workflow.yaml`   | CRE workflow configuration                 |
| `../secrets.yaml` | VaultDON secrets configuration             |

## Setup

### 1. Configure Secrets

Edit `../secrets.yaml`:

```yaml
secretsNames:
  solver_auth_token:
    - SOLVER_AUTH_TOKEN_DEV
```

Add to your `.env`:

```bash
SOLVER_AUTH_TOKEN_DEV="sk_live_your_very_long_random_token"
SAN_MARINO_AES_KEY_DEV="$(openssl rand -hex 32)"  # For response encryption
```

### 2. Configure Workflow

Copy and edit config:

```bash
cp config.json.example config.json
```

Update:

```json
{
  "solverUrl": "https://your-solver-api.com/resolve",
  "auctionId": "auction-001",
  "owner": "0xYourWalletAddress",
  "schedule": "0 */5 * * * *"
}
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Setup Test Data

See `/temp/test_auction_data.sql` for test auction and bids. Run in Supabase SQL Editor.

To reset for re-testing:

```sql
UPDATE bids SET status = 'active', won_at = NULL WHERE auction_id = 'auction-test-001';
UPDATE auctions SET status = 'active', winner_address = NULL, winning_amount = NULL, resolved_at = NULL WHERE id = 'auction-test-001';
```

### 5. Simulate

```bash
cd ..
cre workflow simulate auction-workflow --target local-simulation
```

Check results:

```sql
SELECT * FROM auctions WHERE id = 'auction-test-001';
SELECT bidder_address, encrypted_data, status FROM bids WHERE auction_id = 'auction-test-001';
```

## The Solver API (Expected Interface)

Your solver should implement this endpoint:

```typescript
// POST /resolve
// Headers: Authorization: Bearer <SOLVER_AUTH_TOKEN>

// Request body:
{
  "auctionId": "auction-001",
  "action": "resolve",
  "timestamp": 1708123456789
}

// Response (encrypted if encryptOutput: true):
// The response is AES-GCM encrypted when encryptOutput: true
// Only the Chainlink enclave can decrypt it
{
  "winner": "0xBidderAddress",
  "amount": 50000,
  "assetId": "asset-123"
}
```

### Solver Authorization Logic

```typescript
const EXPECTED_TOKEN = process.env.SOLVER_AUTH_TOKEN_DEV;

app.post("/resolve", async (req, res) => {
  const authHeader = req.headers.authorization;

  // Gatekeeper check - reject if not from Chainlink Enclave
  if (authHeader !== `Bearer ${EXPECTED_TOKEN}`) {
    return res.status(403).json({
      error: "Access Denied: Enclave Signature Missing",
    });
  }

  // Safe to run decryption logic
  const encryptedBids = await supabase.from("bids").select("*");
  const decrypted = encryptedBids.map((bid) => decrypt(bid, PRIVATE_KEY));
  const winner = decrypted.sort((a, b) => b.amount - a.amount)[0];

  return res.json({
    winner: winner.user,
    amount: winner.amount,
  });
});
```

## Why This Wins

1. **True Credential Isolation**: The token is never in frontend, contract, or workflow code
2. **Hardware-Based Security**: Only the Chainlink Enclave can unlock the solver
3. **Encrypted Response**: Even the winner information is encrypted until consensus
4. **MEV Resistance**: Bids are encrypted until resolution
5. **Provable Fairness**: Chainlink consensus ensures no single node can manipulate results

## Comparison with Standard HTTP

| Feature               | Standard HTTPClient | ConfidentialHTTPClient |
| --------------------- | ------------------- | ---------------------- |
| Secrets in code       | ❌ Required         | ✅ Injected by enclave |
| Template placeholders | ❌ N/A              | ✅ `{{.secret_key}}`   |
| Response encryption   | ❌ No               | ✅ AES-GCM / TDH2      |
| Enclave attestation   | ❌ No               | ✅ Hardware verified   |
| Consensus             | ✅ Yes              | ✅ Yes                 |

## Missing Features (For Teammate - Smart Contract Integration)

The current implementation focuses on the **ConfidentialHTTP** flow. The following features need to be implemented for full production:

### 1. EVMClient.writeReport() - On-Chain Settlement

After the solver determines the winner, write the result to a smart contract:

```typescript
// In onAuctionEnd() after getting result from solver:
const evmConfig = runtime.config.evms[0];
const network = getNetwork({
  chainFamily: "evm",
  chainSelectorName: evmConfig.chainSelectorName,
  isTestnet: true,
});
const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

// Encode winner data for contract
const winnerData = encodeAbiParameters(
  parseAbiParameters("uint256 auctionId, address winner, uint256 amount"),
  [BigInt(config.auctionId), result.winner as Address, BigInt(result.amount)]
);

// Generate signed report
const report = runtime.report({
  encodedPayload: hexToBase64(winnerData),
  encoderName: 'evm',
  signingAlgo: 'ecdsa',
  hashingAlgo: 'keccak256',
}).result();

// Write to auction contract
const writeResult = evmClient.writeReport(runtime, {
  receiver: evmConfig.auctionContractAddress,
  report,
  gasConfig: { gasLimit: evmConfig.gasLimit },
}).result();

runtime.log(`Winner written to chain: ${bytesToHex(writeResult.txHash)}`);
```

**Smart Contract Requirements:**
- `AuctionPlatform.sol` with `resolveAuction(uint256 auctionId, address winner, uint256 amount)` function
- Event: `AuctionResolved(uint256 indexed auctionId, address indexed winner, uint256 amount)`
- Function to verify CRE report signature

### 2. LogTrigger - Event-Driven Resolution

Instead of cron, trigger when smart contract emits `AuctionEnded`:

```typescript
// Replace cron trigger with:
const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
const logTrigger = evmClient.logTrigger({
  addresses: [config.auctionContractAddress],
});

return [
  cre.handler(logTrigger, onAuctionEnd),
];
```

**Smart Contract Requirements:**
- Emit `AuctionEnded(uint256 indexed auctionId)` when auction duration expires
- CRE workflow listens for this event to trigger resolution

### 3. HTTPTrigger - Manual Resolution

Allow manual trigger via API:

```typescript
// Add second handler:
const httpTrigger = new cre.capabilities.HTTPCapability();

return [
  cre.handler(cron.trigger({...}), onAuctionEnd),     // Auto
  cre.handler(httpTrigger.trigger({}), onHTTPTrigger), // Manual
];

const onHTTPTrigger = (runtime: Runtime<Config>, payload: HTTPPayload) => {
  const { auctionId } = JSON.parse(Buffer.from(payload.input).toString());
  // Resolve specific auction
};
```

### 4. Production Deployment

Current: `local-simulation` (single node, simulated enclave)
Production: Deploy to Chainlink DON

```bash
# Register workflow with Chainlink
cre workflow deploy auction-workflow --target staging

# This runs on real hardware enclaves with:
# - 5-10 distributed nodes
# - Real VaultDON for secrets
# - SGX/TDX hardware attestation
# - True multi-node consensus
```

**Required for Production:**
- Chainlink CRE account with credits
- Workflow registration
- Secrets stored in VaultDON (not local .env)
- `auctionContractAddress` in config.json

## References

- [Chainlink Confidential Compute](https://blog.chain.link/chainlink-confidential-compute/)
- [CRE Documentation](https://docs.chain.link/cre)
- [Confidential HTTP Capability](https://docs.chain.link/cre/capabilities/confidential-http)
