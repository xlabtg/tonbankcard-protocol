# Security Guarantees

This document outlines the security principles and guarantees of the TONBANKCARD Merchant SDK.

---

## 🔐 Core Security Principles

### 1. Non-Custodial by Design

The SDK **NEVER**:
- Stores private keys or mnemonics
- Signs transactions
- Has custody of user funds
- Acts as a payment authority
- Overrides user consent

The SDK **ONLY**:
- Creates informational invoices (no on-chain state)
- Generates wallet deep links (user must approve)
- Verifies settlements on-chain (read-only)
- Queries account information (read-only)

### 2. Blockchain as Source of Truth

All authoritative operations rely on:
- On-chain smart contract state
- Cryptographically signed transactions
- Block confirmations
- Immutable event logs

**Never trust:**
- Off-chain databases alone
- API responses without verification
- Unconfirmed transactions
- Client-side claims

### 3. User Sovereignty

Users maintain complete control:
- Only user wallet can sign transactions
- Users review all payment details before approval
- Transactions require explicit user consent
- No pre-authorization or automatic charges

---

## 🛡️ What This SDK Does NOT Do

### No Signing Logic
```typescript
// ❌ SDK does NOT have these methods:
sdk.sign()
sdk.signTransaction()
sdk.executePayment()
sdk.sendTransaction()
```

### No Key Storage
```typescript
// ❌ SDK does NOT store:
privateKey
mnemonic
seed
keyPair
```

### No Custody
```typescript
// ❌ SDK does NOT:
- Hold user funds
- Lock funds
- Pre-authorize payments
- Have withdrawal authority
```

### No Trust Assumptions
```typescript
// ❌ SDK does NOT:
- Trust API responses without verification
- Cache balances (always query fresh)
- Assume transaction finality prematurely
- Hide protocol rules from developers
```

---

## ✅ Security Guarantees

### 1. Read-Only Operations

All SDK methods are **read-only** with respect to funds:

```typescript
// ✓ Safe: Creates informational invoice (no on-chain state)
const invoice = sdk.createInvoice({...});

// ✓ Safe: Generates link (user must approve in wallet)
const link = sdk.generateWalletLink({invoice});

// ✓ Safe: Queries blockchain (read-only)
const status = await sdk.getInvoiceStatus(invoiceId);

// ✓ Safe: Verifies on-chain (read-only)
const verification = await sdk.verifySettlement(txHash);
```

### 2. Invoice Creation is Non-Authoritative

Invoices created by the SDK:
- Are NOT recorded on-chain
- Do NOT lock funds
- Do NOT grant payment authority
- Are purely informational

**Merchants must:**
- Store invoices in their own database
- Verify settlements independently on-chain
- Not treat invoice creation as payment confirmation

### 3. Settlement Verification is Authoritative

The `verifySettlement()` method:
- Queries blockchain directly
- Checks transaction validity
- Counts confirmations
- Returns cryptographic proof

**Recommended:**
- Wait for at least 5 confirmations
- Verify transaction matches invoice parameters
- Check for reorgs on high-value payments

### 4. Wallet Links Require User Approval

Generated wallet links:
- Open user's wallet with pre-filled data
- Require explicit user approval
- Cannot execute without user signature
- Show all payment details to user

**Users see:**
- Recipient address (merchant NFT)
- Amount to be paid
- Payment description
- All transaction details

---

## 🚨 Security Best Practices

### For Merchants

1. **Always Verify On-Chain**
   ```typescript
   // ✓ Good: Verify settlement on-chain
   const verification = await sdk.verifySettlement(txHash);
   if (verification.isValid && verification.confirmations >= 5) {
     grantAccess();
   }

   // ✗ Bad: Trust client-side claim alone
   if (userClaims.paid) {
     grantAccess(); // NEVER DO THIS
   }
   ```

2. **Wait for Confirmations**
   ```typescript
   // ✓ Good: Wait for sufficient confirmations
   if (verification.confirmations >= 5) {
     // Safe to grant access
   }

   // ✗ Bad: Accept 0 confirmations
   if (verification.confirmations >= 0) {
     // Risk of reorg
   }
   ```

