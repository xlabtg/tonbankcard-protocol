# Merchant Integration Guide

This guide demonstrates how to integrate the Tonbankcard Merchant API into your website or application to accept TBC payments.

**Issue**: [#24 — Merchant API (Non-Custodial Payment Orchestration)](https://github.com/xlabtg/tonbankcard-protocol/issues/24)

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Integration Steps](#integration-steps)
3. [Code Examples](#code-examples)
4. [Best Practices](#best-practices)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Merchant NFT card address (from Tonbankcard)
- API key (obtained from merchant dashboard)
- Node.js or Python environment (for backend)
- HTTPS-enabled website (required for production)

### Installation

```bash
# Node.js / TypeScript
npm install @tonbankcard/merchant-api

# Python
pip install tonbankcard-merchant-api
```

---

## Integration Steps

### Step 1: Create Invoice

When a customer initiates checkout, create an invoice via the API:

```typescript
import { MerchantApiClient } from '@tonbankcard/merchant-api';

const client = new MerchantApiClient({
  apiKey: process.env.TONBANKCARD_API_KEY,
  baseUrl: 'https://api.tonbankcard.io/v1',
});

// Create invoice
const invoice = await client.createInvoice({
  merchant_nft: 'EQAbc123...', // Your merchant NFT address
  amount_tbc: '1000000000',    // 1 TBC in nanocoins
  currency: 'TBC',
  metadata: {
    order_id: 'ORDER-12345',
    description: 'Premium subscription (1 month)',
    customer_email: 'customer@example.com',
  },
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
});

console.log('Invoice created:', invoice.invoice_id);
console.log('Payment URL:', invoice.payment_url);
```

### Step 2: Display Payment Link

Show the payment link to the customer:

```html
<!-- QR Code for mobile -->
<div id="payment-qr">
  <img src="https://api.qrserver.com/v1/create-qr-code/?data={payment_url}&size=200x200" />
  <p>Scan with TON Wallet to pay</p>
</div>

<!-- Or clickable button -->
<a href="{payment_url}" class="btn-pay-tbc">
  Pay with TBC
</a>
```

### Step 3: Wait for Settlement

Poll the API or use webhooks (future) to detect payment settlement:

```typescript
async function waitForPayment(invoiceId: string): Promise<void> {
  const maxAttempts = 60; // 5 minutes
  const interval = 5000;  // 5 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const status = await client.getInvoiceStatus(invoiceId);

    if (status.status === 'settled') {
      console.log('Payment confirmed!');
      console.log('TX Hash:', status.settlement.tx_hash);
      console.log('Block:', status.settlement.block_number);

      // Fulfill order
      await fulfillOrder(orderId);
      return;
    }

    if (status.status === 'expired') {
      throw new Error('Invoice expired before payment');
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Payment timeout');
}
```

### Step 4: Verify On-Chain (Recommended)

For high-value transactions, independently verify settlement on the blockchain:

```typescript
import { TonClient } from '@ton/ton';

async function verifySettlementOnChain(settlement: Settlement): Promise<boolean> {
  const tonClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  });

  // Get transaction by hash
  const tx = await tonClient.getTransaction(settlement.tx_hash);

  // Verify transaction details
  if (!tx) {
    return false;
  }

  // Check transaction is confirmed
  const latestBlock = await tonClient.getLatestBlock();
  const confirmations = latestBlock - settlement.block_number;

  if (confirmations < 6) {
    console.warn('Settlement not fully confirmed yet');
    return false;
  }

  // Verify amounts and addresses
  // (implementation depends on transaction structure)

  return true;
}
```

---

## Code Examples

### Example 1: E-commerce Checkout

```typescript
// routes/checkout.ts
import express from 'express';
import { MerchantApiClient } from '@tonbankcard/merchant-api';

const router = express.Router();
const merchantApi = new MerchantApiClient({
  apiKey: process.env.TONBANKCARD_API_KEY!,
});

router.post('/checkout', async (req, res) => {
  const { cart, customerEmail } = req.body;

  // Calculate total
  const totalTbc = calculateTotal(cart);

  // Create invoice
  const invoice = await merchantApi.createInvoice({
    merchant_nft: process.env.MERCHANT_NFT!,
    amount_tbc: totalTbc,
    currency: 'TBC',
    metadata: {
      order_id: generateOrderId(),
      description: `Order of ${cart.length} items`,
      customer_email: customerEmail,
      cart_items: JSON.stringify(cart),
    },
  });

  // Store invoice ID in database
  await db.orders.create({
    order_id: invoice.metadata.order_id,
    invoice_id: invoice.invoice_id,
    customer_email: customerEmail,
    amount_tbc: totalTbc,
    status: 'pending',
  });

  // Return payment URL to frontend
  res.json({
    invoice_id: invoice.invoice_id,
    payment_url: invoice.payment_url,
    amount_tbc: totalTbc,
    expires_at: invoice.expires_at,
  });
});

export default router;
```

### Example 2: Payment Status Webhook Handler

```typescript
// routes/webhooks.ts (future feature)
import express from 'express';

const router = express.Router();

router.post('/webhook/payment-settled', async (req, res) => {
  // Verify webhook signature (future feature)
  const signature = req.headers['x-tonbankcard-signature'];
  if (!verifyWebhookSignature(signature, req.body)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { invoice_id, settlement } = req.body;

  // Get order from database
  const order = await db.orders.findOne({ invoice_id });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Update order status
  await db.orders.update(order.id, {
    status: 'paid',
    settlement_tx: settlement.tx_hash,
    settlement_block: settlement.block_number,
    paid_at: settlement.timestamp,
  });

  // Fulfill order (ship product, grant access, etc.)
  await fulfillOrder(order);

  res.json({ status: 'ok' });
});

export default router;
```

### Example 3: Python Integration

```python
from tonbankcard import MerchantApiClient
import os
import time

# Initialize client
client = MerchantApiClient(
    api_key=os.environ['TONBANKCARD_API_KEY'],
    base_url='https://api.tonbankcard.io/v1'
)

# Create invoice
invoice = client.create_invoice(
    merchant_nft=os.environ['MERCHANT_NFT'],
    amount_tbc='1000000000',  # 1 TBC
    currency='TBC',
    metadata={
        'order_id': 'ORDER-12345',
        'description': 'Premium subscription',
    }
)

print(f"Invoice created: {invoice['invoice_id']}")
print(f"Payment URL: {invoice['payment_url']}")

# Wait for payment
def wait_for_payment(invoice_id: str, timeout: int = 300) -> dict:
    start_time = time.time()

    while time.time() - start_time < timeout:
        status = client.get_invoice_status(invoice_id)

        if status['status'] == 'settled':
            print("Payment confirmed!")
            return status['settlement']

        if status['status'] == 'expired':
            raise Exception("Invoice expired")

        time.sleep(5)

    raise TimeoutError("Payment timeout")

# Wait for settlement
settlement = wait_for_payment(invoice['invoice_id'])
print(f"TX Hash: {settlement['tx_hash']}")
print(f"Block: {settlement['block_number']}")
```

### Example 4: React Frontend

```tsx
// components/PaymentButton.tsx
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentButtonProps {
  orderId: string;
  amountTbc: string;
  description: string;
  onPaymentComplete: (settlement: any) => void;
}

export function PaymentButton({
  orderId,
  amountTbc,
  description,
  onPaymentComplete,
}: PaymentButtonProps) {
  const [invoice, setInvoice] = useState(null);
  const [status, setStatus] = useState('pending');
  const [showQr, setShowQr] = useState(false);

  async function createInvoice() {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        amount_tbc: amountTbc,
        description,
      }),
    });

    const data = await response.json();
    setInvoice(data);
    startPolling(data.invoice_id);
  }

  async function startPolling(invoiceId: string) {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/invoice/${invoiceId}/status`);
      const data = await response.json();

      if (data.status === 'settled') {
        clearInterval(interval);
        setStatus('settled');
        onPaymentComplete(data.settlement);
      }

      if (data.status === 'expired') {
        clearInterval(interval);
        setStatus('expired');
      }
    }, 5000);
  }

  if (status === 'settled') {
    return <div className="payment-success">✓ Payment Confirmed!</div>;
  }

  if (status === 'expired') {
    return <div className="payment-expired">Invoice expired. Please try again.</div>;
  }

  if (!invoice) {
    return (
      <button onClick={createInvoice} className="btn-pay">
        Pay with TBC
      </button>
    );
  }

  return (
    <div className="payment-modal">
      <h3>Scan to Pay</h3>
      <QRCodeSVG value={invoice.payment_url} size={256} />
      <p>{amountTbc} TBC</p>
      <a href={invoice.payment_url} target="_blank" className="btn-wallet">
        Open Wallet
      </a>
      <p className="status">Waiting for payment...</p>
    </div>
  );
}
```

---

## Best Practices

### Security

1. **Never expose API keys client-side**
   - Store API keys in environment variables
   - Use server-side API calls only
   - Rotate keys periodically

2. **Validate webhook signatures** (when available)
   ```typescript
   const crypto = require('crypto');

   function verifyWebhookSignature(signature: string, payload: any): boolean {
     const secret = process.env.WEBHOOK_SECRET;
     const expectedSignature = crypto
       .createHmac('sha256', secret)
       .update(JSON.stringify(payload))
       .digest('hex');

     return crypto.timingSafeEqual(
       Buffer.from(signature),
       Buffer.from(expectedSignature)
     );
   }
   ```

3. **Independently verify high-value settlements**
   - Don't rely solely on API responses
   - Query blockchain directly for critical transactions
   - Wait for sufficient confirmations (≥6 blocks)

### Performance

1. **Use database for invoice tracking**
   ```sql
   CREATE TABLE invoices (
     id SERIAL PRIMARY KEY,
     invoice_id VARCHAR(32) UNIQUE NOT NULL,
     order_id VARCHAR(64) NOT NULL,
     merchant_nft VARCHAR(48) NOT NULL,
     amount_tbc VARCHAR(40) NOT NULL,
     status VARCHAR(20) NOT NULL,
     created_at TIMESTAMP NOT NULL,
     expires_at TIMESTAMP NOT NULL,
     settlement_tx VARCHAR(64),
     settlement_block INTEGER,
     INDEX (order_id),
     INDEX (status),
     INDEX (created_at)
   );
   ```

2. **Implement caching**
   ```typescript
   import Redis from 'ioredis';

   const redis = new Redis();

   async function getInvoiceWithCache(invoiceId: string) {
     // Check cache first
     const cached = await redis.get(`invoice:${invoiceId}`);
     if (cached) {
       return JSON.parse(cached);
     }

     // Fetch from API
     const invoice = await merchantApi.getInvoice(invoiceId);

     // Cache for 1 minute
     await redis.setex(`invoice:${invoiceId}`, 60, JSON.stringify(invoice));

     return invoice;
   }
   ```

3. **Use background jobs for polling**
   ```typescript
   import { Queue, Worker } from 'bullmq';

   const paymentQueue = new Queue('payments');

   // Add job when invoice created
   await paymentQueue.add('check-payment', {
     invoice_id: invoice.invoice_id,
     order_id: order.id,
   });

   // Worker to check payment status
   new Worker('payments', async (job) => {
     const { invoice_id } = job.data;
     const status = await merchantApi.getInvoiceStatus(invoice_id);

     if (status.status === 'settled') {
       await fulfillOrder(job.data.order_id);
       return { settled: true };
     }

     if (status.status === 'pending') {
       // Re-queue with delay
       await job.updateProgress(50);
       throw new Error('Not settled yet'); // Will retry
     }
   });
   ```

### Error Handling

1. **Handle network failures gracefully**
   ```typescript
   async function createInvoiceWithRetry(params: CreateInvoiceRequest) {
     const maxRetries = 3;
     let lastError;

     for (let i = 0; i < maxRetries; i++) {
       try {
         return await merchantApi.createInvoice(params);
       } catch (error) {
         lastError = error;

         // Don't retry client errors (4xx)
         if (error.code >= 400 && error.code < 500) {
           throw error;
         }

         // Exponential backoff
         await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
       }
     }

     throw lastError;
   }
   ```

2. **Log all API interactions**
   ```typescript
   import winston from 'winston';

   const logger = winston.createLogger({
     level: 'info',
     format: winston.format.json(),
     transports: [
       new winston.transports.File({ filename: 'merchant-api.log' }),
     ],
   });

   async function loggedCreateInvoice(params: CreateInvoiceRequest) {
     logger.info('Creating invoice', { params });

     try {
       const invoice = await merchantApi.createInvoice(params);
       logger.info('Invoice created', { invoice_id: invoice.invoice_id });
       return invoice;
     } catch (error) {
       logger.error('Failed to create invoice', { error, params });
       throw error;
     }
   }
   ```

---

## Testing

### Testnet Setup

Use testnet for development and testing:

```typescript
const client = new MerchantApiClient({
  apiKey: process.env.TESTNET_API_KEY,
  baseUrl: 'https://api-testnet.tonbankcard.io/v1',
});

