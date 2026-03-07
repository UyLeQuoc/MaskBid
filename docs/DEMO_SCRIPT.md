# MaskBid — Hackathon Pitch Video Demo Script

**Total target runtime:** 3–4 minutes
**Tone:** Professional, cinematic — matches the dark luxury aesthetic of the app

---

## Pre-Demo Setup Checklist

Before recording, ensure:
- [ ] Two MetaMask wallets funded with ETH + USDC on Tenderly fork
- [ ] Seller wallet: World ID KYC completed, has a **Minted** asset ready
- [ ] A second (bidder) wallet: World ID KYC completed, has USDC
- [ ] An active auction already created and live
- [ ] At least 2–3 sealed bids already placed (from multiple wallets)
- [ ] Browser tabs pre-opened: Landing, Dashboard, My Assets, Auctions, Verifier
- [ ] Terminal ready with CRE solver command pre-staged
- [ ] MetaMask connected to Tenderly Virtual Testnet (Sepolia fork)
- [ ] Screen resolution: 1440×900 or wider; browser zoom at 100%

---

## Scene 1 — Hook: The Problem (0:00 – 0:20)

**Screen:** Landing page (`/`) — Hero section
**Action:** Scroll slowly from hero text to "Live Auctions" section; hover on a locked bid card

**Title card (overlay):**
> "Every on-chain auction has the same flaw."

**Voice Script:**
> "Traditional on-chain auctions are broken. Every bid is public. Bots watch the mempool, snipe at the last second, and front-run real buyers. The market is rigged — not by people, but by code.
>
> MaskBid changes the rules."

---

## Scene 2 — The Concept (0:20 – 0:40)

**Screen:** Landing page — scroll through "The Ritual" section (4 steps: Verify → Discover → Sealed Bid → The Reveal)

**Title card (overlay):**
> "Sealed. Verified. Confidential."

**Voice Script:**
> "MaskBid is a sealed-bid auction platform for Real World Assets. Every bid wears a mask — RSA-encrypted in your browser before it ever leaves your device. Not even we can see it.
>
> Only Chainlink's secure enclave decrypts bids — all at once — the moment the auction ends."

---

## Scene 3 — Identity: World ID KYC (0:40 – 1:00)

**Screen:** Landing page → click "Enter the Arena" → Dashboard (`/dashboard`)
**Action:** Show the KYC Status card — "Verified / World ID verified". Briefly show what the World ID verification prompt looks like.

**Title card (overlay):**
> "One human. One bid. No bots."

**Voice Script:**
> "Before anyone can bid, they prove they're human using World ID — zero-knowledge proof of personhood. No wallet farms. No Sybil attacks. One verified person, one verified bid.
>
> The dashboard shows your KYC status, active bids, assets, and USDC deposits — all live from the chain."

---

## Scene 4 — Asset Registration (1:00 – 1:25)

**Screen:** My Assets (`/my-assets`) → click "Register Asset" → `/my-assets/register`
**Action:** Show the form pre-filled with a luxury watch. Click "Submit Asset for Verification". MetaMask popup appears — approve. Show the CRE Command Box with tx hash.

**Title card (overlay):**
> "Phase 1: Register a Real World Asset"

**Voice Script:**
> "A seller registers their asset — here, a Tissot PRX luxury watch. They fill in the details: name, type, serial number, description. One MetaMask transaction calls our `MaskBidAsset` ERC-1155 contract on-chain.
>
> The UI then shows a Chainlink CRE command. This is how we bridge the chain event to our database — Chainlink's Runtime Environment picks up the `AssetRegistered` event and syncs it to Supabase."

---

## Scene 5 — Verification & Minting (1:25 – 1:45)

**Screen:** Verifier page (`/verifier`)
**Action:** Show the "Pending Verification" queue with the asset just registered. Click "Verify Asset" on it. MetaMask popup — approve. Show the CRE Command Box. Then navigate to `/my-assets` and show the asset now showing "Minted" status.

**Title card (overlay):**
> "Phase 2: Verify & Tokenize"

**Voice Script:**
> "An authorized verifier reviews the asset details and approves it. One transaction calls `verifyAndMint` — the asset is verified and a single ERC-1155 token is minted to the seller's wallet.
>
> We now have a verified, on-chain tokenized Real World Asset."

---

## Scene 6 — Create an Auction (1:45 – 2:05)

