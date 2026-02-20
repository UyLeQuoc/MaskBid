# MaskBid — Product Requirements Document

**Project Name:** MaskBid (The Dark Auction)
**Tagline:** "Price Discovery for Real World Assets — Private, Verified, and Bot-Free."
**Hackathon:** Chainlink Convergence Hackathon 2026

---

## 1. Executive Summary

MaskBid is a decentralized auction and custody platform for high-value Real World Assets (RWAs) like luxury watches, real estate, or art. Unlike standard on-chain auctions where bids are public and assets can be stolen by hackers, MaskBid introduces **"Human-Locked" Assets**.

We combine **Chainlink Confidential HTTP** to keep bid amounts secret (preventing sniping) with **World ID** to bind asset ownership to a verified human identity. This ensures that even if a wallet key is stolen, the RWA cannot be transferred to an unverified thief, and can be recovered by the original owner via biometric proof.

---

## 2. Target Tracks & Prizes

| Track | Angle |
|---|---|
| **DeFi & Tokenization** | Solving the "Winner's Curse" and "Key Loss" problems for RWAs |
| **Privacy** | Using Confidential HTTP to hide bid values until the auction ends |
| **World ID / Mini App** | Going beyond "Login" to implement "Identity-Bound Ownership" and Sybil resistance |
| **Tenderly** | Dev tooling and smart contract simulation for the encrypted auction logic |

---

## 3. Core Features (MVP)

### 3.1 The Auctioneer Dashboard (Seller)

- **Asset Minting:** Seller mints a "Human-Locked" RWA NFT. This isn't a standard ERC-721; it requires the recipient to be World ID verified.
- **Auction Setup:** Define Reserve Price, Duration, and Asset Metadata.
- **Blind Status:** View only the number of valid human bids, not the amounts.

### 3.2 The Bidder Interface (World Mini App)

- **Proof of Personhood:** User logs in via World ID. This "Human Proof" is attached to their wallet address in the `MaskBidIdentityRegistry`.
- **Encrypted Bidding:**
  1. User inputs bid (e.g., 5,000 USDC).
  2. App encrypts the payload using Chainlink's public key.
  3. User signs the transaction. The contract verifies the user is "Human Verified" before accepting the encrypted hash.

### 3.3 The Settlement Engine (Chainlink CRE)

- **Trigger:** Auction Timer expires.
- **The "Dark" Computation:** Chainlink CRE nodes (off-chain) fetch and decrypt all bids inside a secure enclave.
- **Logic:**
  1. Filter valid bids > Reserve Price.
  2. Identify the Winner.
- **Execution:** The CRE calls `finalizeAuction(winner, amount)` on the contract.

### 3.4 The "Human-Locked" Asset Standard

- **The Guarded Transfer:** The `MaskBidRWA` contract overrides standard ERC-721 transfer logic.
- **The Check:** Before any transfer (even after the auction), the contract queries the `MaskBidIdentityRegistry`.
  - If Recipient == Verified Human: **Allow Transfer.**
  - If Recipient == Unverified/Bot/Hacker: **REVERT Transaction.**
- **Biometric Recovery:** If a user loses their private key, they can prove their identity via World ID on a new wallet. The Registry updates their address, and they can "reclaim" their stuck assets.

---

## 4. Technical Architecture

| Layer | Technology | Function |
|---|---|---|
| Frontend | World Mini App (Next.js) | Mobile UI for bidding; manages World ID proofs and asset recovery flow |
| Privacy | Chainlink Confidential HTTP | Encrypts bid data so nodes can compute the winner without leaking prices |
| Identity | World ID | The "Root of Trust." Verifies "1 Person = 1 Bid" and "1 Person = 1 Owner" |
| Smart Contracts | Custom Solidity | `MaskBidIdentityRegistry.sol` + `MaskBidRWA.sol` + `MaskBidAuction.sol` |
| Orchestration | Chainlink CRE | The "Judge" that decrypts bids and picks the winner |
| Backend | Supabase (Postgres + Edge Functions) | Auction state, bid storage, identity records, asset management |
| Dev Ops | Tenderly | Virtual Testnet for simulating the "Hacker Transfer Revert" scenario |

