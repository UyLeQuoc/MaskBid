# MaskBid: The Dark Auction
**Sealed-bid auctions for Real World Assets — Private, Verified, and Bot-Free.**

> Built for **Chainlink Convergence Hackathon 2026**
>
> | Track | Prize Pool | Fit |
> |-------|-----------|-----|
> | **Privacy** (Chainlink Confidential Compute) | $32,000 | Sealed-bid auction = exact example use case |
> | **DeFi & Tokenization** | $40,000 | RWA tokenization + on-chain settlement |
> | **Tenderly Virtual TestNets** | $9,000 | 3 CRE workflows tested on Virtual TestNet |
> | **World ID + CRE** | $10,000 | Human-gated bidding via World ID KYC |

---

## The Problem

Traditional on-chain auctions are broken:
- **Public bids** → sniper bots and front-running destroy fair price discovery
- **No identity layer** → Sybil attacks inflate bid counts with fake wallets
- **Mempool exposure** → last-second manipulation is trivial

## The Solution

MaskBid is a decentralized sealed-bid auction platform for high-value Real World Assets (watches, art, gold, real estate). Every bid is encrypted in the browser and can only be decrypted by Chainlink's secure enclave — after the auction ends.

**Three guarantees that have never coexisted before:**
- **Confidential bids** — RSA-OAEP encrypted client-side; unreadable by anyone, including database admins
- **Proof of Personhood** — World ID ensures 1 human = 1 bid; no bots, no Sybil attacks
- **Trustless settlement** — Chainlink CRE decrypts all bids simultaneously in a secure enclave, picks the winner, and finalizes on-chain

> MaskBid is the **Privacy track reference implementation** for the Chainlink Convergence Hackathon.
> Chainlink's own track description lists *"Sealed-bid auctions with private payments"* as the first example use case. That is MaskBid.

---

## How It Works

```
I. Verify Identity    II. Discover Assets    III. Place Sealed Bid    IV. The Reveal
World ID proof   →   Browse ERC-1155 RWAs →  RSA-encrypt in browser →  CRE decrypts all
(1 person, 1 bid)    (verified on-chain)      USDC deposit escrowed     winner finalized
```

### The Privacy Guarantee

| Party | Can see bid amounts? | Why |
|-------|---------------------|-----|
| Other bidders | No | Only bid count shown |
| Seller | No | Only sees count, not amounts |
| Blockchain observers | No | Only SHA-256 hash on-chain |
| Supabase admin | No | RSA-OAEP ciphertext — unreadable |
| CRE enclave | Yes, at resolution only | Has private key; runs after auction ends |

---

## Architecture

```
Browser (Next.js)
  ↓ RSA-OAEP encrypt bid amount (client-side, never leaves plaintext)
  ├── MetaMask → MaskBidAuction.placeBid(bidHash) + USDC escrow (on-chain)
  └── POST /api/bids → Supabase bids table (encrypted_data = RSA ciphertext)

Chainlink CRE (after auction ends)
  ↓ ConfidentialHTTPClient → Solver Edge Function
  ↓ solver_auth_token injected by VaultDON via {{.solver_auth_token}} — never in code
  ↓ RSA decrypt all bids inside enclave → pick winner by consensus
  ↓ ABI-encode report → submit on-chain via Forwarder

MaskBidAuction._processReport()
  → State: Ended → PendingClaim
  → Winner calls claimWin(): USDC to seller + RWA token to winner
  → Losers call claimRefund(): USDC deposit returned
```

### What stays private vs. what is public

```
                PRIVATE (never exposed)          PUBLIC (on-chain / visible)
Browser         bid amount plaintext             bidder wallet address
On-chain        ← nothing stored                bidHash (SHA-256), USDC deposit
Supabase        encrypted_data (RSA cipher)      auction_id, bidder_address, bid count
CRE Enclave     decrypted bids, SOLVER_AUTH      winner + winning amount (after end only)
VaultDON        SOLVER_AUTH_TOKEN
```

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| `MaskBidAsset.sol` | ERC-1155 RWA tokenization. Register → Verify → Mint → Transfer |
| `MaskBidAuction.sol` | Sealed-bid auction engine. USDC escrow, CRE integration via `ReceiverTemplate`, 2-step claim |