**Screen:** My Assets (`/my-assets`) → click "Create Auction" on the minted asset → `/auctions/create`
**Action:** Show the form with reserve price, deposit, duration fields. Click create. Two MetaMask popups: first ERC-1155 approval, then auction creation. Show success — navigate to `/auctions`.

**Title card (overlay):**
> "Phase 3: Open the Auction"

**Voice Script:**
> "The seller creates an auction: reserve price, required deposit, duration. Two transactions — first approving the ERC-1155 token transfer, then creating the auction.
>
> The token is immediately escrowed into the `MaskBidAuction` contract. The seller no longer holds it — the contract does, until a winner claims."

---

## Scene 7 — Place a Sealed Bid (2:05 – 2:30)

**Screen:** Auctions page (`/auctions`) — show the live auction card with `🔒 3 sealed` bids
**Action:** Click the auction, open BidModal. Show the bid amount field. Type "5000". Click "Place Bid". Two MetaMask popups: USDC approval then `placeBid`. Show post-bid state with bid count incrementing. Optionally show the Supabase table with `encrypted_data` column full of RSA ciphertext.

**Title card (overlay):**
> "Phase 4: The Masked Bid"

**Voice Script:**
> "Now from a different wallet — a bidder. They see the auction: reserve price, time remaining, and a sealed bid count. No amounts. No rankings.
>
> They enter their bid. In the browser, the amount is RSA-encrypted using the solver's public key before anything is sent anywhere. On-chain, only a SHA-256 hash is stored — not the bid, not the encrypted payload.
>
> The encrypted data lives in Supabase — but even with full database access, it's unreadable RSA ciphertext. Nobody can snipe what nobody can see."

---

## Scene 8 — CRE Solver: The Reveal (2:30 – 2:55)

**Screen:** Auction detail page — Test Controls panel. Click "Set End", wait, click "End Auction". Show CRE Command Box. Switch to terminal.
**Action:** Run `./prepare-solver.sh` then `cre workflow simulate auction-workflow --target local-simulation`. Show solver output decrypting bids and picking a winner. Back in UI, click "Finalize" button. Show auction transitioning to "PendingClaim".

**Title card (overlay):**
> "Phase 5: Chainlink CRE Reveals the Winner"

**Voice Script:**
> "The auction ends. Now the magic happens.
>
> Chainlink's Runtime Environment calls our solver via ConfidentialHTTP — the auth token is injected from VaultDON, never in our code. Inside the secure enclave, the solver decrypts every bid with the RSA private key, ranks them, selects the winner — and submits the result on-chain.
>
> In production this runs trustlessly in a TEE. For this demo we trigger it locally. The contract transitions to `PendingClaim` — winner recorded, 48-hour claim window started."

---

## Scene 9 — Claim Win (2:55 – 3:15)

**Screen:** Auctions page — switch to winner's wallet. Auction card shows "Claim Win" button.
**Action:** Click "Claim Win". ClaimWinModal appears — show breakdown: winning bid, deposit already paid, balance due, deadline countdown. Click "Approve & Claim Win". Two MetaMask popups. Show success — auction moves to "Finalized".

**Title card (overlay):**
> "Phase 6: The Winner Claims Their Asset"

**Voice Script:**
> "The winner connects their wallet and sees the Claim Win button — only visible to them. The modal shows the payment breakdown: how much they bid, the deposit already locked, and what's still owed.
>
> One approval, one transaction — the remaining USDC transfers to the seller, and the ERC-1155 RWA token transfers to the winner. Ownership on-chain, settled in seconds."

---

## Scene 10 — Loser Refund & Dashboard (3:15 – 3:30)

**Screen:** My Bids (`/my-bids`) — switch to a losing bidder's wallet. Show bid status "Lost" with "Claim Deposit" button.
**Action:** Click "Claim Deposit". Show USDC returning. Then navigate to Dashboard (`/dashboard`) — show stats updating.

**Title card (overlay):**
> "Losers get their deposits back. Instantly."

**Voice Script:**
> "Losing bidders can claim their USDC deposit back immediately — no waiting, no approval process. The contract handles it trustlessly.
>
> Back on the dashboard — everything is live: active bids, asset portfolio, KYC status, and total deposits locked. Full visibility. Zero exposure of bid amounts."

---

## Scene 11 — Closing: Why It Matters (3:30 – 3:50)

