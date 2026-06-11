/**
 * NOWPayments Adapter Test/Experiment Script
 *
 * This script is for testing and experimenting with the NOWPayments adapter
 * in a safe development environment.
 *
 * Usage:
 *   1. Set your API key: export NOWPAYMENTS_API_KEY=your-key
 *   2. Set IPN secret: export NOWPAYMENTS_IPN_SECRET=your-secret
 *   3. Run: ts-node experiments/adapters/test-nowpayments.ts
 */

import { createHmac } from 'crypto';

import { createNOWPaymentsAdapter } from '../../backend/adapters';
import type { PaymentCallback } from '../../backend/adapters';

/**
 * Reproduce the signature NOWPayments places in the `x-nowpayments-sig` header:
 * HMAC-SHA512 of the recursively key-sorted JSON body, keyed by the IPN secret.
 * A production handler never signs callbacks itself — this only exists so the
 * experiment can drive `verifyCallback()` with a genuine signature.
 */
function signLikeNowpayments(payload: PaymentCallback, ipnSecret: string): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value !== null && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sortKeys((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  };
  const canonical = JSON.stringify(sortKeys(payload));
  return createHmac('sha512', ipnSecret).update(canonical, 'utf8').digest('hex');
}

async function testGetAvailableCurrencies() {
  console.log('\n--- Testing getAvailableCurrencies() ---');

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    console.log('⚠️  NOWPAYMENTS_API_KEY not set, skipping test');
    return;
  }

  const adapter = createNOWPaymentsAdapter(apiKey);

  try {
    const currencies = await adapter.getAvailableCurrencies();
    console.log('✅ Currencies retrieved successfully');
    console.log('   Total currencies:', currencies.length);
    console.log('   First 5:', currencies.slice(0, 5).map(c => c.ticker).join(', '));

    // Check if TON is supported
    const tonSupported = currencies.some(c => c.ticker.toLowerCase() === 'ton');
    console.log('   TON supported:', tonSupported ? '✅' : '❌');
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testGetMinAmount() {
  console.log('\n--- Testing getMinAmount() ---');

  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) {
    console.log('⚠️  NOWPAYMENTS_API_KEY not set, skipping test');
    return;
  }

  const adapter = createNOWPaymentsAdapter(apiKey);

  try {
    const minAmount = await adapter.getMinAmount('ton');
    console.log('✅ Min amount retrieved successfully');
    console.log('   Min amount:', minAmount, 'TON');
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testMapPaymentToNFTAccount() {
  console.log('\n--- Testing mapPaymentToNFTAccount() ---');

  const adapter = createNOWPaymentsAdapter('dummy-key');

  // Mock invoice response
  const mockInvoice = {
    id: 'invoice-123',
    invoice_url: 'https://nowpayments.io/payment/invoice-123',
    price_amount: '99.99',
    price_currency: 'USD',
    pay_currency: 'ton',
    pay_amount: '45.5',
    payment_status: 'waiting',
    order_id: 'ORDER-12345',
    created_at: new Date().toISOString(),
  };

  try {
    const txRecord = adapter.mapPaymentToNFTAccount(mockInvoice, '8888001');
    console.log('✅ Payment mapped successfully');
    console.log('   Provider:', txRecord.provider);
    console.log('   NFT Account:', txRecord.nftAccountId);
    console.log('   Status:', txRecord.status);
    console.log('   Asset pair:', `${txRecord.assetIn} -> ${txRecord.assetOut}`);
    console.log('   Amount:', `${txRecord.amountIn} -> ${txRecord.amountOut}`);
    console.log('   Order ID:', txRecord.metadata?.orderId);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testEmitPaymentSettledEvent() {
  console.log('\n--- Testing emitPaymentSettledEvent() ---');

  const adapter = createNOWPaymentsAdapter('dummy-key');

  // Mock payment callback
  const mockCallback: PaymentCallback = {
    payment_id: 123456789,
    payment_status: 'finished',
    pay_address: 'EQD...',
    price_amount: 99.99,
    price_currency: 'USD',
    pay_amount: 45.5,
    pay_currency: 'ton',
    order_id: 'ORDER-12345',
    order_description: 'Test Order',
    outcome_amount: 99.99,
    outcome_currency: 'USD',
    payin_hash: 'abc123def456',
  };

  try {
    const txRecord = adapter.emitPaymentSettledEvent(mockCallback, '8888001');
    console.log('✅ Payment settled event emitted successfully');
    console.log('   Provider:', txRecord.provider);
    console.log('   NFT Account:', txRecord.nftAccountId);
    console.log('   Status:', txRecord.status);
    console.log('   TON TX Hash:', txRecord.tonTxHash);
    console.log('   Order ID:', txRecord.metadata?.orderId);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testVerifyCallback() {
  console.log('\n--- Testing verifyCallback() ---');

  const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET || 'test-secret';
  const adapter = createNOWPaymentsAdapter('dummy-key', ipnSecret);

  const mockCallback: PaymentCallback = {
    payment_id: 123456789,
    payment_status: 'finished',
    pay_address: 'EQD...',
    price_amount: 99.99,
    price_currency: 'USD',
    pay_amount: 45.5,
    pay_currency: 'ton',
  };

  try {
    // A genuine signature (HMAC-SHA512 of the canonical body) must be accepted.
    const genuineSignature = signLikeNowpayments(mockCallback, ipnSecret);
    const genuineAccepted = adapter.verifyCallback(mockCallback, genuineSignature);
    console.log('   Genuine signature accepted:', genuineAccepted, genuineAccepted ? '✅' : '❌');

    // A forged signature must be rejected — this is the PC-03 fix (issue #372).
    const forgedRejected = !adapter.verifyCallback(mockCallback, 'forged-signature');
    console.log('   Forged signature rejected:', forgedRejected, forgedRejected ? '✅' : '❌');
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testVerifyCallbackWithoutSecret() {
  console.log('\n--- Testing verifyCallback() without IPN secret ---');

  const adapter = createNOWPaymentsAdapter('dummy-key');

  const mockCallback: PaymentCallback = {
    payment_id: 123456789,
    payment_status: 'finished',
    pay_address: 'EQD...',
    price_amount: 99.99,
    price_currency: 'USD',
    pay_amount: 45.5,
    pay_currency: 'ton',
  };

  try {
    adapter.verifyCallback(mockCallback, 'signature');
    console.log('❌ Should have thrown an error');
  } catch (error: any) {
    console.log('✅ Error thrown as expected');
    console.log('   Message:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n--- Testing Error Handling ---');

  const adapter = createNOWPaymentsAdapter('invalid-api-key');

  try {
    await adapter.getAvailableCurrencies();
    console.log('❌ Should have thrown an error');
  } catch (error: any) {
    console.log('✅ Error caught successfully');
    console.log('   Provider:', error.provider);
    console.log('   Message:', error.message);
    console.log('   Status code:', error.statusCode);
  }
}

async function main() {
  console.log('=== NOWPayments Adapter Tests ===');
  console.log('These tests verify the adapter implementation');

  await testGetAvailableCurrencies();
  await testGetMinAmount();
  await testMapPaymentToNFTAccount();
  await testEmitPaymentSettledEvent();
  await testVerifyCallback();
  await testVerifyCallbackWithoutSecret();
  await testErrorHandling();

  console.log('\n=== Tests Complete ===');
  console.log('\nNotes:');
  console.log('- Some tests require NOWPAYMENTS_API_KEY environment variable');
  console.log('- Webhook verification requires NOWPAYMENTS_IPN_SECRET');
  console.log('- These tests do NOT create actual invoices or cost money');
  console.log('- Payment mapping is tested with mock data');
  console.log('- HMAC verification uses real HMAC-SHA512 (audit finding PC-03 / #372)');
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
