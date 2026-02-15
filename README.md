# MaskBid: The Dark Auction  
**Price Discovery for Real World Assets—Private, Verified, and Bot-Free.**

![MaskBid Banner](https://via.placeholder.com/1200x400/1a1a2e/ffffff?text=MaskBid+-+Human-Locked+Dark+Auctions)  
*(Replace with your actual banner image or demo screenshot)*

## Overview
MaskBid is a decentralized auction and custody platform for high-value **Real World Assets (RWAs)** such as luxury watches, fine art, real estate deeds, rare collectibles, and more.

Traditional on-chain auctions suffer from:
- Public bids → sniper bots and front-running
- Wallet key theft → permanent asset loss
- Sybil attacks → fake bids inflating prices

MaskBid solves these with **"Human-Locked" Assets**:
- **Confidential bids** using Chainlink Confidential HTTP & Runtime Environment (CRE)
- **Proof-of-Personhood** ownership bound to verified human identity via World ID
- **Biometric recovery** if keys are lost/stolen

Even if a private key is compromised, a hacker cannot transfer the asset to an unverified wallet. The rightful owner can reclaim it via World ID biometric proof on a new wallet.

Built during **Chainlink Convergence Hackathon 2026** — targeting **DeFi & Tokenization**, **CRE**, and **World ID** prize tracks.

## Key Features (MVP)
- **Seller Dashboard**: Mint "Human-Locked" RWA NFTs, set reserve price, duration, view blind bid count (no amounts revealed)
- **Bidder Mini App**: World ID login → encrypt bid payload → submit to auction (bots blocked)
- **Confidential Auction Engine**: Chainlink CRE decrypts bids off-chain in secure enclave, selects winner trustlessly, calls `finalizeAuction()`
- **Guarded Transfers**: Custom ERC-721 override — transfers only allowed to World ID-verified recipients
- **Asset Recovery**: Prove identity biometrically → update registry → reclaim stuck RWAs

## Tech Stack
| Layer              | Technology                          | Purpose                                                                 |
|--------------------|-------------------------------------|-------------------------------------------------------------------------|
| Frontend           | World Mini App                      | Mobile bidding UI + World ID proof management                           |
| Privacy            | Chainlink Confidential HTTP + CRE   | Encrypt bids client-side; decrypt & compute winner in TEE/enclave       |
| Identity           | World ID (Proof of Personhood)      | 1 person = 1 bid/owner; Sybil resistance & biometric key recovery      |
| Smart Contracts    | Solidity (custom)                   | `MaskBidRWA.sol` (permissioned NFT), `MaskBidAuction.sol` (escrow)      |
| Orchestration      | Chainlink Runtime Environment (CRE) | Off-chain bid decryption, winner selection, on-chain finalization      |
| Dev Tooling        | Tenderly                            | Simulate encrypted logic, hacker transfer reverts, virtual testnet     |

**Official Docs & Resources** (2026 latest):
- Chainlink CRE: https://docs.chain.link/cre
- CRE Getting Started: https://docs.chain.link/cre/getting-started/overview
- Confidential HTTP/Compute: https://docs.chain.link/cre/capabilities/confidential-http (conceptual)
- World ID Integration: https://docs.world.org/world-id
- Hackathon Page: https://chain.link/hackathon

## Architecture Diagram
*(Add your diagram here – e.g. from Excalidraw or Draw.io)*

1. Seller mints → Human-Locked RWA NFT
2. Bidders submit encrypted bids via Mini App
3. Bids stored on-chain as ciphertext
4. Auction ends → CRE decrypts & computes winner
5. Winner receives NFT (only if verified)
6. Transfer attempt by unverified wallet → REVERT
7. Owner recovery → new wallet + World ID proof → reclaim

## User Flows
### Auction Creation & Bidding
1. Seller connects wallet → mints RWA with metadata
2. Sets reserve, duration → auction live
3. Bidder logs in with World ID → enters bid amount
4. App encrypts bid → signs tx → stored encrypted on-chain

### Settlement
- Timer expires
- CRE fetches/decrypts bids securely
- Filters valid bids (> reserve)
- Calls `finalizeAuction(winner, amount)` → NFT transfer

### Security Demo: Hacker Attack
- Hacker steals winner's private key
- Attempts to transfer NFT to own wallet
- Contract checks recipient World ID → REVERT (transaction fails)

### Recovery
- Victim verifies World ID on new wallet
- Calls `recoverAsset()` → registry updates → NFT moves safely

## Hackathon Winning Narrative
"We solve the **three biggest barriers** to mainstream RWA adoption:
- **Privacy**: No bid sniping/front-running
- **Sybil resistance**: Only verified humans can bid/own
- **Theft protection**: Assets bound to identity, not keys — recoverable biometrically"

**Demo Highlights** (for video submission):
- Live private bidding
- CRE trustless winner reveal
- Simulated hacker transfer fail (via Tenderly)

## Getting Started (Local Dev)
1. Clone repo: `git clone https://github.com/yourusername/maskbid.git`
2. Install deps: `npm install` (or yarn/pnpm)
3. Set up World ID, Chainlink CRE CLI, Tenderly fork
4. Deploy contracts to Sepolia/testnet
5. Run Mini App: `npm run dev`

Detailed setup in `/docs/setup.md` (add this file later).

## License
MIT License — feel free to fork and build upon for RWA innovation!

## Built for
[Chainlink Convergence Hackathon 2026](https://chain.link/hackathon)  
Team: Lê Quốc Uy (Dong Nai, VN)

Questions? Reach out on X @yourhandle or open an issue.

Let's bring secure, private RWA markets on-chain! 🚀