**Screen:** Return to Landing page — "Why the Mask Matters" section, then the closing CTA
**Action:** Slow scroll through the three features cards: Confidential Bids, Real World Assets, Proof of Personhood. End on the stats bar: 12+ Assets, $2.4M+ TVL, 100% Bid Privacy, 0 Data Breaches.

**Title card (overlay):**
> "MaskBid — Where Every Bid Wears a Mask"

**Voice Script:**
> "MaskBid brings three guarantees to RWA markets that have never coexisted before: complete bid privacy, Sybil-resistant human verification, and trustless on-chain settlement — powered by Chainlink CRE and World ID.
>
> No front-running. No bots. No cheating.
>
> The auction awaits. Your bid is your secret."

---

## Production Notes

| Element | Recommendation |
|---------|----------------|
| **Music** | Cinematic, minimal — low drone with subtle piano |
| **Pacing** | Hold each screen 3–4 seconds before animating; don't rush wallet popups |
| **Annotations** | Add text callouts for: RSA ciphertext in Supabase, `PendingClaim` state, CRE terminal output |
| **Cuts** | Use hard cuts between scenes rather than transitions — matches the dark aesthetic |
| **MetaMask** | Pre-configure transaction details to show clean wallet addresses, not giant hex |
| **Resolution** | Record at 1920×1080 minimum; crop browser chrome if needed |
| **Screen highlight** | Use a subtle spotlight/highlight to draw attention to key UI elements |

---

## Key Technical Callouts (B-roll / overlay graphics)

Use these as text overlays or split-screen graphics during the bid placement and solver scenes:

```
Browser                          Supabase                  Chainlink CRE
─────────────────────────────    ──────────────────────    ──────────────────────
bid = { amount: 5000 USDC }  →  encrypted_data:           solver_auth_token
RSA-OAEP encrypt                 "kJ3x8vQ2m7F..."          (VaultDON secret)
↓                                (unreadable)              ↓
bidHash (SHA-256) → on-chain                               RSA decrypt all bids
USDC deposit → escrow            ←─────────────────────── pick winner
                                                           submit on-chain
```

---

---

# TRACK-SPECIFIC DEMO ADDITIONS

> **Updated prize amounts (from chain.link/hackathon/prizes):**
> | Track | 1st | 2nd | 3rd |
> |-------|-----|-----|-----|
> | **Privacy** ← main track | $16,000 | $10,000 | $6,000 |
> | DeFi & Tokenization | $20,000 | $12,000 | $8,000 |
> | Tenderly Virtual TestNets | $5,000 | $2,500 | $1,750 |
> | World ID with CRE | $10,000 pool | — | — |

---

## Track 0: Privacy — "Chainlink Confidential Compute" ($32,000 pool) ← PRIORITY

### Why MaskBid is the perfect fit

The Privacy track description says: *"use Chainlink Confidential Compute for private transactions — ConfidentialHTTP capability to build privacy-preserving workflows, where API credentials and sensitive application logic executes off-chain."*

**First example use case listed by Chainlink:** *"Sealed-bid auctions with private payments."*

That is MaskBid. Verbatim.

MaskBid's implementation hits every criterion:

| Track Criterion | MaskBid Implementation |
|----------------|----------------------|
| ConfidentialHTTP capability | `ConfidentialHTTPClient` in `auction-workflow/main.ts` |
| API credentials secured in enclave | `SOLVER_AUTH_TOKEN` injected via `{{.solver_auth_token}}` from VaultDON — never in code |
| Sensitive logic executes off-chain | RSA bid decryption + winner selection runs inside CRE enclave |
| Private transactions | Bid amounts never touch the blockchain — only SHA-256 hash on-chain |
| Secure Web2 API integration | Solver Edge Function called only from authenticated CRE enclave |

---

### Privacy Scene P1 — The Core Problem with Transparent Auctions (0:15)

**Screen:** Landing page hero — "Every Bid Wears a Mask" + scroll to Live Auctions showing `🔒 sealed` counts

**Title card (overlay):**
> "On every public blockchain, bids are visible. Until now."

**Voice Script:**
> "Every open auction on a public blockchain leaks the same information: bid amounts, bidder addresses, timing. Bots front-run. Late bidders snipe. The highest bidder always overpays.
>
> Confidential Compute changes this. MaskBid uses Chainlink's ConfidentialHTTP to run auction resolution inside a secure enclave — where bids are decrypted, ranked, and settled without ever being exposed."

