/**
 * Compile projects for every source allowed by DEPLOYABLE_CONTRACTS.
 *
 * This manifest is deliberately separate from package-local Tact configs: CI
 * compares it with the deployment map before compiling, so adding a deployable
 * source without a bytecode build fails closed.
 */

export type DeployableBuildProject = {
  name: string;
  source: string;
  language: 'tact' | 'func';
};

const project = (
  name: string,
  source: string,
  language: 'tact' | 'func',
): DeployableBuildProject => ({ name, source, language });

export const DEPLOYABLE_BUILD_PROJECTS: DeployableBuildProject[] = [
  project('AccountLocks', 'contracts/payments/account-locks.fc', 'func'),
  project('AccountStateMachine', 'contracts/payment-hub/account-state.tact', 'tact'),
  project('PaymentHub', 'contracts/payments/PaymentHub.tact', 'tact'),
  project('MerchantPaymentHub', 'contracts/MerchantPaymentHub.tact', 'tact'),
  project('CollateralSignal', 'contracts/CollateralSignal.tact', 'tact'),
  project('ProposalRegistry', 'contracts/governance/ProposalRegistry.tact', 'tact'),
  project('SnapshotVerifier', 'contracts/governance/SnapshotVerifier.tact', 'tact'),
  project('TransparencyRegistry', 'contracts/governance/TransparencyRegistry.tact', 'tact'),
];
