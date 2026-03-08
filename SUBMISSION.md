# MaskBid — Hackathon Submission

> **Chainlink Convergence Hackathon 2026**

---

## Project Description

**MaskBid** is a decentralized sealed-bid auction platform for Real World Assets (RWAs) — watches, art, gold, real estate — where every bid is encrypted and invisible to all parties until Chainlink's secure enclave reveals the winner.

### The Problem

On-chain auctions are fundamentally broken: public bids enable sniper bots and front-running, the mempool exposes last-second manipulation, and no identity layer means Sybil attacks inflate bids with fake wallets. Fair price discovery is impossible.

### The Solution

MaskBid delivers three guarantees that have never coexisted before:

1. **Confidential bids** — Bid amounts are RSA-OAEP encrypted in the browser. No one — not the seller, not the database admin, not blockchain observers — can see bid amounts. Only Chainlink CRE's secure enclave can decrypt them, and only after the auction ends.

2. **Proof of Personhood** — World ID ensures 1 human = 1 bid. Bots and Sybil attacks are eliminated at the contract level. KYC status is verified through a CRE workflow that achieves consensus before writing on-chain.

3. **Trustless settlement** — Chainlink CRE decrypts all bids simultaneously inside the enclave, picks the winner by consensus across multiple nodes, and finalizes the result on-chain via the Forwarder. USDC escrow handles deposits, and a 2-step claim process settles the auction — winner gets the RWA token, losers get their USDC back.

### Stack & Architecture

```
Frontend:    Next.js 15 + React 19 + TypeScript + MetaMask SDK
Privacy:     Chainlink CRE + ConfidentialHTTPClient + VaultDON
Identity:    World ID (IDKit + on-chain KYC via CRE)
Contracts:   Solidity ^0.8.20 + ERC-1155 (OpenZeppelin) + ReceiverTemplate
Backend:     Supabase (Postgres + Edge Functions)
Testnet:     Tenderly Virtual TestNet (Sepolia fork)
Build:       Turborepo + Bun monorepo
```

**Data flow:**

```
Browser → RSA-encrypt bid → Supabase (ciphertext) + on-chain (SHA-256 hash + USDC escrow)
                                    ↓
Chainlink CRE (ConfidentialHTTPClient) → Solver Edge Function (decrypts, picks winner)
                                    ↓
CRE consensus → ABI-encoded report → Forwarder → MaskBidAuction._processReport()
                                    ↓
Winner claims RWA token + Losers claim USDC refund
```

---

## Source Code

**GitHub:** https://github.com/UyLeQuoc/MaskBid

---

## Chainlink CRE Integration

MaskBid implements **4 CRE workflows** that integrate the blockchain with Supabase (external API/database) and World ID (external identity provider):

### Workflow 1: Auction Solver (Core Privacy Engine)

