# Tokenized Asset Platform - Smart Contracts

Solidity smart contracts for the Tokenized Asset Platform (ERC-1155 based RWA tokenization) with TypeScript deployment and interaction scripts.

## Project Structure

```
contracts/
├── src/                          # Solidity source files
│   ├── TokenizedAssetPlatform.sol    # Main contract
│   └── interfaces/                   # Chainlink CRE receiver interfaces
│       ├── IERC165.sol
│       ├── IReceiver.sol
│       └── ReceiverTemplate.sol
├── scripts/                      # TypeScript deployment & interaction scripts
│   ├── 1_deploy.ts
│   ├── 2_registerNewAsset.ts
│   ├── 3_verifyAsset.ts
│   ├── 4_readUid.ts
│   ├── 5_mint.ts
│   ├── 6_redeem.ts
│   └── gen-abi-ts.ts             # ABI to TypeScript generator
├── output/                       # Compiled ABI + bytecode (generated)
├── abi/                          # TypeScript ABI exports (generated)
├── viemUtils.ts                  # Shared viem client utilities
├── package.json
└── tsconfig.json
```

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Solidity compiler (solc)](https://docs.soliditylang.org/en/latest/installing-solidity.html) (v0.8.20+)
  ```bash
  brew install solidity
  ```
- Ethereum Sepolia testnet RPC URL (e.g., Alchemy, Infura)
- Sepolia ETH for gas fees

## Setup

1. Install dependencies:

   ```bash
   cd apps/cre-workflow/contracts
   bun install
   ```

2. Configure environment variables in `../.env`:

   ```
   CRE_ETH_PRIVATE_KEY=<your-private-key>
   ```

3. Configure Sepolia RPC URL in `../project.yaml`:

   ```yaml
   local-simulation:
     rpcs:
       - chain-name: ethereum-testnet-sepolia
         url: <your-rpc-url>
   ```

## Build

Compile the Solidity contract and generate TypeScript ABI:

```bash
bun run build
```

This will:
1. Compile `src/TokenizedAssetPlatform.sol` with `solc`
2. Output `TokenizedAssetPlatform.abi` and `.bin` to `output/`
3. Generate typed `abi/TokenizedAssetPlatform.ts` (with `as const` for viem type inference)

## Scripts

All scripts use [viem](https://viem.sh/) to interact with the deployed contract on Sepolia.

| Command | Script | Description |
|---|---|---|
| `bun run deploy` | `1_deploy.ts` | Deploy contract to Sepolia |
| `bun run register` | `2_registerNewAsset.ts` | Register a new asset |
| `bun run verify` | `3_verifyAsset.ts` | Verify an asset |
| `bun run readUid` | `4_readUid.ts` | Read UID Asset |
| `bun run mint` | `5_mint.ts` | Mint Asset |
| `bun run redeem` | `6_redeem.ts` | Redeem Asset |

## Formatting

```bash
bun run format       # Check formatting
bun run format:fix   # Auto-fix formatting
```
