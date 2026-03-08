# MaskBid — 5-Minute Demo Script
**Chainlink Convergence Hackathon 2026**

Total runtime: ~5:00 | Slides: ~1:30 | Demo: ~3:30

---

## SLIDE SECTION (~1:30)

---

### Slide 1 — Title (0:00–0:15)

**On screen:**
```
MaskBid
Price Discovery for Real World Assets
Private, Verified, and Bot-Free.

Chainlink Convergence Hackathon 2026
```

**Voice:**
> "MaskBid. Price discovery for Real World Assets — private, verified, and bot-free.
> Built on Chainlink CRE for the Convergence Hackathon 2026."

---

### Slide 2 — The Problem (0:15–0:45)

**On screen:**
```
3 Critical Barriers to RWA Adoption

🔴 Bid Sniping & Winner's Curse (Privacy Gap)
   Public bids are visible on-chain. Bots watch the mempool and
   snipe with last-second overbids — distorting price discovery.

🔴 Sybil Attacks & Bot Manipulation (Identity Gap)
   Anyone can spin up unlimited wallets. Bots flood auctions with
   fake bids. No way to verify a real human is bidding.

🔴 Key Compromise = Asset Loss (Custody Gap)
   Stolen private key = instant theft. No recovery exists for
   RWAs worth thousands or millions.
```

**Voice:**
> "Three critical problems block RWA adoption today.
> First — public bids. Any bot can watch the mempool and snipe the winning bid at the last second.
> Second — no identity layer. Unlimited fake wallets flood auctions with Sybil attacks.
> Third — key theft. One stolen private key and a high-value asset is gone forever.
> No existing platform solves all three at once."

---

### Slide 3 — The Solution (0:45–1:10)

**On screen:**
```
What is MaskBid?

MaskBid is a decentralized auction & custody platform for high-value
Real World Assets — luxury watches, real estate, and art.
"Human-Locked" Assets: ownership bound to a verified human identity,
not just a private key.

🔒 Private Bids
   Chainlink Confidential HTTP encrypts all bid amounts.
   Nobody sees prices until the auction ends.

🧬 Human-Verified
   World ID ties ownership to a real, verified person.
   One human = one bid. No Sybil attacks.

🛡️ Theft-Proof
   Transfer guard on every NFT. Thief steals your key?
   Contract blocks transfer to any unverified wallet.
```

**Voice:**
> "MaskBid introduces Human-Locked Assets — RWA ownership bound to a verified human identity, not just a private key.
> Private bids via Chainlink Confidential HTTP — nobody, not even the database admin, sees any amount until the auction ends.
> World ID for proof of personhood — one human, one bid, no bots.
> And a transfer guard that blocks any unverified wallet from receiving your asset."

---

### Slide 4 — 4 CRE Workflows (1:10–1:25)

**On screen:**
```
4 Chainlink CRE Workflows

┌─────────────────────────┬──────────────────────────────────────────────────────┐
│ Auction Solver          │ HTTPTrigger → decrypt sealed bids in VaultDON        │
│                         │ enclave → write winner on-chain                      │
├─────────────────────────┼──────────────────────────────────────────────────────┤
│ Asset Log Trigger       │ LogTrigger MaskBidAsset events → sync RWA asset      │
│                         │ lifecycle to Supabase                                │
├─────────────────────────┼──────────────────────────────────────────────────────┤
│ Auction Log Trigger     │ LogTrigger MaskBidAuction events → sync auction      │
│                         │ & bid status to Supabase                             │
├─────────────────────────┼──────────────────────────────────────────────────────┤
│ KYC Verification        │ HTTPTrigger World ID proof → verify in CRE           │
│                         │ consensus → write KYC status on-chain                │
└─────────────────────────┴──────────────────────────────────────────────────────┘
```

**Voice:**
> "We built four CRE workflows. The Auction Solver is our core privacy engine — it decrypts sealed bids inside Chainlink's VaultDON enclave and writes the winner on-chain.
> The two Log Triggers keep our off-chain database in sync with on-chain events in real time.
> And the KYC Verification workflow brings World ID proof verification into CRE consensus — no centralized server, no single point of trust."

---

### Slide 5 — Product Flow (1:25–1:35)

**On screen:** *(show the product flow diagram image)*

**Voice:**
> "Here's the full product flow. Every actor — Seller, Verifier, Bidder — must pass World ID KYC through a CRE workflow before interacting. Let's see it live."

