# MaskBid: The Dark Auction

**Sealed-bid auctions for Real World Assets — Private, Verified, and Bot-Free.**

> Built for **Chainlink Convergence Hackathon 2026**
>
> | Track                                        | Fit                                         |
> | -------------------------------------------- | ------------------------------------------- |
> | **Privacy** (Chainlink Confidential Compute) | Sealed-bid auction = exact example use case |
> | **DeFi & Tokenization**                      | RWA tokenization + on-chain settlement      |
> | **Tenderly Virtual TestNets**                | 4 CRE workflows tested on Virtual TestNet   |
> | **World ID + CRE**                           | Human-gated bidding via World ID KYC        |

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
> Chainlink's own track description lists _"Sealed-bid auctions with private payments"_ as the first example use case. That is MaskBid.

---

## How It Works

```
I. Verify Identity    II. Discover Assets    III. Place Sealed Bid    IV. The Reveal
World ID proof   →   Browse ERC-1155 RWAs →  RSA-encrypt in browser →  CRE decrypts all
(1 person, 1 bid)    (verified on-chain)      USDC deposit escrowed     winner finalized
```

### The Privacy Guarantee

| Party                | Can see bid amounts?    | Why                                      |
| -------------------- | ----------------------- | ---------------------------------------- |
| Other bidders        | No                      | Only bid count shown                     |
| Seller               | No                      | Only sees count, not amounts             |
| Blockchain observers | No                      | Only SHA-256 hash on-chain               |
| Supabase admin       | No                      | RSA-OAEP ciphertext — unreadable         |
| CRE enclave          | Yes, at resolution only | Has private key; runs after auction ends |

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

| Contract             | Purpose                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `MaskBidAsset.sol`   | ERC-1155 RWA tokenization. Register → Verify → Mint → Transfer                               |
| `MaskBidAuction.sol` | Sealed-bid auction engine. USDC escrow, CRE integration via `ReceiverTemplate`, 2-step claim |

### Key Pages

| Route                 | Description                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `/`                   | Landing page — pitch, live auction previews, how-it-works           |
| `/dashboard`          | Personal stats: active bids, assets, KYC status, deposits locked    |
| `/auctions`           | Live auction browser — bid count visible, amounts hidden            |
| `/auctions/create`    | Create a new sealed-bid auction for a minted RWA                    |
| `/my-assets`          | Asset portfolio with lifecycle status (Pending → Verified → Minted) |
| `/my-assets/register` | Register a new RWA for tokenization                                 |
| `/my-bids`            | Bid history — claim deposits for lost bids, claim wins              |
| `/verifier`           | Admin queue to verify and mint RWA tokens                           |

---

## Tech Stack

| Layer           | Technology                                  | Purpose                                                             |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| Frontend        | Next.js 15 + React 19 + TypeScript          | Web app                                                             |
| Wallet          | MetaMask SDK                                | Signing & transaction submission                                    |
| **Privacy**     | **Chainlink CRE + ConfidentialHTTP**        | **Encrypted bid decryption in secure enclave**                      |
| **Secret mgmt** | **Chainlink VaultDON**                      | **`SOLVER_AUTH_TOKEN` injected at enclave runtime — never in code** |
| **Identity**    | **World ID (IDKit + on-chain KYC)**         | **Proof-of-personhood, Sybil resistance**                           |
| Contracts       | Solidity ^0.8.20 + ERC-1155 (OpenZeppelin)  | Asset tokenization + auction escrow                                 |
| Backend         | Supabase (Postgres + Edge Functions)        | Encrypted bid storage + CRE event sync                              |
| **Testnet**     | **Tenderly Virtual TestNet (Sepolia fork)** | **CRE workflow testing + time manipulation**                        |
| Build           | Turborepo + Bun                             | Monorepo orchestration                                              |

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

MaskBid implements four CRE workflows, all tested on Tenderly Virtual TestNet:

| Workflow                       | Trigger        | What it does                                                                                                                                                                        |
| ------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auction-workflow`             | HTTP / Cron    | **Core privacy engine.** `ConfidentialHTTPClient` calls solver with VaultDON-injected auth token. Decrypts RSA bids, picks winner, submits report on-chain via EVMClient Forwarder. |
| `auction-log-trigger-workflow` | Blockchain log | Listens for `AuctionCreated`, `BidPlaced`, `AuctionEnded`, `WinnerClaimRequired`, `WinClaimed` events. Syncs to Supabase.                                                           |
| `asset-log-trigger-workflow`   | Blockchain log | Listens for `AssetRegistered`, `AssetVerified`, `TokensMinted` events. Syncs to Supabase.                                                                                           |
| `kyc-verification-workflow`    | HTTP           | Receives World ID proof, verifies via CRE consensus, calls `kyc-handler` Edge Function to write `setKYCStatus()` on-chain.                                                          |

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
supabase functions deploy asset-handler auction-event-handler solver kyc-handler

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

# Verify World ID KYC
cre workflow simulate kyc-verification-workflow --target local-simulation
```

**Event index reference:**

