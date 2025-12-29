/**
 * NOWPayments Adapter Usage Example
 *
 * This example demonstrates how to use the NOWPayments adapter
 * for merchant cryptocurrency payment processing.
 *
 * ⚠️ This is an example only. In production:
 * - Use environment variables for API keys
 * - Implement proper error handling
 * - Store transaction records in a database
 * - Verify webhook signatures
 * - Add rate limiting and validation
 */

import { createNOWPaymentsAdapter } from '../../backend/adapters';
import type { ExternalTransaction, PaymentCallback } from '../../backend/adapters';

/**
 * Mock database for storing payment records
 * In production, use PostgreSQL, MongoDB, etc.
 */
const mockDatabase: ExternalTransaction[] = [];

async function main() {
  console.log('=== NOWPayments Adapter Example ===\n');

  // Initialize adapter with API key and IPN secret
  // In production:
  // const apiKey = process.env.NOWPAYMENTS_API_KEY!;
  // const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET!;
  const apiKey = 'your-nowpayments-api-key';
  const ipnSecret = 'your-ipn-secret-key';
  const nowPayments = createNOWPaymentsAdapter(apiKey, ipnSecret);

  try {
    // Example 1: Get available currencies
    console.log('1. Fetching available payment currencies...');
    const currencies = await nowPayments.getAvailableCurrencies();
    console.log(`Available currencies: ${currencies.length} total`);
    console.log(`Example: ${currencies.slice(0, 3).map(c => c.ticker).join(', ')}\n`);

    // Example 2: Get minimum payment amount
    console.log('2. Checking minimum payment amount for TON...');
    const minAmount = await nowPayments.getMinAmount('ton');
    console.log(`Minimum amount: ${minAmount} TON\n`);

    // Example 3: Create payment invoice for merchant
    console.log('3. Creating payment invoice...');
    const invoice = await nowPayments.createInvoice({
      price_amount: 99.99,
      price_currency: 'USD',
      pay_currency: 'ton',
      nftAccountId: '8888001', // Merchant's NFT Account
      ipn_callback_url: 'https://your-backend.com/webhooks/nowpayments',
      success_url: 'https://your-store.com/payment/success',
      cancel_url: 'https://your-store.com/payment/cancel',
      order_id: 'ORDER-12345',
      order_description: 'Premium Subscription - Annual Plan',
    });

    console.log(`Invoice created successfully!`);
    console.log(`Invoice ID: ${invoice.id}`);
    console.log(`Payment URL: ${invoice.invoice_url}`);
    console.log(`Customer should pay: ${invoice.pay_amount} ${invoice.pay_currency}`);
    console.log(`Order ID: ${invoice.order_id}\n`);

    // Map invoice to merchant's NFT Account
    const txRecord = nowPayments.mapPaymentToNFTAccount(invoice, '8888001');
    mockDatabase.push(txRecord);
    console.log(`Invoice mapped to merchant NFT Account: ${txRecord.nftAccountId}`);
    console.log(`Status: ${txRecord.status}\n`);

    // Example 4: Check payment status
    console.log('4. Checking payment status...');
    const paymentStatus = await nowPayments.getPaymentStatus(invoice.id);
    console.log(`Payment status: ${paymentStatus.payment_status}`);
    console.log(`Pay amount: ${paymentStatus.pay_amount} ${paymentStatus.pay_currency}\n`);

    // Example 5: Simulate webhook callback
    console.log('5. Simulating webhook callback...');
    const mockCallback: PaymentCallback = {
      payment_id: 123456789,
      payment_status: 'finished',
      pay_address: 'EQD...',
      price_amount: 99.99,
      price_currency: 'USD',
      pay_amount: 45.5,
      pay_currency: 'ton',
      order_id: 'ORDER-12345',
      order_description: 'Premium Subscription - Annual Plan',
      purchase_id: 'PURCHASE-789',
      outcome_amount: 99.99,
      outcome_currency: 'USD',
      payin_hash: 'abc123def456...',
    };

    // Verify webhook signature (in real scenario, signature comes from header)
    const mockSignature = 'mock-hmac-signature';
    const isValid = nowPayments.verifyCallback(mockCallback, mockSignature);
    console.log(`Webhook signature valid: ${isValid}`);

    if (mockCallback.payment_status === 'finished') {
      console.log('Payment confirmed! Processing order...');

      // Emit payment settled event
      const settledTx = nowPayments.emitPaymentSettledEvent(mockCallback, '8888001');
      mockDatabase.push(settledTx);

      console.log(`Payment settled for NFT Account: ${settledTx.nftAccountId}`);
      console.log(`Amount received: ${settledTx.amountIn} ${settledTx.assetIn}`);
      console.log(`TON transaction hash: ${settledTx.tonTxHash}\n`);
    }

    // Example 6: Create invoice for TBC payment
    console.log('6. Creating invoice for TBC payment...');
    const tbcInvoice = await nowPayments.createInvoice({
      price_amount: 50,
      price_currency: 'USD',
      pay_currency: 'tbc',  // Assuming TBC is supported
      nftAccountId: '8888002',
      order_id: 'ORDER-67890',
      order_description: 'Digital Product Purchase',
    });

    console.log(`TBC Invoice created!`);
    console.log(`Invoice ID: ${tbcInvoice.id}`);
    console.log(`Customer pays: ${tbcInvoice.pay_amount} TBC\n`);

    const tbcTxRecord = nowPayments.mapPaymentToNFTAccount(tbcInvoice, '8888002');
    mockDatabase.push(tbcTxRecord);

    // Display mock database contents
    console.log('=== Mock Database Contents ===');
    console.log(`Total payments: ${mockDatabase.length}`);
    mockDatabase.forEach((tx, index) => {
      console.log(`\nPayment ${index + 1}:`);
      console.log(`  Provider: ${tx.provider}`);
      console.log(`  ID: ${tx.providerTxId}`);
      console.log(`  Merchant NFT Account: ${tx.nftAccountId}`);
      console.log(`  ${tx.amountIn} ${tx.assetIn} -> ${tx.amountOut} ${tx.assetOut}`);
      console.log(`  Status: ${tx.status}`);
      if (tx.metadata?.orderId) {
        console.log(`  Order ID: ${tx.metadata.orderId}`);
      }
    });

    console.log('\n✅ Example completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Error occurred:');
    if (error.provider) {
      console.error(`Provider: ${error.provider}`);
      console.error(`Message: ${error.message}`);
      console.error(`Status Code: ${error.statusCode || 'N/A'}`);
    } else {
      console.error(error);
    }
  }
}

