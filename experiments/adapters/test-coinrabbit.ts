/**
 * CoinRabbit Adapter Test/Experiment Script
 *
 * This script is for testing and experimenting with the CoinRabbit lending adapter
 * in a safe development environment.
 *
 * ⚠️ IMPORTANT: The lending adapter is NON-CUSTODIAL
 * All actual lending happens through CoinRabbit, outside the protocol.
 *
 * Usage:
 *   ts-node experiments/adapters/test-coinrabbit.ts
 */

import { createCoinRabbitAdapter } from '../../backend/adapters';
import type {
  BorrowerIdentity,
  LoanIntentResponse,
  CollateralVerificationResponse,
  LenderVerificationData,
} from '../../backend/adapters';

// Test results tracking
const testResults: { name: string; passed: boolean; message?: string }[] = [];

function logTest(name: string, passed: boolean, message?: string) {
  testResults.push({ name, passed, message });
  const status = passed ? '✅' : '❌';
  console.log(`   ${status} ${name}${message ? `: ${message}` : ''}`);
}

async function testIdentityResolution() {
  console.log('\n--- Testing Identity Resolution ---');

  const adapter = createCoinRabbitAdapter();

  // Test valid Series 7777
  const identity1 = await adapter.resolveBorrowerIdentity('7777001');
  logTest(
    'Series 7777 identity resolution',
    identity1.isValid && identity1.collectionAddress.length > 0,
    `Valid: ${identity1.isValid}`
  );

  // Test valid Series 8888
  const identity2 = await adapter.resolveBorrowerIdentity('8888042');
  logTest(
    'Series 8888 identity resolution',
    identity2.isValid,
    `Valid: ${identity2.isValid}`
  );

  // Test invalid series
  const identity3 = await adapter.resolveBorrowerIdentity('9999001');
  logTest(
    'Invalid series rejection',
    !identity3.isValid,
    `Correctly rejected: ${!identity3.isValid}`
  );

  // Test empty ID
  const identity4 = await adapter.resolveBorrowerIdentity('');
  logTest(
    'Empty ID rejection',
    !identity4.isValid,
    `Correctly rejected: ${!identity4.isValid}`
  );

  // Test with owner address
  const identity5 = await adapter.resolveBorrowerIdentity('7777001', 'EQD_owner');
  logTest(
    'Identity with owner address',
    identity5.currentOwnerAddress === 'EQD_owner',
    `Owner preserved: ${identity5.currentOwnerAddress}`
  );
}

async function testNFTAccountValidation() {
  console.log('\n--- Testing NFT Account Validation ---');

  const adapter = createCoinRabbitAdapter();

  const testCases = [
    { id: '7777001', expected: true },
    { id: '8888001', expected: true },
    { id: '7777999', expected: true },
    { id: '9999001', expected: false },
    { id: 'invalid', expected: false },
    { id: '', expected: false },
  ];

  testCases.forEach(({ id, expected }) => {
    const result = adapter.isValidNFTAccountId(id);
    logTest(
      `Validate "${id}"`,
      result === expected,
      `Got: ${result}, Expected: ${expected}`
    );
  });
}

async function testLoanIntentCreation() {
  console.log('\n--- Testing Loan Intent Creation ---');

  const adapter = createCoinRabbitAdapter({
    affiliateId: 'test-affiliate',
  });

  // Test successful intent creation
  try {
    const intent = await adapter.createLoanIntent({
      nftAccountId: '7777001',
      collateralSignalId: 'signal_test_123',
      requestedAmount: '1000',
      requestedCurrency: 'USDT',
      targetLender: 'coinrabbit',
    });

    logTest(
      'Loan intent creation',
      !!intent.intentId && !!intent.lenderUrl,
      `Intent ID: ${intent.intentId}`
    );

    logTest(
      'Intent has verification data',
      !!intent.verificationData.disclaimer,
      'Disclaimer present'
    );

    logTest(
      'Intent has lender URL',
      intent.lenderUrl.includes('coinrabbit.io'),
      intent.lenderUrl
    );

    logTest(
      'Intent has affiliate ID in URL',
      intent.lenderUrl.includes('ref=test-affiliate'),
      'Affiliate ID included'
    );

    logTest(
      'Intent has expiration',
      intent.expiresAt > intent.createdAt,
      `Expires: ${intent.expiresAt.toISOString()}`
    );
  } catch (error: any) {
    logTest('Loan intent creation', false, error.message);
  }

  // Test intent creation with invalid account
  try {
    await adapter.createLoanIntent({
      nftAccountId: 'invalid',
      targetLender: 'coinrabbit',
    });
    logTest('Invalid account rejection', false, 'Should have thrown');
  } catch (error: any) {
    logTest(
      'Invalid account rejection',
      error.message.includes('Invalid NFT Account'),
      'Correctly rejected'
    );
  }
}