### 4.1 Project Structure

```
MaskBid/
├── apps/
│   ├── bidder-app/              # Next.js World Mini App (bidder UI)
│   │   └── src/abi/             # Contract ABIs (auto-generated)
│   ├── cre-workflow/            # Chainlink CRE workflows
│   │   ├── contracts/           # Solidity contracts + deploy scripts
│   │   │   ├── MaskBidIdentityRegistry.sol
│   │   │   ├── MaskBidRWA.sol
│   │   │   ├── MaskBidAuction.sol
│   │   │   └── interfaces/      # IReceiver, ReceiverTemplate, IMaskBidIdentityRegistry
│   │   ├── asset-log-trigger-workflow/   # Existing: asset lifecycle sync
│   │   └── auction-settlement-workflow/  # New: blind auction settlement
│   └── supabase/
│       ├── migrations/          # SQL schema (asset_states + auction tables)
│       └── functions/
│           ├── asset-handler/   # Existing: asset lifecycle API
│           └── auction-handler/ # New: auction/bid/identity API
├── docs/
│   ├── PRD.md                   # This document
│   └── HOW_TO_RUN.md           # Setup & run guide
├── package.json                 # Bun workspace root
└── turbo.json                   # Turborepo config
```

### 4.2 On-Chain vs Off-Chain Data Split

| Data | On-Chain | Off-Chain (Supabase) |
|---|---|---|
| Identity (nullifier hash) | Yes — transfer guard needs it | Yes — fast UI lookups |
| Encrypted bid | Only `bytes32` hash (gas efficient) | Full ciphertext (CRE decrypts) |
| Auction state machine | Yes — canonical source of truth | Mirrored for UI queries |
| USDC escrow | Yes — actual funds held | Amount tracked for display |
| Winner selection | Yes — CRE writes on-chain | Mirrored after finalization |
| User profiles / display names | No | Yes — UI-only data |
| Asset metadata (name, image) | tokenURI (IPFS) | JSONB for quick access |

### 4.3 Supabase Database Schema

#### Existing: `asset_states` table (unchanged)

| Column | Type | Description |
|---|---|---|
| `asset_id` | TEXT (PK) | Unique asset identifier |
| `asset_name` | TEXT | Human-readable name |
| `issuer` | TEXT | Entity that issued the asset |
| `supply` | NUMERIC | Total supply |
| `uid` | UUID | Auto-generated cross-system reference |
| `verified` | BOOLEAN | Whether the asset has been verified |
| `token_minted` | NUMERIC | Tokens minted (atomic increment) |
| `token_redeemed` | NUMERIC | Tokens redeemed (atomic increment) |
| `created_at` / `updated_at` | TIMESTAMPTZ | Timestamps |

#### New: `identity_verifications` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto | |
| `wallet_address` | TEXT | NOT NULL | Verified wallet |
| `nullifier_hash` | TEXT | NOT NULL, UNIQUE | World ID unique human identifier |
| `verification_level` | TEXT | CHECK ('device','orb') | Orb = biometric, Device = phone |
| `is_active` | BOOLEAN | DEFAULT true | Deactivated on wallet recovery |
| `created_at` / `updated_at` | TIMESTAMPTZ | | |

Indexes: unique on `(nullifier_hash) WHERE is_active`, index on `(wallet_address) WHERE is_active`.

#### New: `user_profiles` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto | |
| `wallet_address` | TEXT | NOT NULL, UNIQUE | |
| `display_name` | TEXT | | From World ID username |
| `verification_id` | UUID | FK -> identity_verifications | |
| `is_verified` | BOOLEAN | DEFAULT false | Convenience flag |
| `created_at` / `updated_at` | TIMESTAMPTZ | | |

