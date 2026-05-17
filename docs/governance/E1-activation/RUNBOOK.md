# E1 — Activation Runbook

**Engagement:** [E1](./ENGAGEMENT.md)
**Issue:** [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132)
**Status:** Frozen at engagement preparation — executed once all upstream gates are ✅
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Read first.** This document tells the operator *how* to activate the governance contracts deployed by B2. It is a step-by-step recipe with **idempotent**, **append-only** semantics. The runbook contains **no destructive operations** — there is no rollback, no pause, no upgrade primitive. Mistakes are corrected by appending a new manifest, never by editing past records.

---

## 1. Pre-flight checks

Before any operator action, verify each row. A `✗` aborts the runbook.

| # | Check | Method | Expected |
|---|-------|--------|----------|
| 1.1 | Working tree clean on the activation commit | `git status --porcelain` | empty |
| 1.2 | Activation commit matches B2 freeze metadata | `cat audit/FREEZE_METADATA.md \| grep commit` | matches `git rev-parse HEAD` |
| 1.3 | B2 manifest shows governance group `activated: no` | `jq '.contracts[] \| select(.name \| startswith("Proposal") or startswith("Snapshot") or startswith("Transparency")) \| .activated' deployments/mainnet/<latest>.json` | `"no"` for all three |
| 1.4 | `PARAMETERS.md` parameter table matches contract constants | `npx ts-node scripts/governance/verify-parameters.ts` | exit 0 |
| 1.5 | A1 verdict = `READY` | `cat docs/security/audits/A1-core-contracts/STATUS.md` | `Verdict: READY` |
| 1.6 | B2 verdict = `MAINNET-LIVE` after 24-h soak | `cat docs/deployments/B2-mainnet/STATUS.md` | `Gating verdict: MAINNET-LIVE` |
| 1.7 | 7-day payment-block soak elapsed without Critical | B3 alert log | 0 CRITICAL rows in the 7-day window |
| 1.8 | Testnet round-trip report exists with verdict `PASS` | `docs/governance/E1-activation/STATUS.md` §4 | `Audit-script verdict: PASS` |
| 1.9 | Indexer staging mirror green for governance events | B3 dashboard | `R-014 GovernanceEventGap` armed, mirror lag < 60 s |
| 1.10 | Maintainer cooldown counter shows ≥ 48 h since last related governance change | local check | `now - last_change ≥ 48h` |

If any check fails, abort and address the root cause. **Do not** flip individual gates manually.

---

## 2. Environment

The runbook expects the following environment, identical to B2's runbook env contract (`scripts/deploy/MAINNET_RUNBOOK.md` §5):

| Variable | Source | Notes |
|----------|--------|-------|
| `MAINNET_RPC_URL` | Operator workstation | Authenticated archive endpoint |
| `MULTISIG_DEPLOYER_ADDRESS` | B2 manifest | Equals deploy.signer multi-sig |
| `PROPOSAL_REGISTRY_ADDRESS` | B2 manifest | Mainnet address of `ProposalRegistry` |
| `SNAPSHOT_VERIFIER_ADDRESS` | B2 manifest | Mainnet address of `SnapshotVerifier` |
| `TRANSPARENCY_REGISTRY_ADDRESS` | B2 manifest | Mainnet address of `TransparencyRegistry` |
| `INDEXER_STAGING_URL` | B3 monitoring | Used for §3 verification only |
| `INDEXER_MAINNET_URL` | B3 monitoring | Used for §5 verification |

No private keys, mnemonics, or session cookies are loaded into the operator workstation. Signing is done on hardware wallets per [`../../deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../../deployments/B2-mainnet/MULTISIG_CEREMONY.md).

---

## 3. Indexer enable (staging)

E1 does **not** modify mainnet indexer config before §4. The staging mirror is the rehearsal:

1. **Staging deploy.** Apply the indexer governance module (`backend/indexer/src/governance/`) to the staging environment. Tag the staging release.
2. **Replay.** Replay the testnet events from §1.8 against the staging indexer. Verify each event type:
   - `ProposalSubmitted` → row in `governance_proposals` view.
   - `SnapshotRegistered` → row in `governance_snapshots` view.
   - `VoteCast` → row in `governance_votes` view (without `voter_nft_id` — see [`../PARAMETERS.md`](../PARAMETERS.md) §3 P-11).
   - `ProposalFinalized` → row in `governance_proposals` with terminal status.
3. **Mirror to TransparencyRegistry on testnet.** Confirm that the indexer's relay path actually publishes events to the testnet `TransparencyRegistry`.
4. **B3 dashboard.** Verify the "Governance — events / hour" panel is non-empty and the `R-014 GovernanceEventGap` alert is armed.

Output of §3: a passing staging report stored at `audit/governance-snapshots/staging-replay.json`. Failure here aborts; do not proceed to §4.

---

## 4. Mainnet bind (Phase 4 — one-time, irreversible)

This is the **only** mainnet on-chain action performed by E1. It binds `SnapshotVerifier.proposal_registry` to the mainnet `ProposalRegistry` address.

### 4.1 Why one transaction?

`SnapshotVerifier.set_registry` is guarded by `require(self.proposal_registry == null)`. A successful call permanently freezes the binding. A failed call (e.g. wrong sender) is rejected by the contract and does not consume the slot.

### 4.2 Construct the message

```ts
// scripts/governance/build-set-registry.ts
const cell = beginCell()
  .storeUint(0, 32)         // op = empty (text comment)
  .storeStringTail("set_registry")
  .endCell();

const intent = {
  to:    SNAPSHOT_VERIFIER_ADDRESS,
  value: toNano("0.05"),    // generous gas; refunded surplus
  body:  cell,
  sendMode: 1,              // pay fees separately
};
```

The script writes a signed JSON intent under `experiments/governance/intents/<timestamp>.json` for offline review.

### 4.3 Multi-sig signing

Two of three B2 signers sign the intent on their hardware wallets following [`../../deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../../deployments/B2-mainnet/MULTISIG_CEREMONY.md) §3.2 — **the same identities** that performed the B2 ceremony.

