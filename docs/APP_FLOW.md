# MaskBid: Complete App Flow

End-to-end walkthrough of the sealed-bid auction system — from asset registration to winner finalization. This document explains **what happens at each step**, **where data lives**, and **why bid amounts stay secret**.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1: Register an Asset](#2-phase-1-register-an-asset)
3. [Phase 2: Verify & Mint](#3-phase-2-verify--mint)
4. [Phase 3: Create an Auction](#4-phase-3-create-an-auction)
5. [Phase 4: Place a Sealed Bid](#5-phase-4-place-a-sealed-bid)
6. [Phase 5: Auction Resolution (CRE Solver)](#6-phase-5-auction-resolution-cre-solver)
7. [Phase 6: Claim Results](#7-phase-6-claim-results)
8. [Security: Why Nobody Can Snipe](#8-security-why-nobody-can-snipe)
9. [CRE Auth Model](#9-cre-auth-model-why-some-edge-functions-have-auth-and-others-dont)
10. [Setup Checklist](#10-setup-checklist-before-first-run)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### RSA Keypair (one-time setup)

The sealed-bid system relies on an RSA-OAEP keypair:

```bash
# Generate 2048-bit RSA private key
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048

# Extract public key
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

**Where each key goes:**

| Key             | Location                                        | Who can access                                        |
| --------------- | ----------------------------------------------- | ----------------------------------------------------- |
| **Public key**  | `apps/web/.env` as `NEXT_PUBLIC_RSA_PUBLIC_KEY` | Everyone (safe to expose)                             |
| **Private key** | Supabase secret `RSA_PRIVATE_KEY`               | Only the solver Edge Function, inside the CRE enclave |

```bash
# Set private key as Supabase secret
supabase secrets set RSA_PRIVATE_KEY="$(cat private_key.pem)"
```

### Environment

- Contracts deployed on Tenderly Virtual Testnet (Sepolia fork)
- Supabase project running with Edge Functions deployed
- `bun run dev` for the web app

### Funding test wallets on Tenderly

You need at least **two wallets** — one for the seller (who creates the auction) and one for the bidder (the seller cannot bid on their own auction).

```bash
# Fund a wallet with ETH + USDC via Tenderly RPC
RPC="<your-tenderly-rpc-url>"
ADDR="<wallet-address>"
USDC="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

# Set ETH balance (10M ETH)
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tenderly_setBalance\",\"params\":[[\"$ADDR\"],\"0x204FCE5E3E25026110000000\"],\"id\":1}"

# Set USDC balance (10M USDC)
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tenderly_setErc20Balance\",\"params\":[\"$USDC\",\"$ADDR\",\"0x2386F26FC10000000\"],\"id\":2}"
```

---

## 2. Phase 1: Register an Asset

**Page:** `/my-assets/register`

### User steps

1. Connect MetaMask wallet
2. Complete KYC via World ID (one-time per wallet)
3. Fill out the form:
   - **Asset Name** — e.g. "Tissot PRX"
   - **Asset Type** — Watch, Art, Real Estate, Gold, or Other
   - **Description** — Condition, provenance, authenticity details
   - **Serial/Certificate Number** (optional)
4. Click **"Submit Asset for Verification"**

### What happens technically

```
Browser -> MetaMask -> MaskBidAsset.registerAsset()
```

- Contract assigns an auto-incremented `assetId`
- Asset is created with `active = false` (not yet verified)
- Emits `AssetRegistered` event with all metadata

### Sync to database

After the transaction confirms, the UI shows a **CRE Command Box** with copyable values. Run:

```bash
cd apps/cre-workflow
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 1
```

This CRE workflow picks up the `AssetRegistered` event and inserts the asset into Supabase `asset_states` table.

---

## 3. Phase 2: Verify & Mint

**Page:** `/verifier`

### User steps (admin/verifier role)

1. View the "Pending Verification" queue
2. Review asset details (name, type, serial number, description)
3. Click **"Verify Asset"**

### What happens technically

```
Browser -> MetaMask -> MaskBidAsset.verifyAndMint(assetId, verificationDetails)
```

- Sets `assets[assetId].active = true`
- Mints 1 ERC-1155 token to the issuer's wallet
- Emits `AssetVerified` + `TransferSingle` + `TokensMinted` events

### Sync to database (run TWICE — two events)

```bash
cd apps/cre-workflow

# Run 1: AssetVerified event
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 0

# Run 2: TokensMinted event (same tx hash, different event index)
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <same tx> | Event index: 2
```

> **Important:** Event index `1` is the ERC-1155 `TransferSingle` event — skip it. The asset-handler doesn't understand it.

The asset now shows as **"Minted"** on the `/my-assets` page with the owner holding 1 ERC-1155 token.

---

## 4. Phase 3: Create an Auction

**Page:** `/auctions/create?assetId={id}`

### User steps

1. Navigate from **My Assets -> "Create Auction"** on a minted asset
2. Fill auction parameters:
   - **Token ID** — auto-filled from the asset
   - **Reserve Price (USDC)** — minimum acceptable bid
   - **Required Deposit (USDC)** — escrow each bidder must lock
   - **Start Time** — when bidding opens
   - **Duration (hours)** — how long the auction runs
3. Approve the ERC-1155 token transfer (MetaMask popup)
4. Confirm the auction creation transaction (MetaMask popup)

### What happens technically

**Step 1 — Token Approval:**

```
ERC1155.setApprovalForAll(auctionContractAddress, true)
```

**Step 2 — Create Auction:**

```
MaskBidAuction.createAuction(tokenId, 1, reservePrice, depositRequired, startTime, endTime)
```

- The ERC-1155 RWA token is **transferred from seller to the auction contract** (escrowed)
- An `auctionId` is auto-assigned
- Emits `AuctionCreated` event

### Sync to database

```bash
cd apps/cre-workflow
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 2
```

> **Important:** Event indices 0-1 are ERC-1155 transfer events — use index `2` for `AuctionCreated`.

The auction now appears on the `/auctions` page.

### Auction states

```
Created --(startTime reached)--> Active --(endTime reached)--> Ended
   |                                                             |
   +--(seller cancels)--> Cancelled                              +--(CRE resolves)--> PendingClaim
                                                                                        |
                                                              +-------------------------+
                                                              |                         |
                                                  (winner calls claimWin)    (deadline passes → expireClaim)
                                                              |                         |
                                                          Finalized                 Cancelled
```

---

## 5. Phase 4: Place a Sealed Bid

**Page:** `/auctions` -> click **"Place Bid"** on a Live auction

### Important constraints

- **Seller cannot bid on their own auction** — switch to a different MetaMask wallet
- **One bid per wallet per auction** — each address can only bid once
- **Bidder wallet needs KYC** — complete World ID verification first
- **Bidder needs USDC** — for the deposit escrow (fund via Tenderly, see Prerequisites)

### User steps

1. **Connect wallet** via MetaMask (must be different from seller)
2. **Approve USDC** — locks the deposit amount for escrow
3. **Enter bid amount** — must be >= reserve price
4. **Submit** — bid is encrypted and placed

### What happens technically (this is the core privacy mechanism)

#### Step 1: Client-side RSA encryption

```typescript
// apps/web/src/lib/crypto.ts
const plaintext = JSON.stringify({
  amount: 5000, // the actual bid in USDC
  user: "0xBidder...", // bidder's wallet address
  timestamp: 1709836800000, // when bid was placed
});

// Encrypt with solver's RSA public key (RSA-OAEP, SHA-256)
const encryptedData = await crypto.subtle.encrypt(
  { name: "RSA-OAEP" },
  solverPublicKey,
  new TextEncoder().encode(plaintext),
);
// Result: base64-encoded ciphertext — unreadable without private key
```

#### Step 2: Generate bid hash

```typescript
const bidHash = SHA256(`${auctionId}:${bidderAddress}:${encryptedData}`);
```

#### Step 3: On-chain bid placement

```
USDC.approve(auctionContract, depositAmount)
MaskBidAuction.placeBid(auctionId, bidHash)
```

The contract:

- Transfers USDC deposit from bidder to the auction contract (escrow)
- Stores only the `bidHash` on-chain (not the encrypted data, not the amount)
- Increments `auction.bidCount`
- Emits `BidPlaced` event

#### Step 4: Off-chain encrypted storage

```
POST /api/bids -> Supabase "bids" table
```

| Column           | Value                              | Readable?               |
| ---------------- | ---------------------------------- | ----------------------- |
| `auction_id`     | UUID                               | Yes                     |
| `bidder_address` | `0xBidder...`                      | Yes                     |
| `encrypted_data` | `base64(RSA_OAEP(...))`            | **No** — RSA ciphertext |
| `hashed_amount`  | `SHA256(plaintext)`                | **No** — one-way hash   |
| `bid_hash`       | `SHA256(auction:bidder:encrypted)` | **No** — one-way hash   |
| `escrow_tx_hash` | `0xabc...`                         | Yes (just the tx ref)   |
| `status`         | `active`                           | Yes                     |

### Sync bid to database

After the bid is placed, the UI shows a CRE Command Box. Run:

```bash
cd apps/cre-workflow
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 1
```

> **Note:** Event index `0` is the USDC `Transfer` event (deposit). Use index `1` for `BidPlaced`.

### What the auction page shows

```
Sealed Bids: 🔒 3
```

Only the count of bids is visible. No amounts. No rankings.

---

## 6. Phase 5: Auction Resolution (CRE Solver)

Once the auction end time passes, the Chainlink CRE workflow resolves it.

### Step 1: End the auction on-chain

Use the **Test Controls** panel on the auction detail page:

1. Click **"Set Start"** to make the auction immediately active
2. Click **"Set End"** to set the auction to end in 30 seconds
3. Wait ~30 seconds, then click **"End Auction"** — calls `endAuction()` on-chain
4. Sync the `AuctionEnded` event via the CRE command shown in the UI

> **Note:** The `AuctionStartTimeUpdated` / `AuctionEndTimeUpdated` events from Set Start / Set End are also handled by the CRE workflow and sync to Supabase, but the critical one is `AuctionEnded` — it sets the Supabase status to `"ended"` which the solver requires.

Alternatively, fast-forward on Tenderly via CLI:

```bash
RPC="<your-tenderly-rpc-url>"
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"evm_increaseTime","params":["0x1C20"],"id":1}'
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"evm_mine","params":[],"id":2}'
cast send <AUCTION_CONTRACT> "endAuction(uint256)" <AUCTION_ID> --rpc-url "$RPC" --private-key <KEY>
# Then sync AuctionEnded event via CRE
```

### Step 2: Prepare and run the solver

A helper script automates finding the ended auction and updating `config.json`:

```bash
cd apps/cre-workflow
./prepare-solver.sh           # Finds ended auction, updates config.json
cre workflow simulate auction-workflow --target local-simulation
# When prompted for HTTP trigger payload, type: {}
```

### What happens inside the CRE enclave

```
+------------------------------------------------------------+
|  CHAINLINK CRE ENCLAVE (Trusted Execution Environment)     |
|                                                             |
|  1. Call solver Edge Function via ConfidentialHTTP           |
|     -> Auth token injected by VaultDON (never in code)      |
|     -> Template: "Bearer {{.solver_auth_token}}"            |
|                                                             |
|  2. Solver decrypts all bids with RSA private key           |
|     for each bid:                                           |
|       ciphertext -> RSA-OAEP decrypt -> { amount, user }    |
|                                                             |
|  3. Winner = highest bid amount                             |
|                                                             |
|  4. Update database:                                        |
|     - Winner bid -> status: "won"                           |
|     - Other bids -> status: "lost"                          |
|     - Auction -> status: "resolved"                         |
|                                                             |
|  5. Return ABI-encoded report:                              |
|     (uint256 auctionId, address winner, uint256 amount)     |
|                                                             |
|  6. Submit report on-chain via EVMClient                    |
|     -> Forwarder -> MaskBidAuction._processReport(report)   |
|     -> Internally calls _finalize()                         |
|     -> Sets state to PendingClaim                           |
+------------------------------------------------------------+
```

### What `_finalize()` does on-chain

1. Sets `auction.state = PendingClaim`
2. Records `winner`, `winningBid`, and `claimDeadline` (48 hours from now)
3. Emits `WinnerClaimRequired(auctionId, winner, winningBid, depositPaid, balanceDue, deadline)`

> **Important:** `_finalize()` does NOT transfer tokens or USDC. The winner must call `claimWin()` within 48 hours to complete the purchase (see [Phase 6](#7-phase-6-claim-results)).

### Local simulation workaround

In production, the CRE node submits the report on-chain automatically via the Forwarder. In local simulation (`--target local-simulation`), the `EVMClient.writeReport()` does not actually broadcast — the tx hash will be all zeros.

To finalize on-chain during local development, use the **"Finalize"** button in Test Controls on the auction detail page (requires admin wallet). The button reads the solver's winner and amount from Supabase and calls `finalizeAuction()` on-chain. It is only enabled after the solver has run (auction status = `resolved`).

Alternatively, use `cast` directly:

```bash
cast send <AUCTION_CONTRACT> "finalizeAuction(uint256,address,uint256)" \
  <CONTRACT_AUCTION_ID> <WINNER_ADDRESS> <WINNING_BID_IN_USDC_UNITS> \
  --rpc-url <RPC> --private-key <ADMIN_KEY>
```

After finalizing, sync the `WinnerClaimRequired` event via CRE (command shown in UI).

### Verify state

```bash
# Check auction state (3 = PendingClaim, 4 = Finalized after claimWin)
cast call <AUCTION_CONTRACT> "getAuctionState(uint256)(uint8)" <AUCTION_ID> --rpc-url <RPC>
```

---

## 7. Phase 6: Claim Results

**Page:** `/auctions` -> auction detail page

### Two-Step Claim Mechanism

After CRE resolution, the auction enters `PendingClaim` state. The winner must complete the purchase within **48 hours**.

```
_finalize()   -> Sets state to PendingClaim, records winner + winningBid + claimDeadline
claimWin()    -> Winner pays (winningBid - deposit) in USDC
                 -> Full bid amount (deposit + remainder) transfers to seller
                 -> RWA token transfers to winner
                 -> State set to Finalized
expireClaim() -> If winner doesn't pay within 48 hours, anyone can call this
                 -> Winner's deposit forfeited to seller as compensation
                 -> RWA token returned to seller
                 -> State set to Cancelled (losing bidders can then claimRefund)
```

### If you won

The auction detail page reads the on-chain `PendingClaim` state and shows a **"Claim Win"** button if your connected wallet is the winner. Clicking it opens the `ClaimWinModal`:

1. Review payment breakdown (winning bid, deposit already paid, balance due)
2. See the claim deadline countdown
3. Click **"Approve & Claim Win"**
4. Approve remaining USDC (MetaMask popup) — if balance due > 0
5. Confirm `claimWin` transaction (MetaMask popup)
6. RWA token arrives in your wallet, seller receives full payment

### If you lost

- Losing bidders can claim refunds **immediately** during `PendingClaim` state (no need to wait for the winner)
- Click **"Claim Deposit"** on the auction page or `/my-bids`
- Calls `MaskBidAuction.claimRefund(auctionId)`
- Your USDC deposit is returned to your wallet
- Emits `BidRefunded` event

### If the winner doesn't pay (claim expires)

- After the 48-hour deadline, anyone can call `expireClaim(auctionId)`
- The winner's deposit is forfeited to the seller
- The RWA token is returned to the seller (who can relist it)
- Auction state becomes `Cancelled` — all other bidders can `claimRefund`

---

## 8. Security: Why Nobody Can Snipe

The entire system is designed so that **no one — not even the database admin — can see bid amounts before the auction ends**.

### What each party can see

| Party                    | Can see bid amounts?         | Why                                                                      |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------ |
| **Other bidders**        | No                           | Only bid count shown on UI                                               |
| **Seller**               | No                           | Only sees bid count, not amounts                                         |
| **Blockchain observers** | No                           | Only `bidHash` (SHA-256) stored on-chain — no amounts                    |
| **Supabase admin**       | No                           | `encrypted_data` is RSA-OAEP ciphertext — unreadable without private key |
| **Frontend developer**   | No                           | Only has the public key (can encrypt, cannot decrypt)                    |
| **CRE enclave**          | Yes, at resolution time only | Has the private key, but only runs after auction ends                    |

### The encryption guarantee

```
Bid amount (5000 USDC)
    |
    v RSA-OAEP encrypt with solver's public key
    |
    v Base64 encode
    |
"kJ3x8vQ2m7F..." <-- This is what Supabase stores
    |
    v Can ONLY be decrypted by the RSA private key
    |
    v Private key exists ONLY in:
      - Supabase secret (RSA_PRIVATE_KEY)
      - Accessed ONLY by solver Edge Function
      - Solver ONLY runs when called by CRE with valid SOLVER_AUTH_TOKEN
      - SOLVER_AUTH_TOKEN lives in Chainlink VaultDON
      - Injected at runtime via {{.solver_auth_token}} template
```

### Why a Supabase admin can't cheat

Even with full database access, the admin sees:

```sql
SELECT encrypted_data FROM bids WHERE auction_id = 'abc';
-- Returns: "kJ3x8vQ2m7F..." (RSA ciphertext, useless without private key)
```

The `RSA_PRIVATE_KEY` is stored as a **Supabase secret** — accessible only to Edge Functions at runtime, not readable through the dashboard or SQL queries. The solver Edge Function is the only code that loads this key, and it only does so when authenticated by the Chainlink CRE enclave.

### Why a front-runner can't snipe

- Bids are encrypted **in the browser** before being sent anywhere
- On-chain, only a hash exists — no encrypted data, no amounts
- The auction contract accepts bids only during the active period
- Resolution happens **after** the auction ends — there's no way to see other bids and outbid them

---

## 9. CRE Auth Model: Why Some Edge Functions Have Auth and Others Don't

The Chainlink CRE SDK exposes **two** HTTP capabilities with different auth support:

| CRE Client               | Auth Support                                                    | Used By                                                      | Edge Functions                           |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `HTTPClient` (regular)   | Static headers only — **no VaultDON secret injection**          | `asset-log-trigger-workflow`, `auction-log-trigger-workflow` | `asset-handler`, `auction-event-handler` |
| `ConfidentialHTTPClient` | VaultDON secret injection via `{{.solver_auth_token}}` template | `auction-workflow`                                           | `solver`                                 |

### What this means

**`asset-handler` and `auction-event-handler`** are called by log-trigger workflows that use the regular `HTTPClient`. This client sends HTTP requests through CRE consensus but does **not** support injecting secrets from VaultDON into headers. Therefore:

- These functions **must have JWT verification disabled** in Supabase dashboard
- These functions **cannot use Bearer token auth** — the CRE workflow has no way to send one
- Security relies on the functions being non-destructive (they only sync on-chain events to the database)

**`solver`** is called by the auction-workflow via `ConfidentialHTTPClient`. This client:

- Injects `solver_auth_token` from VaultDON into the `Authorization` header at runtime
- In production: the secret lives in the Chainlink VaultDON, never in code
- In local simulation: the secret is read from `apps/cre-workflow/.env` as `SOLVER_AUTH_TOKEN_DEV`
- The solver Edge Function validates this token against `SOLVER_AUTH_TOKEN_DEV` (set as a Supabase secret)

```
Log Trigger Workflows (no auth possible):
  HTTPClient -> asset-handler        (JWT off, no token check)
  HTTPClient -> auction-event-handler (JWT off, no token check)

Auction Resolution Workflow (auth via VaultDON):
  ConfidentialHTTPClient -> solver   (JWT off, but Bearer token validated in code)
     +-- {{.solver_auth_token}} injected by enclave
```

### Why this is acceptable

- `asset-handler` and `auction-event-handler` only **write** data that mirrors on-chain events — an attacker could at most duplicate data that's already public on the blockchain
- The `solver` is the security-critical endpoint (it decrypts bids and determines the winner), and it **does** have proper auth via VaultDON
- In production, additional network-level controls (IP allowlists, Chainlink node identity) would further restrict access

### Production: TEE (Trusted Execution Environment)

In production, the solver runs inside a **TEE** such as **AWS Nitro Enclaves**. This provides transparency and verifiable guarantees:

- The solver code runs in an **isolated, attestable enclave** — even the infrastructure operator cannot inspect memory or tamper with execution
- **Attestation documents** prove to any verifier that the correct solver code is running, unmodified
- The RSA private key used for bid decryption is **sealed to the enclave** — it can only be accessed by attested code, not by the host machine or cloud admin
- Combined with Chainlink CRE's VaultDON for secret injection, this creates a **zero-trust decryption pipeline**: bids are encrypted client-side, transit through Supabase (unreadable), and are only decrypted inside the TEE after auction end

---

## 10. Setup Checklist (before first run)

1. **Deploy contracts** — from `apps/contract`:

   ```bash
   forge install OpenZeppelin/openzeppelin-contracts --no-git
   forge install foundry-rs/forge-std --no-git
   forge build
   source .env && forge script script/Deploy.s.sol --rpc-url "$TENDERLY_VIRTUAL_TESTNET_RPC_URL" --broadcast
   ```

   Then update **all** `.env` and `config.json` files with the new addresses (6 files total):
   - `apps/contract/.env`
   - `apps/web/.env`
   - `apps/cre-workflow/.env`
   - `apps/cre-workflow/asset-log-trigger-workflow/config.json`
   - `apps/cre-workflow/auction-log-trigger-workflow/config.json`
   - `apps/cre-workflow/auction-workflow/config.json`

2. **Set `ADMIN_PRIVATE_KEY`** in `apps/web/.env` to the **same key used for deployment**. This key has `ADMIN_ROLE` on the asset contract and is used by `/api/verify` to call `setKYCStatus()`. If you deploy with key A but set key B as ADMIN_PRIVATE_KEY, KYC verification will fail with `AccessControlUnauthorizedAccount`.

3. **Deploy Edge Functions** — from `apps/supabase`:

   ```bash
   supabase functions deploy asset-handler auction-event-handler solver
   ```

4. **Disable JWT verification** on all three Edge Functions in the Supabase dashboard:
   - Go to **Edge Functions** in the Supabase dashboard
   - Click each function -> **Settings** -> **JWT Verification** -> **Off**
   - Must be done for: `asset-handler`, `auction-event-handler`, `solver`

5. **Apply DB migration** — push the constraint fix:
   ```bash
   cd apps/supabase && supabase db push
   ```

6. **Set `chainSelectorName`** in `apps/cre-workflow/auction-workflow/config.json` to `ethereum-testnet-sepolia` (not `ethereum-sepolia`).

7. **Fund test wallets** — at minimum two wallets (seller + bidder) with ETH and USDC via Tenderly RPC (see Prerequisites).

---

## CRE Event Index Reference

Each contract transaction emits multiple events (including ERC-1155 and ERC-20 internal events). Use these event indices when running CRE sync:

| Transaction        | Event Index | Event                                                            |
| ------------------ | ----------- | ---------------------------------------------------------------- |
| **Register Asset** | `1`         | `AssetRegistered`                                                 |
| **Verify & Mint**  | `0`         | `AssetVerified`                                                   |
| **Verify & Mint**  | `2`         | `TokensMinted` (skip index 1 — that's ERC-1155 `TransferSingle`)  |
| **Create Auction** | `2`         | `AuctionCreated` (skip indices 0-1 — ERC-1155 transfer events)    |
| **Place Bid**      | `1`         | `BidPlaced` (skip index 0 — that's USDC `Transfer`)               |
| **End Auction**    | `0`         | `AuctionEnded`                                                     |
| **Finalize**       | `0`         | `WinnerClaimRequired`                                              |
| **Claim Win**      | `4`         | `WinClaimed` (skip 0-3: USDC transfers + ERC-1155 transfer)       |

> **How to find the right event index:** If a CRE sync fails with an unrecognized event, try adjacent indices. Each on-chain transaction can emit multiple events from different contracts (ERC-1155 transfers, ERC-20 transfers, and your custom events). You can also inspect the transaction on the Tenderly explorer to see the exact event ordering.

---

## Quick Reference: Full Flow Commands

```bash
# 0. Prerequisites
bun run dev                        # Start the web app
# Fund wallets on Tenderly (see Prerequisites section)
# Complete KYC via World ID for both seller and bidder wallets

# 1. Register an asset (on /my-assets/register)
#    After tx confirms, sync to DB:
cd apps/cre-workflow
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 1

# 2. Verify & mint the asset (on /verifier)
#    After tx confirms, sync BOTH events to DB:
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 0  (AssetVerified)
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <same>    | Event index: 2  (TokensMinted)

# 3. Create an auction (on /auctions/create)
#    After tx confirms, sync to DB:
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 2

# 4. Place a sealed bid (on /auctions, switch to bidder wallet!)
#    After tx confirms, sync to DB:
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 1

# 5. End the auction (on auction detail page, use Test Controls)
#    Click "Set Start" → "Set End" → wait 30s → "End Auction"
#    Sync the AuctionEnded event via CRE (command shown in UI):
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 0

# 6. Resolve the auction (solver decrypts bids, picks winner)
cd apps/cre-workflow
./prepare-solver.sh    # Auto-finds ended auction, updates config.json
cre workflow simulate auction-workflow --target local-simulation
# When prompted for HTTP trigger payload, type: {}

# 7. Finalize on-chain (local simulation workaround — production uses CRE Forwarder)
#    On auction detail page (admin wallet), click "Finalize" in Test Controls
#    (reads winner from Supabase, calls finalizeAuction on-chain)
#    Sync WinnerClaimRequired event via CRE (command shown in UI):
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from UI> | Event index: 0

# 8. Winner claims the asset (on /auctions, switch to winner wallet)
#    Click "Claim Win" → approve remaining USDC → confirm claimWin tx
#    RWA token transfers to winner, full USDC payment to seller
#    After claim succeeds, the modal shows a CRE sync command. Sync the WinClaimed event:
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation
# Trigger: 1 | Tx hash: <from modal> | Event index: 4
```

---

## 11. Troubleshooting

### Common errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Seller cannot bid` | Trying to bid with the same wallet that created the auction | Switch to a different MetaMask wallet |
| `Already placed a bid` | Contract allows only one bid per wallet per auction | Use a different wallet for additional bids |
| `Not KYC verified` | Bidder wallet hasn't completed World ID verification | Complete KYC on the `/` page first |
| `AccessControlUnauthorizedAccount` | `ADMIN_PRIVATE_KEY` doesn't match the contract deployer | Set `ADMIN_PRIVATE_KEY` in `apps/web/.env` to the deployment key |
| CRE HTTP 401 | JWT verification enabled on Edge Function | Disable JWT in Supabase dashboard for that function |
| CRE HTTP 400 | Edge Function code is outdated | Redeploy: `supabase functions deploy <function-name>` |
| `Network not found: ethereum-sepolia` | Wrong chain selector name | Use `ethereum-testnet-sepolia` in config.json |
| Solver returns 400 (`No active bids`) | Auction already resolved in a previous run | Reset auction status to "ended" and bids to "active" in Supabase |
| `STATUS_UNAUTHORIZED is not defined` | Missing constant in Edge Function | Redeploy the function with latest code |
| Wrong event picked by CRE | ERC-1155/ERC-20 events interleave with custom events | Check the Event Index Reference table above |
| `user rejected transaction` | User declined the MetaMask popup | Retry the action and approve in MetaMask |
| `ERC20: insufficient allowance` | USDC approval expired or insufficient | Re-approve USDC spending in the bid flow |
| `AccessControlUnauthorizedAccount` on Finalize | Connected wallet doesn't have `ADMIN_ROLE` | Switch MetaMask to the admin/deployer wallet |
| `Encoded event signature not found on ABI` | New contract events not in CRE workflow ABI | Ensure CRE workflow and Edge Function are updated and redeployed |
| Finalize button disabled | Solver hasn't run yet or auction not in `resolved` status | Run `prepare-solver.sh` + solver first |
| `Claim deadline has passed` | Winner didn't call `claimWin` within 48 hours | Call `expireClaim` to return RWA to seller and forfeit deposit |

### Finding a transaction hash after the fact

If you closed the UI before copying the tx hash, you can find it via contract events:

```bash
# Find BidPlaced events
cast logs --rpc-url <RPC> --from-block 0 --address <AUCTION_CONTRACT> \
  "BidPlaced(uint256,address,bytes32,uint256)"

# Find AuctionCreated events
cast logs --rpc-url <RPC> --from-block 0 --address <AUCTION_CONTRACT> \
  "AuctionCreated(uint256,address,uint256)"
```

The `transactionHash` field in the output is what you need for CRE sync.

### Resetting a failed solver run

If the solver succeeded (updated Supabase) but the on-chain submission failed, you need to reset before retrying:

```bash
# Reset auction status
curl -s -X PATCH "https://<project>.supabase.co/rest/v1/auctions?id=eq.<uuid>" \
  -H "apikey: <key>" -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"ended","winner_address":null,"winning_amount":null}'

# Reset bid statuses
curl -s -X PATCH "https://<project>.supabase.co/rest/v1/bids?auction_id=eq.<uuid>" \
  -H "apikey: <key>" -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

---

## Data Flow Diagram

```
                        +---------------+
                        |   Browser     |
                        |  (Next.js)    |
                        +------+--------+
                               |
              +----------------+----------------+
              |                |                |
              v                v                v
   +---------------+  +---------------+  +---------------+
   |  MetaMask     |  |  /api/bids    |  | /api/auctions |
   |  (on-chain)   |  |  (Supabase)   |  |  (Supabase)   |
   +------+--------+  +------+--------+  +---------------+
          |                   |
          v                   v
   +---------------+  +---------------+
   |  Contracts    |  |  Supabase DB  |
   |  (Tenderly)   |  |  bids table   |
   |               |  |  (encrypted)  |
   | - bidHash     |  | - RSA cipher  |
   | - USDC escrow |  | - SHA-256     |
   +------+--------+  +------+--------+
          |                   |
          |    +--------------+
          v    v
   +----------------------------+
   |  Chainlink CRE Enclave     |
   |                             |
   |  solver_auth_token          |
   |  (from VaultDON)            |
   |         |                   |
   |         v                   |
   |  Solver Edge Function       |
   |  RSA_PRIVATE_KEY            |
   |  (Supabase secret)          |
   |         |                   |
   |    Decrypt bids             |
   |    Pick winner              |
   |    Submit on-chain          |
   +------------+----------------+
                |
                v
   +---------------+
   |  Contract     |
   | _finalize()   |
   |               |
   | Token -> Winner
   | USDC -> Seller|
   +---------------+
```