---

### Privacy Scene P2 — RSA Encryption in the Browser (during Scene 7, ~2:10)

**Screen:** BidModal open. Show bid amount field. Then split-screen: left = browser devtools Network tab, right = Supabase `bids` table.

**Action:** Type bid amount `5000`. Open browser console and show the `crypto.subtle.encrypt` call (from `apps/web/src/lib/crypto.ts`). Submit. In Supabase table, show the `encrypted_data` column — a wall of base64 RSA ciphertext.

**Title card (overlay):**
> "Encrypted in the browser. Unreadable everywhere else."

**Voice Script:**
> "The moment a bidder types their amount, it's encrypted using RSA-OAEP with the solver's public key — right here in the browser, before anything is transmitted. The plaintext bid amount never leaves the device.
>
> What arrives in our database is this — RSA ciphertext. Even with full Supabase admin access, you cannot read a single bid amount. Not the developer. Not the seller. Not us."

---

### Privacy Scene P3 — ConfidentialHTTP: The Secure Enclave (during Scene 8, ~2:40)

**Screen:** Terminal showing `cre workflow simulate auction-workflow`. Highlight the key lines in `auction-workflow/main.ts` in a code overlay.

**Action:** Show the `ConfidentialHTTPClient` call in the workflow. Show `{{.solver_auth_token}}` template placeholder. Show solver output decrypting bids. Show the winner logged.

**Code overlay (show during voice):**
```typescript
// auction-workflow/main.ts
// Auth token NEVER in code — injected by VaultDON at runtime
multiHeaders: {
  Authorization: { values: ["Bearer {{.solver_auth_token}}"] },
},
vaultDonSecrets: [{ key: "solver_auth_token", namespace: "default" }],
```

**Title card (overlay):**
> "Chainlink VaultDON injects the secret. The enclave decrypts the bids. Nothing leaks."

**Voice Script:**
> "When the auction ends, Chainlink's CRE workflow triggers. It uses `ConfidentialHTTPClient` to call our solver — but the authentication token is never written in any code. It's stored in Chainlink's VaultDON and injected at runtime inside the enclave.
>
> Inside the enclave: the solver loads the RSA private key, decrypts every bid, selects the highest, and returns the winner. Multiple CRE nodes must reach consensus on the result before anything is submitted on-chain.
>
> This is Chainlink Confidential Compute — verifiable, decentralized, private execution."

---

### Privacy Scene P4 — On-Chain Settlement with Zero Exposure (end of Scene 8, ~2:55)

**Screen:** Show `_processReport()` being called. Contract state changes to `PendingClaim`. Tenderly explorer shows the `WinnerClaimRequired` event — winner address and winning amount now visible for the first time.

**Title card (overlay):**
> "The mask comes off — only after the auction ends."

**Voice Script:**
> "The CRE enclave submits an ABI-encoded report via the Forwarder contract. `MaskBidAuction._processReport()` runs — and for the first time, the winner's address and winning bid are written publicly on-chain.
>
> Bids stayed private for the entire auction window. The reveal happens simultaneously, trustlessly, with no ability to front-run. This is exactly the privacy guarantee that sealed-bid auctions require — and it's delivered by Chainlink Confidential Compute."

---

### Privacy — Full Architecture Callout (B-roll graphic)

```
                    WHAT STAYS PRIVATE              WHAT IS PUBLIC
                    ─────────────────              ──────────────
Browser             bid amount (5000 USDC)         wallet address
  ↓ RSA encrypt     plaintext JSON                 bid count
On-chain            ← nothing                      bidHash (SHA-256)
                                                   USDC deposit amount
Supabase            encrypted_data (RSA cipher)    auction_id, bidder_address
                    RSA private key (secret)
CRE Enclave         decrypted bids                 → winner + amount (after end)
  VaultDON          SOLVER_AUTH_TOKEN
```

---

### Privacy Track — Submission Talking Points

1. **Sealed-bid auctions** — the exact first example use case in the track description
2. **ConfidentialHTTP** (`ConfidentialHTTPClient`) used for solver authentication and execution
3. **VaultDON secret injection** — `SOLVER_AUTH_TOKEN` never in code, injected at enclave runtime
4. **Zero bid exposure** — not to other bidders, seller, blockchain observers, or database admins
5. **Decentralized consensus** — multiple CRE nodes agree on winner before on-chain submission
6. **Production path**: TEE (AWS Nitro Enclaves) for full attestation in production

