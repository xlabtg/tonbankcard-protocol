/**
 * Regression guard for audit finding CONTRACTS-H3 (#260):
 * "Non-functional FunC stubs (payment-hub, nft_account_resolver) ship in
 * deployable set".
 *
 * These tests assert — without compiling FunC — that:
 *  1. The non-production FunC stubs are excluded from every deployable manifest.
 *  2. The payment-hub stub keeps its 0xDEAD deploy blocker on every message.
 *  3. The NFT resolver stub cannot report an empty/dummy owner as a valid account.
 *  4. The deploy/verify scripts source their contract set from the single
 *     deployable manifest (so the stubs cannot silently re-enter the set).
 *
 * The suite runs in the "Test (Contracts)" CI job (contracts/payment-hub `npm test`).
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Repository root, resolved from contracts/payment-hub/.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const STUB_FILES = [
  'contracts/payments/payment-hub.fc',
  'contracts/nft-resolver/nft_account_resolver.fc',
];

const INCOMPLETE_NFT_RESOLVER = 'contracts/nft-resolver/nft_account_resolver.tact';

const NON_PRODUCTION_COLLATERAL_LOOKUP_FILES = [
  'contracts/collateral-lookup/PublicCollateralLookup.tact',
  'contracts/collateral-lookup/public-collateral-lookup.fc',
];

const DEPLOYER_GATED_TEST_ONLY_HANDLERS = [
  {
    file: 'contracts/payment-hub/account-state.tact',
    handlers: [
      'receive(msg: DepositTBC)',
      'receive(msg: WithdrawTBC)',
      'receive(msg: TransferInternal)',
      'receive(msg: ChangeAccountState)',
    ],
  },
  {
    file: 'contracts/RecurringPayments.tact',
    handlers: ['receive(msg: RegisterNFTOwnerRecurring)'],
  },
  {
    file: 'contracts/MultiSigCard.tact',
    handlers: ['receive(msg: RegisterNFTOwnerMultiSig)'],
  },
];

const MANIFEST = 'scripts/deploy/deployable-contracts.ts';
const DEPLOY_SCRIPTS = [
  'scripts/deploy/check-immutability.ts',
  'scripts/deploy/verify.ts',
];

function read(relPath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

/**
 * Extract the body of an exported object/array literal by brace/bracket matching
 * starting at the declaration. Keeps the test independent of formatting.
 */
function extractLiteral(source: string, declaration: string, open: string, close: string): string {
  const declIdx = source.indexOf(declaration);
  expect(declIdx).toBeGreaterThanOrEqual(0);
  // Start after the `=` so a type annotation like `: string[]` is not matched.
  const start = source.indexOf('=', declIdx);
  expect(start).toBeGreaterThanOrEqual(0);
  const openIdx = source.indexOf(open, start);
  expect(openIdx).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    if (source[i] === open) depth++;
    else if (source[i] === close) {
      depth--;
      if (depth === 0) return source.slice(openIdx, i + 1);
    }
  }
  throw new Error(`Unterminated ${open}${close} literal for ${declaration}`);
}

describe('CONTRACTS-H3: non-production FunC stubs excluded from deployable set', () => {
  it('lists both stubs as non-production and keeps them out of the deployable map', () => {
    const manifest = read(MANIFEST);

    const deployable = extractLiteral(manifest, 'const DEPLOYABLE_CONTRACTS', '{', '}');
    for (const stub of STUB_FILES) {
      expect(deployable).not.toContain(stub);
    }

    const nonProduction = extractLiteral(manifest, 'const NON_PRODUCTION_STUBS', '[', ']');
    for (const stub of STUB_FILES) {
      expect(nonProduction).toContain(stub);
    }
  });

  it('keeps the production PaymentHub source in the deployable map', () => {
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');
    expect(deployable).toContain('contracts/payments/PaymentHub.tact');
  });

  it('deploy/verify scripts source their contract set from the shared manifest', () => {
    for (const script of DEPLOY_SCRIPTS) {
      const source = read(script);
      expect(source).toContain("from './deployable-contracts'");
      // The scripts must not re-introduce the stubs as inline deployable entries.
      for (const stub of STUB_FILES) {
        expect(source).not.toContain(stub);
      }
    }
  });

  it('the stub files still exist on disk as frozen audit reference', () => {
    for (const stub of STUB_FILES) {
      expect(fs.existsSync(path.join(REPO_ROOT, stub))).toBe(true);
    }
  });
});