---

## DEMO SECTION (~3:30)

---

### Scene 1 — Tenderly Setup (1:35–2:00)

**Title in video:** `Setting Up — Tenderly Virtual TestNet`

**Screen:** Tenderly Explorer dashboard

**Actions:**
1. Open Tenderly Virtual TestNet explorer
2. Show Watched Wallets — 3 wallets already added: **Seller**, **Bidder 1**, **Bidder 2 / Verifier**
3. Open Tenderly Faucet, fund one wallet, show the digest / transaction confirmation
4. Switch tab to `localhost:3000`

**Voice:**
> "We're on Tenderly Virtual TestNet — a Sepolia fork that lets us control block time and balances.
> Three wallets are pre-loaded: a Seller, two Bidders — one doubling as the Verifier.
> Quick faucet top-up — and we're live on the app."

---

### Scene 2 — KYC Verification (2:00–2:30)

**Title in video:** `Step 1 — KYC: World ID via Chainlink CRE`

**Screen:** `localhost:3000/kyc`

**Actions:**
1. Connect MetaMask with **Seller** wallet
2. Click "Verify with World ID" → IDKit widget opens → select "Simulate" / use test credential
3. IDKit returns proof → UI shows **CRECommandBox** with pre-filled terminal command
4. Copy command → paste into terminal → run CRE simulation
5. Terminal shows CRE logs: `Verifying World ID proof...` → `World ID proof verified` → `KYC set on-chain`
6. UI transitions to **"Verification Complete"**
7. Switch to Tenderly → show transaction digest + `KYCStatusSet` event on the contract

**Voice:**
> "First — KYC. The Seller connects their wallet and completes World ID verification.
> Instead of a centralized server, the proof is forwarded to our Chainlink CRE KYC workflow.
> Multiple CRE nodes independently call worldcoin dot org and must reach consensus before anything is written on-chain.
> The KYC status is now stored in the smart contract — not just a database record.
> Here it is on Tenderly — the KYCStatusSet event, confirmed on-chain."

---

### Scene 3 — Register Assets (2:30–3:00)

**Title in video:** `Step 2 — Register RWA Assets`

**Screen:** `localhost:3000/assets/register`

