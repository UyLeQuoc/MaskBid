# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MaskBid is a decentralized auction platform for Real World Assets (RWAs) built for the Chainlink Convergence Hackathon 2026. It uses confidential bids via Chainlink CRE (Runtime Environment) and World ID for proof-of-personhood.

**Key Technologies:**

- **Package Manager:** Bun v1.3.9
- **Monorepo:** Turborepo with workspaces
- **Frontend:** Next.js 15 + React 19 + TypeScript 5 (World Mini App)
- **Privacy:** Chainlink CRE + ConfidentialHTTP
- **Identity:** World ID (next-auth v5)
- **Backend:** Supabase (Postgres + Edge Functions)
- **Contracts:** Solidity ^0.8.20 (ERC-1155 via OpenZeppelin)
- **Linting:** Biome 2.3.15

## Common Commands

All commands use Bun. The repository is a Turborepo with workspaces in `apps/*` and `apps/cre-workflow/*`.

### Root Level (Turborepo)

```bash
# Install dependencies
bun install

# Development (runs all apps in parallel)
bun run dev

# Build all apps
bun run build

# Lint all apps
bun run lint

# Type checking across all apps
bun run check-types

# Format code (check only)
bun run format

# Format code (auto-fix)
bun run format:fix

# Dead code detection
bun run knip

# Clean build artifacts
bun run clean
```

### Bidder App (World Mini App)

```bash
cd apps/bidder-app

# Development server
bun run dev

# Build for production
bun run build

# Production server
bun run start

# Lint
bun run lint

# Format
bun run format
```

### CRE Workflows

```bash
cd apps/cre-workflow

# Simulate asset-log-trigger workflow
# LogTrigger: blockchain event -> Supabase
cre workflow simulate asset-log-trigger-workflow --target local-simulation

# With broadcast to Sepolia
cre workflow simulate asset-log-trigger-workflow --broadcast --target local-simulation

# Simulate ZK auction workflow
# Triggers solver to resolve confidential auction
cre workflow simulate auction-workflow --target local-simulation
cre workflow simulate auction-workflow --broadcast --target local-simulation
```

### Contract Interactions

```bash
cd apps/cre-workflow

# These scripts emit events that trigger CRE workflows
npx tsx contracts/scripts/1_deploy.ts
npx tsx contracts/scripts/2_registerNewAsset.ts    # emits AssetRegistered
npx tsx contracts/scripts/3_verifyAsset.ts         # emits AssetVerified
npx tsx contracts/scripts/5_mint.ts                # emits TokensMinted
npx tsx contracts/scripts/6_redeem.ts              # emits TokensRedeemed

# Auction Contract Interactions
npx tsx contracts/scripts/7_deployAuction.ts
npx tsx contracts/scripts/8_createAuction.ts       # emits AuctionCreated
npx tsx contracts/scripts/9_placeBid.ts            # emits BidPlaced (USDC escrow)
npx tsx contracts/scripts/10_finalizeAuction.ts    # emits AuctionFinalized
npx tsx contracts/scripts/11_claimRefund.ts        # emits BidRefunded
npx tsx contracts/scripts/e2e_test.ts              # Full E2E test on Tenderly fork
```

## Architecture

### Zero-Knowledge Auction Flow

The core innovation is confidential bidding where bids remain encrypted until auction resolution:

```
Bidder App (Next.js)
  ↓
Client-side RSA encryption of bid amount
  ↓
Supabase (bids table) - stores encrypted_data
  ↓
Chainlink CRE (ConfidentialHTTP)
  ↓
Supabase Edge Function (solver) - decrypts and selects winner
  ↓
Winner written on-chain
```

**Security Model:**

- `SOLVER_AUTH_TOKEN` only exists in VaultDON and Secure Enclave
- In code, use template placeholder `{{.solver_auth_token}}` - the enclave injects the real value
- Response encryption enabled (`encryptOutput: true`) - winner data encrypted until Chainlink consensus

### Database Schema

**asset_states** (RWA tracking):

- `asset_id` (TEXT, PK)
- `asset_name`, `issuer`, `supply`
- `uid` (UUID, auto-generated)
- `verified` (BOOLEAN)
- `token_minted`, `token_redeemed`

**auctions**:

- `id` (TEXT, PK)
- `asset_id` (FK), `seller_address`
- `start_price`, `reserve_price`
- `status` (active/resolved/cancelled)
- `winner_address`, `winning_amount`

**bids**:

- `id` (UUID, PK)
- `auction_id` (FK), `bidder_address`
- `encrypted_data` (RSA-encrypted bid)
- `hashed_amount` (for verification without revealing)
- `status` (active/won/lost/cancelled)

### Smart Contract Architecture

**TokenizedAssetPlatform.sol** (ERC-1155):

- Role-based access: `ADMIN_ROLE`, `ISSUER_ROLE`
- Asset lifecycle: Register → Verify → Mint → Redeem/Transfer
- CRE integration via `ReceiverTemplate` pattern for metadata updates
- Key events: `AssetRegistered`, `AssetVerified`, `TokensMinted`, `TokensRedeemed`

**MaskBidAuction.sol**:

- Manages confidential sealed-bid auctions for ERC-1155 RWAs
- Automatic ERC-1155 token escrow upon `createAuction`
- USDC token deposit escrow upon `placeBid`
- CRE integration via `ReceiverTemplate` for solver finalization (`_processReport`)
- Refund mechanism for losing bidders
- Key events: `AuctionCreated`, `BidPlaced`, `AuctionFinalized`, `BidRefunded`

### Authentication

**World ID + Wallet Auth:**

- Uses `@worldcoin/minikit-js` for wallet authentication
- next-auth v5 with credentials provider
- SIWE (Sign-In with Ethereum) message verification
- Session includes: `walletAddress`, `username`, `profilePictureUrl`

## Configuration Files

**biome.json** - Linting/formatting:

- Tab indentation, double quotes
- Tailwind CSS directives enabled
- Import organization enabled

**turbo.json** - Build pipeline:

- `build` depends on `^build` (topological)
- Dev servers are persistent with `cache: false`
- Outputs: `.next/**`, `dist/**`, `output/**`

**knip.json** - Dead code detection:

- Ignores `**/generated/**`, `contracts/generated/**`
- Ignores shadcn/ui components in `apps/web/components/ui/**`

## Key File Locations

| Purpose                     | Path                                                         |
| --------------------------- | ------------------------------------------------------------ |
| CRE workflow (ZK auction)   | `apps/cre-workflow/auction-workflow/main.ts`                 |
| CRE project config          | `apps/cre-workflow/project.yaml`                             |
| Solver Edge Function        | `apps/supabase/functions/solver/index.ts`                    |
| Asset handler Edge Function | `apps/supabase/functions/asset-handler/index.ts`             |
| Database migrations         | `apps/supabase/migrations/`                                  |
| RWA Smart Contract          | `apps/cre-workflow/contracts/src/TokenizedAssetPlatform.sol` |
| Auction Smart Contract      | `apps/cre-workflow/contracts/src/MaskBidAuction.sol`         |
| World ID auth               | `apps/bidder-app/src/auth/index.ts`                          |
| Setup guide                 | `docs/HOW_TO_RUN.md`, `docs/SETUP_ZK_AUCTION.md`             |

## Environment Setup

Copy example configs and fill in values:

```bash
# CRE workflow
cp apps/cre-workflow/.env.example apps/cre-workflow/.env
# Required: CRE_ETH_PRIVATE_KEY, CRE_TARGET

cp apps/cre-workflow/asset-log-trigger-workflow/config.json.example \
   apps/cre-workflow/asset-log-trigger-workflow/config.json
# Required: url (Supabase Edge Function), evms[].assetAddress

cp apps/cre-workflow/auction-workflow/config.json.example \
   apps/cre-workflow/auction-workflow/config.json
# Required: solverUrl, auctionId, owner

# Bidder app
cp apps/bidder-app/.env.example apps/bidder-app/.env
# Required: NEXTAUTH_SECRET, WORLD_APP_ID, WORLD_CLIENT_SECRET
```

## Notes

- **No test runner configured** - this is a hackathon project without automated tests
- **Bun-only** - Do not use npm/yarn/pnpm; the lockfile is `bun.lock`
- **CRE CLI required** for workflow simulation
- **Supabase** requires JWT verification disabled on Edge Functions for CRE integration
- **RSA keypair** required for ZK auction - see `docs/SETUP_ZK_AUCTION.md` for generation commands