describe('Issue #426: placeholder NFTAccountResolver is not deployable', () => {
  it('excludes the incomplete Tact resolver from production manifests', () => {
    const manifest = read(MANIFEST);
    const deployable = extractLiteral(manifest, 'const DEPLOYABLE_CONTRACTS', '{', '}');
    const nonProduction = extractLiteral(manifest, 'const NON_PRODUCTION_STUBS', '[', ']');

    expect(deployable).not.toContain(INCOMPLETE_NFT_RESOLVER);
    expect(nonProduction).toContain(INCOMPLETE_NFT_RESOLVER);
  });

  it('documents why the resolver cannot be deployed as production authority', () => {
    expect(read(INCOMPLETE_NFT_RESOLVER)).toMatch(/NON-PRODUCTION|NOT PRODUCTION READY/i);
  });
});

describe('CONTRACTS-LOW L-3: incomplete collateral lookup excluded from deployable set', () => {
  it('keeps the on-chain collateral lookup stub out of production deployment manifests', () => {
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');
    for (const source of NON_PRODUCTION_COLLATERAL_LOOKUP_FILES) {
      expect(deployable).not.toContain(source);
    }
  });

  it('marks the collateral lookup sources as non-production until Account Locks state is reflected', () => {
    for (const source of NON_PRODUCTION_COLLATERAL_LOOKUP_FILES) {
      expect(read(source)).toMatch(/NON-PRODUCTION|NOT PRODUCTION READY/i);
    }
  });
});

describe('CONTRACTS-LOW I-1: deployable contracts exclude test-only deployer-gated handlers', () => {
  it('does not deploy sources that still contain issue-specified test-only handlers', () => {
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');

    for (const { file, handlers } of DEPLOYER_GATED_TEST_ONLY_HANDLERS) {
      const source = read(file);
      const containsForbiddenHandler = handlers.some(handler => source.includes(handler));
      if (containsForbiddenHandler) {
        expect(deployable).not.toContain(file);
      }
    }
  });

  it('removes AccountStateMachine deployer-gated mint, move, withdraw, and state-change handlers', () => {
    const source = read('contracts/payment-hub/account-state.tact');
    for (const handler of DEPLOYER_GATED_TEST_ONLY_HANDLERS[0].handlers) {
      expect(source).not.toContain(handler);
    }
    expect(source).not.toContain('Unauthorized: only deployer (test-only)');
  });
});

describe('Issue #363: MerchantPaymentHub ships without test-only bootstrap handlers', () => {
  const PRODUCTION = 'contracts/MerchantPaymentHub.tact';
  const HARNESS = 'contracts/merchant-hub/test/MerchantPaymentHubHarness.tact';
  // The handlers removed from the deployable production contract before mainnet.
  // `SetAccountState` / `SetAccountBalance` were admin-mint / admin-register
  // backdoors (audit C-MPH-C1 / C-MPH-H1); `SetAccountLock` was replaced by the
  // Account-Locks-contract-gated `ApplyAccountLock`.
  const TEST_ONLY_HANDLERS = [
    'receive(msg: SetAccountState)',
    'receive(msg: SetAccountBalance)',
    'receive(msg: SetAccountLock)',
  ];

  it('keeps MerchantPaymentHub in the deployable map and the harness out of it', () => {
    const manifest = read(MANIFEST);
    const deployable = extractLiteral(manifest, 'const DEPLOYABLE_CONTRACTS', '{', '}');
    expect(deployable).toContain(PRODUCTION);
    expect(deployable).not.toContain(HARNESS);

    const nonProduction = extractLiteral(manifest, 'const NON_PRODUCTION_STUBS', '[', ']');
    expect(nonProduction).toContain(HARNESS);
  });

  it('removes every test-only bootstrap handler from the production contract', () => {
    const source = read(PRODUCTION);
    for (const handler of TEST_ONLY_HANDLERS) {
      expect(source).not.toContain(handler);
    }
    // The deployer-gated test-only require message must not survive either.
    expect(source).not.toContain('(test-only)');
  });

  it('keeps the bootstrap handlers exclusively in the non-deployable harness', () => {
    const harness = read(HARNESS);
    expect(harness).toContain('receive(msg: SetAccountState)');
    expect(harness).toContain('receive(msg: SetAccountBalance)');
  });
});

