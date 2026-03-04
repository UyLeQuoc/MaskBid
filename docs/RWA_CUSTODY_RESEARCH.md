# RWA Custody & Fraud Prevention Research

## Problem Statement

In tokenized Real World Asset (RWA) auctions, a fundamental trust gap exists: after an auction finalizes, the seller receives payment (USDC) while the buyer receives only a digital token (NFT) representing the physical asset. The seller still physically possesses the real-world asset and can simply disappear with both the payment and the asset.

This document surveys how production platforms solve this problem.

---

## 1. Legal Wrapper Structures (SPV / LLC / Trust)

**The most widely adopted approach.** The physical asset is transferred to a legally independent entity (Special Purpose Vehicle) _before_ tokenization. Tokens represent equity or beneficial interest in the SPV, not a direct claim on the asset.

### How It Works

1. A Special Purpose Vehicle (SPV) — typically an LLC, limited partnership, or statutory trust — is created.
2. The physical asset is deeded/titled to the SPV. The SPV, not the original owner, holds legal title.
3. Tokens are issued representing fractional equity or beneficial interest in the SPV.
4. The SPV is **bankruptcy-remote** — if the issuing company goes under, the asset remains legally owned by the SPV for the benefit of token holders.

### Production Examples

| Platform     | Structure                  | Details                                                                                                                                                                         |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RealT**    | Delaware Series LLC        | Each property held by an independent series LLC. Deed recorded at county recorder's office. RealTokens = equity in the LLC. Rental income flows to holders via smart contracts. |
| **Tangible** | Local SPVs (UK, Singapore) | Each property in its own SPV. TNFT holders have beneficial ownership. Holders can redeem TNFT to become full legal holder of the SPV.                                           |
| **CitaDAO**  | SPV (Singapore)            | Tokenized properties valued over $1.2M on Ethereum. Investors with 30% ownership can redeem actual property deeds.                                                              |
| **Harbor**   | SPV                        | Student housing project ($20M). SPV holds property, tradeable token shares issued.                                                                                              |

### Why It Prevents Fraud

The seller transfers title to the SPV **at the point of tokenization**, not at the point of sale. Once the asset is in the SPV, the seller has no more legal claim to it. Any attempt to reclaim or move the asset would be **theft from the SPV** — prosecutable in traditional courts.

### Two-Layer Governance

On-chain voting by token holders connects to formal SPV governance through the entity's Articles of Association, making token-holder votes legally binding.

### Limitations

- Requires legal setup per asset (cost and time)
- Jurisdiction-dependent
- Not fully trustless — relies on the legal system for enforcement

---

## 2. Regulated Custodian Models (Vaulted Assets)

**Standard for fungible physical assets** (precious metals, commodities). A professional, regulated, insured custodian physically holds the asset in segregated storage.

### How It Works

1. The physical asset is deposited with a regulated custodian (banks, LBMA-accredited vaults).
2. The custodian holds assets in **segregated accounts** separate from their own balance sheet.
3. Tokens are minted only against verified, custodied assets.
4. Regular third-party audits verify physical reserves match token supply.
5. Redemption mechanisms allow token holders to claim the physical asset.

### Production Examples

| Platform               | Asset                       | Custodian                                   | Regulation                                                                  |
| ---------------------- | --------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| **Paxos Gold (PAXG)**  | Gold (1 token = 1 troy oz)  | Brink's vaults, London                      | OCC (US) regulated. Segregated, bankruptcy-remote accounts. Monthly audits. |
| **Tether Gold (XAUT)** | Gold (1 token = 1 troy oz)  | Swiss vaults                                | Regular attestations.                                                       |
| **Tangible**           | Luxury goods, gold, watches | Insured vaults in London, Singapore, Zurich | 1% annual storage fee. Owners can redeem at any time.                       |

### Why It Prevents Fraud

The seller never has unsupervised custody after tokenization. The asset is in a third-party vault from the moment of tokenization. The custodian is regulated, insured, and legally obligated to hold assets for token holders.

### Limitations

- Custodian fees (storage, insurance)
- Centralized trust in the custodian
- Redemption may have minimums (PAXG requires 430 tokens = 1 full gold bar)

---

## 3. Dual-Deposit Escrow (Game-Theoretic Approach)

**A trustless, on-chain solution** specifically designed for exchange of physical goods without a mediator.

### How It Works

