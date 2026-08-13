#!/usr/bin/env bash
# Reproduces unresolved CHECK423 contract/off-chain findings using source-level
# assertions. Exit 0 means every documented blocker is still present.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

assert_marker() {
  local finding="$1"
  local file="$2"
  local pattern="$3"

  if ! grep -Eq "${pattern}" "${REPO_ROOT}/${file}"; then
    echo "NOT REPRODUCED: ${finding} (${file})" >&2
    return 1
  fi

  echo "REPRODUCED: ${finding} (${file})"
}

assert_marker "CHECK423-H2 resolver returns the NFT address as owner" \
  "contracts/nft-resolver/nft_account_resolver.tact" \
  'return nft_address;.*Placeholder'
assert_marker "CHECK423-H3 admin can seed arbitrary PaymentHub balance" \
  "contracts/payments/PaymentHub.tact" \
  'balance: msg\.initial_balance'
assert_marker "CHECK423-M1 MerchantPaymentHub has no external funding path" \
  "docs/governance/PARAMETERS.md" \
  'UNRESOLVED / blocks production liveness'
assert_marker "CHECK423-M3 CoinRabbit asserts ownership without a chain query" \
  "backend/adapters/coinrabbit.ts" \
  'ownershipVerified: true'
assert_marker "CHECK423-M5 Phase 4 test-only owner injection remains" \
  "contracts/RecurringPayments.tact" \
  'receive\(msg: RegisterNFTOwnerRecurring\)'
assert_marker "CHECK423-L1 governance snapshot queries are placeholders" \
  "scripts/governance/snapshot.ts" \
  'NFT address calculation not implemented'

echo "All unresolved CHECK423 blockers reproduced."