### Key Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page — pitch, live auction previews, how-it-works |
| `/dashboard` | Personal stats: active bids, assets, KYC status, deposits locked |
| `/auctions` | Live auction browser — bid count visible, amounts hidden |
| `/auctions/create` | Create a new sealed-bid auction for a minted RWA |
| `/my-assets` | Asset portfolio with lifecycle status (Pending → Verified → Minted) |
| `/my-assets/register` | Register a new RWA for tokenization |
| `/my-bids` | Bid history — claim deposits for lost bids, claim wins |
| `/verifier` | Admin queue to verify and mint RWA tokens |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 + React 19 + TypeScript | Web app |
| Wallet | MetaMask SDK | Signing & transaction submission |
| **Privacy** | **Chainlink CRE + ConfidentialHTTP** | **Encrypted bid decryption in secure enclave** |
| **Secret mgmt** | **Chainlink VaultDON** | **`SOLVER_AUTH_TOKEN` injected at enclave runtime — never in code** |
| **Identity** | **World ID (IDKit + on-chain KYC)** | **Proof-of-personhood, Sybil resistance** |
| Contracts | Solidity ^0.8.20 + ERC-1155 (OpenZeppelin) | Asset tokenization + auction escrow |
| Backend | Supabase (Postgres + Edge Functions) | Encrypted bid storage + CRE event sync |
| **Testnet** | **Tenderly Virtual TestNet (Sepolia fork)** | **CRE workflow testing + time manipulation** |
| Build | Turborepo + Bun | Monorepo orchestration |

---

## Auction Flow (6 Phases)

1. **Register** — Seller calls `registerAsset()`. Emits `AssetRegistered`. CRE syncs to Supabase.
2. **Verify & Mint** — Verifier calls `verifyAndMint()`. ERC-1155 token minted to seller. CRE syncs.
3. **Create Auction** — Seller calls `createAuction()`. Token escrowed in contract. CRE syncs.
4. **Place Sealed Bids** — Bidders encrypt amounts in browser → `placeBid(bidHash)` on-chain + encrypted data to Supabase.
5. **CRE Resolution** — After end time: CRE decrypts bids, picks winner, submits report on-chain → `PendingClaim` state.
6. **Claim** — Winner calls `claimWin()`: pays remaining USDC → gets RWA token. Losers call `claimRefund()`.

### Auction State Machine

```
Created → Active → Ended → PendingClaim → Finalized
                         ↘             ↘
                        Cancelled   Cancelled (claim expired)
```

---

## Chainlink CRE Workflows

MaskBid implements three CRE workflows, all tested on Tenderly Virtual TestNet:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `auction-workflow` | HTTP / Cron | **Core privacy engine.** `ConfidentialHTTPClient` calls solver with VaultDON-injected auth token. Decrypts RSA bids, picks winner, submits report on-chain via EVMClient Forwarder. |
| `auction-log-trigger-workflow` | Blockchain log | Listens for `AuctionCreated`, `BidPlaced`, `AuctionEnded`, `WinnerClaimRequired`, `WinClaimed` events. Syncs to Supabase. |
| `asset-log-trigger-workflow` | Blockchain log | Listens for `AssetRegistered`, `AssetVerified`, `TokensMinted` events. Syncs to Supabase. |

### Privacy implementation detail

```typescript
// auction-workflow/main.ts — the auth token is NEVER in code
multiHeaders: {
  Authorization: { values: ["Bearer {{.solver_auth_token}}"] },
},
vaultDonSecrets: [{ key: "solver_auth_token", namespace: "default", owner: config.owner }],
```

The `{{.solver_auth_token}}` placeholder is replaced by Chainlink VaultDON at runtime inside the enclave. The solver Edge Function validates this token — meaning only an authenticated CRE enclave can trigger bid decryption.

---

## Getting Started (Local Dev)

### Prerequisites

