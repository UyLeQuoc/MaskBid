# MaskBid — Web Frontend

## What is MaskBid?

Sealed-bid NFT auction platform for physical assets. Bids are encrypted with
Chainlink Confidential HTTP — no one (not even the seller) can read them until
Chainlink CRE reveals the winner.

## Flows

- **Bidder:** deposit → sealed bid → win/lose → claim NFT or claim deposit back
- **Seller:** register asset → set reserve price + required deposit → receive payment
- **Verifier:** review submitted assets, approve/reject for minting

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/auctions` | Browse live auctions, place sealed bids |
| `/dashboard` | KYC status, active bids, registered assets |
| `/my-bids` | Bid history, Pay & Claim (winners), Claim Deposit (losers) |
| `/my-assets` | Asset portfolio + registration form |
| `/verifier` | Verifier review queue |

## Tech Stack

Next.js 15 (App Router) · Tailwind CSS v4 · MetaMask SDK
World ID (KYC) · Chainlink CRE + Confidential HTTP · nuqs (URL state)

## Local Dev

```bash
bun install
bun dev          # → http://localhost:3000
```

## Network

Tenderly Virtual Sepolia (testnet)
RPC: `https://virtual.sepolia.eu.rpc.tenderly.co/8c5c110e-0641-4255-ae82-73a983077b86`
