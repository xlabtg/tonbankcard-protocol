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

import { createNOWPaymentsAdapter } from '../../backend/adapters';
import type { PaymentCallback } from '../../backend/adapters';

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

  const mockSignature = 'test-signature';

  try {
    const isValid = adapter.verifyCallback(mockCallback, mockSignature);
    console.log('✅ Callback verification executed');
    console.log('   Valid:', isValid);
    console.log('   Note: Signature validation is placeholder in this implementation');
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
  console.log('- HMAC verification is placeholder and needs crypto implementation');
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