async function testCollateralVerification() {
  console.log('\n--- Testing Collateral Verification ---');

  const adapter = createCoinRabbitAdapter();

  // Test verification with valid account
  const verification = await adapter.verifyCollateralSignal({
    signalId: 'signal_test_123',
    nftAccountId: '7777001',
  });

  logTest(
    'Collateral verification returns result',
    verification.verifiedAt instanceof Date,
    `Verified at: ${verification.verifiedAt.toISOString()}`
  );

  logTest(
    'Verification includes disclaimer',
    verification.disclaimer.length > 50,
    'Disclaimer present'
  );

  // Test verification with invalid account
  const invalidVerification = await adapter.verifyCollateralSignal({
    signalId: 'signal_test_123',
    nftAccountId: 'invalid',
  });

  logTest(
    'Invalid account verification fails',
    !invalidVerification.isValid,
    `Valid: ${invalidVerification.isValid}`
  );
}

async function testLenderMetadata() {
  console.log('\n--- Testing Lender Metadata ---');

  const adapter = createCoinRabbitAdapter({ chainId: 1 });

  const metadata = await adapter.getLenderMetadata('7777001', 'signal_123');

  logTest(
    'Metadata includes NFT account',
    metadata.nftAccountId === '7777001',
    metadata.nftAccountId
  );

  logTest(
    'Metadata includes chain ID',
    metadata.chainId === 1,
    `Chain ID: ${metadata.chainId}`
  );

  logTest(
    'Metadata includes protocol version',
    /^\d+\.\d+\.\d+$/.test(metadata.protocolVersion),
    metadata.protocolVersion
  );

  logTest(
    'Metadata includes disclaimer',
    metadata.disclaimer.includes('NO guarantees'),
    'Disclaimer present'
  );
}

async function testLoanReference() {
  console.log('\n--- Testing Loan Reference ---');

  const adapter = createCoinRabbitAdapter();

  // Create reference
  const reference = adapter.createLoanReference(
    'intent_test_123',
    '7777001',
    'loan_ext_456',
    'signal_789'
  );

  logTest(
    'Reference created with ID',
    reference.referenceId.startsWith('ref_'),
    reference.referenceId
  );

  logTest(
    'Reference has correct provider',
    reference.provider === 'CoinRabbit',
    reference.provider
  );

  logTest(
    'Reference status is pending',
    reference.status === 'pending',
    reference.status
  );

  // Update reference
  const updated = adapter.updateLoanReferenceStatus(reference, 'active', {
    additionalInfo: 'test',
  });

  logTest(
    'Reference status updated',
    updated.status === 'active',
    updated.status
  );

  logTest(
    'Reference metadata preserved',
    updated.metadata?.additionalInfo === 'test',
    'Metadata present'
  );

  logTest(
    'Reference ID unchanged',
    updated.referenceId === reference.referenceId,
    'ID preserved'
  );
}

async function testSecurityProperties() {
  console.log('\n--- Testing Security Properties ---');

  const adapter = createCoinRabbitAdapter();

  // Check for dangerous methods that should NOT exist
  const dangerousMethods = [
    'lockFunds',
    'unlockFunds',
    'transferFunds',
    'seizeFunds',
    'liquidate',
    'freezeAccount',
    'withdrawCollateral',
    'forceRepayment',
    'privateKey',
    'signTransaction',
  ];

  dangerousMethods.forEach((method) => {
    const exists = typeof (adapter as any)[method] !== 'undefined';
    logTest(
      `No "${method}" method`,
      !exists,
      exists ? 'DANGEROUS: Method exists!' : 'Safe'
    );
  });

  // Check for safe methods that SHOULD exist
  const safeMethods = [
    'resolveBorrowerIdentity',
    'isValidNFTAccountId',
    'verifyCollateralSignal',
    'createLoanIntent',
    'createLoanReference',
    'getLenderMetadata',
    'getWhitelistedCollections',
    'getProtocolVersion',
    'getDisclaimer',
  ];

  safeMethods.forEach((method) => {
    const exists = typeof (adapter as any)[method] !== 'undefined';
    logTest(`Has "${method}" method`, exists, exists ? 'Present' : 'Missing!');
  });
}

async function testWhitelistedCollections() {
  console.log('\n--- Testing Whitelisted Collections ---');

  const adapter = createCoinRabbitAdapter();

  const collections = adapter.getWhitelistedCollections();

  logTest(
    'Has Series 7777 collection',
    !!collections.SERIES_7777,
    collections.SERIES_7777?.substring(0, 20) + '...'
  );

  logTest(
    'Has Series 8888 collection',
    !!collections.SERIES_8888,
    collections.SERIES_8888?.substring(0, 20) + '...'
  );

  logTest(
    'Collections are valid addresses',
    collections.SERIES_7777?.startsWith('EQ') &&
      collections.SERIES_8888?.startsWith('EQ'),
    'Valid TON addresses'
  );
}

async function main() {
  console.log('=== CoinRabbit Adapter Tests ===');
  console.log('These tests verify the lending adapter implementation');
  console.log('\n⚠️  REMINDER: This adapter is NON-CUSTODIAL');
  console.log('   All lending happens through CoinRabbit, outside the protocol');

  await testIdentityResolution();
  await testNFTAccountValidation();
  await testLoanIntentCreation();
  await testCollateralVerification();
  await testLenderMetadata();
  await testLoanReference();
  await testSecurityProperties();
  await testWhitelistedCollections();

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log(`\nTotal: ${testResults.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    testResults
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`   - ${r.name}: ${r.message}`));
  }

  console.log('\n=== Tests Complete ===');
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