| Transaction    | Event Index | Event                 |
| -------------- | ----------- | --------------------- |
| Register Asset | `1`         | `AssetRegistered`     |
| Verify & Mint  | `0`         | `AssetVerified`       |
| Verify & Mint  | `2`         | `TokensMinted`        |
| Create Auction | `2`         | `AuctionCreated`      |
| Place Bid      | `1`         | `BidPlaced`           |
| End Auction    | `0`         | `AuctionEnded`        |
| Finalize       | `0`         | `WinnerClaimRequired` |
| Claim Win      | `4`         | `WinClaimed`          |

---

## Documentation

| Document                                               | Description                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| [`docs/APP_FLOW.md`](docs/APP_FLOW.md)                 | Complete end-to-end walkthrough — all 6 phases with CRE commands          |
| [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)           | Pitch video script — scenes, voice scripts, track-specific demo additions |
| [`docs/HOW_TO_RUN.md`](docs/HOW_TO_RUN.md)             | Detailed local dev setup guide                                            |
| [`docs/SETUP_ZK_AUCTION.md`](docs/SETUP_ZK_AUCTION.md) | RSA keypair generation for confidential auctions                          |
| [`docs/SETUP_KYC_CRE.md`](docs/SETUP_KYC_CRE.md)     | World ID + CRE KYC workflow setup                                         |

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
│   │   ├── asset-log-trigger-workflow/   # Asset event sync
│   │   └── kyc-verification-workflow/    # World ID KYC via CRE
│   └── supabase/             # Edge Functions + DB migrations
│       └── functions/
│           ├── solver/            # Bid decryption, winner selection
│           ├── asset-handler/     # Asset event handler
│           ├── auction-event-handler/ # Auction event handler
│           └── kyc-handler/       # World ID KYC on-chain writer
└── docs/                     # Documentation
```

---

## Chainlink Integration — All Files

> **Hackathon requirement:** Links to every file that uses Chainlink CRE.

### CRE Workflows (4 workflows)

| File                                                                                                                           | Purpose                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/cre-workflow/project.yaml`](apps/cre-workflow/project.yaml)                                                             | CRE project configuration (networks, capabilities, secrets)                                                                                 |
| [`apps/cre-workflow/secrets.yaml`](apps/cre-workflow/secrets.yaml)                                                             | VaultDON secrets definition for `SOLVER_AUTH_TOKEN`                                                                                         |
| [`apps/cre-workflow/auction-workflow/main.ts`](apps/cre-workflow/auction-workflow/main.ts)                                     | **Core privacy workflow** — `ConfidentialHTTPClient` calls solver, decrypts bids in enclave, submits winner report on-chain via `EVMClient` |
| [`apps/cre-workflow/auction-workflow/workflow.yaml`](apps/cre-workflow/auction-workflow/workflow.yaml)                         | Trigger config: Cron (every 5 min) + HTTP manual trigger                                                                                    |
| [`apps/cre-workflow/asset-log-trigger-workflow/main.ts`](apps/cre-workflow/asset-log-trigger-workflow/main.ts)                 | EVM log trigger — monitors `AssetRegistered`, `AssetVerified`, `TokensMinted` events, syncs to Supabase                                     |
| [`apps/cre-workflow/asset-log-trigger-workflow/workflow.yaml`](apps/cre-workflow/asset-log-trigger-workflow/workflow.yaml)     | Log trigger config with contract address and event signatures                                                                               |
| [`apps/cre-workflow/auction-log-trigger-workflow/main.ts`](apps/cre-workflow/auction-log-trigger-workflow/main.ts)             | EVM log trigger — monitors `AuctionCreated`, `BidPlaced`, `AuctionEnded`, `WinClaimed` events, syncs to Supabase                            |
| [`apps/cre-workflow/auction-log-trigger-workflow/workflow.yaml`](apps/cre-workflow/auction-log-trigger-workflow/workflow.yaml) | Log trigger config for auction contract events                                                                                              |
| [`apps/cre-workflow/kyc-verification-workflow/main.ts`](apps/cre-workflow/kyc-verification-workflow/main.ts)                   | World ID proof verification via CRE consensus — calls `kyc-handler` to write KYC status on-chain                                            |
| [`apps/cre-workflow/kyc-verification-workflow/workflow.yaml`](apps/cre-workflow/kyc-verification-workflow/workflow.yaml)       | HTTP trigger config for World ID proof submission                                                                                           |

### Smart Contracts (CRE ReceiverTemplate pattern)

| File                                                                                                     | Purpose                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`apps/contract/src/MaskBidAuction.sol`](apps/contract/src/MaskBidAuction.sol)                           | Auction contract — inherits `ReceiverTemplate`, implements `_processReport()` to receive winner from CRE solver        |
| [`apps/contract/src/MaskBidAsset.sol`](apps/contract/src/MaskBidAsset.sol)                               | RWA token contract — inherits `ReceiverTemplate`, implements `_processReport()` for CRE metadata updates               |
| [`apps/contract/src/interfaces/ReceiverTemplate.sol`](apps/contract/src/interfaces/ReceiverTemplate.sol) | CRE report receiver abstract — validates Forwarder address, decodes workflow metadata, delegates to `_processReport()` |
| [`apps/contract/src/interfaces/IReceiver.sol`](apps/contract/src/interfaces/IReceiver.sol)               | CRE `onReport()` interface definition                                                                                  |