1. **Seller deposits** collateral into a smart contract escrow (signaling commitment).
2. **Buyer deposits** payment + an additional security deposit.
3. Seller delivers the physical good off-chain.
4. Buyer confirms receipt by calling `approve()` on the contract.
5. Upon approval: payment goes to seller, both security deposits are returned.
6. **If buyer refuses to confirm** (tries to cheat): both parties lose their deposits — making false disputes irrational.
7. **If seller never delivers**: the transaction times out and both parties lose deposits — making non-delivery irrational.

### Game Theory Guarantee

Research by Asgaonkar & Krishnamachari (USC, ICBC 2019) proved that the **Subgame Perfect Nash Equilibrium** is for both parties to behave honestly, as long as both are rational. Neither party gains from cheating because the financial penalty (lost deposit) exceeds the gain from fraud.

> Paper: [Solving the Buyer and Seller's Dilemma](https://anrg.usc.edu/www/papers/Dual_Deposit_ICBC_2019.pdf)

### Production Example

**BitHalo / BitBay** implemented this pattern for peer-to-peer physical goods trading.

### Why It Prevents Fraud

No trusted third party is needed. Both parties have skin in the game. Fraud is economically irrational because the penalty (lost deposit) always exceeds the potential gain.

### Limitations

- Requires both parties to be economically rational
- Higher capital lockup (both sides must stake)
- Doesn't handle partial delivery or quality disputes well

---

## 4. Auction House as Trusted Intermediary

**Traditional approach adapted for crypto.** The auction house physically holds or verifies the asset before the sale and acts as custodian + escrow agent.

### How It Works

1. Seller consigns the asset to the auction house.
2. The auction house authenticates, stores, and insures the item.
3. Auction proceeds (on-chain or off-chain).
4. Buyer pays. The auction house holds payment.
5. Item is shipped/delivered to the buyer.
6. Payment is released to the seller after delivery confirmation.

### Production Examples

| Platform       | Approach                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Christie's** | Partnered with Kresus for blockchain-based certificates of ownership. Physical items held during sale.                    |
| **Sotheby's**  | Requires valid ETH addresses. Manages NFT transfer from seller's agent to buyer's wallet. Traditional escrow for payment. |

### Why It Prevents Fraud

The auction house itself serves as the trusted custodian and escrow agent. Their reputation, legal liability, insurance, and physical security infrastructure create strong guarantees.

### Limitations

- Centralized trust in the institution
- High fees (10-25% buyer's premium)
- Doesn't scale to permissionless markets

---

## 5. Chainlink Proof of Reserve (Oracle-Based Attestation)

**On-chain verification** that tokenized assets are properly backed by their real-world counterparts.

### How It Works

1. A decentralized oracle network periodically fetches reserve data from custodians or third-party auditors.
2. The data is published on-chain as a Proof of Reserve (PoR) feed.
3. Smart contracts query this feed before allowing minting, trading, or redemption.
4. For physical assets: oracles connect to inventory management systems, custodial records, and auditor attestation reports.

### Two Attestation Methods

| Method                      | Description                                                               | Trust Level                  |
| --------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| **Third-party attestation** | Independent auditors verify reserves (e.g., The Network Firm for TrueUSD) | Higher trust, slower updates |
| **Self-attestation**        | Issuer/custodian reports own reserves                                     | Lower trust, faster updates  |

### Production Examples

- **CACHE Gold** — Chainlink PoR verifies tokenized gold is fully backed by vaulted reserves.
- **OpenEden** — Chainlink CCIP + Proof of Reserve for regulated, yield-bearing stablecoin backed by U.S. Treasuries.
- **SBI Digital Markets** — Chainlink as exclusive infrastructure for tokenized asset pipeline.

### Why It Prevents Fraud

Shifts trust from "trust the issuer" to "trust the auditor + oracle network." Provides automated, continuous verification rather than periodic manual audits.

### Limitations

- Verifies existence at attestation time only — doesn't prevent removal between windows
- Requires trusted auditors or data sources
- Setup complexity for physical asset verification

---

## 6. Institutional-Grade Custody (Ondo Finance Model)

**For tokenized financial instruments** (treasuries, securities). Uses the same custody infrastructure as traditional finance.

### How It Works

1. Tokens are backed 1:1 by actual securities held by **qualified custodians** (SEC-regulated: BNY Mellon, State Street, Coinbase Custody).
2. Authorized participants mint tokens by purchasing underlying securities.
3. Daily third-party audits verify 1:1 backing.
4. Full public disclosure on asset backing.

### Why It Prevents Fraud

Built on existing securities custody regulations. Qualified custodians are legally obligated to hold assets for clients. Misappropriation is a federal crime.

---

## 7. Dispute Resolution Patterns

No single dominant on-chain dispute resolution standard exists for RWA. Current approaches:

| Approach                     | Description                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Traditional legal system** | SPV-based platforms fall back to courts. Token holder rights enforceable through SPV governing documents. |
| **Arbitration clauses**      | Written into token purchase agreements for cross-jurisdictional transactions.                             |
| **DAO governance**           | Token-weighted voting for disputes. Vulnerable to whale control.                                          |
| **Insurance**                | Professional custodians carry insurance against theft, damage, and mismanagement.                         |
| **KYC/AML as deterrent**     | Identity verification means sellers face real legal consequences for fraud.                               |

---

## Summary: Approaches by Asset Type

| Asset Type               | Primary Mechanism          | Examples                                | Trust Assumption                  |
| ------------------------ | -------------------------- | --------------------------------------- | --------------------------------- |
| Real estate              | SPV/LLC holds title        | RealT, Tangible, CitaDAO, Propy         | Legal system + property registrar |
| Precious metals          | Regulated vault custody    | Paxos Gold, Tether Gold, CACHE Gold     | Custodian + auditor               |
| Treasuries / Securities  | Qualified custodian (SEC)  | Ondo Finance, OpenEden, BlackRock BUIDL | Regulated custodian               |
| Physical goods (P2P)     | Dual-deposit escrow        | BitHalo / BitBay                        | Both parties are rational         |
| High-value art           | Auction house intermediary | Christie's, Sotheby's                   | Institutional reputation          |
| Any asset (verification) | Chainlink Proof of Reserve | CACHE Gold, OpenEden, TUSD              | Oracle network + auditor          |

---

## Relevance to MaskBid

MaskBid is a sealed-bid auction platform for RWAs using Chainlink CRE. It already has:

- KYC via World ID (fraud deterrent — sellers are identifiable)
- USDC escrow for bidders (partial protection)
- ERC-1155 token escrow on auction creation

### Current Gap

After `finalizeAuction()`, the seller receives USDC and the buyer receives the NFT — but there is no mechanism to ensure the physical asset is delivered.

### Recommended Additions (by implementation effort)

| Priority | Approach                       | Effort | Description                                                                                                                         |
| -------- | ------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1        | **Dual-deposit escrow**        | Low    | Require seller to stake USDC collateral in `MaskBidAuction.sol`. Released only after buyer confirms delivery or timeout.            |
| 2        | **Two-phase settlement**       | Low    | Hold seller's USDC payment until buyer confirms physical delivery. Add `confirmDelivery()` + timeout with admin dispute resolution. |
| 3        | **Verifier / custodian role**  | Medium | Add `VERIFIER_ROLE` to `MaskBidAsset.sol`. Verifier confirms physical custody before `verifyAndMint()` can be called.               |
| 4        | **Chainlink Proof of Reserve** | Medium | Oracle attests that the asset is in custody before the auction can go live. Integrates with existing CRE infrastructure.            |
| 5        | **SPV / legal wrapper**        | High   | Off-chain legal entity holds title. Token represents equity in SPV. Requires legal counsel per jurisdiction.                        |

---

## References

- [RWA.io: SPV for Tokenized Assets](https://www.rwa.io/post/spv-for-tokenized-assets-setup-and-governance)
- [Paxos Gold Documentation](https://www.paxos.com/pax-gold)
- [USC: Dual-Deposit Escrow Paper (ICBC 2019)](https://anrg.usc.edu/www/papers/Dual_Deposit_ICBC_2019.pdf)
- [Chainlink: Proof of Reserve](https://chain.link/proof-of-reserve)
- [Chainlink: Confidential Compute (CRE)](https://blog.chain.link/chainlink-confidential-compute/)
- [Propy: Blockchain-Enabled Title & Escrow](https://propy.com/browse/the-worlds-first-blockchain-enabled-title-escrow/)
- [Tangible Documentation](https://docs.tangible.store/)
- [Ondo Finance Overview](https://www.lbank.com/explore/ondo-finance-rwa-platform-tokenizing-treasuries-stocks)
- [Sotheby's Cryptocurrency FAQ](https://www.sothebys.com/en/buy-sell/cryptocurrency-faq)