- [Bun](https://bun.sh) v1.3.9+
- [Foundry](https://getfoundry.sh) (forge, cast)
- [Chainlink CRE CLI](https://docs.chain.link/cre)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- MetaMask browser extension
- Tenderly account (Virtual Testnet)

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/UyLeQuoc/MaskBid.git
cd MaskBid
bun install

# 2. Configure environment
cp apps/contract/.env.example apps/contract/.env
cp apps/web/.env.example apps/web/.env
cp apps/cre-workflow/.env.example apps/cre-workflow/.env
# Fill in contract addresses, RPC URL, Supabase URL/keys

# 3. Deploy contracts (Foundry)
cd apps/contract
forge build
forge script script/Deploy.s.sol --rpc-url "$TENDERLY_VIRTUAL_TESTNET_RPC_URL" --broadcast

# 4. Deploy Supabase Edge Functions
cd apps/supabase
supabase functions deploy asset-handler auction-event-handler solver

# 5. Start the web app
cd ../..
bun run dev
```

### Fund Test Wallets (Tenderly)

```bash
RPC="<your-tenderly-rpc-url>"
ADDR="<wallet-address>"
USDC="0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

# ETH
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tenderly_setBalance\",\"params\":[[\"$ADDR\"],\"0x204FCE5E3E25026110000000\"],\"id\":1}"

# USDC
curl -s -X POST "$RPC" -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"tenderly_setErc20Balance\",\"params\":[\"$USDC\",\"$ADDR\",\"0x2386F26FC10000000\"],\"id\":2}"
```

### Generate RSA Keypair (one-time)

```bash
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Add public key to apps/web/.env as NEXT_PUBLIC_RSA_PUBLIC_KEY
# Add private key as Supabase secret:
supabase secrets set RSA_PRIVATE_KEY="$(cat private_key.pem)"
```

---

## CRE Workflow Commands

After each on-chain transaction, sync the event to Supabase via CRE:

```bash
cd apps/cre-workflow

# Sync asset events (Register, Verify, Mint)
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation

# Sync auction events (Create, Bid, End, Finalize, Claim)
cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation

# Run the solver (decrypts bids, picks winner)
./prepare-solver.sh
cre workflow simulate auction-workflow --target local-simulation
```

**Event index reference:**

| Transaction | Event Index | Event |
|-------------|------------|-------|
| Register Asset | `1` | `AssetRegistered` |
| Verify & Mint | `0` | `AssetVerified` |
| Verify & Mint | `2` | `TokensMinted` |
| Create Auction | `2` | `AuctionCreated` |
| Place Bid | `1` | `BidPlaced` |
| End Auction | `0` | `AuctionEnded` |
| Finalize | `0` | `WinnerClaimRequired` |
| Claim Win | `4` | `WinClaimed` |

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/APP_FLOW.md`](docs/APP_FLOW.md) | Complete end-to-end walkthrough — all 6 phases with CRE commands |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) | Pitch video script — scenes, voice scripts, track-specific demo additions |
| [`docs/HOW_TO_RUN.md`](docs/HOW_TO_RUN.md) | Detailed local dev setup guide |
| [`docs/SETUP_ZK_AUCTION.md`](docs/SETUP_ZK_AUCTION.md) | RSA keypair generation for confidential auctions |

---

## Monorepo Structure

```
MaskBid/
├── apps/
│   ├── web/                  # Next.js 15 frontend
│   │   ├── src/app/          # App router pages
│   │   ├── src/components/   # UI components
│   │   ├── src/abis/         # Contract ABIs
│   │   └── src/lib/crypto.ts # RSA encryption library
│   ├── contract/             # Solidity contracts + Foundry scripts
│   │   ├── src/              # MaskBidAsset.sol, MaskBidAuction.sol
│   │   └── scripts/          # TypeScript interaction scripts
│   ├── cre-workflow/         # Chainlink CRE workflow definitions
│   │   ├── auction-workflow/             # Solver (bid decryption + winner)
│   │   ├── auction-log-trigger-workflow/ # Auction event sync
│   │   └── asset-log-trigger-workflow/   # Asset event sync
│   └── supabase/             # Edge Functions + DB migrations
│       └── functions/
│           ├── solver/            # Bid decryption, winner selection
│           ├── asset-handler/     # Asset event handler
│           └── auction-event-handler/ # Auction event handler
└── docs/                     # Documentation
```

---

## License

MIT — fork freely and build on top of it.

## Built By

**Lê Quốc Uy** — [Chainlink Convergence Hackathon 2026](https://chain.link/hackathon)

---

## Track Alignment Summary

### Privacy ($32,000) — Primary track

Chainlink's Privacy track describes: *"ConfidentialHTTP capability to build privacy-preserving workflows, where API credentials and sensitive application logic executes offchain."* The first example use case: *"Sealed-bid auctions with private payments."*

MaskBid is a complete, production-ready implementation of exactly that:
- `ConfidentialHTTPClient` for enclave-authenticated solver calls
- `SOLVER_AUTH_TOKEN` stored in VaultDON, injected via `{{.solver_auth_token}}` — never in code
- Bid amounts RSA-encrypted client-side, unreadable at every layer until CRE decrypts post-auction
- ABI-encoded report submitted on-chain via Forwarder after consensus

### DeFi & Tokenization ($40,000) — Secondary track

- ERC-1155 RWA tokenization with full lifecycle: Register → Verify → Mint → Auction → Transfer
- USDC escrow and on-chain settlement
- Chainlink CRE log-trigger workflows bridge blockchain events to off-chain database

### Tenderly Virtual TestNets ($9,000) — Tertiary track

- All 3 CRE workflows developed and validated on Tenderly Virtual TestNet (Sepolia fork)
- `tenderly_setBalance` / `tenderly_setErc20Balance` for test wallet funding
- `evm_increaseTime` / `evm_mine` for auction lifecycle testing without waiting
- Full E2E test: `apps/contract/scripts/e2e_test.ts`

### World ID + CRE ($10,000) — Tertiary track

- World ID IDKit integration for proof-of-personhood
- KYC result written on-chain via `setKYCStatus()` — enforced at contract level in `MaskBidAuction`
- No unverified wallet can place a bid — reverts at EVM level

> "Every bid wears a mask. Until the reveal."
