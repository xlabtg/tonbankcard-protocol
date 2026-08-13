/**
 * TONBANKCARD Protocol — Single source of truth for the deployable contract set.
 *
 * Issue Reference: #260 — [CONTRACTS-H3] Non-functional FunC stubs
 * (payment-hub, nft_account_resolver) ship in deployable set.
 *
 * Audit finding CONTRACTS-H3 (see
 * audit/findings/CONTRACTS-H3-nonfunctional-fc-stubs-shipped.md) flagged that the
 * non-production FunC stubs `contracts/payments/payment-hub.fc` and
 * `contracts/nft-resolver/nft_account_resolver.fc` were still listed as
 * deployable. The payment-hub stub `throw`s `DEPLOY_BLOCKER_NOT_PRODUCTION_READY`
 * (0xDEAD) on every message, and the resolver stub returns dummy/empty owner data.
 *
 * To make sure neither file can be deployed or verified as a production artefact,
 * the deployable contract map below resolves PaymentHub to its production Tact
 * source. NFTAccountResolver is excluded until its Tact placeholder implements
 * an authenticated asynchronous TEP-62 request/callback flow and has Sandbox
 * coverage (Issue #426). PublicCollateralLookup is also excluded until it reads
 * Account Locks state instead of returning a stubbed result. The
 * non-production sources are kept on disk for audit reference but are listed
 * explicitly in {@link NON_PRODUCTION_STUBS} and excluded from every
 * deployment/verification manifest that imports this module.
 *
 * Regression coverage: `contracts/payment-hub/non-production-stubs.spec.ts`.
 */

/**
 * Production contracts that may be deployed (B2 mainnet scope), mapped to the
 * source file(s) that compile to the deployed bytecode.
 *
 * NOTE: the non-production FunC stubs are intentionally absent here. Adding them
 * back will fail the regression test guarding CONTRACTS-H3.
 */
export const DEPLOYABLE_CONTRACTS: Record<string, string[]> = {
  AccountLocks: ['contracts/payments/account-locks.fc'],
  AccountStateMachine: ['contracts/payment-hub/account-state.tact'],
  PaymentHub: ['contracts/payments/PaymentHub.tact'],
  MerchantPaymentHub: ['contracts/MerchantPaymentHub.tact'],
  CollateralSignal: ['contracts/CollateralSignal.tact'],
  ProposalRegistry: ['contracts/governance/ProposalRegistry.tact'],
  SnapshotVerifier: ['contracts/governance/SnapshotVerifier.tact'],
  TransparencyRegistry: ['contracts/governance/TransparencyRegistry.tact'],
};

/**
 * Non-production FunC stubs that MUST NOT appear in any deployable manifest.
 *
 * These files remain in the tree as frozen audit reference only:
 * - `payment-hub.fc` blocks every inbound message with 0xDEAD until real ledger
 *   logic lands.
 * - `nft_account_resolver.fc` is a stateless read-only reference that rejects
 *   empty/addr_none owners so a dummy owner can never pass an ownership check.
 * - `nft_account_resolver.tact` still returns the NFT address as its owner and
 *   does not implement authenticated asynchronous TEP-62 resolution (Issue #426).
 * - `PublicCollateralLookup.*` is a non-production collateral lookup because it
 *   does not yet query Account Locks state.
 * - `MerchantPaymentHubHarness.tact` (Issue #363) is a TEST-ONLY harness that
 *   re-adds the `SetAccountState` / `SetAccountBalance` bootstrap handlers removed
 *   from the deployable `MerchantPaymentHub`. It exists solely for the Jest suite
 *   and MUST NEVER be deployed.
 */
export const NON_PRODUCTION_STUBS: string[] = [
  'contracts/payments/payment-hub.fc',
  'contracts/nft-resolver/nft_account_resolver.fc',
  'contracts/nft-resolver/nft_account_resolver.tact',
  'contracts/collateral-lookup/PublicCollateralLookup.tact',
  'contracts/collateral-lookup/public-collateral-lookup.fc',
  'contracts/merchant-hub/test/MerchantPaymentHubHarness.tact',
];

/**
 * Returns the deployable source paths that collide with a non-production stub.
 * An empty array means the deployable set is clean (the expected state).
 */
export function findStubsInDeployableSet(): string[] {
  const deployableFiles = new Set(Object.values(DEPLOYABLE_CONTRACTS).flat());
  return NON_PRODUCTION_STUBS.filter(stub => deployableFiles.has(stub));
}
