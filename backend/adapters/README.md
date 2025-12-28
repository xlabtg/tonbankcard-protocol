# External Payment Providers Adapter

This module implements the adapter layer for integrating TONBANKCARD with external payment and exchange providers.

## ⚠️ Critical Security Principles

**TONBANKCARD IS NOT A CUSTODIAN**

This adapter layer:
- ✅ **DOES** orchestrate user-initiated operations
- ✅ **DOES** track transactions off-chain for user convenience
- ✅ **DOES** link operations to NFT Accounts for bookkeeping
- ❌ **DOES NOT** custody user funds at any point
- ❌ **DOES NOT** store or access private keys
- ❌ **DOES NOT** proxy money through TONBANKCARD
- ❌ **DOES NOT** have ability to modify recipient addresses
- ❌ **DOES NOT** have ability to hold or revert transactions

## Architecture Overview

```
User / Merchant
   ↓ (initiates operation)
TONBANKCARD NFT Account
   ↓ (on-chain event)
Adapter Service (this module)
   ↓ (API calls)
ChangeNOW / NOWPayments
   ↓ (direct to user wallet)
User receives funds
```

### What This Module Does

1. **Orchestration**: Coordinates between on-chain TON events and external APIs
2. **Indexing**: Tracks external transactions and maps them to NFT Accounts
3. **Status Monitoring**: Polls external providers for transaction updates
4. **Webhook Handling**: Receives and verifies callbacks from payment providers

### What This Module Does NOT Do

1. **Hold Funds**: All funds flow directly between user and provider
2. **Control Addresses**: Cannot modify where funds are sent
3. **Initiate Transfers**: Only users can initiate operations
4. **Store Keys**: No private keys are ever handled by this module

## Supported Providers

### 1. ChangeNOW

**Purpose**: Cryptocurrency swap and on/off-ramp service

**Supported Flows**:
- TON → External chain (BTC, ETH, etc.)
- External chain → TON
- TBC ↔ TON (via TONCO pool first)