describe('Issue #397: MerchantPaymentHub registers accounts only via the trusted resolver', () => {
  // #363 removed the test-only SetAccountState / SetAccountBalance bootstrap from
  // the deployable contract and DOCUMENTED — but never implemented — a real
  // registration path, so a freshly deployed hub had permanently empty
  // nft_owners / account_states maps and every MerchantPaymentRequest failed with
  // ERROR_PAYER_NOT_EXISTS / ERROR_MERCHANT_NOT_EXISTS (audit CHECK393-M1). #397
  // ships that path: a resolver-gated, write-once ResolveNFTOwner handler that
  // mirrors CollateralSignal (#364). The behavioural reproduction + fix tests live
  // in contracts/merchant-hub/merchant-payment-hub-deployable.spec.ts; these
  // static assertions are the CI lock that the handler stays resolver-gated and
  // write-once (the merchant-hub Tact suite runs in a separate CI job).
  const PRODUCTION = 'contracts/MerchantPaymentHub.tact';
  const source = read(PRODUCTION);

  it('keeps the production MerchantPaymentHub in the deployable map', () => {
    // Like #364 (and unlike #363's removed handlers), registration now has a real
    // production path, so the contract itself stays deployable.
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');
    expect(deployable).toContain(PRODUCTION);
  });

  it('registers NFT ownership + ACTIVE state only through the resolver-gated ResolveNFTOwner handler', () => {
    // Ownership and the initial account state are pushed by the immutable, trusted
    // on-chain NFT Account Resolver — never by the admin/deployer (INVARIANT I3).
    expect(source).toContain('nft_resolver: Address');
    expect(source).toContain('receive(msg: ResolveNFTOwner)');
    expect(source).toContain('sender() == self.nft_resolver');
    expect(source).toContain('Unauthorized: only NFT resolver');
    // The handler binds the owner AND marks the account ACTIVE (the step #363 missed).
    expect(source).toContain('self.account_states.set(msg.nft_address, ACCOUNT_STATE_ACTIVE)');
  });

  it('keeps the write-once owner binding guard (CONTRACTS-M1 / #279)', () => {
    expect(source).toContain('NFT owner already registered');
    expect(source).toMatch(/self\.nft_owners\.get\(msg\.nft_address\)\s*==\s*null/);
  });

  it('does not register accounts through an admin/deployer or test-only path', () => {
    // The registration authority is the resolver, NOT the admin: the production
    // source must carry no test-only bootstrap and no admin-gated registration.
    expect(source).not.toContain('(test-only)');
    expect(source).not.toContain('receive(msg: SetAccountState)');
    // The resolver getter lets deploy/verify tooling confirm the sole authority.
    expect(source).toContain('getNFTResolver');
  });
});

describe('Issue #364: CollateralSignal binds NFT ownership only via the trusted resolver', () => {
  const PRODUCTION = 'contracts/CollateralSignal.tact';

  it('keeps the hardened CollateralSignal in the deployable map', () => {
    // Unlike #363 (which moved test-only handlers into a non-deployable harness),
    // #364 leaves NO test-only handler behind: ownership has a real production
    // registration path, so the contract itself stays deployable.
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');
    expect(deployable).toContain(PRODUCTION);
  });

  it('removes the deployer-gated test-only RegisterNFTOwner handler from production', () => {
    const source = read(PRODUCTION);
    // The test-only handler and ANY deployer-gated ownership path must never ship.
    expect(source).not.toContain('receive(msg: RegisterNFTOwner)');
    expect(source).not.toContain('self.deployer');
    expect(source).not.toContain('(test-only)');
  });

  it('registers NFT ownership only through the resolver-gated ResolveNFTOwner handler', () => {
    const source = read(PRODUCTION);
    // Ownership is pushed by the immutable, trusted on-chain NFT Account Resolver.
    expect(source).toContain('nft_resolver: Address');
    expect(source).toContain('receive(msg: ResolveNFTOwner)');
    expect(source).toContain('sender() == self.nft_resolver');
    expect(source).toContain('Unauthorized: only NFT resolver');
  });

  it('keeps the write-once owner binding guard (CONTRACTS-M1 / #279)', () => {
    const source = read(PRODUCTION);
    expect(source).toContain('NFT owner already registered');
    expect(source).toMatch(/self\.nft_owners\.get\(msg\.nft_address\)\s*==\s*null/);
  });
});