- **File:** [`apps/cre-workflow/auction-workflow/main.ts`](https://github.com/UyLeQuoc/MaskBid/blob/main/apps/cre-workflow/auction-workflow/main.ts)
- **What it does:** `ConfidentialHTTPClient` calls the Solver Edge Function with VaultDON-injected `SOLVER_AUTH_TOKEN`. The solver decrypts RSA-encrypted bids, selects the highest bidder, and returns an ABI-encoded report. CRE achieves consensus across nodes, then submits the winner on-chain via `EVMClient` Forwarder.
- **Blockchain ↔ External:** Sepolia blockchain ↔ Supabase Edge Function (bid decryption API)
- **Simulation:** `cre workflow simulate auction-workflow --target local-simulation`

### Workflow 2: Asset Log Trigger

- **File:** [`apps/cre-workflow/asset-log-trigger-workflow/main.ts`](https://github.com/UyLeQuoc/MaskBid/blob/main/apps/cre-workflow/asset-log-trigger-workflow/main.ts)
- **What it does:** EVM log trigger monitors `AssetRegistered`, `AssetVerified`, `TokensMinted` events on-chain. Decodes event data and POSTs to Supabase Edge Function to sync asset state.
- **Blockchain ↔ External:** Sepolia blockchain events → Supabase database (external API)
- **Simulation:** `cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation`

### Workflow 3: Auction Log Trigger

- **File:** [`apps/cre-workflow/auction-log-trigger-workflow/main.ts`](https://github.com/UyLeQuoc/MaskBid/blob/main/apps/cre-workflow/auction-log-trigger-workflow/main.ts)
- **What it does:** EVM log trigger monitors `AuctionCreated`, `BidPlaced`, `AuctionEnded`, `WinClaimed` events. Syncs auction state and bid data to Supabase.
- **Blockchain ↔ External:** Sepolia blockchain events → Supabase database (external API)
- **Simulation:** `cre workflow simulate auction-log-trigger-workflow --broadcast --target local-simulation`

### Workflow 4: KYC Verification (World ID + CRE)

- **File:** [`apps/cre-workflow/kyc-verification-workflow/main.ts`](https://github.com/UyLeQuoc/MaskBid/blob/main/apps/cre-workflow/kyc-verification-workflow/main.ts)
- **What it does:** Receives World ID proof via HTTP trigger, verifies it through CRE consensus, then calls the `kyc-handler` Edge Function to write `setKYCStatus(wallet, true)` on-chain.
- **Blockchain ↔ External:** World ID API (external identity provider) → Sepolia blockchain (KYC status)
- **Simulation:** `cre workflow simulate kyc-verification-workflow --target local-simulation`

### Full Chainlink File Index

See the [**Chainlink Integration — All Files**](https://github.com/UyLeQuoc/MaskBid#chainlink-integration--all-files) section in the README for direct links to every file (19 files total across 4 workflows, 4 smart contracts, 4 Edge Functions, and 1 encryption library).

---

## CRE Workflow Requirements Checklist

| Requirement                                   | Status | Details                                                                                               |
| --------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| Build, simulate, or deploy a CRE Workflow     | Done   | 4 workflows built and simulated via CRE CLI                                                           |
| Integrate blockchain with external API/system | Done   | Sepolia ↔ Supabase (bids, assets, auctions) + World ID (identity)                                     |
| Successful simulation via CRE CLI             | Done   | All 4 workflows tested with `cre workflow simulate`                                                   |
| Publicly accessible source code               | Done   | https://github.com/UyLeQuoc/MaskBid                                                                   |
| README links to Chainlink files               | Done   | [Chainlink Integration section](https://github.com/UyLeQuoc/MaskBid#chainlink-integration--all-files) |

---

## Prize Track Alignment

### Privacy — Primary Track

Chainlink's Privacy track description: _"ConfidentialHTTP capability to build privacy-preserving workflows, where API credentials and sensitive application logic executes offchain."_ First example: _"Sealed-bid auctions with private payments."_

MaskBid is a complete implementation of exactly that:

- `ConfidentialHTTPClient` for enclave-authenticated solver calls
- `SOLVER_AUTH_TOKEN` in VaultDON, injected via `{{.solver_auth_token}}` — never in code
- RSA-OAEP encrypted bids, unreadable at every layer until CRE decrypts post-auction
- ABI-encoded winner report submitted on-chain via Forwarder after consensus

### DeFi & Tokenization — Secondary Track

- ERC-1155 RWA tokenization: Register → Verify → Mint → Auction → Transfer
- USDC escrow and on-chain settlement via `MaskBidAuction.sol`
- CRE log-trigger workflows bridge blockchain events to off-chain database

### Tenderly Virtual TestNets

- All 4 CRE workflows developed and tested on Tenderly Virtual TestNet (Sepolia fork)
- `tenderly_setBalance` / `tenderly_setErc20Balance` for test wallet funding
- `evm_increaseTime` / `evm_mine` for auction lifecycle testing
- Full E2E test: [`apps/contract/scripts/e2e_test.ts`](https://github.com/UyLeQuoc/MaskBid/blob/main/apps/contract/scripts/e2e_test.ts)

### World ID + CRE

- World ID IDKit integration for proof-of-personhood
- Dedicated CRE workflow (`kyc-verification-workflow`) verifies World ID proofs via consensus
- KYC status written on-chain via `setKYCStatus()` — enforced at contract level
- No unverified wallet can place a bid — reverts at EVM level

---

## Video

> [Link to 3-5 minute demo video]

---

## Team

Built for [Chainlink Convergence Hackathon 2026](https://chain.link/hackathon)