/**
 * Example webhook endpoint handler
 *
 * This shows how to handle NOWPayments webhooks in an Express.js server
 */
export function exampleWebhookHandler() {
  console.log('\n=== Example Webhook Handler ===\n');
  console.log('// In your Express.js server:\n');
  console.log(`
import express from 'express';
import { createNOWPaymentsAdapter } from './backend/adapters';

const app = express();
app.use(express.json());

const nowPayments = createNOWPaymentsAdapter(
  process.env.NOWPAYMENTS_API_KEY!,
  process.env.NOWPAYMENTS_IPN_SECRET!
);

app.post('/webhooks/nowpayments', async (req, res) => {
  try {
    // Get signature from header
    const signature = req.headers['x-nowpayments-sig'] as string;

    // Verify signature
    const isValid = nowPayments.verifyCallback(req.body, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).send('Unauthorized');
    }

    const callback = req.body;

    // Process based on status
    switch (callback.payment_status) {
      case 'finished':
        // Payment confirmed
        const txRecord = nowPayments.emitPaymentSettledEvent(
          callback,
          getMerchantNFTAccountId(callback.order_id)
        );
        await saveToDatabaseAndFulfillOrder(txRecord);
        break;

      case 'failed':
        // Payment failed
        await handleFailedPayment(callback);
        break;

      case 'refunded':
        // Payment refunded
        await handleRefund(callback);
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
  `);
}

// Run example
if (require.main === module) {
  main()
    .then(() => exampleWebhookHandler())
    .catch(console.error);
}

export { main };