#### New: `auctions` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto | |
| `auction_id` | SERIAL | UNIQUE | Mirrors on-chain auction ID |
| `token_id` | BIGINT | NOT NULL | MaskBidRWA NFT token ID |
| `seller_address` | TEXT | NOT NULL | |
| `reserve_price` | NUMERIC(78,0) | NOT NULL | USDC base units (6 decimals) |
| `start_time` | TIMESTAMPTZ | NOT NULL | |
| `end_time` | TIMESTAMPTZ | NOT NULL | |
| `status` | ENUM | NOT NULL, DEFAULT 'created' | created/active/ended/finalized/cancelled |
| `winner_address` | TEXT | | Set after CRE finalization |
| `winning_bid` | NUMERIC(78,0) | | |
| `bid_count` | INTEGER | DEFAULT 0 | Atomic increment |
| `metadata` | JSONB | DEFAULT '{}' | Asset name, description, image URL |
| `tx_hash_create` | TEXT | | createAuction tx hash |
| `tx_hash_finalize` | TEXT | | finalizeAuction tx hash |
| `created_at` / `updated_at` | TIMESTAMPTZ | | |

#### New: `bids` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, auto | |
| `auction_id` | UUID | FK -> auctions, NOT NULL | |
| `bidder_address` | TEXT | NOT NULL | |
| `nullifier_hash` | TEXT | NOT NULL | Enforces 1 human = 1 bid |
| `encrypted_bid` | TEXT | NOT NULL | Full ciphertext for CRE to decrypt |
| `bid_hash` | TEXT | NOT NULL | keccak256(ciphertext) — stored on-chain |
| `escrow_amount` | NUMERIC(78,0) | NOT NULL | USDC deposited |
| `escrow_tx_hash` | TEXT | | On-chain escrow tx |
| `is_winner` | BOOLEAN | DEFAULT false | |
| `refund_tx_hash` | TEXT | | Set when refund claimed |
| `created_at` | TIMESTAMPTZ | | |

Unique constraint: `(auction_id, nullifier_hash)` — one bid per human per auction.

#### New: `auction_events` table

| Column | Type | Description |
|---|---|---|
| `id` | UUID PK | |
| `auction_id` | UUID FK | |
| `event_type` | TEXT | created / bid_placed / finalized / refunded / cancelled |
| `actor_address` | TEXT | Who triggered the event |
| `data` | JSONB | Event-specific payload |
| `tx_hash` | TEXT | On-chain tx reference |
| `created_at` | TIMESTAMPTZ | |

**All new tables:** RLS enabled (service_role only), `updated_at` triggers, appropriate indexes.

**Atomic function:** `increment_bid_count(p_auction_id UUID)` for race-safe bid counting.

### 4.4 Edge Functions

#### Existing: `asset-handler` (unchanged)

| Action | Description |
|---|---|
| `read` | Retrieve asset state by `assetId` |
| `AssetRegistered` | Register a new asset with initial supply |
| `AssetVerified` | Update verification status |
| `TokensMinted` | Atomically increment minted count |
| `TokensRedeemed` | Atomically increment redeemed count |
| `sendNotification` | POST asset UID to external API |

#### New: `auction-handler`

| Action | Called By | Description |
|---|---|---|
| `createAuction` | Bidder app | Insert auction record after on-chain tx |
| `placeBid` | Bidder app | Store encrypted bid ciphertext, increment bid_count |
| `getAuction` | Bidder app | Read auction by ID |
| `listAuctions` | Bidder app | List auctions by status (for UI) |
| `getAuctionBids` | CRE workflow | Return all encrypted bids for decryption |
| `finalizeAuction` | CRE workflow | Update winner, status after settlement |
| `refundRecorded` | Bidder app | Record refund tx hash |
| `registerVerification` | Bidder app | Insert/update identity_verifications |
| `getProfile` | Bidder app | Read user profile |
| `upsertProfile` | Bidder app | Create/update user profile |

---

## 5. User Flow (Step-by-Step)

### 5.1 Happy Path

1. **Mint:** Seller mints "Gold Bar #001" as a MaskBid RWA.
2. **Bid:** Alice (Verified Human) encrypts a bid of $1,000. It is stored on-chain as `0xAb5...` (hidden).
3. **Block:** A bot tries to bid. Blocked because it has no World ID proof.
4. **Win:** Auction ends. Chainlink CRE calculates Alice is the winner. The NFT moves to Alice.