Anti-foot-gun rules (mirrors B2 AF-1..AF-10):

- AF-E1-1. The **sender** of `set_registry` must be the B2 multi-sig. The runbook rejects sends from EOA hot wallets.
- AF-E1-2. The recipient address **must** equal `SNAPSHOT_VERIFIER_ADDRESS` from the B2 manifest. The runbook rejects any other address.
- AF-E1-3. The intent body **must** be exactly `set_registry` (text comment). No additional bytes.
- AF-E1-4. The value **must** be ≤ 0.1 TON. The runbook rejects larger.
- AF-E1-5. The intent **must** not bundle other operations.

### 4.4 Broadcast

The signed transaction is broadcast via the operator's archive RPC. The runbook waits for ≥ 32 master-chain block confirmations before declaring success.

### 4.5 Verification (immediate)

| Check | Method | Expected |
|-------|--------|----------|
| Get-method `getProposalRegistry` returns `ProposalRegistry` address | RPC | `=` `PROPOSAL_REGISTRY_ADDRESS` |
| A second `set_registry` send is rejected | RPC dry-run | `Registry already set` |
| B3 alert silence | dashboard | No alert flips during the binding |

### 4.6 Activation manifest

The operator writes `docs/governance/E1-activation/activations/<timestamp>.json` against [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json). The same PR updates `docs/deployments/network-matrix.md` to flip the governance group from `activated: no` to `activated: yes` and updates `docs/existing-contracts.md` with the activation note.

The PR is reviewed by the verification reviewer **before** §5. Two-reviewer attestation is required because the manifest is append-only — there is no edit path post-merge.

---

## 5. First proposal submission (Phase 5 — `E1-PROP-001`)

Once §4 is merged and `network-matrix.md` shows `activated: yes`:

1. **Snapshot block.** Per [`../SNAPSHOT.md`](../SNAPSHOT.md) §3.2, the operator picks the snapshot block. Records it in [`STATUS.md`](./STATUS.md) §3.
2. **Eligibility map.** Indexer builds the map per [`../SNAPSHOT.md`](../SNAPSHOT.md) §4. Operator pins proposal metadata to IPFS and records the CID.
3. **`RegisterSnapshot`.** Multi-sig sends `SnapshotVerifier.RegisterSnapshot{proposal_id=1, timestamp=<gen_utime>, eligible_nfts=<map>}`. Awaits `SnapshotRegistered` event.
4. **`SubmitProposal`.** Multi-sig sends `ProposalRegistry.SubmitProposal{metadata_hash=<sha256>, author_nft_id=<id>, category=0, voting_duration=604800, quorum_threshold=22}`. Awaits `ProposalSubmitted` event.
5. **Communications.** Communications lead posts the proposal link on GitHub Discussions, the project README banner, and the merchant newsletter. The voting window is 7 days; communications cadence is `T+0`, `T+72h`, `T+144h`, `T+168h - 12h`.
6. **Voting.** Holders cast votes from any TON wallet (TBC Diamonds NFT ownership at `snapshot_seqno` required).

### 5.1 Anti-foot-gun rules for §5

- AF-E1-6. `RegisterSnapshot` **must** precede `SubmitProposal`. The runbook rejects the inverse order. Without snapshot, the contract's `isEligible` fallback would silently mark every NFT eligible — see [`../SNAPSHOT.md`](../SNAPSHOT.md) §4.1.
- AF-E1-7. `quorum_threshold` **must** be ≥ 22. The runbook rejects smaller values.
- AF-E1-8. `voting_duration` **must** be ≥ 604 800. The runbook rejects smaller values.
- AF-E1-9. The proposal author NFT ID **must** appear with `eligible = true` in the just-registered snapshot.
- AF-E1-10. The proposal metadata hash on-chain **must** match the IPFS CID's SHA-256.

---

## 6. Finalisation & cooldown

### 6.1 Finalisation

