# TONBANKCARD Merchant SDK

A lightweight, **non-custodial** SDK for integrating TONBANKCARD payments into websites and applications.

[![NPM Version](https://img.shields.io/npm/v/@tonbankcard/merchant-sdk)](https://www.npmjs.com/package/@tonbankcard/merchant-sdk)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TON](https://img.shields.io/badge/TON-Blockchain-0088cc)](https://ton.org)

---

## 🔐 Security Guarantees

This SDK is **NON-CUSTODIAL** by design:

- ✅ **READ-ONLY** with respect to funds
- ✅ **NEVER signs transactions**
- ✅ **NEVER stores private keys**
- ✅ **NEVER acts as a payment authority**
- ✅ **Blockchain is the ONLY source of truth**

Any feature that violates these principles will be rejected.

---

## 🎯 What This SDK Does

The SDK provides convenience methods for:

1. **Invoice Creation**: Generate payment requests (informational only)
2. **Wallet Deep Links**: Create TON Connect links for user wallets
3. **On-Chain Verification**: Verify payment settlement trustlessly
4. **Account Queries**: Read account balances and states

---

## 🚫 What This SDK Does NOT Do

- ❌ Execute payments (requires user wallet)
- ❌ Store private keys or mnemonics
- ❌ Have custody of funds
- ❌ Override user consent
- ❌ Hide protocol rules

---

## 📦 Installation

```bash
npm install @tonbankcard/merchant-sdk
```

Or with yarn:

```bash
yarn add @tonbankcard/merchant-sdk
```

---

## 🚀 Quick Start

```typescript
import { TonbankcardSDK, TESTNET_CONFIG, parseTBC } from '@tonbankcard/merchant-sdk';
import { Address } from '@ton/core';

// 1. Initialize SDK
const sdk = new TonbankcardSDK({
  ...TESTNET_CONFIG,
  paymentHubAddress: Address.parse('EQ...YourPaymentHub'),
});

// 2. Create an invoice
const invoice = sdk.createInvoice({
  merchantNft: Address.parse('EQ...YourMerchantNFT'),
  amountTbc: parseTBC('10.50'), // 10.50 TBC
  orderId: 'ORDER-12345',
  description: 'Premium Subscription',
  expirationSeconds: 3600, // 1 hour
});

// 3. Generate payment link
const paymentLink = sdk.generateWalletLink({
  invoice,
  returnUrl: 'https://your-site.com/success',
});

console.log('Payment link:', paymentLink);
// User opens link in their wallet and approves payment

// 4. Verify payment on-chain
const status = await sdk.getInvoiceStatus(invoice.id);
if (status === 'settled') {
  console.log('Payment confirmed!');
}
```

---

## 🧩 API Reference

### Initialize SDK

```typescript
const sdk = new TonbankcardSDK({
  network: 'mainnet' | 'testnet',
  paymentHubAddress: Address,  // Payment Hub contract address
  rpcEndpoint?: string,        // Optional custom RPC
  apiEndpoint?: string,        // Optional API for invoice storage
});
```

### Create Invoice

```typescript
const invoice = sdk.createInvoice({
  merchantNft: Address,        // Your merchant NFT account
  amountTbc: bigint,          // Amount in nanocoins (1 TBC = 10^9)
  orderId?: string,           // Optional order ID
  description?: string,       // Optional description
  metadata?: object,          // Optional metadata
  expirationSeconds?: number, // Optional expiration time
});
```

**Returns:** `Invoice` object

**Security:** This does NOT lock funds or create on-chain state. It's a reference for the user's wallet.

### Generate Wallet Link

```typescript
const link = sdk.generateWalletLink({
  invoice: Invoice,
  returnUrl?: string,
});
```

**Returns:** TON Connect deep link

**Security:** Opening this link does NOT execute payment. User MUST approve in their wallet.

### Get Invoice Status

```typescript
const status = await sdk.getInvoiceStatus(invoiceId);
```

**Returns:** `'pending' | 'settled' | 'failed' | 'expired'`

**Security:** Queries blockchain for authoritative settlement status.

### Verify Settlement

```typescript
const verification = await sdk.verifySettlement(txHash);
```

**Returns:** `TransactionVerification` with:
- `isValid: boolean` - Transaction is valid
- `confirmations: number` - Block confirmations
- `matchesInvoice: boolean` - Matches invoice parameters
- `error?: string` - Error message if failed

**Security:** This is the AUTHORITATIVE verification method. Only on-chain data is trusted.

### Get Account Info

```typescript
const accountInfo = await sdk.getAccountInfo(nftAddress);
```

**Returns:** `AccountInfo` with:
- `balance: bigint` - TBC balance
- `state: AccountState` - Account state
- `canSend: boolean` - Can send payments
- `canReceive: boolean` - Can receive payments

**Security:** Read-only query, cannot modify account.

---

## 🎓 Examples

### Simple Checkout Flow

See [examples/simple-checkout.ts](./examples/simple-checkout.ts)

```typescript
// Create invoice
const invoice = sdk.createInvoice({
  merchantNft: Address.parse('EQ...Merchant'),
  amountTbc: parseTBC('10.50'),
  orderId: 'ORDER-123',
  description: 'Premium Plan',
});

// Generate payment link
const link = sdk.generateWalletLink({ invoice });

// Show link to user (QR code, button, etc.)
// Wait for payment confirmation
const status = await sdk.getInvoiceStatus(invoice.id);
```

### Payment Verification

See [examples/payment-verification.ts](./examples/payment-verification.ts)

```typescript
// User provides transaction hash
const txHash = 'abc123...';

// Verify on-chain
const verification = await sdk.verifySettlement(txHash);

if (verification.isValid && verification.confirmations >= 5) {
  // Payment confirmed with sufficient confirmations
  grantAccess();
}
```

### Webhook-less Verification

See [examples/webhook-less-verification.ts](./examples/webhook-less-verification.ts)

Perfect for static sites and serverless apps:

```typescript
// Poll for payment (client-side)
const pollForPayment = async (invoiceId) => {
  for (let i = 0; i < 60; i++) {
    const status = await sdk.getInvoiceStatus(invoiceId);
    if (status === 'settled') return true;
    await sleep(5000); // Wait 5 seconds
  }
  return false;
};
```

---

## 🧠 Architecture

### Trust Model

```
User Wallet ←→ TON Blockchain ←→ Merchant
     ↓              ↓              ↓
  Signs TX    Source of Truth   Verifies
```

- **User trusts:** Their wallet (self-custody)
- **Merchant trusts:** Blockchain (cryptographic proof)
- **SDK role:** Convenience wrapper (NO authority)

### Integration Flow

```
1. Merchant creates invoice (SDK)
   ↓
2. User scans QR / clicks link
   ↓
3. Wallet opens with pre-filled data
   ↓
4. User reviews and approves
   ↓
5. Wallet signs & broadcasts transaction
   ↓
6. Payment Hub settles on-chain
   ↓
7. Merchant verifies settlement (SDK)
```

---

## 🔒 Security Considerations

### What Merchants Should Know

1. **Invoice IDs are NOT secrets**: They're deterministic hashes, safe to share publicly

2. **Always verify on-chain**: Never trust off-chain confirmation alone

3. **Wait for confirmations**: Recommended minimum: 5 blocks

4. **Handle reorgs**: Check transaction status periodically for high-value payments

5. **No pre-authorization**: Users can't be charged without explicit consent

### What Users Should Know

1. **Review all payment details** in your wallet before approving

2. **SDK cannot access your funds**: Only you can authorize payments

3. **Transactions are final**: No chargebacks (it's blockchain)

4. **Check merchant address**: Verify it's the correct merchant NFT

---

## 🛠 Utilities

### Format & Parse TBC

```typescript
import { formatTBC, parseTBC } from '@tonbankcard/merchant-sdk';

const nanocoins = parseTBC('10.50');  // bigint(10500000000)
const formatted = formatTBC(nanocoins); // "10.50"
```

### Address Validation

```typescript
import { isValidTonAddress } from '@tonbankcard/merchant-sdk';

if (isValidTonAddress(addressString)) {
  // Valid TON address
}
```

### Short Address Display

```typescript
import { shortAddress } from '@tonbankcard/merchant-sdk';

const short = shortAddress(address); // "EQAjHk...3il-Le"
```

---

## 📚 TypeScript Support

This SDK is written in TypeScript with full type definitions:

```typescript
import type {
  Invoice,
  PaymentStatus,
  AccountInfo,
  TransactionVerification,
} from '@tonbankcard/merchant-sdk';
```

---

## 🧪 Testing

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

---

## 🤝 Contributing

Contributions must align with **non-custodial principles**:

- No custody or signing logic
- No hidden authority
- Read-only SDK operations only
- Blockchain as source of truth

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🔗 Links

- [Protocol Documentation](../docs/architecture.md)
- [Payment Hub Specification](../contracts/payments/README.md)
- [Issue 5.1: Merchant API](https://github.com/xlabtg/tonbankcard-protocol/issues/24)
- [Issue 5.2: Merchant SDK](https://github.com/xlabtg/tonbankcard-protocol/issues/26)
- [TON Documentation](https://docs.ton.org/)

---

## ⚠️ Disclaimer

This SDK is provided "as is" without warranty. It is the merchant's responsibility to:

- Verify payment settlement on-chain
- Handle edge cases (reorgs, failed transactions, etc.)
- Comply with local regulations
- Secure their merchant NFT account

The SDK authors are not liable for:
- Lost funds due to misuse
- Incorrect integration
- Blockchain issues
- Smart contract vulnerabilities

Always verify settlements using multiple independent sources for high-value transactions.

---

**Built on TON. Owned by users.**