3. **Handle Reorgs**
   ```typescript
   // For high-value payments, periodically re-verify
   setInterval(async () => {
     const verification = await sdk.verifySettlement(txHash);
     if (!verification.isValid) {
       // Transaction was reorganized out
       revokeAccess();
     }
   }, 60000); // Check every minute
   ```

4. **Validate Addresses**
   ```typescript
   // ✓ Good: Validate before use
   if (!isValidTonAddress(merchantNft)) {
     throw new Error('Invalid merchant address');
   }

   // Store expected merchant address securely
   const EXPECTED_MERCHANT = 'EQ...YourMerchantNFT';
   if (invoice.merchantNft.toString() !== EXPECTED_MERCHANT) {
     throw new Error('Wrong merchant address');
   }
   ```

5. **Store Invoices Securely**
   ```typescript
   // Store invoices in your database
   await db.invoices.insert({
     id: invoice.id,
     orderId: invoice.orderId,
     amount: invoice.amountTbc,
     createdAt: invoice.createdAt,
     expiresAt: invoice.expiresAt,
   });

   // Verify invoice exists before processing
   const storedInvoice = await db.invoices.findById(invoiceId);
   if (!storedInvoice) {
     throw new Error('Invalid invoice');
   }
   ```

### For Users

1. **Always Review Payment Details**
   - Check recipient address matches expected merchant
   - Verify amount is correct
   - Read payment description
   - Ensure it's the right transaction

2. **Use Trusted Wallets**
   - Use well-known TON wallets
   - Keep wallet software updated
   - Verify wallet authenticity

3. **Understand Finality**
   - Blockchain transactions are irreversible
   - No chargebacks exist
   - Double-check before approving

4. **Check Merchant Address**
   ```
   Expected: EQ...YourMerchantNFT
   Actual:   EQ...YourMerchantNFT

   ✓ Addresses match - safe to proceed
   ✗ Addresses differ - DO NOT PAY
   ```

---

## 🔍 Threat Model

### In Scope

The SDK protects against:
- Unauthorized payments (user must approve)
- Key theft (no keys stored)
- Man-in-the-middle (on-chain verification)
- Replay attacks (deterministic invoice IDs)
- Balance manipulation (read-only queries)

### Out of Scope

The SDK does NOT protect against:
- Compromised user wallets (user responsibility)
- Phishing sites (user must verify URLs)
- Smart contract vulnerabilities (contract audit required)
- Malicious merchants (user must verify merchant)
- Network attacks on TON blockchain itself

### Shared Responsibility

```
Merchant Responsibilities:
- Verify settlements on-chain
- Store invoices securely
- Validate merchant addresses
- Handle edge cases (reorgs, expirations)
- Comply with regulations

User Responsibilities:
- Use trusted wallets
- Review transaction details
- Verify merchant authenticity
- Keep wallet credentials secure

SDK Responsibilities:
- No custody or signing
- Read-only operations
- On-chain verification
- Cryptographic correctness
```

---

## 📋 Security Checklist

Before deploying to production:

- [ ] Payment Hub contract is audited
- [ ] Merchant NFT address is verified and stored securely
- [ ] Invoice verification logic is tested
- [ ] Reorg handling is implemented for high-value payments
- [ ] Error handling is comprehensive
- [ ] Timeouts and retries are configured
- [ ] Logs do not contain sensitive data
- [ ] API endpoints use HTTPS
- [ ] Rate limiting is in place
- [ ] Monitoring and alerts are configured

---

## 🐛 Reporting Security Issues

**DO NOT** disclose security vulnerabilities publicly.

To report a security issue:
1. Email: security@tonbankcard.com
2. Include detailed reproduction steps
3. Allow time for patch before disclosure
4. Follow responsible disclosure practices

---

## 📄 Security Assumptions

This SDK assumes:
1. TON blockchain is secure and operational
2. Payment Hub contract is correctly implemented
3. User wallets are not compromised
4. TLS/HTTPS protects API communications
5. Merchant servers are secure

If any assumption is violated, security guarantees may not hold.

---

## ⚖️ Disclaimer

This SDK is provided "as is" without warranty of any kind. Users and merchants assume all risk. The SDK authors are not liable for:

- Lost or stolen funds
- Smart contract bugs
- Integration errors
- Blockchain failures
- Regulatory violations

Always perform your own security audit before production use.

---

**Last Updated:** 2024-12-27

**Security Contact:** security@tonbankcard.com
