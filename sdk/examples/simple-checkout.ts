/**
 * Example: Simple Checkout Flow
 *
 * This example demonstrates a basic e-commerce checkout integration
 * with TONBANKCARD payment.
 */

import { Address } from '@ton/core';
import {
  TonbankcardSDK,
  TESTNET_CONFIG,
  parseTBC,
  formatTBC,
} from '../src';

async function simpleCheckoutExample() {
  // 1. Initialize SDK
  const sdk = new TonbankcardSDK({
    ...TESTNET_CONFIG,
    // In production, set your deployed Payment Hub address
    paymentHubAddress: Address.parse('EQ...YourPaymentHubAddress'),
    // Optional: Set your API endpoint for invoice storage
    apiEndpoint: 'https://your-api.example.com',
  });

  // 2. Create an invoice for a product purchase
  const invoice = sdk.createInvoice({
    // Your merchant NFT account
    merchantNft: Address.parse('EQ...YourMerchantNFT'),

    // Amount in TBC (converted from human-readable)
    amountTbc: parseTBC('10.50'), // 10.50 TBC

    // Order ID from your system
    orderId: 'ORDER-12345',

    // Description shown to user
    description: 'Premium Subscription - 1 Year',

    // Additional metadata (optional)
    metadata: {
      productId: 'premium-yearly',
      customerId: 'CUST-67890',
      email: 'customer@example.com',
    },

    // Invoice expires in 1 hour
    expirationSeconds: 3600,
  });

  console.log('Invoice created:', {
    id: invoice.id,
    amount: formatTBC(invoice.amountTbc) + ' TBC',
    expiresAt: new Date(invoice.expiresAt! * 1000).toISOString(),
  });

  // 3. Generate wallet link for user
  const walletLink = sdk.generateWalletLink({
    invoice,
    returnUrl: 'https://your-site.com/payment/success',
  });

  console.log('Payment link:', walletLink);
  console.log('\nUser should open this link in their TON wallet');
  console.log('The wallet will prompt them to approve the payment');

  // 4. Wait for payment (in real app, use webhooks or polling)
  console.log('\nWaiting for payment...');
  console.log('In production:');
  console.log('- Poll getInvoiceStatus() periodically');
  console.log('- Or subscribe to Payment Hub events via indexer');
  console.log('- Or use webhooks from your API backend');

  // Example: Check payment status
  const checkPayment = async () => {
    const status = await sdk.getInvoiceStatus(invoice.id);
    console.log('Payment status:', status);

    if (status === 'settled') {
      console.log('✓ Payment confirmed on-chain!');
      console.log('Grant access to Premium Subscription');
      return true;
    }

    if (status === 'expired') {
      console.log('✗ Invoice expired');
      return false;
    }

    return false;
  };

  // In production, you would poll this or use events
  // await checkPayment();
}

// Run example
if (require.main === module) {
  simpleCheckoutExample()
    .then(() => console.log('\nExample completed'))
    .catch((error) => console.error('Error:', error));
}

export { simpleCheckoutExample };
