/**
 * Example: Webhook-less Verification
 *
 * This example shows how to verify payments without webhooks,
 * using only on-chain data. Useful for:
 * - Static websites
 * - Serverless applications
 * - High-security environments
 */

import { Address } from '@ton/core';
import { TonbankcardSDK, TESTNET_CONFIG, Invoice } from '../src';

/**
 * Payment verification without backend webhooks
 */
async function webhooklessVerificationExample() {
  const sdk = new TonbankcardSDK({
    ...TESTNET_CONFIG,
    paymentHubAddress: Address.parse('EQ...YourPaymentHubAddress'),
  });

  console.log('Webhook-less Payment Verification');
  console.log('==================================\n');

  // Step 1: Create invoice and store locally (browser localStorage, etc.)
  const invoice = sdk.createInvoice({
    merchantNft: Address.parse('EQ...YourMerchantNFT'),
    amountTbc: BigInt(10_500_000_000), // 10.5 TBC
    orderId: 'LOCAL-ORDER-001',
    description: 'Digital Product',
  });

  console.log('Invoice created:', invoice.id);

  // Store invoice in browser localStorage or IndexedDB
  // localStorage.setItem(`invoice_${invoice.id}`, JSON.stringify(invoice));

  // Step 2: Show payment link to user
  const paymentLink = sdk.generateWalletLink({ invoice });
  console.log('Payment link:', paymentLink);

  // Step 3: Poll for payment status (client-side)
  console.log('\nPolling for payment (client-side)...\n');

  const pollForPayment = async (
    invoiceId: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
  ): Promise<boolean> => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Checking payment status (attempt ${attempt}/${maxAttempts})...`);

      try {
        const status = await sdk.getInvoiceStatus(invoiceId);

        if (status === 'settled') {
          console.log('✓ Payment confirmed!');
          return true;
        }

        if (status === 'expired' || status === 'failed') {
          console.log('✗ Payment', status);
          return false;
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }

    console.log('⚠ Timeout: Payment not confirmed within polling period');
    return false;
  };

  // Example: Poll for 5 minutes (60 attempts × 5 seconds)
  // const paid = await pollForPayment(invoice.id);

  console.log('\nClient-side verification complete');
  console.log('\nBenefits of webhook-less approach:');
  console.log('- No backend server required');
  console.log('- Works on static sites');
  console.log('- User sees immediate feedback');
  console.log('- Still cryptographically secure (on-chain verification)');

  console.log('\nSecurity notes:');
  console.log('- All verification is done against blockchain (trustless)');
  console.log('- No server-side secrets required');
  console.log('- Payment cannot be faked (cryptographic proof)');
}

/**
 * Advanced: Direct blockchain event monitoring
 * (requires indexer or direct blockchain scanning)
 */
async function directEventMonitoring() {
  console.log('\n\nAdvanced: Direct Event Monitoring');
  console.log('==================================\n');

  const sdk = new TonbankcardSDK({
    ...TESTNET_CONFIG,
    paymentHubAddress: Address.parse('EQ...YourPaymentHubAddress'),
  });

  console.log('For production systems, consider:');
  console.log('1. Running a TON indexer (e.g., ton-indexer)');
  console.log('2. Subscribing to MerchantPayment events');
  console.log('3. Filtering by your merchant NFT address');
  console.log('4. Processing events in real-time');
  console.log('\nThis provides:');
  console.log('- Real-time notifications');
  console.log('- No polling overhead');
  console.log('- Complete payment history');
  console.log('- Still fully decentralized');
}

// Run examples
if (require.main === module) {
  webhooklessVerificationExample()
    .then(() => directEventMonitoring())
    .then(() => console.log('\nExamples completed'))
    .catch((error) => console.error('Error:', error));
}

export { webhooklessVerificationExample, directEventMonitoring };