// Use testnet NFT addresses
const TESTNET_MERCHANT_NFT = 'kQTest123...';
```

### Unit Tests

```typescript
import { describe, it, expect } from '@jest/globals';
import { createInvoice, getInvoiceStatus } from './merchant-service';

describe('Merchant Integration', () => {
  it('should create invoice successfully', async () => {
    const invoice = await createInvoice({
      merchant_nft: 'EQTest123...',
      amount_tbc: '1000000000',
      currency: 'TBC',
      metadata: { order_id: 'TEST-001' },
    });

    expect(invoice.invoice_id).toMatch(/^inv_[a-f0-9]{16}$/);
    expect(invoice.status).toBe('pending');
  });

  it('should detect settled payment', async () => {
    const invoice = await createInvoice({ /* ... */ });

    // Simulate payment (testnet only)
    await simulatePayment(invoice.invoice_id);

    const status = await getInvoiceStatus(invoice.invoice_id);
    expect(status.status).toBe('settled');
    expect(status.settlement).toBeDefined();
  });
});
```

---

## Troubleshooting

### Common Issues

**Issue**: "Invalid API key"
- **Solution**: Verify API key is correct and not expired. Check environment variables.

**Issue**: "NFT not whitelisted"
- **Solution**: Ensure merchant NFT is from Series 7777 or 8888. Verify address format.

**Issue**: "Invoice expired before payment"
- **Solution**: Increase `expires_at` time. Default is 24 hours.

**Issue**: "Payment not detected"
- **Solution**:
  - Check invoice ID matches payment payload
  - Verify user sent exact amount
  - Wait for blockchain confirmations (≥6 blocks)
  - Check blockchain explorer for transaction

**Issue**: "Rate limit exceeded"
- **Solution**: Implement exponential backoff. Respect `Retry-After` header.

### Support

For technical support:
- GitHub Issues: https://github.com/xlabtg/tonbankcard-protocol/issues
- Documentation: https://docs.tonbankcard.io
- API Status: https://status.tonbankcard.io

---

## Next Steps

1. **Get merchant credentials**
   - Apply for merchant account
   - Receive NFT card and API key

2. **Implement integration**
   - Follow code examples above
   - Test on testnet first

3. **Go live**
   - Switch to production API
   - Monitor settlements
   - Fulfill orders

4. **Optimize**
   - Add caching
   - Use background jobs
   - Implement webhooks (when available)

---

**Issue Reference**: [#24 — Merchant API](https://github.com/xlabtg/tonbankcard-protocol/issues/24)
**API Specification**: [docs/merchant-api-spec.md](../docs/merchant-api-spec.md)