### 5.2 Attack Scenario

5. **Theft Attempt:** Alice's private key is stolen by a Hacker.
6. **Transfer Blocked:** Hacker tries to send "Gold Bar #001" to his own wallet.
7. **Result:** Transaction Failed. The contract sees the Hacker's wallet has no World ID verification.

### 5.3 Recovery

8. **Recovery:** Alice creates a new wallet, verifies with World ID, and calls `recoverAsset()`. The NFT moves to her new safe wallet.

---

## 6. Smart Contract Specifications

### 6.0 Deployment Order & Relationships

```
1. Deploy MaskBidIdentityRegistry(admin)
2. Deploy MaskBidRWA(admin, registryAddress)
3. Deploy MaskBidAuction(admin, creForwarder, registryAddress, rwaAddress, usdcAddress)
4. Grant MINTER_ROLE on MaskBidRWA to AuctionContract
5. Grant MINTER_ROLE on MaskBidRWA to admin (for initial minting)
```

```
┌─────────────────────────┐
│ MaskBidIdentityRegistry │ ◄── Source of truth for "is human?"
│  - nullifier → wallet   │
│  - isVerifiedHuman()    │
└──────────┬──────────────┘
           │ queries
     ┌─────┴─────────────┐
     │                    │
┌────▼──────────┐   ┌────▼──────────────┐
│  MaskBidRWA   │   │ MaskBidAuction    │
│  (ERC-721)    │   │ (Escrow + CRE)    │
│               │◄──│                   │
│ _update()     │   │ placeBid()        │
│  guard check  │   │ _processReport()  │
│ recoverAsset()│   │ claimRefund()     │
└───────────────┘   └───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  USDC Token │
                    │  (ERC-20)   │
                    └─────────────┘
```

### 6.1 `MaskBidIdentityRegistry.sol`

**Inherits:** `AccessControl`

**Roles:**
- `DEFAULT_ADMIN_ROLE` — can revoke verifications
- `REGISTRAR_ROLE` — can register verifications (backend relayer)

**Storage:**

```solidity
struct Verification {
    address wallet;
    uint256 verifiedAt;
    bool active;
}

mapping(uint256 => Verification) public verifications;  // nullifierHash → Verification
mapping(address => uint256) public walletToNullifier;    // wallet → nullifierHash (reverse)
```

**Functions:**

| Function | Access | Description |
|---|---|---|
| `registerVerification(address wallet, uint256 nullifierHash)` | REGISTRAR_ROLE | Register verified human. If nullifier already has a different active wallet, deactivates old one (recovery). |
| `isVerifiedHuman(address wallet) → bool` | View | Used by RWA transfer guard and Auction bid check. |
| `getNullifier(address wallet) → uint256` | View | Reverse lookup for recovery matching. |
| `getWallet(uint256 nullifierHash) → address` | View | Get active wallet for a nullifier. |
| `revokeVerification(uint256 nullifierHash)` | ADMIN | Emergency deactivation. |

**Events:** `HumanVerified(wallet, nullifierHash, timestamp)`, `WalletRecovered(oldWallet, newWallet, nullifierHash)`, `VerificationRevoked(wallet, nullifierHash)`

