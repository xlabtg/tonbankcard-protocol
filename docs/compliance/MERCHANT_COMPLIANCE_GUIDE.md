# TONBANKCARD Protocol — Merchant Compliance Guide (Advanced)

**Document Type:** Compliance Documentation
**Issue Reference:** [#74 — Improvements / Phase 12 — Compliance & Institutional Readiness](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_12_compliance.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Important Disclaimer

*This document is for informational purposes only and does not constitute legal, financial, or tax advice. Consult independent specialists for your jurisdiction and business model.*

---

## Table of Contents

1. [Audience & Purpose](#1-audience--purpose)
2. [Understanding Non-Custodial Settlement](#2-understanding-non-custodial-settlement)
3. [Regulatory Assessment for Merchants](#3-regulatory-assessment-for-merchants)
4. [AML/KYC for Institutional Merchants](#4-amlkyc-for-institutional-merchants)
5. [Tax Considerations](#5-tax-considerations)
6. [Data Protection Obligations](#6-data-protection-obligations)
7. [Invoice & Record-Keeping Requirements](#7-invoice--record-keeping-requirements)
8. [Fraud Prevention](#8-fraud-prevention)
9. [Technical Compliance Controls](#9-technical-compliance-controls)
10. [Compliance Checklist](#10-compliance-checklist)

---

## 1. Audience & Purpose

This guide addresses institutional merchants integrating TONBANKCARD for payment acceptance. It covers:

- How to assess your compliance obligations when accepting TBC payments
- AML/KYC requirements for institutional-grade deployment
- Tax implications of TBC settlements
- Data protection obligations for customer information
- Invoice and record-keeping best practices
- Fraud prevention measures

**This guide supplements, not replaces, legal advice.** Requirements vary significantly by jurisdiction and business type.

---

## 2. Understanding Non-Custodial Settlement

### 2.1 How TBC Settlement Works

When a customer pays via TONBANKCARD:

1. Customer initiates a transaction in their wallet (TON Connect)
2. Customer signs the transaction with their private key
3. Transaction is submitted to the TON blockchain
4. The TBC jetton transfer executes atomically on-chain
5. You (merchant) receive TBC to your NFT account
6. Settlement is final and irreversible once included in a block

**Key implications for merchants:**
- You do NOT control the customer's private keys
- You CANNOT initiate a payment on a customer's behalf
- You CANNOT reverse a settled payment (settlement is immutable)
- Settlement confirmation comes from the blockchain, not from an intermediary

### 2.2 What Changes vs. Traditional Payments

| Aspect | Traditional Card Payment | TONBANKCARD TBC |
|--------|--------------------------|-----------------|
| Intermediary | Bank / PSP | None (direct on-chain) |
| Reversal mechanism | Chargeback via card network | None — refunds only |
| Settlement time | 1–3 business days | ~5 seconds (1 block) |
| Settlement currency | Fiat | TBC (with optional conversion) |
| Identity verification | Issuing bank handles | Your responsibility |
| Fraud protection | Card network + bank | Your responsibility |

---

## 3. Regulatory Assessment for Merchants

### 3.1 Key Questions

Before accepting TBC payments, assess:

1. **Is receiving TBC a regulated activity in my jurisdiction?** — In most jurisdictions, accepting cryptocurrency as payment for goods/services is not regulated (it's equivalent to accepting any asset as payment). However, some jurisdictions require registration if you routinely convert received crypto to fiat.

2. **Does my customer base require KYC?** — If you provide regulated financial services, or if your transaction volumes trigger AML thresholds, KYC may be required.

3. **What are my tax obligations?** — In most jurisdictions, TBC received as payment is taxable income (see Section 5).

4. **Do Travel Rule requirements apply?** — If you are a VASP (Virtual Asset Service Provider) as defined in your jurisdiction, Travel Rule may require you to collect and transmit sender information.

### 3.2 Merchant Categories and Typical Obligations

| Merchant Type | Typical Regulatory Obligation |
|--------------|-------------------------------|
| E-commerce (physical/digital goods) | Generally minimal — standard tax obligations |
| Financial services provider | AML/KYC, licensing, Travel Rule |
| Licensed gaming/gambling | Licensing, AML/KYC |
| Remittance services | MSB/VASP licensing, AML, Travel Rule |
| DeFi protocol operator | Jurisdiction-dependent, rapidly evolving |

---

## 4. AML/KYC for Institutional Merchants

### 4.1 When AML/KYC Is Required

AML/KYC obligations apply to your TBC payment acceptance if:
- You are regulated as a Virtual Asset Service Provider (VASP) in your jurisdiction
- You provide financial services to customers
- Your jurisdiction requires AML monitoring above certain transaction thresholds

### 4.2 Customer Due Diligence (CDD)

For merchants with CDD obligations, the following applies to TBC payments:

| CDD Tier | Trigger | Required Information |
|----------|---------|---------------------|
| Simplified | Low-risk customers, small transactions | Name, jurisdiction |
| Standard | All customers above threshold | Name, ID, wallet address, source of funds |
| Enhanced | High-risk customers, large transactions | Full EDD: source of wealth, PEP screening, ongoing monitoring |

**Note:** TONBANKCARD does not provide KYC infrastructure. You must implement KYC using your own processes or third-party providers before associating customer identity with their NFT wallet address.

### 4.3 Transaction Monitoring

For merchants with AML obligations:

- Monitor for unusual transaction patterns (sudden large amounts, structuring, etc.)
- Maintain records of all TBC transactions received (timestamp, amount, sender NFT address)
- Flag and investigate transactions that appear inconsistent with the customer's expected activity
- Report suspicious activity per local requirements

### 4.4 Travel Rule Compliance

If your jurisdiction's Travel Rule applies to virtual asset transfers:

| Transaction Direction | Obligation |
|----------------------|-----------|
| Receiving TBC from customer | Collect originator information (name, wallet address) from customer at payment initiation |
| Sending TBC (refunds, payouts) | Transmit originator + beneficiary information to receiving VASP if applicable |

**TONBANKCARD Travel Rule integration:** The protocol does not natively implement Travel Rule data transmission. Merchants subject to Travel Rule must implement data collection and transmission at the application layer (your integration layer), not at the protocol layer.

---

## 5. Tax Considerations

*Consult a tax professional for your jurisdiction. The following is general guidance, not tax advice.*

### 5.1 Receiving TBC as Payment

In most jurisdictions that tax cryptocurrencies:

- **Income recognition:** TBC received for goods/services is taxable income at the fair market value (TBC/fiat) at the time of receipt
- **Value determination:** Use a reputable price source (e.g., TONCO DEX price at time of transaction) to determine TBC fair market value
- **Record-keeping:** Maintain records of: transaction timestamp, TBC amount, TBC/fiat price at time of receipt, customer reference

### 5.2 Converting TBC to Fiat or Other Crypto

When you convert received TBC:
- The conversion is generally a separate taxable event
- Capital gains/loss = (proceeds from conversion) − (cost basis = fair market value at time of original receipt)
- Use FIFO, LIFO, or specific identification depending on your jurisdiction's rules

### 5.3 VAT/GST Considerations

- Receiving cryptocurrency as payment does not generally change VAT/GST obligations for the underlying sale
- The VAT/GST applies to the sale of goods/services; the payment method is TBC
- Convert TBC to local currency for VAT reporting using exchange rate at time of supply

---

## 6. Data Protection Obligations

### 6.1 What Data You Collect

When accepting TONBANKCARD payments, you typically collect:
- Customer NFT wallet address (public blockchain data)
- Order/invoice details (amount, description, orderId)
- Any personal data required for KYC (name, email, etc. — your responsibility)

### 6.2 GDPR / Data Protection Requirements

If you process EU customer personal data:
- Establish a lawful basis for processing (contract performance, legal obligation, legitimate interest)
- Provide clear privacy notice explaining what data you collect and why
- Do not store personal data beyond what is necessary for your purpose
- Enable customer rights (access, rectification, erasure for non-blockchain data)
- Implement appropriate security measures for off-chain personal data

**Note:** On-chain transaction data is public and immutable. You cannot delete on-chain data. Your privacy obligations apply to the off-chain data you collect (customer name, email, etc.).

---

## 7. Invoice & Record-Keeping Requirements

### 7.1 Invoice Best Practices

Implement invoice management with:

| Field | Requirement | Purpose |
|-------|-------------|---------|
| Invoice ID | Unique, non-reusable | Deduplication, audit trail |
| Customer NFT address | Required | On-chain correlation |
| TBC amount | Exact | Settlement matching |
| Order reference | Required | Business record |
| TBC/fiat rate at issuance | Recommended | Tax records |
| Invoice creation timestamp | Required | TTL, audit trail |
| Invoice expiry | Recommended (15–60 min) | Prevent stale invoices |

### 7.2 Settlement Records

After settlement, record:
- On-chain transaction hash (authoritative proof of payment)
- Block number and timestamp
- TBC amount received (from blockchain, not from customer claim)
- TBC/fiat rate at settlement time
- Mapping between invoice ID and transaction hash

**Record retention:** Retain transaction records for minimum 5–7 years (standard financial record retention, or per your jurisdiction's requirements).

### 7.3 Invoice Deduplication

The protocol does not enforce on-chain invoice uniqueness. You **must** implement deduplication:

```
// Required: idempotency check before processing
if (invoice_already_settled(invoice_id)) {
  return { status: 'already_settled', txHash: original_tx_hash };
}
```

---

## 8. Fraud Prevention

### 8.1 Verify On-Chain, Not Off-Chain

**Critical rule:** Only accept on-chain settlement as proof of payment. Do not fulfill orders based solely on:
- Wallet app screenshots
- Customer claims of payment
- Off-chain confirmations from intermediaries

**Correct flow:**
1. Customer initiates payment (wallet transaction)
2. Transaction appears on-chain (pending)
3. Wait for sufficient confirmations (recommended: 1–3 blocks for small amounts, 5+ blocks for large amounts)
4. Verify settlement against blockchain using SDK's `verifySettlement()` method
5. Fulfill order only after on-chain verification

### 8.2 Invoice Replay Protection

Implement server-side deduplication:
- Index all invoice IDs in your database with unique constraint
- When a settlement is received for invoice ID X, mark it as settled atomically
- Second settlement attempt for same invoice ID returns existing settlement data
- Never process the same invoice ID twice

### 8.3 Address Verification

Verify that the customer's payment came from the expected wallet:
- Record the customer's NFT address when they initiate payment
- After settlement, verify the on-chain sender matches the expected NFT address
- Alert on payments from unexpected addresses (possible phishing against customer)

### 8.4 Chargeback Simulation

TBC payments do not have chargebacks. However:
- If you offer refunds, implement refund as a new outgoing TBC transfer from your merchant NFT
- Maintain refund records separate from original settlement records
- Clearly communicate no-chargeback policy to customers in your terms of service

---

## 9. Technical Compliance Controls

### 9.1 SDK Integration for Compliance

Use the TONBANKCARD SDK's `verifySettlement()` for all settlement verification:

```typescript
const sdk = new TonbankcardSDK({
  network: 'mainnet',
  paymentHubAddress: YOUR_PAYMENT_HUB,
  apiEndpoint: YOUR_API,
});

// NEVER fulfill before verifying
const verification = await sdk.verifySettlement(txHash);
if (!verification.isValid || verification.confirmations < MIN_CONFIRMATIONS) {
  throw new Error('Settlement not confirmed');
}

// Now fulfill order
await fulfillOrder(orderId);
```

### 9.2 Audit Logging

Log all compliance-relevant events:
- Invoice created (with timestamp, amount, customer NFT address)
- Payment initiated (customer wallet link clicked)
- Settlement received (on-chain tx hash, block number)
- Order fulfilled (with settlement reference)
- Refund issued (if applicable)

Retain logs in tamper-evident storage.

### 9.3 Webhook Security

If using webhooks from external providers (NOWPayments, ChangeNOW):
- Verify HMAC signatures on all incoming webhooks
- Implement replay protection (timestamp + nonce validation)
- Never trust webhook payload alone — verify on-chain before acting
- Rate-limit webhook endpoints

---

## 10. Compliance Checklist

### Pre-Launch

- [ ] Legal assessment completed for target jurisdictions
- [ ] AML/KYC requirements assessed and implemented (if applicable)
- [ ] Tax reporting process established
- [ ] Privacy notice updated to include TBC payment data
- [ ] Invoice ID uniqueness enforced in database
- [ ] On-chain settlement verification implemented (not webhook-only)
- [ ] Chargeback policy disclosed in terms of service
- [ ] Refund process designed and documented
- [ ] Audit logging implemented and tested
- [ ] Webhook security (HMAC verification, replay protection) implemented

### Ongoing Operations

- [ ] Transaction records retained per jurisdiction requirements (5–7 years)
- [ ] TBC/fiat exchange rates recorded at time of each transaction
- [ ] Suspicious activity monitoring active (if AML-obligated)
- [ ] Customer KYC records updated (if applicable)
- [ ] Regular reconciliation between invoice records and on-chain settlements
- [ ] Monitor regulatory developments in target jurisdictions

---

## References

- **Regulatory Map:** [`docs/compliance/REGULATORY_MAP.md`](REGULATORY_MAP.md)
- **Legal Risk Model:** [`docs/compliance/LEGAL_RISK_MODEL.md`](LEGAL_RISK_MODEL.md)
- **Merchant API Spec:** [`docs/merchant-api-spec.md`](../merchant-api-spec.md)
- **Merchant Onboarding:** [`docs/merchants/onboarding-guide.md`](../merchants/onboarding-guide.md)
- **SDK Documentation:** [`sdk/README.md`](../../sdk/README.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
