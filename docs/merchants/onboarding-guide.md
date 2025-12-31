# TONBANKCARD Merchant Onboarding Guide

**Document Type:** Non-Technical Merchant Guide
**Status:** Final
**Audience:** Merchants, Platforms, Product Teams, Integrators
**Issue Reference:** [#50 — Merchant Onboarding Guide](https://github.com/xlabtg/tonbankcard-protocol/issues/50)

---

## Table of Contents

1. [What Is TONBANKCARD](#1-what-is-tonbankcard)
2. [How Payments Work](#2-how-payments-work)
3. [What the Merchant Needs](#3-what-the-merchant-needs)
4. [Settlement & Funds Access](#4-settlement--funds-access)
5. [What TONBANKCARD Guarantees](#5-what-tonbankcard-guarantees)
6. [What TONBANKCARD Does NOT Guarantee](#6-what-tonbankcard-does-not-guarantee)
7. [Risk & Responsibility Summary](#7-risk--responsibility-summary)
8. [Integration Paths](#8-integration-paths)
9. [Where to Verify Everything](#9-where-to-verify-everything)

---

## 1. What Is TONBANKCARD

TONBANKCARD is a **non-custodial payment protocol** built on the TON blockchain.

### Key Facts

- **NFT-Based Accounts**: Every account in TONBANKCARD is represented by an NFT card. Ownership of the NFT equals control of the account.

- **TBC Token Settlement**: All payments within the protocol settle in TBC, the protocol's internal token.

- **Non-Custodial**: No central party holds your funds. You control your own account directly through your NFT ownership.

- **No Reversals, No Chargebacks**: Once a payment is confirmed on the blockchain, it is final. There is no mechanism for reversing transactions at the protocol level.

- **Built on TON**: The protocol operates on the TON blockchain, inheriting its security, speed, and decentralization properties.

> **TONBANKCARD is infrastructure, not a payment processor.**

### What This Means for Merchants

| Traditional Payment Processor | TONBANKCARD Protocol |
|-------------------------------|----------------------|
| Holds your funds until payout | You receive funds directly |
| Can freeze your account | Your account is controlled by your NFT |
| Processes chargebacks | No chargebacks at protocol level |
| Sets rules for your business | Protocol rules are transparent and immutable |
| Requires KYC/approval | No KYC required by the protocol |

---

## 2. How Payments Work

### The Payment Flow (Simplified)

```
   Customer                       Merchant
      |                              |
      |  1. Customer decides to pay  |
      |                              |
      v                              |
  [Customer's                        |
   NFT Account]                      |
      |                              |
      |  2. Customer signs           |
      |     payment transaction      |
      |                              |
      v                              v
  =========== TON BLOCKCHAIN ===========
      |                              |
      |  3. Smart contract           |
      |     validates and            |
      |     executes transfer        |
      |                              |
      v                              v
  [TBC Debited                [TBC Credited
   from Customer]              to Merchant]
      |                              |
      |  4. Settlement is final      |
      |     and on-chain             |
      |                              |
      v                              v
  =========================================
```

### What Happens Step-by-Step

1. **Customer initiates payment**: The customer uses their wallet to pay from their NFT account.

2. **Customer signs the transaction**: The customer must explicitly approve and sign the payment. No one else can initiate this.

3. **Smart contract executes**: The protocol's smart contract validates that the customer has sufficient balance, the accounts are in good standing, and all rules are met.

4. **Funds transfer atomically**: TBC is debited from the customer's NFT account and credited to the merchant's NFT account in a single, atomic operation.

5. **Settlement is final**: Once the transaction is confirmed on the blockchain, it cannot be reversed.

### Key Points

- **No intermediary holds funds**: The transfer happens directly on-chain.
- **No one can intercept or freeze funds mid-transfer**: The blockchain enforces the rules.
- **The merchant receives TBC directly**: It arrives in the merchant's NFT account.

---

## 3. What the Merchant Needs

### Requirements to Accept TONBANKCARD Payments

| Requirement | Description |
|-------------|-------------|
| **TON Wallet** | A wallet compatible with TON (e.g., Tonkeeper, MyTonWallet) to manage your NFT and sign transactions |
| **Merchant NFT Account** | An NFT card from the TONBANKCARD series (7777 or 8888) that represents your merchant account |
| **Payment Status Monitoring** | Ability to check payment status via the Merchant API or by querying the blockchain directly |
| **Basic Key Management** | Secure storage and handling of your wallet's private keys |

### What Is NOT Required

- **No KYC**: The protocol does not require identity verification.
- **No Custody Arrangement**: You do not deposit funds with anyone.
- **No Contract Deployment**: You do not need to deploy any smart contracts.
- **No Blockchain Expertise**: You can use the API without understanding blockchain internals.

### Getting Your Merchant NFT Account

1. Obtain an NFT card from the TONBANKCARD collection (Series 7777 or 8888).
2. This NFT represents your merchant account within the protocol.
3. Ownership of the NFT gives you full control over the associated account.

### Securing Your Account

Your account security depends entirely on:

- **Protecting your wallet's private keys**: Anyone with your private keys controls your account.
- **Not sharing your NFT**: If you transfer the NFT, you transfer account control.
- **Using a secure wallet**: Choose a reputable, well-maintained wallet application.

---

## 4. Settlement & Funds Access

### Settlement Is Final

When a customer pays you through TONBANKCARD:

- The payment settles **immediately on-chain**.
- Settlement is **final and irreversible** at the protocol level.
- Funds arrive **directly in your NFT account**.

There is no holding period, no pending status, and no settlement batch. Once confirmed on the blockchain, the TBC is yours.

### Accessing Your Funds

As the owner of your Merchant NFT:

- You **control your funds directly**.
- You can **transfer TBC** to other accounts at any time.
- You can **swap TBC for TON** (or other assets) on decentralized exchanges like TONCO.
- Withdrawals are **merchant-controlled** — you decide when and how.

No one else can:

- Freeze your funds
- Delay your withdrawals
- Require approval for your transactions

### Regarding Refunds

> **Important**: There is no refund mechanism at the protocol level.

If you need to refund a customer:

- You must **manage refunds off-chain** (e.g., through your customer service process).
- You can voluntarily send TBC back to the customer's account.
- The protocol does not enforce or automate refunds.

Refund policies are entirely at the merchant's discretion and responsibility.

---

## 5. What TONBANKCARD Guarantees

The TONBANKCARD protocol provides the following **guarantees**, derived from its immutable smart contracts and documented in the protocol's formal invariants:

### Protocol Immutability

- Core smart contracts are **immutable after deployment**.
- No one can change the protocol rules after the contracts are live.
- The code that runs today will run the same way tomorrow.

### Non-Custodial Behavior

- The protocol **never takes custody** of user or merchant funds.
- Only the NFT owner can initiate transfers from their account.
- No admin, operator, or third party can move your funds.

### Interface Stability

- Public interfaces (Merchant API, smart contract functions) follow documented specifications.
- Changes to interfaces are versioned and documented.

### Transparency

- All smart contract code is **open source** and auditable.
- All transactions are **publicly visible** on the TON blockchain.
- Protocol invariants are **formally documented** and testable.

### Atomic Transfers

- Every transfer either **completes fully** or **does not happen at all**.
- There are no partial transfers or intermediate states.

### Lock Behavior

- Account locks (for fraud or collateral purposes) **restrict sending only**.
- Locked accounts **can still receive** funds.
- Locks **do not confiscate** funds — they only limit operations.
- Locks are **reversible** by the appropriate authority.

---

## 6. What TONBANKCARD Does NOT Guarantee

The protocol explicitly **does not guarantee** the following:

### Uptime of External Services

- The **Merchant API** is an off-chain service that may experience downtime.
- Your own **merchant servers and systems** are your responsibility.
- The protocol operates on-chain, but ancillary services do not share blockchain guarantees.

### Liquidity

- **TBC liquidity** on exchanges (like TONCO) is provided by independent liquidity providers.
- The protocol does not maintain a treasury or guarantee buy/sell depth.
- Slippage may occur on large trades.

### Price Stability

- **TBC has no price peg**. Its value is determined by the open market.
- The protocol does not manage or stabilize the TBC/TON exchange rate.
- Price volatility is a market phenomenon, not a protocol feature.

### Customer Behavior

- The protocol cannot **force customers to pay**.
- The protocol cannot **guarantee customer solvency**.
- Disputes with customers are **outside protocol scope**.

### Regulatory Compliance

- The protocol **does not provide legal advice**.
- Compliance with local laws (tax, licensing, consumer protection) is **your responsibility**.
- The protocol operates globally and does not adapt to specific jurisdictions.

### Customer Support

- TONBANKCARD does not provide **customer support for end users**.
- Merchant-customer disputes are handled **outside the protocol**.
- The protocol is infrastructure, not a service provider.

---

## 7. Risk & Responsibility Summary

### Your Responsibilities as a Merchant

| Area | Merchant Responsibility |
|------|------------------------|
| **Private Key Security** | You must secure your wallet keys. Loss of keys = loss of access. |
| **NFT Custody** | You must control your Merchant NFT. Transfer = loss of account control. |
| **Payment Verification** | You should verify payments on-chain for critical transactions. |
| **Refund Policy** | You define and execute your own refund process. |
| **Regulatory Compliance** | You must comply with local laws, taxes, and consumer protection rules. |
| **Customer Disputes** | You handle customer issues directly. |
| **Operational Uptime** | You maintain your own systems and integration. |

### Protocol Does NOT Intervene

The TONBANKCARD protocol:

- **Does not intervene** in merchant-customer disputes.
- **Does not reverse** transactions under any circumstances.
- **Does not freeze** accounts at anyone's request (except through documented lock mechanisms with appropriate authority).
- **Does not provide** emergency support or override capabilities.

### Risk Acknowledgment

By integrating with TONBANKCARD, you acknowledge that:

1. You **own all operational risk** associated with accepting TBC payments.
2. You **own all compliance decisions** for your jurisdiction and industry.
3. The protocol **does not provide insurance**, guarantees, or recourse beyond its documented invariants.

> **This section is explicit and unambiguous by design.**

---

## 8. Integration Paths

TONBANKCARD offers multiple integration approaches depending on your technical capabilities and needs.

### Option 1: Merchant API

**Best for**: Most merchants, e-commerce platforms, service providers

The Merchant API provides a simple, stateless interface for:

- Creating payment invoices
- Checking payment status
- Receiving settlement confirmation

**Key characteristics**:
- RESTful API with JSON responses
- API key authentication
- Works without blockchain expertise
- Handles invoice management and status tracking

**What you do**:
1. Call the API to create an invoice when a customer wants to pay.
2. Display the payment link or QR code to your customer.
3. Poll the API (or use webhooks when available) to detect settlement.
4. Fulfill the order when payment is confirmed.

### Option 2: Merchant SDK

**Best for**: Developers building custom integrations, mobile apps

The Merchant SDK provides client libraries for popular languages:

- TypeScript/JavaScript
- Python

**Key characteristics**:
- Higher-level abstractions over the API
- Built-in error handling and retry logic
- Convenient data types and helpers

**What you do**:
1. Install the SDK in your project.
2. Use SDK methods to create invoices and check status.
3. Integrate with your existing order fulfillment workflow.

### Option 3: Direct On-Chain Verification (Advanced)

**Best for**: High-value transactions, technically sophisticated merchants

For merchants who want maximum assurance, you can verify payments directly on the TON blockchain:

- Query the blockchain for transaction confirmation.
- Verify block finality and confirmation count.
- Independently validate settlement events.

**Key characteristics**:
- Highest level of trust (you verify, not the API)
- Requires blockchain development knowledge
- Recommended for mission-critical payments

**What you do**:
1. Use the TON SDK or API to query blockchain state.
2. Verify the transaction hash, block number, and confirmations.
3. Match the on-chain event to your invoice.

### Comparison

| Approach | Technical Skill | Trust Level | Effort |
|----------|-----------------|-------------|--------|
| Merchant API | Low | API-verified | Low |
| Merchant SDK | Medium | API-verified | Low-Medium |
| Direct On-Chain | High | Self-verified | High |

---

## 9. Where to Verify Everything

TONBANKCARD is built on transparency. You can independently verify all aspects of the protocol.

### Public Protocol Registry

The protocol's public registry contains:

- Deployed smart contract addresses
- NFT collection addresses
- Token contract addresses

**Where to find it**: [docs/existing-contracts.md](../existing-contracts.md)

### Network Deployment Matrix

The deployment matrix shows:

- Which contracts are deployed on mainnet vs testnet
- Contract versions and deployment dates
- Official contract addresses

**Where to find it**: [docs/existing-contracts.md](../existing-contracts.md)

### Governance Release Notes

Governance documentation explains:

- How protocol decisions are made
- What governance can and cannot do
- The non-executive nature of governance

**Where to find it**:
- [docs/governance.md](../governance.md)
- [docs/governance/release-notes-v1.md](../governance/release-notes-v1.md)

### Protocol Invariants

The formal invariants document specifies:

- Core security guarantees
- Non-custodial properties
- Behavior that will never change

**Where to find it**: [docs/invariants.md](../invariants.md)

### Smart Contract Code

All smart contracts are open source:

- Review the code yourself or hire an auditor
- Verify deployed bytecode matches source
- Understand exactly what the protocol does

**Where to find it**: [contracts/](../../contracts/)

### Blockchain Explorers

Verify transactions and contract state using public explorers:

- [TONViewer](https://tonviewer.com/)
- [TONScan](https://tonscan.org/)

### API Specification

The Merchant API is fully documented:

- Endpoint descriptions
- Request/response formats
- Error codes and handling

**Where to find it**: [docs/merchant-api-spec.md](../merchant-api-spec.md)

### Encourage Independent Verification

We **encourage** merchants to:

- Verify settlements on-chain for critical transactions
- Review smart contract code before integrating
- Understand the invariants and guarantees
- Not rely solely on API responses for high-value decisions

> **Trust, but verify. The blockchain is the source of truth.**

---

## Frequently Asked Questions

### Do I need a bank account to accept TONBANKCARD payments?

No. TONBANKCARD operates entirely on the blockchain. You receive TBC directly in your NFT account. You can swap TBC for other assets on decentralized exchanges without traditional banking.

### Can someone freeze my merchant account?

The protocol has no admin function to freeze accounts arbitrarily. Account locks can only be applied by designated authorities (risk authority for fraud, lending adapter for collateral) and follow documented rules. Even locked accounts can receive payments.

### What happens if I lose my private keys?

If you lose access to your wallet's private keys, you lose access to your merchant account. There is no recovery mechanism. **Secure key backup is essential.**

### Can I get a refund if I send TBC to the wrong address?

No. Blockchain transactions are irreversible. If you send TBC to an incorrect address, the protocol cannot reverse it. Always verify addresses before sending.

### Is TONBANKCARD regulated?

TONBANKCARD is a decentralized protocol. It does not hold licenses in any jurisdiction. Merchants are responsible for their own regulatory compliance.

### How do I handle customer refunds?

You manage refunds off-chain. If you agree to refund a customer, you voluntarily send TBC from your account to theirs. The protocol does not enforce or automate this.

### What fees does TONBANKCARD charge?

Internal TBC transfers between NFT accounts have **zero protocol fees**. Standard TON blockchain gas fees apply to all transactions. Swaps on decentralized exchanges incur exchange fees (typically ~0.3%).

---

## Legal & Compliance Notes

This guide is **informational only**.

Merchants are responsible for:

- **Regulatory compliance** in their operating jurisdictions
- **Tax reporting** and payment on income received
- **Consumer protection** obligations under applicable law
- **Business licensing** as required

TONBANKCARD does not provide:

- Legal advice
- Tax advice
- Compliance services
- Jurisdiction-specific guidance

Consult qualified professionals for legal and tax matters.

---

## Final Statement

The Merchant Onboarding Guide exists to ensure:

> **No merchant integrates TONBANKCARD under false assumptions.**

The protocol is designed for:

- **Clarity** over complexity
- **Transparency** over obscurity
- **User control** over central authority
- **Predictability** over flexibility

**Clarity is a security feature.**

---

## Document Information

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Status** | Final |
| **Created** | 2025-12 |
| **Issue Reference** | [#50](https://github.com/xlabtg/tonbankcard-protocol/issues/50) |
| **Maintainer** | TONBANKCARD Protocol Team |

---

## References

- [Architecture Documentation](../architecture.md)
- [Protocol Invariants](../invariants.md)
- [Governance Documentation](../governance.md)
- [Governance Release Notes v1](../governance/release-notes-v1.md)
- [Merchant API Specification](../merchant-api-spec.md)
- [Merchant API Security](../merchant-api-security.md)
- [Existing Contracts](../existing-contracts.md)
- [Merchant Integration Guide (Technical)](../../examples/merchant-integration.md)

---

**Built on TON. Controlled by You. Transparent by Design.**
