# TokenizedAssetPlatform — Smart Contracts

ERC-1155 contract for Real World Asset (RWA) tokenization, with Chainlink CRE integration and KYC verification.

## Setup

```bash
cp .env.example .env
# Fill in your values
```

| Variable | Description |
|---|---|
| `TENDERLY_VIRTUAL_TESTNET_RPC_URL` | RPC URL from Tenderly Virtual TestNet dashboard |
| `TENDERLY_VERIFIER_URL` | `<RPC_URL>/verify` |
| `TENDERLY_ACCESS_TOKEN` | Tenderly API access token |
| `PRIVATE_KEY` | Deployer wallet private key (`0x`-prefixed) |
| `CONTRACT_ADDRESS` | Set after deploying — used by interaction scripts |

## Commands

### Build

```bash
bun run build
# or: forge build
```

### Deploy + Verify

```bash
bun run deploy
```

Deploys `TokenizedAssetPlatform` and verifies on Tenderly. After deployment, copy the printed address into `.env` as `CONTRACT_ADDRESS`.

### Interact with deployed contract

```bash
bun run register      # Register a new asset (must be KYC-verified)
bun run verify-asset  # Verify an asset (admin only)
bun run readUid       # Read asset UID
bun run mint          # Mint tokens for a verified asset
bun run redeem        # Redeem (burn) tokens
```

## Contract Overview

**`src/TokenizedAssetPlatform.sol`** — ERC-1155 with:
- Role-based access: `ADMIN_ROLE`, `ISSUER_ROLE`
- Asset lifecycle: Register → Verify → Mint → Redeem
- KYC state per address (`setKYCStatus` / `isKYCVerified`)
- Chainlink CRE report handler via `ReceiverTemplate`

**`src/interfaces/ReceiverTemplate.sol`** — Abstract base for receiving Chainlink CRE workflow reports. Validates forwarder address, workflow author, and workflow ID.

## Forge deploy script

The deploy script (`script/Deploy.s.sol`) targets the Chainlink CRE forwarder on Ethereum Sepolia:
```
0x15fC6ae953E024d975e77382eEeC56A9101f9F88
```
See [Chainlink docs](https://docs.chain.link/cre/guides/workflow/using-evm-client/supported-networks-ts) for other networks.