**Unique angle vs. other submissions:** Most privacy demos show *that* data is hidden. MaskBid shows a complete, working economic primitive — a sealed-bid auction — where privacy enables fair price discovery for Real World Assets. The outcome (RWA ownership transfer, USDC settlement) is tangible and demonstrable end-to-end.

---

## Track A: Tenderly — "Build CRE Workflows with Tenderly Virtual TestNets" ($5,000)

### What MaskBid already has (strong coverage)

| Requirement | MaskBid implementation |
|-------------|----------------------|
| Deployed contracts on Virtual TestNet | `MaskBidAsset` + `MaskBidAuction` on Tenderly Sepolia fork |
| Virtual TestNet Explorer Link | Required in submission — link Tenderly project explorer |
| CRE workflow execution on Virtual TestNet | 3 workflows: `asset-log-trigger`, `auction-log-trigger`, `auction-workflow` |
| Tenderly-specific RPC methods | `tenderly_setBalance`, `tenderly_setErc20Balance`, `evm_increaseTime`, `evm_mine` |
| Full E2E test on fork | `apps/contract/scripts/e2e_test.ts` |
| Documentation | `docs/APP_FLOW.md` covers full workflow with Tenderly commands |

---

### Tenderly Scene T1 — Virtual TestNet Explorer (add after Scene 6, ~2:10)

**Screen:** Tenderly dashboard → Virtual TestNet → `MaskBidAuction` contract page
**Action:** Show deployed contract with ABI decoded. Click into a recent `BidPlaced` transaction — show event logs, decoded function call, internal traces. Switch to the "Simulations" tab if time allows.

**Title card (overlay):**
> "Every transaction. Fully inspectable. Before production."

**Voice Script:**
> "Tenderly's Virtual TestNet gives us a production-grade testing environment synced with real Sepolia state. Every CRE workflow execution, every contract call — instantly visible in the explorer with fully decoded event logs and internal traces.
>
> No node setup. No faucet queues. This is where we built and validated every workflow before production."

---

### Tenderly Scene T2 — Time Manipulation (insert inside Scene 8, before solver runs, ~2:35)

**Screen:** Auction detail page — Test Controls panel. Split screen with terminal.
**Action:** Click "Set End" button. Show 30-second countdown. Click "End Auction". In terminal show the raw RPC calls:

```bash
# Fast-forward blockchain clock on Tenderly
curl -X POST "$TENDERLY_RPC" \
  -d '{"method":"evm_increaseTime","params":["0x1C20"],"id":1}'
curl -X POST "$TENDERLY_RPC" \
  -d '{"method":"evm_mine","params":[],"id":2}'
```

**Title card (overlay):**
> "Tenderly: control time itself."

**Voice Script:**
> "A real auction runs for hours. In development — and in this demo — Tenderly lets us fast-forward the blockchain clock. `evm_increaseTime` and `evm_mine` via the Virtual TestNet RPC jump past the auction end time in seconds.
>
> This is how we test the complete 6-phase lifecycle in minutes. Our Test Controls panel is wired directly to these Tenderly RPC methods — the same environment we'd use for pre-production validation."

---

### Tenderly Scene T3 — Wallet Funding (Pre-demo B-roll callout)

**Screen:** Terminal — wallet funding script
**Action:** Run `tenderly_setBalance` + `tenderly_setErc20Balance`. Show MetaMask balance updating.

**Voice Script (brief, 15 seconds):**
> "Onboarding a test wallet: two Tenderly RPC calls — ETH and USDC funded instantly. No faucets. No waiting. This let us simulate multiple competing bidders in seconds."

---

### Submission Notes (Tenderly Track)

- Share the **Tenderly Virtual TestNet public Explorer link** (Settings → Share in Tenderly dashboard) — this is a required submission artifact
- Point judges to `apps/cre-workflow/` for all 3 CRE workflows and `docs/APP_FLOW.md` for documentation
- Highlight that `evm_increaseTime` is used to test the full auction lifecycle end-to-end on Virtual TestNet

---

---

## Track B: World ID + CRE — "Best Use of World ID with CRE" ($10,000 pool)

### Honest Gap Analysis — Read This First

The track requires: **"CRE to enable World ID on blockchains where it's not natively supported — proof verification off-chain within CRE."**