**Key invariants:**
- One active wallet per nullifier hash at any time
- One nullifier per wallet (can't verify as two humans)
- Recovery = re-register same nullifier with new wallet → old wallet auto-deactivated

### 6.2 `MaskBidRWA.sol` (Permissioned NFT)

**Inherits:** `ERC721`, `ERC721URIStorage`, `AccessControl`

**Roles:**
- `DEFAULT_ADMIN_ROLE` — admin operations
- `MINTER_ROLE` — mint new RWAs (admin + auction contract)

**Immutables:** `identityRegistry` (address)

**Storage:**

```solidity
struct RWAMetadata {
    string assetName;     // e.g., "Gold Bar #001"
    string assetType;     // e.g., "watch", "real_estate", "art"
    string issuer;        // Entity that created/certified the asset
    uint256 createdAt;
}

mapping(uint256 => RWAMetadata) public rwaMetadata;
uint256 private _nextTokenId = 1;  // Auto-increment
```

**Functions:**

| Function | Access | Description |
|---|---|---|
| `mintRWA(to, assetName, assetType, issuer, tokenURI) → tokenId` | MINTER_ROLE | Mint new Human-Locked NFT. Recipient must be verified. |
| `recoverAsset(tokenId)` | Public | Caller proves same human identity via registry. Force-transfers token from old wallet to caller. |
| `_update(to, tokenId, auth)` | Internal override | **Transfer guard**: reverts if recipient is not a verified human (except burns). |

**Events:** `RWAMinted(tokenId, to, assetName, assetType)`, `AssetRecovered(tokenId, from, to, nullifierHash)`, `TransferBlocked(tokenId, to, reason)`

**Transfer guard logic** (in `_update` override):
```
if to != address(0):                    # not a burn
  if !registry.isVerifiedHuman(to):     # recipient not verified
    emit TransferBlocked(...)
    revert RecipientNotVerified(to)
```

**Recovery logic** (in `recoverAsset`):
```
1. Caller must be verified human (registry.isVerifiedHuman(msg.sender))
2. Caller's nullifier must map to msg.sender (registry.getWallet(nullifier) == msg.sender)
3. This proves caller is the same human who originally owned the token
4. Force transfer: _transfer(currentOwner, msg.sender, tokenId)
```

### 6.3 `MaskBidAuction.sol` (Escrow & Bidding)

**Inherits:** `AccessControl`, `ReentrancyGuard`, `ReceiverTemplate`

**Immutables:** `identityRegistry`, `rwaContract`, `usdcToken`

**Storage:**

```solidity
enum AuctionState { Created, Active, Ended, Finalized, Cancelled }

struct Auction {
    uint256 tokenId;       // MaskBidRWA token ID being auctioned
    address seller;
    uint256 reservePrice;  // Minimum bid in USDC (6 decimals)
    uint256 startTime;
    uint256 endTime;
    AuctionState state;
    address winner;
    uint256 winningBid;
    uint256 bidCount;
}

struct Bid {
    address bidder;
    bytes32 bidHash;       // keccak256 of encrypted bid payload
    uint256 escrowAmount;  // USDC deposited
    bool refunded;
}

mapping(uint256 => Auction) public auctions;
mapping(uint256 => mapping(uint256 => Bid)) public bids;  // auctionId → nullifierHash → Bid
mapping(uint256 => uint256[]) public auctionBidders;       // auctionId → nullifier list
uint256 private _nextAuctionId = 1;
```

**Functions:**

| Function | Access | Description |
|---|---|---|
| `createAuction(tokenId, reservePrice, startTime, endTime) → auctionId` | Public (verified sellers) | Transfers NFT to contract as escrow. Starts auction. |
| `placeBid(auctionId, bidHash, escrowAmount)` | Public (verified humans) | Accepts keccak256(encrypted_bid). Transfers USDC escrow. 1 bid per nullifier per auction. |
| `_processReport(bytes report)` | CRE only (via ReceiverTemplate) | Decodes `(auctionId, winner, amount)`. Transfers NFT to winner, USDC to seller. |
| `claimRefund(auctionId)` | Public | Pull pattern: losing bidders reclaim USDC. Winner gets back excess escrow. |
| `cancelAuction(auctionId)` | Seller only | Returns NFT. Bidders must claim refunds separately. |
| `getAuction(auctionId) → Auction` | View | Read auction state. |
| `getBidCount(auctionId) → uint256` | View | Number of bids (amounts hidden). |

**Events:** `AuctionCreated(auctionId, tokenId, seller, reservePrice, startTime, endTime)`, `BidPlaced(auctionId, bidder, bidHash, escrowAmount)`, `AuctionFinalized(auctionId, winner, winningBid)`, `AuctionCancelled(auctionId)`, `BidRefunded(auctionId, bidder, amount)`, `SellerPaid(auctionId, seller, amount)`

**Auction lifecycle:**
```
Created ──► Active ──► (timer expires) ──► Finalized
               │                               │
               └──── Cancelled ◄───────────────┘
                                          (if no valid bids)
```

**Bid escrow flow:**
```
placeBid:  USDC.transferFrom(bidder → auctionContract, escrowAmount)
finalize:  USDC.transfer(auctionContract → seller, winningBidAmount)
refund:    USDC.transfer(auctionContract → losingBidder, escrowAmount)
           USDC.transfer(auctionContract → winner, excess)  // if escrow > winningBid
```

### 6.4 `IMaskBidIdentityRegistry.sol` (Interface)

```solidity
interface IMaskBidIdentityRegistry {
    function isVerifiedHuman(address wallet) external view returns (bool);
    function getNullifier(address wallet) external view returns (uint256);
    function getWallet(uint256 nullifierHash) external view returns (address);
}
```

Used by both `MaskBidRWA` and `MaskBidAuction` to query verification status.

### 6.5 Security Considerations

| Concern | Mitigation |
|---|---|
| **Reentrancy** | `ReentrancyGuard` on Auction. `SafeERC20` for all USDC transfers. CEI pattern. |
| **Sybil bids** | 1 bid per `nullifierHash` per auction (on-chain mapping + DB unique index). |
| **Bid sniping** | Bids are encrypted. Only `bytes32` hash on-chain. CRE decrypts off-chain. |
| **CRE trust** | `ReceiverTemplate` validates forwarder + workflow identity. Only CRE can finalize. |
| **Refund griefing** | Pull pattern: bidders call `claimRefund()` themselves (no push loops). |
| **Transfer theft** | `_update()` override blocks all transfers to unverified wallets. |
| **Key compromise** | `recoverAsset()` + identity registry wallet update via World ID re-verification. |

---

## 7. Chainlink CRE Workflows

### 7.1 Existing: Asset Log Trigger Workflow (unchanged)

- **LogTrigger** — Listens for `AssetRegistered`, `AssetVerified`, `TokensMinted`, `TokensRedeemed` events → syncs to Supabase via `asset-handler`.
- **HTTPTrigger** — Accepts `{assetId, uid}` → writes UID on-chain.

### 7.2 New: Auction Settlement Workflow

**Location:** `apps/cre-workflow/auction-settlement-workflow/`

**Triggers:**

1. **LogTrigger** — Listens for auction contract events (`AuctionCreated`, `BidPlaced`, `AuctionFinalized`, `AuctionCancelled`) → syncs to Supabase via `auction-handler`.

2. **HTTPTrigger** — Auction settlement (the core "dark computation"):

```
Settlement Flow:
1. Trigger fires (timer or HTTP call with {auctionId})
2. CRE fetches encrypted bids from Supabase (getAuctionBids action)
3. CRE decrypts each bid in secure enclave (Confidential HTTP)
4. CRE filters: valid bids where amount > reservePrice
5. CRE selects winner: highest valid bid
6. CRE encodes report: abi.encode(auctionId, winnerAddress, winningBidAmount)
7. CRE generates signed report → writeReport to MaskBidAuction
8. MaskBidAuction._processReport() executes: NFT → winner, USDC → seller
9. CRE syncs result to Supabase (finalizeAuction action)
```

---

## 8. Data Flow Diagrams

### 8.1 Bid Submission Flow

```
Bidder (World Mini App)
  │
  ├─(1) MiniKit.verify() ──► World ID Cloud ──► returns proof + nullifierHash
  │
  ├─(2) POST /api/verify-proof ──► verifyCloudProof() ──► success
  │
  ├─(3) POST /auction-handler {action: registerVerification}
  │     ──► INSERT into identity_verifications
  │
  ├─(4) Backend tx: IdentityRegistry.registerVerification(wallet, nullifierHash)
  │     ──► On-chain: walletToNullifier[wallet] = nullifierHash
  │
  ├─(5) User enters bid (e.g., 5000 USDC)
  │     App encrypts with Chainlink Confidential HTTP public key
  │     bidHash = keccak256(encryptedPayload)
  │
  ├─(6) MiniKit.sendTransaction([
  │       USDC.approve(auctionContract, 5000e6),
  │       MaskBidAuction.placeBid(auctionId, bidHash, 5000e6)
  │     ])
  │     ──► On-chain: USDC escrowed, bid hash recorded
  │
  ├─(7) POST /auction-handler {action: placeBid, encryptedBid, bidHash, ...}
  │     ──► Supabase stores full ciphertext for CRE
  │
  └─(8) CRE LogTrigger picks up BidPlaced event ──► syncs to Supabase
```

### 8.2 Auction Settlement Flow

```
Timer / External Trigger
  │
  ├─(1) HTTP POST to CRE auction-settlement-workflow {auctionId}
  │
  ├─(2) CRE fetches encrypted bids from Supabase (getAuctionBids)
  │
  ├─(3) CRE decrypts bids in secure enclave (Confidential HTTP)
  │
  ├─(4) CRE computes: filter(bid > reservePrice) → max(bid) → winner
  │
  ├─(5) CRE encodes report: abi.encode(auctionId, winner, winningBid)
  │
  ├─(6) CRE signed report → writeReport → MaskBidAuction._processReport()
  │     ──► NFT transferred to winner, USDC to seller
  │
  └─(7) CRE syncs result to Supabase (finalizeAuction action)
```

### 8.3 Key Recovery Flow

```
User (compromised key, new wallet)
  │
  ├─(1) MiniKit.verify() on NEW wallet → same World ID → same nullifierHash
  │
  ├─(2) Backend tx: IdentityRegistry.registerVerification(newWallet, nullifierHash)
  │     ──► On-chain: old wallet deactivated, new wallet active
  │     ──► emits WalletRecovered(oldWallet, newWallet, nullifierHash)
  │
  └─(3) User calls MaskBidRWA.recoverAsset(tokenId) from new wallet
        ──► Contract verifies: getNullifier(msg.sender) matches identity
        ──► getWallet(nullifier) == msg.sender (new wallet)
        ──► _transfer(oldWallet, newWallet, tokenId)
        ──► Transfer guard passes (new wallet is verified)
```

---

## 9. Hackathon Demo Strategy

**The Narrative:** "We solved the three biggest barriers to RWA adoption: Privacy (hidden bids), Sybil Attacks (bots rigging auctions), and Theft (assets bound to identity, not just keys)."

### Demo Video Script

1. **The Auction:** Show a private bid being submitted (encrypted payload visible on-chain).
2. **The Reveal:** Show the winner being selected trustlessly by CRE.
3. **The "Hacker" Fail:** Live demo of a "hacker" trying to steal the winner's NFT and getting rejected by the smart contract. This proves the "Human-Locked" security model.
4. **The Recovery:** Show the original owner reclaiming the asset via World ID on a new wallet.

### Key Differentiators

- Not just another auction — it's an **identity-bound custody** system.
- Not just World ID login — it's **ownership verification at the protocol level**.
- Not just encrypted bids — it's **end-to-end private price discovery**.

---

## 10. Development Milestones

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Supabase backend (migrations + Edge Function) | Done |
| 2 | CRE workflow (LogTrigger + HTTPTrigger) | Done |
| 3 | Bidder Mini App (Next.js + World ID auth) | In Progress |
| 4 | Smart contracts (`MaskBidRWA`, `MaskBidAuction`, `IdentityRegistry`) | Pending |
| 5 | Encrypted bidding via Confidential HTTP | Pending |
| 6 | CRE auction settlement flow | Pending |
| 7 | Tenderly simulation (hacker transfer revert) | Pending |
| 8 | Demo video & submission | Pending |

---

## 11. References

- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [CRE Getting Started](https://docs.chain.link/cre/getting-started/overview)
- [Confidential HTTP](https://docs.chain.link/cre/capabilities/confidential-http)
- [World ID Integration](https://docs.world.org/world-id)
- [Chainlink Convergence Hackathon](https://chain.link/hackathon)
- [Setup Guide](/docs/HOW_TO_RUN.md)
