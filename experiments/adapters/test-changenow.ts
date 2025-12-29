/**
 * ChangeNOW Adapter Test/Experiment Script
 *
 * This script is for testing and experimenting with the ChangeNOW adapter
 * in a safe development environment.
 *
 * Usage:
 *   1. Set your API key in environment: export CHANGENOW_API_KEY=your-key
 *   2. Run: ts-node experiments/adapters/test-changenow.ts
 */

import { createChangeNOWAdapter } from '../../backend/adapters';

async function testGetQuote() {
  console.log('\n--- Testing getQuote() ---');

  const apiKey = process.env.CHANGENOW_API_KEY;
  if (!apiKey) {
    console.log('⚠️  CHANGENOW_API_KEY not set, skipping test');
    return;
  }

  const adapter = createChangeNOWAdapter(apiKey);

  try {
    const quote = await adapter.getQuote('ton', 'btc', '100', 'standard');
    console.log('✅ Quote retrieved successfully');
    console.log('   Estimated amount:', quote.estimatedAmount);
    console.log('   Rate:', quote.rate);
    console.log('   Min amount:', quote.minAmount);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testGetMinAmount() {
  console.log('\n--- Testing getMinAmount() ---');

  const apiKey = process.env.CHANGENOW_API_KEY;
  if (!apiKey) {
    console.log('⚠️  CHANGENOW_API_KEY not set, skipping test');
    return;
  }

  const adapter = createChangeNOWAdapter(apiKey);

  try {
    const minAmount = await adapter.getMinAmount('ton', 'btc');
    console.log('✅ Min amount retrieved successfully');
    console.log('   Min amount:', minAmount, 'TON');
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testGetAvailableCurrencies() {
  console.log('\n--- Testing getAvailableCurrencies() ---');

  const apiKey = process.env.CHANGENOW_API_KEY;
  if (!apiKey) {
    console.log('⚠️  CHANGENOW_API_KEY not set, skipping test');
    return;
  }

  const adapter = createChangeNOWAdapter(apiKey);

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

async function testMapSwapToNFTAccount() {
  console.log('\n--- Testing mapSwapToNFTAccount() ---');

  const adapter = createChangeNOWAdapter('dummy-key');

  // Mock swap response
  const mockSwap = {
    id: 'test-swap-123',
    payinAddress: 'EQD...',
    payoutAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    fromAmount: '100',
    toAmount: '0.0045',
    status: 'waiting',
    fromCurrency: 'ton',
    toCurrency: 'btc',
  };

  try {
    const txRecord = adapter.mapSwapToNFTAccount(mockSwap, '7777001');
    console.log('✅ Swap mapped successfully');
    console.log('   Provider:', txRecord.provider);
    console.log('   NFT Account:', txRecord.nftAccountId);
    console.log('   Status:', txRecord.status);
    console.log('   Asset pair:', `${txRecord.assetIn} -> ${txRecord.assetOut}`);
    console.log('   Amount:', `${txRecord.amountIn} -> ${txRecord.amountOut}`);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }
}

async function testErrorHandling() {
  console.log('\n--- Testing Error Handling ---');

  const adapter = createChangeNOWAdapter('invalid-api-key');

  try {
    await adapter.getQuote('ton', 'btc', '100', 'standard');
    console.log('❌ Should have thrown an error');
  } catch (error: any) {
    console.log('✅ Error caught successfully');
    console.log('   Provider:', error.provider);
    console.log('   Message:', error.message);
    console.log('   Status code:', error.statusCode);
  }
}

async function main() {
  console.log('=== ChangeNOW Adapter Tests ===');
  console.log('These tests verify the adapter implementation');

  await testGetQuote();
  await testGetMinAmount();
  await testGetAvailableCurrencies();
  await testMapSwapToNFTAccount();
  await testErrorHandling();

  console.log('\n=== Tests Complete ===');
  console.log('\nNotes:');
  console.log('- Some tests require CHANGENOW_API_KEY environment variable');
  console.log('- These tests do NOT create actual swaps or cost money');
  console.log('- mapSwapToNFTAccount is tested with mock data');
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