describe('CONTRACTS-H3: payment-hub.fc keeps the 0xDEAD deploy blocker', () => {
  const source = read('contracts/payments/payment-hub.fc');

  it('defines the DEPLOY_BLOCKER_NOT_PRODUCTION_READY = 0xDEAD constant', () => {
    expect(source).toMatch(/const\s+int\s+DEPLOY_BLOCKER_NOT_PRODUCTION_READY\s*=\s*0xDEAD\s*;/);
  });

  it('throws the deploy blocker as the first statement of recv_internal', () => {
    const recvIdx = source.indexOf('recv_internal');
    expect(recvIdx).toBeGreaterThanOrEqual(0);
    const body = source.slice(recvIdx);
    // The first executable statement (ignoring comments) must be the throw.
    const firstThrow = body.indexOf('throw(DEPLOY_BLOCKER_NOT_PRODUCTION_READY)');
    expect(firstThrow).toBeGreaterThanOrEqual(0);
    // No handler op-code routing can run before the blocker.
    const firstOp = body.indexOf('op == op::');
    expect(firstOp === -1 || firstThrow < firstOp).toBe(true);
  });
});

describe('CONTRACTS-H3: nft_account_resolver.fc rejects empty/dummy owners', () => {
  const source = read('contracts/nft-resolver/nft_account_resolver.fc');

  it('marks the file as a non-production reference stub', () => {
    expect(source).toMatch(/NON-PRODUCTION REFERENCE STUB/i);
  });

  it('guards resolve_owner_with_validation against non-address owners', () => {
    // is_valid must depend on a real-owner check, not just initialization/whitelist.
    expect(source).toContain('owner_addr.slice_bits()');
    expect(source).toMatch(/is_valid\s*=\s*is_initialized\s*&\s*is_whitelisted\s*&\s*owner_present/);
  });
});

describe('Issue #367: payment-hub.fc reference integrates ownership, Account Locks, and balance mutations', () => {
  // Audit findings C-PHF-C1 / C-PHF-C2 / C-PHF-H1. Synchronous cross-contract
  // reads are impossible on TON, so the reference is hardened with the SAME
  // TON-feasible patterns the production Tact hubs use: a resolver-gated owner
  // registry (#320), the ApplyAccountLock push mirror (#363), and an internal
  // TBC ledger. The file stays a NON-DEPLOYABLE audit reference (the production
  // hub is PaymentHub.tact, CONTRACTS-H3 / #260); these static assertions are
  // the CI gate that couples removing the 0xDEAD blocker to the three fixes
  // being present, since there is no FunC toolchain in CI to run the behavioural
  // integration tests (those live in contracts/payments/tests/payment-hub.spec.fc).
  const SOURCE = 'contracts/payments/payment-hub.fc';
  const INTEGRATION_TEST = 'contracts/payments/tests/payment-hub.spec.fc';
  const source = read(SOURCE);

  describe('C-PHF-C1: ownership comes from a resolver-gated registry, not a placeholder', () => {
    it('removes the get_nft_data_raw placeholder that returned empty slices', () => {
      // The dummy that pretended to read NFT data synchronously must be gone.
      expect(source).not.toContain('get_nft_data_raw');
    });

    it('rejects empty/dummy owners with a slice_bits() guard (mirrors #320)', () => {
      expect(source).toContain('owner.slice_bits()');
      expect(source).toMatch(/throw_unless\(error::invalid_nft,\s*owner\.slice_bits\(\)\s*>=\s*267\)/);
    });

    it('registers NFT ownership only through the trusted resolver, write-once', () => {
      expect(source).toContain('op::resolve_nft_owner');
      expect(source).toContain('equal_slices(sender_address, nft_resolver)');
      // Write-once binding (CONTRACTS-M1 / #279): an existing owner cannot be overwritten.
      expect(source).toMatch(/throw_if\(error::unauthorized,\s*exists\)/);
      expect(source).toContain('nft_owners~udict_set');
    });
  });

  describe('C-PHF-C2: Account Locks gate every send', () => {
    it('stores the trusted Account Locks contract and accepts lock state only from it', () => {
      expect(source).toContain('global slice account_locks_contract');
      expect(source).toContain('op::apply_account_lock');
      expect(source).toContain('equal_slices(sender_address, account_locks_contract)');
    });

    it('blocks a locked account from sending in BOTH transfer handlers', () => {
      expect(source).toContain('throw_unless(error::account_locked, can_send(from_nft))');
      expect(source).toContain('throw_unless(error::account_locked, can_send(payer_nft))');
    });
  });

  describe('C-PHF-H1: transfers move balances, not just events', () => {
    it('checks sufficient balance before sending in BOTH transfer handlers', () => {
      expect(source).toContain('throw_unless(error::insufficient_balance, from_balance >= amount)');
      expect(source).toContain('throw_unless(error::insufficient_balance, payer_balance >= amount)');
    });

    it('debits the sender and credits the recipient in BOTH transfer handlers', () => {
      expect(source).toContain('set_balance(from_nft, from_balance - amount)');
      expect(source).toContain('set_balance(to_nft, get_balance(to_nft) + amount)');
      expect(source).toContain('set_balance(payer_nft, payer_balance - amount)');
      expect(source).toContain('set_balance(merchant_nft, get_balance(merchant_nft) + amount)');
    });
  });

  describe('CI gate: the 0xDEAD blocker cannot be removed without the C-PHF-C1/C2/H1 fixes', () => {
    it('keeps the file in the non-production stub set while the blocker stands', () => {
      const nonProduction = extractLiteral(read(MANIFEST), 'const NON_PRODUCTION_STUBS', '[', ']');
      expect(nonProduction).toContain(SOURCE);
      expect(source).toMatch(/NON-PRODUCTION REFERENCE STUB/i);
      // The CONTRACTS-H3 suite above asserts the 0xDEAD blocker is still the first
      // statement of recv_internal. Together with the C-PHF assertions in this
      // block, that means the blocker can only be removed by a reviewed change
      // that also keeps the three fixes — the coupling the reviewer requested.
      expect(source).toMatch(/const\s+int\s+DEPLOY_BLOCKER_NOT_PRODUCTION_READY\s*=\s*0xDEAD\s*;/);
    });

    it('ships the C-PHF-C1/C2/H1 integration tests the blocker removal depends on', () => {
      expect(fs.existsSync(path.join(REPO_ROOT, INTEGRATION_TEST))).toBe(true);
      const tests = read(INTEGRATION_TEST);
      // The suite must reference all three findings...
      expect(tests).toContain('C-PHF-C1');
      expect(tests).toContain('C-PHF-C2');
      expect(tests).toContain('C-PHF-H1');
      // ...and actually exercise the three hardened code paths, so the file
      // cannot be gutted to comment-only stubs while still passing this gate.
      expect(tests).toContain('#include "../payment-hub.fc";');
      expect(tests).toContain('verify_nft_account(');       // C-PHF-C1 path
      expect(tests).toContain('handle_apply_account_lock(');// C-PHF-C2 path
      expect(tests).toContain('can_send(');                 // C-PHF-C2 gate
      expect(tests).toContain('handle_internal_transfer('); // C-PHF-H1 path
      expect(tests).toContain('get_balance(');              // C-PHF-H1 ledger
      expect(tests).toContain('run_tests(');                // a runner ties them together
    });
  });
});