### Edge Functions (CRE callback endpoints)

| File                                                                                                               | Purpose                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/supabase/functions/solver/index.ts`](apps/supabase/functions/solver/index.ts)                               | **Confidential solver** — validates `SOLVER_AUTH_TOKEN` from CRE enclave, RSA-decrypts bids, selects winner, returns ABI-encoded report |
| [`apps/supabase/functions/kyc-handler/index.ts`](apps/supabase/functions/kyc-handler/index.ts)                     | KYC handler — called by CRE after World ID consensus, writes `setKYCStatus()` on-chain                                                  |
| [`apps/supabase/functions/asset-handler/index.ts`](apps/supabase/functions/asset-handler/index.ts)                 | Asset event handler — called by CRE log trigger, syncs `AssetRegistered`/`AssetVerified`/`TokensMinted` to Supabase                     |
| [`apps/supabase/functions/auction-event-handler/index.ts`](apps/supabase/functions/auction-event-handler/index.ts) | Auction event handler — called by CRE log trigger, syncs `AuctionCreated`/`BidPlaced`/`AuctionEnded`/`WinClaimed` to Supabase           |

### Frontend (encryption for CRE)

| File                                                       | Purpose                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`apps/web/src/lib/crypto.ts`](apps/web/src/lib/crypto.ts) | Client-side RSA-OAEP encryption — bids encrypted before storage, only decryptable by CRE enclave |

---

## License

MIT — fork freely and build on top of it.

## Built By

[Chainlink Convergence Hackathon 2026](https://chain.link/hackathon)

---

## Track Alignment Summary

### Privacy — Primary track

Chainlink's Privacy track describes: _"ConfidentialHTTP capability to build privacy-preserving workflows, where API credentials and sensitive application logic executes offchain."_ The first example use case: _"Sealed-bid auctions with private payments."_

MaskBid is a complete implementation of exactly that:

- `ConfidentialHTTPClient` for enclave-authenticated solver calls
- `SOLVER_AUTH_TOKEN` stored in VaultDON, injected via `{{.solver_auth_token}}` — never in code
- Bid amounts RSA-encrypted client-side, unreadable at every layer until CRE decrypts post-auction
- ABI-encoded report submitted on-chain via Forwarder after consensus

### DeFi & Tokenization — Secondary track

- ERC-1155 RWA tokenization with full lifecycle: Register → Verify → Mint → Auction → Transfer
- USDC escrow and on-chain settlement
- Chainlink CRE log-trigger workflows bridge blockchain events to off-chain database

### Tenderly Virtual TestNets — Tertiary track

- **Contract simulation** — Simulate any function call (e.g. `placeBid`, `claimWin`) with full execution trace, state diff, and event log before committing a real transaction
- **Wallet funding** — `tenderly_setBalance` and `tenderly_setErc20Balance` to fund Seller / Bidder / Verifier test wallets instantly
- **Time control** — `evm_increaseTime` + `evm_mine` to fast-forward past auction end time without waiting
- **Transaction history** — Full event log for every CRE workflow execution: `AssetRegistered`, `BidPlaced`, `AuctionFinalized`, `KYCStatusSet`, etc.
- **E2E test** — [`apps/contract/scripts/e2e_test.ts`](apps/contract/scripts/e2e_test.ts) runs the full 6-phase auction lifecycle on the Virtual TestNet

All smart contracts are deployed and all CRE workflows are tested on a **Tenderly Virtual TestNet** (Sepolia fork).

| | |
|---|---|
| **Explorer** | https://dashboard.tenderly.co/explorer/vnet/c83354a8-0917-4b6b-83f2-559dc41d494b |
| **Public RPC** | `https://virtual.sepolia.eu.rpc.tenderly.co/8c5c110e-0641-4255-ae82-73a983077b86` |
| **Chain** | Sepolia fork |

### Deployed Contracts

| Contract | Address | Explorer |
|---|---|---|
| `MaskBidAsset` (ERC-1155 RWA) | `0x2732b983c27786d45cb435293e8e697a03e44e66` | [View](https://dashboard.tenderly.co/explorer/vnet/c83354a8-0917-4b6b-83f2-559dc41d494b/address/0x2732b983c27786d45cb435293e8e697a03e44e66) |
| `MaskBidAuction` (Sealed-bid) | `0xb27f27ba229c8f4d9dbf368c3f842cd5ca22af39` | [View](https://dashboard.tenderly.co/explorer/vnet/c83354a8-0917-4b6b-83f2-559dc41d494b/address/0xb27f27ba229c8f4d9dbf368c3f842cd5ca22af39) |

### How Tenderly is used

---

### World ID + CRE — Tertiary track

- World ID IDKit integration for proof-of-personhood
- KYC result written on-chain via `setKYCStatus()` — enforced at contract level in `MaskBidAuction`
- No unverified wallet can place a bid — reverts at EVM level

> "Every bid wears a mask. Until the reveal."
