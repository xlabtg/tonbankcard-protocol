/**
 * Example: Payment Verification
 *
 * This example demonstrates how to verify payment settlement on-chain
 * without relying on off-chain APIs.
 */

import { Address } from '@ton/core';
import { TonbankcardSDK, TESTNET_CONFIG, formatTBC } from '../src';

async function paymentVerificationExample() {
  // Initialize SDK
  const sdk = new TonbankcardSDK({
    ...TESTNET_CONFIG,
    paymentHubAddress: Address.parse('EQ...YourPaymentHubAddress'),
  });

  console.log('Payment Verification Example');
  console.log('============================\n');

  // Scenario: User claims they paid via transaction hash
  const txHash = 'abc123...'; // Transaction hash from user

  console.log('Verifying transaction:', txHash);

  // Verify settlement on-chain
  const verification = await sdk.verifySettlement(txHash);

  console.log('\nVerification result:');
  console.log('- Valid:', verification.isValid);
  console.log('- Confirmations:', verification.confirmations);
  console.log('- Matches invoice:', verification.matchesInvoice);

  if (verification.error) {
    console.log('- Error:', verification.error);
  }

  if (verification.isValid && verification.confirmations >= 5) {
    console.log('\n✓ Payment confirmed with sufficient confirmations');
    console.log('Safe to grant access');
  } else if (verification.isValid && verification.confirmations < 5) {
    console.log('\n⚠ Payment valid but waiting for more confirmations');
    console.log('Consider waiting for at least 5 confirmations');
  } else {
    console.log('\n✗ Payment not valid or not found');
    console.log('Do not grant access');
  }

  // Alternative: Query account to verify balance transfer
  console.log('\n\nAlternative: Direct account verification');
  console.log('=========================================\n');

  const merchantNft = Address.parse('EQ...YourMerchantNFT');
  const accountInfo = await sdk.getAccountInfo(merchantNft);

  console.log('Merchant account info:');
  console.log('- Balance:', formatTBC(accountInfo.balance), 'TBC');
  console.log('- State:', accountInfo.state);
  console.log('- Can receive:', accountInfo.canReceive);

  console.log('\nVerify that balance increased by expected amount');
  console.log('Compare with balance before expected payment');
}

// Run example
if (require.main === module) {
  paymentVerificationExample()
    .then(() => console.log('\nExample completed'))
    .catch((error) => console.error('Error:', error));
}

export { paymentVerificationExample };