**API Documentation**: [ChangeNOW API](https://changenow.io/api/docs)

### 2. NOWPayments

**Purpose**: Merchant cryptocurrency payment processing

**Supported Flows**:
- Customer pays merchant in crypto (TON/TBC)
- Payment tracked and linked to merchant's NFT Account
- Invoice generation and payment verification

**API Documentation**: [NOWPayments API](https://documenter.getpostman.com/view/7907941/S1a32n38)

### 3. CoinRabbit (Lending Adapter - Issue 6.2)

**Purpose**: Non-custodial coordination layer for external crypto lending

**Design Principles** (CRITICAL):
- **DOES NOT** issue loans
- **DOES NOT** custody collateral
- **DOES NOT** enforce repayments
- **DOES NOT** liquidate assets
- **DOES NOT** track debt
- Only provides identity resolution and lender metadata

**Supported Features**:
- NFT-based borrower identity resolution
- Read-only collateral signal verification
- Standardized metadata for lenders
- Optional UX deep-links

**Documentation**: [Lending Adapter Documentation](../../docs/lending-adapter.md)

## Installation

```bash
# Install dependencies (when package.json is added)
npm install
```

## Usage

### ChangeNOW Adapter

#### Creating a Swap

```typescript
import { createChangeNOWAdapter } from './adapters';

// Initialize adapter
const changeNow = createChangeNOWAdapter('your-api-key');

// Get quote first
const quote = await changeNow.getQuote(
  'ton',    // from currency
  'btc',    // to currency
  '100',    // amount
  'standard' // flow type
);

console.log(`You will receive approximately ${quote.estimatedAmount} BTC`);

// Create swap (user-initiated)
const swap = await changeNow.createSwap({
  fromCurrency: 'ton',
  toCurrency: 'btc',
  fromNetwork: 'ton',
  toNetwork: 'btc',
  fromAmount: '100',
  address: 'user-btc-address',  // USER'S destination address
  nftAccountId: '7777001',      // NFT Account for tracking
  flow: 'standard',
  refundAddress: 'user-ton-address', // USER'S refund address
});

console.log(`Send ${swap.fromAmount} TON to: ${swap.payinAddress}`);

// Track status
const status = await changeNow.trackSwapStatus(swap.id);
console.log(`Status: ${status.status}`);

// Map to NFT Account for off-chain storage
const txRecord = changeNow.mapSwapToNFTAccount(swap, '7777001');
// Store txRecord in your database for tracking
```

#### Fixed-Rate Flow

```typescript
// For fixed-rate exchanges (rate locked)
const swap = await changeNow.createSwap({
  fromCurrency: 'ton',
  toCurrency: 'eth',
  fromNetwork: 'ton',
  toNetwork: 'eth',
  fromAmount: '100',
  address: 'user-eth-address',
  nftAccountId: '7777001',
  flow: 'fixed-rate',  // Rate is locked
});
```

### NOWPayments Adapter

#### Creating a Payment Invoice

```typescript
import { createNOWPaymentsAdapter } from './adapters';

// Initialize adapter
const nowPayments = createNOWPaymentsAdapter(
  'your-api-key',
  'your-ipn-secret-key'  // For webhook verification
);

// Create invoice for merchant
const invoice = await nowPayments.createInvoice({
  price_amount: 100,
  price_currency: 'USD',
  pay_currency: 'ton',
  nftAccountId: '8888001',  // Merchant's NFT Account
  ipn_callback_url: 'https://your-backend.com/webhook',
  success_url: 'https://your-site.com/success',
  order_id: 'ORDER-123',
  order_description: 'Purchase of digital goods',
});

console.log(`Payment URL: ${invoice.invoice_url}`);
console.log(`Customer should pay ${invoice.pay_amount} ${invoice.pay_currency}`);

// Map to NFT Account for merchant bookkeeping
const txRecord = nowPayments.mapPaymentToNFTAccount(invoice, '8888001');
// Store txRecord in your database
```

#### Handling Webhooks

```typescript
// In your webhook endpoint
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-nowpayments-sig'];
  const payload = req.body;

  // Verify webhook authenticity
  const isValid = nowPayments.verifyCallback(payload, signature);

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process payment callback
  if (payload.payment_status === 'finished') {
    const txRecord = nowPayments.emitPaymentSettledEvent(
      payload,
      'merchant-nft-account-id'
    );

    // Update your database
    // Send confirmation to merchant
    // etc.
  }

  res.status(200).send('OK');
});
```

### CoinRabbit Lending Adapter

#### Resolving Borrower Identity

```typescript
import { createCoinRabbitAdapter } from './adapters';

// Initialize adapter
const coinRabbit = createCoinRabbitAdapter({
  affiliateId: 'your-affiliate-id',  // Optional
  chainId: 1,                         // TON mainnet
});

// Resolve borrower identity from NFT Account ID
const identity = await coinRabbit.resolveBorrowerIdentity('7777001');
console.log(`Valid: ${identity.isValid}`);
console.log(`Collection: ${identity.collectionAddress}`);
```

#### Creating a Loan Intent

```typescript
// Create loan intent (user-initiated only)
const intent = await coinRabbit.createLoanIntent({
  nftAccountId: '7777001',
  collateralSignalId: 'signal_abc123',  // From Issue 6.1
  requestedAmount: '5000',               // Informational only
  requestedCurrency: 'USDT',
  targetLender: 'coinrabbit',
});

console.log(`Intent ID: ${intent.intentId}`);
console.log(`Lender URL: ${intent.lenderUrl}`);

// Verification data for lender (includes disclaimer)
console.log(`Chain ID: ${intent.verificationData.chainId}`);
console.log(`Disclaimer: ${intent.verificationData.disclaimer}`);
```

#### Verifying Collateral Signal (Read-Only)

```typescript
// Lenders can verify collateral signals on-chain
const verification = await coinRabbit.verifyCollateralSignal({
  signalId: 'signal_abc123',
  nftAccountId: '7777001',
});

console.log(`Valid: ${verification.isValid}`);
console.log(`Ownership verified: ${verification.ownershipVerified}`);
// NOTE: Protocol makes NO guarantees - lender must verify on-chain
```

#### Tracking Loan References (Off-Chain)

```typescript
// Create off-chain reference for tracking
const reference = coinRabbit.createLoanReference(
  intent.intentId,
  '7777001',
  undefined,  // External loan ID (when available)
  'signal_abc123'
);

// Update when lender confirms (informational only)
const updated = coinRabbit.updateLoanReferenceStatus(
  reference,
  'active',
  { externalLoanId: 'coinrabbit_loan_xyz' }
);

// NOTE: Status is purely for UX - protocol does NOT enforce
```

## Data Model

### ExternalTransaction

Off-chain record linking external provider operations to NFT Accounts:

```typescript
interface ExternalTransaction {
  provider: 'ChangeNOW' | 'NOWPayments';
  providerTxId: string;          // Provider's transaction ID
  nftAccountId: string;          // Associated NFT Account
  amountIn: string;              // Input amount
  amountOut: string;             // Output amount
  assetIn: string;               // Input asset (e.g., 'ton')
  assetOut: string;              // Output asset (e.g., 'btc')
  status: TransactionStatus;     // Current status
  tonTxHash?: string;            // TON tx hash if applicable
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}
```

This record should be stored in your off-chain database (PostgreSQL, MongoDB, etc.) for:
- User transaction history
- Merchant accounting
- Status monitoring
- Analytics

## Error Handling

All adapter methods throw `ProviderError` on failure:

```typescript
try {
  const swap = await changeNow.createSwap(request);
} catch (error) {
  if (error.provider === 'ChangeNOW') {
    console.error(`ChangeNOW error: ${error.message}`);
    console.error(`Status code: ${error.statusCode}`);
    console.error(`Error code: ${error.code}`);
  }
}
```

## Security Considerations

### API Keys

- **NEVER** commit API keys to version control
- Store keys in environment variables or secure secret management
- Rotate keys regularly
- Use separate keys for development/production

### Webhook Verification

Always verify webhook signatures:

```typescript
// NOWPayments webhooks
const isValid = nowPayments.verifyCallback(payload, signature);
if (!isValid) {
  // Reject the webhook
  throw new Error('Invalid webhook signature');
}
```

### Address Validation

Always validate destination addresses before creating swaps/payments:

```typescript
// Validate user-provided addresses
function validateTONAddress(address: string): boolean {
  // Implement TON address validation
  return /^[A-Za-z0-9_-]{48}$/.test(address);
}

const destinationAddress = userInput.address;
if (!validateTONAddress(destinationAddress)) {
  throw new Error('Invalid TON address');
}
```

### Rate Limiting

Implement rate limiting to prevent API quota exhaustion:

```typescript
// Example using simple in-memory rate limiter
const rateLimiter = new Map<string, number>();

function checkRateLimit(nftAccountId: string, maxPerHour: number): boolean {
  const now = Date.now();
  const key = `${nftAccountId}-${Math.floor(now / 3600000)}`;
  const count = rateLimiter.get(key) || 0;

  if (count >= maxPerHour) {
    return false;
  }

  rateLimiter.set(key, count + 1);
  return true;
}
```

## Testing

See the `examples/adapters` and `experiments/adapters` directories for test scripts.

### Running Examples

```bash
# ChangeNOW example
node examples/adapters/changenow-example.js

# NOWPayments example
node examples/adapters/nowpayments-example.js

# CoinRabbit lending adapter example
ts-node examples/adapters/coinrabbit-example.ts

# CoinRabbit tests
ts-node experiments/adapters/test-coinrabbit.ts
```

## Acceptance Criteria

- [x] Adapter works without custody
- [x] All operations are user-initiated
- [x] Each operation maps to NFT Account
- [x] Webhook verification implemented
- [x] Error and timeout handling
- [x] Documentation with examples

## References

- [TONBANKCARD Architecture](../../docs/architecture.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [ChangeNOW API Documentation](https://changenow.io/api/docs)
- [NOWPayments API Documentation](https://documenter.getpostman.com/view/7907941/S1a32n38)
- [NOWPayments Blog: API Usage](https://nowpayments.io/blog/how-to-use-your-nowpayments-payment-api-to-the-full-extent)

## License

Same as TONBANKCARD protocol (TBD)