describe('Issue #427 (CHECK423-H3): PaymentHub excludes admin balance minting', () => {
  // Issue #371 made the old InitializeAccount path create-once. Issue #427
  // removes that test-only path from production altogether: create-once still
  // allowed an admin to mint an arbitrary balance into every fresh slot.
  const PRODUCTION = 'contracts/payments/PaymentHub.tact';
  const source = read(PRODUCTION);

  it('keeps the production hub in the deployable map', () => {
    const deployable = extractLiteral(read(MANIFEST), 'const DEPLOYABLE_CONTRACTS', '{', '}');
    expect(deployable).toContain(PRODUCTION);
  });

  it('contains neither the InitializeAccount message nor its receiver', () => {
    expect(source).not.toContain('message InitializeAccount');
    expect(source).not.toContain('receive(msg: InitializeAccount)');
    expect(source).not.toContain('initial_balance');
  });

  it('keeps the account read path side-effect free so a query cannot squat a slot', () => {
    // With the write-once guard in place, any path that durably created an empty
    // slot for an arbitrary nft_address (a free GetAccountStateRequest query, a
    // validation lookup) would permanently block that account's legitimate first
    // initialization — a denial-of-service. The read helper must NOT persist.
    const fnIdx = source.indexOf('fun getAccountOrDefault');
    expect(fnIdx).toBeGreaterThanOrEqual(0);
    const nextFn = source.indexOf('\n    fun ', fnIdx + 1);
    const body = source.slice(fnIdx, nextFn === -1 ? source.length : nextFn);
    expect(body).not.toMatch(/self\.accounts\.set\(/);
    // The legacy helper that persisted a placeholder on read must be gone.
    expect(source).not.toContain('getOrCreateAccount');
  });
});
