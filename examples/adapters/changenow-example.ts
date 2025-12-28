/**
 * ChangeNOW Adapter Usage Example
 *
 * This example demonstrates how to use the ChangeNOW adapter
 * to create cryptocurrency swaps while maintaining non-custodial principles.
 *
 * ⚠️ This is an example only. In production:
 * - Use environment variables for API keys
 * - Implement proper error handling
 * - Store transaction records in a database
 * - Add rate limiting and validation
 */

import { createChangeNOWAdapter } from '../../backend/adapters';
import type { ExternalTransaction } from '../../backend/adapters';

/**
 * Mock database for storing transaction records
 * In production, use PostgreSQL, MongoDB, etc.
 */
const mockDatabase: ExternalTransaction[] = [];

async function main() {
  console.log('=== ChangeNOW Adapter Example ===\n');

  // Initialize adapter with API key
  // In production: const apiKey = process.env.CHANGENOW_API_KEY!;
  const apiKey = 'your-changenow-api-key';
  const changeNow = createChangeNOWAdapter(apiKey);

  try {
    // Example 1: Get available currencies
    console.log('1. Fetching available currencies...');
    const currencies = await changeNow.getAvailableCurrencies();
    console.log(`Available currencies: ${currencies.length} total`);
    console.log(`Example: ${currencies.slice(0, 3).map(c => c.ticker).join(', ')}\n`);

    // Example 2: Get minimum exchange amount
    console.log('2. Checking minimum exchange amount for TON -> BTC...');
    const minAmount = await changeNow.getMinAmount('ton', 'btc');
    console.log(`Minimum amount: ${minAmount} TON\n`);

    // Example 3: Get exchange quote
    console.log('3. Getting exchange quote for 100 TON -> BTC...');
    const quote = await changeNow.getQuote('ton', 'btc', '100', 'standard');
    console.log(`Estimated amount: ${quote.estimatedAmount} BTC`);
    console.log(`Rate: ${quote.rate || 'N/A'}`);
    console.log(`Network fee: ${quote.networkFee || 'N/A'}\n`);

    // Example 4: Create standard flow swap
    console.log('4. Creating standard flow swap (TON -> BTC)...');
    const swap = await changeNow.createSwap({
      fromCurrency: 'ton',
      toCurrency: 'btc',
      fromNetwork: 'ton',
      toNetwork: 'btc',
      fromAmount: '100',
      address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Example BTC address
      nftAccountId: '7777001',
      flow: 'standard',
      refundAddress: 'EQD...',  // User's TON refund address
    });

    console.log(`Swap created successfully!`);
    console.log(`Swap ID: ${swap.id}`);
    console.log(`Send ${swap.fromAmount} TON to: ${swap.payinAddress}`);
    console.log(`You will receive ~${swap.toAmount} BTC at: ${swap.payoutAddress}\n`);

    // Map swap to NFT Account for tracking
    const txRecord = changeNow.mapSwapToNFTAccount(swap, '7777001');
    mockDatabase.push(txRecord);
    console.log(`Transaction mapped to NFT Account: ${txRecord.nftAccountId}`);
    console.log(`Status: ${txRecord.status}\n`);

    // Example 5: Track swap status
    console.log('5. Tracking swap status...');
    const status = await changeNow.trackSwapStatus(swap.id);
    console.log(`Current status: ${status.status}`);
    if (status.payoutHash) {
      console.log(`Payout transaction: ${status.payoutHash}`);
    }
    console.log();

    // Example 6: Fixed-rate flow
    console.log('6. Creating fixed-rate swap (TON -> ETH)...');
    const fixedSwap = await changeNow.createSwap({
      fromCurrency: 'ton',
      toCurrency: 'eth',
      fromNetwork: 'ton',
      toNetwork: 'eth',
      fromAmount: '100',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Example ETH address
      nftAccountId: '7777002',
      flow: 'fixed-rate',
    });

    console.log(`Fixed-rate swap created!`);
    console.log(`Swap ID: ${fixedSwap.id}`);
    console.log(`Rate is LOCKED at: ${fixedSwap.toAmount} ETH for ${fixedSwap.fromAmount} TON\n`);

    // Store in mock database
    const fixedTxRecord = changeNow.mapSwapToNFTAccount(fixedSwap, '7777002');
    mockDatabase.push(fixedTxRecord);

    // Display mock database contents
    console.log('=== Mock Database Contents ===');
    console.log(`Total transactions: ${mockDatabase.length}`);
    mockDatabase.forEach((tx, index) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log(`  Provider: ${tx.provider}`);
      console.log(`  ID: ${tx.providerTxId}`);
      console.log(`  NFT Account: ${tx.nftAccountId}`);
      console.log(`  ${tx.amountIn} ${tx.assetIn} -> ${tx.amountOut} ${tx.assetOut}`);
      console.log(`  Status: ${tx.status}`);
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

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