**Current implementation (does NOT fully qualify):**
```
User → IDKit proof → Next.js /api/verify → worldcoin.org API → setKYCStatus() on-chain
```
The World ID proof is verified on a **centralized Next.js server**, not inside CRE.

**What qualifies:**
```
User → IDKit proof → CRE HTTP Trigger → CRE verifies with worldcoin.org API (in consensus)
                                       → EVMClient calls setKYCStatus() on any chain
```

The critical distinction: verification inside CRE means the result is decentrally agreed upon, and can set KYC status on **any chain CRE can reach** — including chains where World ID is not natively deployed (Arbitrum, Avalanche, BNB, custom L2s).

---

### What to build to qualify (minimal, focused addition)

Create `apps/cre-workflow/kyc-verification-workflow/main.ts`:

```typescript
// HTTP Trigger: receives { proof, nullifier_hash, merkle_root, wallet_address, app_id, action }
// Step 1: CRE HTTPClient calls worldcoin.org verify API (in consensus)
// Step 2: If valid → CRE EVMClient writes setKYCStatus(wallet, true) via Forwarder
```

Then in the web app, after IDKit returns the proof, POST it to the CRE workflow's HTTP endpoint instead of `/api/verify`. Keep the existing `/api/verify` as a local dev fallback (the `bypass` mode already exists).

This gives you: **World ID verification in CRE consensus → KYC written on-chain via Forwarder → works on any EVM chain CRE supports.**

---

### World ID Scene W1 — The KYC Gate (show what's already working, ~0:50)

**Screen:** Dashboard → KYC Status card showing "Verified / World ID verified"
**Action:** If showing live: connect a fresh wallet, show World ID IDKit modal, scan/simulate, watch KYC status flip to Verified. Show the on-chain `setKYCStatus` tx in Tenderly explorer.

**Title card (overlay):**
> "One human. One identity. Enforced on-chain."

**Voice Script:**
> "Every participant is verified through World ID's zero-knowledge proof system — no biometric data stored anywhere. The proof is verified and the result written directly to our smart contract. The bidder's wallet is permanently KYC-gated on-chain."

---

### World ID Scene W2 — KYC Enforcement at the Contract Level (~2:10)

**Screen:** Attempt to `placeBid` with an unverified wallet. Show the MetaMask transaction revert.

**Title card (overlay):**
> "No KYC. No bid. Contract-enforced."

**Voice Script:**
> "The enforcement is not in the UI — it's in the contract. `MaskBidAuction` calls `isKYCVerified` before accepting any bid. An unverified wallet cannot participate, no matter how much USDC it holds. The transaction reverts at the EVM level."

---

### World ID Scene W3 — CRE Extension pitch (if kyc-verification-workflow is built)

**Screen:** Terminal — show `cre workflow simulate kyc-verification-workflow`
**Action:** Paste a World ID proof JSON as the HTTP trigger payload. Show CRE calling worldcoin.org verify API in consensus, then submitting `setKYCStatus` on-chain. Show the tx in Tenderly.

**Title card (overlay):**
> "World ID verification — inside a Chainlink CRE enclave. On any chain."

**Voice Script:**
> "Standard World ID is natively available on Ethereum, Optimism, and World Chain. With CRE, we extend it anywhere. The proof is verified in decentralized CRE consensus — multiple nodes must agree before any KYC status is set. Then CRE's EVMClient writes the result to any chain it supports.
>
> A proof from World Chain can grant verified status on Avalanche, Arbitrum, or a custom L2 — chains where World ID has no native deployment. CRE becomes the bridge."

---

### Submission Checklist (World ID + CRE Track)

**Current (partial — likely honorable mention territory):**
- [x] World ID IDKit integrated in frontend
- [x] KYC result stored on-chain via `setKYCStatus()`
- [x] `isKYCVerified` enforced at contract level in auction
- [ ] **World ID proof verified INSIDE a CRE workflow** — required for full qualification

**Priority: build `kyc-verification-workflow` before submission deadline.**
Argument to make in submission text:
> "World ID is natively available on 3 chains. MaskBid uses Chainlink CRE to extend World ID verification to any EVM chain. The proof is verified in CRE consensus, eliminating centralized verification servers. KYC status is then written on-chain via the CRE Forwarder — fully decentralized, chain-agnostic identity gating for auctions."
