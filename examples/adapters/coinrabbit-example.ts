/**
 * CoinRabbit Lending Adapter Usage Example
 *
 * This example demonstrates how to use the CoinRabbit lending adapter
 * to coordinate between TONBANKCARD NFT accounts and external lenders.
 *
 * ⚠️ IMPORTANT: The lending adapter is NON-CUSTODIAL.
 * - It does NOT issue loans
 * - It does NOT custody collateral
 * - It does NOT enforce repayments
 * - It only provides identity resolution and coordination
 *
 * All actual lending happens OUTSIDE the TONBANKCARD protocol.
 */

import { createCoinRabbitAdapter } from '../../backend/adapters';
import type { LoanReference, LoanIntentResponse } from '../../backend/adapters';

/**
 * Mock database for storing loan references
 * In production, use PostgreSQL, MongoDB, etc.
 */
const mockDatabase: {
  intents: LoanIntentResponse[];
  references: LoanReference[];
} = {
  intents: [],
  references: [],
};

async function main() {
  console.log('=== CoinRabbit Lending Adapter Example ===\n');
  console.log('⚠️  REMINDER: This adapter is NON-CUSTODIAL');
  console.log('    Loans are issued by CoinRabbit, NOT TONBANKCARD\n');

  // Initialize adapter
  const adapter = createCoinRabbitAdapter({
    affiliateId: 'example-affiliate',
    chainId: 1, // TON mainnet
  });

  try {
    // =========================================================================
    // Example 1: Resolve Borrower Identity
    // =========================================================================
    console.log('1. Resolving borrower identity...\n');

    const identity = await adapter.resolveBorrowerIdentity('7777001');

    console.log('   Borrower Identity:');
    console.log(`   - NFT Account ID: ${identity.nftAccountId}`);
    console.log(`   - Collection: ${identity.collectionAddress}`);
    console.log(`   - Is Valid: ${identity.isValid}`);
    console.log(`   - Resolved At: ${identity.resolvedAt.toISOString()}`);
    console.log();

    // =========================================================================
    // Example 2: Validate NFT Account ID
    // =========================================================================
    console.log('2. Validating NFT Account IDs...\n');

    const validIds = ['7777001', '8888042', '7777999'];
    const invalidIds = ['9999001', 'invalid', ''];

    console.log('   Valid IDs:');
    validIds.forEach(id => {
      const isValid = adapter.isValidNFTAccountId(id);
      console.log(`   - ${id}: ${isValid ? '✅' : '❌'}`);
    });

    console.log('\n   Invalid IDs:');
    invalidIds.forEach(id => {
      const isValid = adapter.isValidNFTAccountId(id);
      console.log(`   - "${id}": ${isValid ? '✅' : '❌'}`);
    });
    console.log();

    // =========================================================================
    // Example 3: Create Loan Intent
    // =========================================================================
    console.log('3. Creating loan intent...\n');

    const intent = await adapter.createLoanIntent({
      nftAccountId: '7777001',
      collateralSignalId: 'signal_example_123',
      requestedAmount: '5000',
      requestedCurrency: 'USDT',
      targetLender: 'coinrabbit',
    });

    mockDatabase.intents.push(intent);

    console.log('   Loan Intent Created:');
    console.log(`   - Intent ID: ${intent.intentId}`);
    console.log(`   - Borrower: ${intent.borrowerIdentity.nftAccountId}`);
    console.log(`   - Valid Until: ${intent.expiresAt.toISOString()}`);
    console.log(`   - Lender URL: ${intent.lenderUrl}`);
    console.log();

    console.log('   Verification Data for Lender:');
    console.log(`   - Chain ID: ${intent.verificationData.chainId}`);
    console.log(`   - Protocol Version: ${intent.verificationData.protocolVersion}`);
    console.log(`   - Collection: ${intent.verificationData.collectionAddress}`);
    console.log();

    // =========================================================================
    // Example 4: Get Lender Metadata
    // =========================================================================
    console.log('4. Getting lender metadata...\n');

    const metadata = await adapter.getLenderMetadata(
      '7777001',
      'signal_example_123'
    );

    console.log('   Lender Metadata:');
    console.log(`   - NFT Account: ${metadata.nftAccountId}`);
    console.log(`   - NFT Index: ${metadata.nftIndex}`);
    console.log(`   - Collection: ${metadata.collectionAddress}`);
    console.log(`   - Collateral Signal: ${metadata.collateralSignalId}`);
    console.log(`   - Chain ID: ${metadata.chainId}`);
    console.log();

    console.log('   ⚠️  Disclaimer:');
    console.log(`   ${metadata.disclaimer}`);
    console.log();

    // =========================================================================
    // Example 5: Verify Collateral Signal (Read-Only)
    // =========================================================================
    console.log('5. Verifying collateral signal (READ-ONLY)...\n');

    const verification = await adapter.verifyCollateralSignal({
      signalId: 'signal_example_123',
      nftAccountId: '7777001',
    });

    console.log('   Verification Result:');
    console.log(`   - Is Valid: ${verification.isValid}`);
    console.log(`   - Ownership Verified: ${verification.ownershipVerified}`);
    console.log(`   - Verified At: ${verification.verifiedAt.toISOString()}`);

    if (verification.signalInfo) {
      console.log(`   - Asset Type: ${verification.signalInfo.assetType}`);
      console.log(`   - Is Active: ${verification.signalInfo.isActive}`);
    }
    console.log();

    // =========================================================================
    // Example 6: Create and Update Loan Reference
    // =========================================================================
    console.log('6. Creating loan reference (off-chain tracking)...\n');

    const reference = adapter.createLoanReference(
      intent.intentId,
      '7777001',
      undefined,
      'signal_example_123'
    );

    mockDatabase.references.push(reference);

    console.log('   Initial Reference:');
    console.log(`   - Reference ID: ${reference.referenceId}`);
    console.log(`   - Provider: ${reference.provider}`);
    console.log(`   - Status: ${reference.status}`);
    console.log(`   - Intent ID: ${reference.intentId}`);
    console.log();

    // Simulate lender confirming loan
    console.log('   Updating reference (simulating lender confirmation)...');

    const updatedReference = adapter.updateLoanReferenceStatus(
      reference,
      'active',
      {
        externalLoanId: 'coinrabbit_loan_789',
        loanAmount: '5000',
        loanCurrency: 'USDT',
      }
    );

    console.log(`   - New Status: ${updatedReference.status}`);
    console.log(`   - External Loan ID: ${updatedReference.metadata?.externalLoanId}`);
    console.log(`   - Updated At: ${updatedReference.updatedAt.toISOString()}`);
    console.log();

    // =========================================================================
    // Example 7: Get Whitelisted Collections
    // =========================================================================
    console.log('7. Getting whitelisted collections...\n');

    const collections = adapter.getWhitelistedCollections();

    console.log('   Whitelisted NFT Collections:');
    Object.entries(collections).forEach(([series, address]) => {
      console.log(`   - ${series}: ${address}`);
    });
    console.log();

    // =========================================================================
    // Summary
    // =========================================================================
    console.log('=== Mock Database Contents ===\n');

    console.log(`Intents: ${mockDatabase.intents.length}`);
    mockDatabase.intents.forEach((i, idx) => {
      console.log(`  ${idx + 1}. ${i.intentId} -> ${i.borrowerIdentity.nftAccountId}`);
    });

    console.log(`\nReferences: ${mockDatabase.references.length}`);
    mockDatabase.references.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.referenceId} (${r.status})`);
    });

    console.log('\n✅ Example completed successfully!');
    console.log('\n⚠️  REMEMBER:');
    console.log('   - This adapter does NOT issue loans');
    console.log('   - All lending happens through CoinRabbit');
    console.log('   - TONBANKCARD protocol remains a passive observer');
  } catch (error: any) {
    console.error('\n❌ Error occurred:');
    if (error.provider) {
      console.error(`   Provider: ${error.provider}`);
      console.error(`   Message: ${error.message}`);
      console.error(`   Code: ${error.code || 'N/A'}`);
    } else {
      console.error(`   ${error.message || error}`);
    }
  }
}

// Run example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