Any wallet (typically the maintainer team) calls `ProposalRegistry.FinalizeProposal{proposal_id=1}` after `now() > voting_end`. The call is idempotent; replays are rejected by the contract.

### 6.2 Off-chain cooldown ≥ 48 hours

The maintainer team observes the cooldown defined in [`../PARAMETERS.md`](../PARAMETERS.md) §5. The cooldown counter starts at the `ProposalFinalized` event timestamp.

CI gate: `scripts/governance/check-cooldown.ts` runs on every PR that mentions a proposal ID. The script fails the PR if the commit timestamp is < `proposal_finalized_at + 48h` and the PR is not in the explicit "draft / discussion" allow-list.

---

## 7. Continuous verification (post-activation)

After Phase 5, the following checks run continuously:

| Check | Frequency | Tooling |
|-------|-----------|---------|
| Parameter table cross-walk (`PARAMETERS.md` ↔ contract constants) | Every commit | `scripts/governance/verify-parameters.ts` (CI) |
| Indexer mirror lag | Continuous | B3 alert `R-014 GovernanceEventGap` (max 60 s) |
| Audit script per proposal | On `ProposalFinalized` | `scripts/governance/audit-snapshot.ts <id>` |
| Cooldown gate | On every PR | `scripts/governance/check-cooldown.ts` |
| `set_registry` invariant | Daily | `scripts/governance/check-registry-binding.ts` — fails if `SnapshotVerifier.getProposalRegistry()` ≠ `PROPOSAL_REGISTRY_ADDRESS` |

The checks have no side effects on the chain — they read state, emit alerts, and fail CI when they detect drift.

---

## 8. Failure modes & responses

| Failure | Severity | Response |
|---------|----------|----------|
| §4 `set_registry` reverts (bad sender) | LOW | Re-sign with multi-sig; transaction is idempotent against contract state |
| §4 confirmed but `getProposalRegistry()` returns wrong address | CRITICAL | Engagement aborts; cycle a new B2 deployment of `SnapshotVerifier` (binding is irreversible per contract) |
| §5 `RegisterSnapshot` fails | LOW | Investigate eligibility map; re-send; no state change on failure |
| §5 `SubmitProposal` succeeds **before** `RegisterSnapshot` | CRITICAL | Engagement aborts; `E1-PROP-001` is invalid because fallback eligibility allowed all NFTs. Restart at §5.1 with a new proposal ID |
| Vote-window outage (no votes in 7 days) | HIGH | Proposal finalises as `NO_QUORUM`. Activation stays live; cycle a new proposal with extended outreach |
| Indexer mirror gap > 60 s | HIGH | B3 page on-call; investigate; no on-chain action required |
| Holders dispute snapshot | MEDIUM | Run dispute path in [`../SNAPSHOT.md`](../SNAPSHOT.md) §6.4 |

There is **no** rollback for the activation itself because there is no on-chain primitive that "deactivates" a governance contract. Aborting means flipping the indexer mirror off and posting an advisory; the contract remains queryable.

---

## 9. Operator checklist (printable)

```
☐ §1 pre-flight all rows ✅
☐ §3 staging report at audit/governance-snapshots/staging-replay.json — verdict PASS
☐ §4.2 intent file generated and reviewed offline
☐ §4.3 two-of-three multi-sig signatures collected
☐ §4.4 transaction broadcast and confirmed (≥32 mc-blocks)
☐ §4.5 verification rows all ✅
☐ §4.6 activation manifest committed; network-matrix.md updated atomically
☐ §5 snapshot block selected per ../SNAPSHOT.md §3.2
☐ §5 RegisterSnapshot confirmed before SubmitProposal
☐ §5 SubmitProposal confirmed; ProposalSubmitted event mirrored
☐ §5 communications cadence executed
☐ §6 FinalizeProposal called after voting_end
☐ §6 cooldown counter started
☐ §7 continuous checks armed
☐ STATUS.md §6/§7 fully populated
☐ Verdict declared: ACTIVATED-LIVE
```

---

## 10. References

- [`ENGAGEMENT.md`](./ENGAGEMENT.md)
- [`STATUS.md`](./STATUS.md)
- [`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md)
- [`ACTIVATION_PROPOSAL.md`](./ACTIVATION_PROPOSAL.md)
- [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json)
- [`../PARAMETERS.md`](../PARAMETERS.md)
- [`../SNAPSHOT.md`](../SNAPSHOT.md)
- [`../../deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../../deployments/B2-mainnet/MULTISIG_CEREMONY.md)
- [`../../deployments/B2-mainnet/MANIFEST_TEMPLATE.json`](../../deployments/B2-mainnet/MANIFEST_TEMPLATE.json)
- [`../../production/B3-monitoring/ALERT_RULES.md`](../../production/B3-monitoring/ALERT_RULES.md)
- `contracts/governance/ProposalRegistry.tact`
- `contracts/governance/SnapshotVerifier.tact`
- `contracts/governance/TransparencyRegistry.tact`