**Actions:**
1. Still logged in as **Seller** (already KYC'd)
2. Fill in Asset 1 — pre-typed mock data ready to paste:
   - **Name:** Rolex Submariner Date 116610LN
   - **Type:** Watch
   - **Description:** Excellent condition. Black dial with Oyster bracelet. Original box and papers. Purchased Geneva 2019. No scratches, minimal wear.
   - **Serial:** 2V847391
3. Submit → transaction confirmed
4. Repeat quickly for Asset 2:
   - **Name:** "Crimson Horizon" by Elena Vasquez
   - **Type:** Art
   - **Description:** Oil on canvas, 36"×48", signed 2017. Certificate of authenticity, Vasquez Studio NY. Christie's provenance March 2021.
   - **Serial:** COA-EV2017-0084
5. CRE Asset Log Trigger workflow runs → terminal shows `AssetRegistered` event decoded → Supabase synced
6. Switch to Tenderly → show `AssetRegistered` events + contract state

**Voice:**
> "Now the Seller registers two Real World Assets — a Rolex Submariner and a signed canvas by Elena Vasquez.
> The moment each transaction lands on-chain, our CRE Asset Log Trigger workflow fires automatically — decodes the event and syncs the asset state to our off-chain database.
> Watch the terminal — you can see CRE reading the AssetRegistered event in real time.
> Tenderly confirms both transactions, showing full event logs on the contract."

---

### Scene 4 — Verify & Mint (3:00–3:25)

**Title in video:** `Step 3 — Verifier Approves & Mints RWA Tokens`

**Screen:** `localhost:3000/verify`

**Actions:**
1. Switch MetaMask to **Verifier** wallet (already KYC'd)
2. Navigate to Verifier dashboard — both assets show as **Pending**
3. Click "Verify" on the Rolex → confirm tx → CRE Asset Log Trigger fires → terminal log shows `AssetVerified`
4. Click "Mint" → confirm tx → terminal shows `TokensMinted`
5. Show Tenderly: `AssetVerified` + `TokensMinted` events, ERC-1155 token balance

**Voice:**
> "A separate Verifier role — also KYC'd — reviews the asset documentation and approves it.
> Once verified, they mint the ERC-1155 token representing the Rolex on-chain.
> Again, CRE Log Trigger picks up both events instantly — AssetVerified, then TokensMinted — and the asset state is updated across the whole system.
> The RWA is now a live, tokenized asset on Tenderly Sepolia."

---

### Scene 5 — Create Auction (3:25–3:45)

**Title in video:** `Step 4 — Seller Creates a Sealed-Bid Auction`

**Screen:** `localhost:3000/auctions/create`

**Actions:**
1. Switch to **Seller** wallet
2. Select the Rolex asset → fill auction details: start price, reserve price, end date (set short for demo)
3. Submit → ERC-1155 token is escrowed by the contract
4. CRE Auction Log Trigger fires → terminal log shows `AuctionCreated`
5. Tenderly: `AuctionCreated` event + token balance of auction contract

**Voice:**
> "The Seller selects the Rolex token and creates a sealed-bid auction — setting a start price, reserve, and end time.
> The ERC-1155 token is escrowed directly by the smart contract — the Seller no longer holds it.
> CRE Auction Log Trigger fires on the AuctionCreated event, syncing the new auction to Supabase so it appears in the UI immediately."

---

### Scene 5.5 — Tenderly Contract Simulation (3:45–4:00)

**Title in video:** `Tenderly — Simulate & Inspect the Smart Contract`

**Screen:** Tenderly Virtual TestNet → Contract page → `MaskBidAuction`

**Actions:**
1. Open Tenderly contract page for `MaskBidAuction`
2. Go to **"Simulate"** tab → select function `placeBid` → fill in `auctionId`, a fake `bidHash`, and `bidAmount`
3. Run simulation → Tenderly shows full execution trace: function call → USDC transfer → storage write → event emitted
4. Point to **State Changes** panel — show `bids` mapping updated, USDC balance delta
5. Switch to **Events** tab — show `BidPlaced(auctionId, bidder, bidHash)` — no amount exposed in the event log
6. Open **"Fund Account"** (Tenderly faucet) → set USDC balance for Bidder wallet via `tenderly_setErc20Balance`
7. Switch back to app `localhost:3000`

**Voice:**
> "Before we place real bids, let me show you something powerful about our development setup — Tenderly.
> Right here in the Tenderly dashboard, we can simulate any contract function directly — no wallet, no gas, no real transaction.
> Watch: we simulate placeBid on the MaskBidAuction contract. Tenderly gives us a full execution trace — every internal call, every state change, every event — before we commit a single transaction.
> Notice the BidPlaced event in the log — it contains the auction ID, the bidder address, and the bid hash. No amount. The privacy guarantee holds at the event level too.
> We can also set any wallet's USDC balance instantly — no waiting for a faucet. This is how we iterate fast on a complex multi-actor system.
> Now let's do it for real."

---

### Scene 6 — Bidder 1 Places Sealed Bid (4:00–4:20)

**Title in video:** `Step 5 — Sealed Bid: Encrypted in Browser`

**Screen:** `localhost:3000/auctions/[id]`

**Actions:**
1. Switch to **Bidder 1** wallet (KYC'd)
2. Open the Rolex auction — shows active, no bid amounts visible
3. Click "Place Bid" → enter amount → UI encrypts with RSA-OAEP client-side
4. MetaMask: approve USDC escrow + submit bid hash on-chain
5. CRE Auction Log Trigger fires → `BidPlaced` event → terminal log
6. Tenderly: show `BidPlaced` event — only the hash visible, no amount

**Voice:**
> "I'll quickly move the auction start time to right now so we can place bids immediately.
> Bidder One is already verified — they open the auction and see the Rolex listing.
> Notice there are no prices shown. No one can see what others are bidding.
> They type in their amount and hit submit. At that moment, the app locks the number — it's hidden before it even leaves the device.
> What goes to the blockchain is just a fingerprint of the bid. What goes to our database is scrambled data that no one can read.
> Not the seller. Not us. No one.
> Their USDC deposit is held by the smart contract — locked in, trustless, no middleman."

---

### Scene 7 — Bidder 2 Places Sealed Bid (4:05–4:15)

**Title in video:** `Step 5 — Second Sealed Bid`

**Screen:** `localhost:3000/auctions/[id]`

**Actions:**
1. Switch to **Bidder 2** wallet
2. Same flow — place a different bid amount
3. Show auction page: bid count = 2, amounts = hidden

**Voice:**
> "Bidder Two enters their own sealed bid — a different amount, unknown to everyone.
> The auction now shows two bids. Still no amounts. Pure sealed competition."

---

### Scene 8 — CRE Solver Reveals Winner (4:15–4:45)

**Title in video:** `Step 6 — Chainlink CRE Decrypts & Picks Winner`

**Screen:** Terminal + `localhost:3000/auctions/[id]`

**Actions:**
1. Use Tenderly `evm_increaseTime` to fast-forward past auction end time
2. Run CRE Auction Solver workflow in terminal
3. Terminal shows:
   - `Fetching encrypted bids via ConfidentialHTTP...`
   - `Decrypting bids in VaultDON enclave...`
   - `Winner: 0xBidder1... — Amount: [REDACTED until consensus]`
   - `Submitting ABI-encoded report on-chain via Forwarder...`
4. Auction page refreshes — status: **PendingClaim**, winner address shown
5. Show CRE output: `solver_auth_token` is `{{.solver_auth_token}}` — never in the code

**Voice:**
> "Auction time is up. We run the CRE Auction Solver — in local simulation mode, which simulates the ConfidentialHTTP capability.
> Watch the terminal — the workflow fetches all the encrypted bids from Supabase, passes them to the solver, and the solver decrypts them to find the highest bid.
> Notice the solver auth token in the code is just a placeholder — double curly brace solver auth token. The real token is injected by VaultDON at runtime. It never lives in our codebase, never in our database.
> The winner is selected, an ABI-encoded report is submitted on-chain through the Forwarder, and the contract flips to PendingClaim.
> The winner is revealed — for the first time — by the blockchain itself."

---

### Scene 9 — Claim & Settlement (4:45–5:00)

**Title in video:** `Step 7 — Winner Claims Asset, Loser Claims Refund`

**Screen:** `localhost:3000/auctions/[id]` + Tenderly

**Actions:**
1. Switch to **winning Bidder** → click "Claim Win" → confirm tx → ERC-1155 token transferred to winner
2. Switch to **losing Bidder** → click "Claim Refund" → USDC returned
3. Tenderly: show `WinClaimed` event + ERC-1155 balance change + USDC transfer back to loser

**Voice:**
> "Now we're in the claim phase — two separate actions, two separate people.
> The winner switches to their wallet and clicks Claim Win.
> But first — remember when they placed their bid, they locked up a USDC deposit as collateral. To actually claim the asset, they now pay the full winning bid amount. That USDC goes to the seller. And in return, the Rolex token transfers directly from escrow to their wallet.
> So in one transaction: they pay for the asset, they receive the asset. The contract handles both sides simultaneously. No one handed it to them — the code did.
> Over on Tenderly you can see the ERC-1155 balance move from the auction contract to the winner's address, and the USDC flow to the seller — all in the same block.
> Now the loser. They put up a deposit too — but they didn't win. They click Claim Refund and their full USDC deposit comes straight back. No trust required. No email to support. Just a transaction.
> This is what trustless settlement actually looks like — winner pays and gets the asset, loser gets their money back, seller gets paid. All in the same flow. No middleman touched anything.
> That's MaskBid. Private bids nobody could read. Real humans only — no bots. And a settlement process that runs itself.
> All of it powered by Chainlink CRE."

---

## PRODUCTION NOTES

- Pre-type all mock asset data in a text file — paste don't type during recording
- Have 3 MetaMask wallets imported and labeled before recording
- Tenderly: pre-add watched wallets, have faucet tab open
- Terminal: pre-`cd apps/cre-workflow`, font size 18+, dark theme
- Keep CRE terminal in split screen when running workflows for scenes 3–8
- Scene 8: hide actual bid amounts in terminal font color if needed (dark on dark) for dramatic reveal

---

## TRACK CALLOUTS (add lower-third overlays)

| Scene | Track Callout |
|-------|--------------|
| Scene 2 | **World ID + CRE** — Proof verified in CRE consensus, not a centralized server |
| Scene 5 | **Privacy** — RSA-OAEP encrypted client-side, only hash on-chain |
| Scene 8 | **Privacy** — VaultDON decrypts in enclave, `{{.solver_auth_token}}` never in code |
| All | **Tenderly** — Virtual TestNet fork, `evm_increaseTime` for lifecycle control |
