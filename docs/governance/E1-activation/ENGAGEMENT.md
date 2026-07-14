# Engagement E1 — DAO Governance Activation

**Engagement ID:** `E1`
**Issue:** [#132 — DAO Governance Activation](https://github.com/xlabtg/tonbankcard-protocol/issues/132)
**Roadmap track:** E — DAO Operations
**Status:** Engagement preparation complete — awaiting all upstream gates (A1 `READY`, B2 `MAINNET-LIVE`)
**Maintainer:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** TONBANKCARD governance is **non-executable**. Activation does **not** grant the DAO any new authority — it makes the public proposal registry **observable** for the first time. The success criterion is `ACTIVATED-LIVE`, not "governance can change protocol state".

---

## 1. Objective

Produce a complete, frozen plan for activating the three governance contracts that B2 deploys inert (`ProposalRegistry`, `SnapshotVerifier`, `TransparencyRegistry`), and execute the activation under the **same multi-sig discipline** as B2. The engagement publishes:

- Initial governance parameters in [`../PARAMETERS.md`](../PARAMETERS.md) — ratified by `E1-PROP-001`.
- Voter snapshot methodology in [`../SNAPSHOT.md`](../SNAPSHOT.md) — ratified by `E1-PROP-001`.
- [Activation runbook](./RUNBOOK.md) — pre-flight checks, dry runs, on-chain steps, post-activation verification.
- [Testnet round-trip validation plan](./TESTNET_VALIDATION.md) — propose → vote → finalize on TON testnet (issue #132 §8 acceptance row 4).
- [First governance proposal](./ACTIVATION_PROPOSAL.md) (`E1-PROP-001`) — ratification of initial parameters.
- [Activation manifest schema](./MANIFEST_TEMPLATE.json) — append-only record of activation events.
- [Status tracker](./STATUS.md) — live gate / phase view.

The engagement is the **first activity** of roadmap track **E**. It uses (and does not redeploy) the governance contracts deployed by B2.

Success criteria mirror the acceptance criteria in issue #132 §8:

- [ ] A1 audit complete (prerequisite — see §4 G-1)
- [ ] B2 mainnet deployment complete (prerequisite — see §4 G-2)
- [ ] All three governance contracts deployed to testnet ([`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md) §2)
- [ ] Testnet governance round-trip tested — propose → vote → execute ([`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md) §3)
- [ ] Initial governance parameters documented in [`../PARAMETERS.md`](../PARAMETERS.md) ✅ (this engagement)
- [ ] Voter snapshot methodology documented in [`../SNAPSHOT.md`](../SNAPSHOT.md) ✅ (this engagement)
- [ ] Governance activation proposal published to community ([`ACTIVATION_PROPOSAL.md`](./ACTIVATION_PROPOSAL.md))
- [ ] Contracts deployed to mainnet after testnet validation (gated by §4 G-2 — done in B2)

> The mainnet **deployment** of governance contracts is performed under **B2's** multi-sig ceremony (rows 8–10 of the deterministic deploy order, see [`../../deployments/B2-mainnet/DEPLOYMENT_PLAN.md`](../../deployments/B2-mainnet/DEPLOYMENT_PLAN.md) §3). B2 deploys the contracts **inert**; this engagement (E1) is responsible for **activation** — flipping the `activated` flag in [`../../deployments/network-matrix.md`](../../deployments/network-matrix.md) only after a 7-day soak window and a passing testnet round-trip.

---

## 2. In-scope contracts

E1 does **not** redeploy any contract. It activates the inert governance group already deployed by B2:

| # | Contract | Source | Role | Activation effect |
|---|----------|--------|------|-------------------|
| 1 | `ProposalRegistry` | `contracts/governance/ProposalRegistry.tact` | Records proposal metadata, votes, outcomes | Indexer begins mirroring events; UI exposes "Create proposal" affordance |
| 2 | `SnapshotVerifier` | `contracts/governance/SnapshotVerifier.tact` | Records eligibility per proposal | Indexer begins registering snapshots on proposal submission |
| 3 | `TransparencyRegistry` | `contracts/governance/TransparencyRegistry.tact` | Read-only mirror of governance events | Indexer begins streaming events into the public mirror |

Cross-contract wiring:

- `SnapshotVerifier.proposal_registry` is bound to the mainnet `ProposalRegistry` address via the **one-time** typed `SetProposalRegistry` message. This is part of the activation runbook ([`RUNBOOK.md`](./RUNBOOK.md) §4 step 4-3).
- `TransparencyRegistry` consumes the events emitted by `ProposalRegistry` and `SnapshotVerifier` via the indexer. There is **no direct on-chain link** between them by design (one-way, advisory-only).

---

## 3. Out of scope

Explicitly **not** part of E1 (issue #132 §4):

- **Protocol parameter governance** (E2).
- **Risk Authority decentralisation** (E3).
- **On-chain transparency reporting implementation** (E4) — E1 only flips the indexer mirror to "on".
- **Changes to the governance contract code** — any change is a B2 redeployment, not an E1 activity.
- **Mainnet deployment of governance contracts** — owned by B2 (deploy inert) and gated by A1.
- **Delegation, TBC-weighted voting, fractionalisation** — all explicitly excluded from the activation cycle (see [`../SNAPSHOT.md`](../SNAPSHOT.md) §2.1).
- **Treasury / grant disbursement** — there is no treasury (`docs/dao-governance.md` §"No DAO Treasury Contract").

---

## 4. Upstream gates

The engagement may begin once all rows below are ✅. The live state of each gate is mirrored in [`STATUS.md`](./STATUS.md) §2.

| # | Gate | Owner | Evidence |
|---|------|-------|----------|
| G-1 | A1 verdict = `READY` for Phase 2 contracts (incl. governance group) | Auditor `@A1` | [`../../security/audits/A1-core-contracts/STATUS.md`](../../security/audits/A1-core-contracts/STATUS.md) |
| G-2 | B2 verdict = `MAINNET-LIVE` after the 24-hour soak window | `@konard` | [`../../deployments/B2-mainnet/STATUS.md`](../../deployments/B2-mainnet/STATUS.md) §1 |
| G-3 | Mainnet manifest for B2 records governance group with `activated: no` | `@konard` | [`../../deployments/B2-mainnet/MANIFEST_TEMPLATE.json`](../../deployments/B2-mainnet/MANIFEST_TEMPLATE.json) + actual manifest commit |
| G-4 | Payment-block 7-day soak elapsed without Critical findings | `@konard` | B2 STATUS §"Soak window" + B3 alert log |
| G-5 | Testnet round-trip executed and report attached | `@konard` | [`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md) §3 |
| G-6 | `PARAMETERS.md` and `SNAPSHOT.md` reviewed by a second pair of eyes | `@konard` + reviewer | GitHub PR review |
| G-7 | Indexer governance pipeline live in staging (mirrors `ProposalSubmitted`, `VoteCast`, `ProposalFinalized`, `SnapshotRegistered` to `TransparencyRegistry`) | `@konard` | `backend/indexer/src/governance/` + B3 dashboard |
| G-8 | First proposal `E1-PROP-001` drafted and 24-hour Phase-1 cool-down (per [`../SNAPSHOT.md`](../SNAPSHOT.md) §3.2) elapsed | `@konard` | GitHub Discussions thread URL recorded in [`STATUS.md`](./STATUS.md) §3 |
| G-9 | `SnapshotVerifier.proposal_registry` bound (`SetProposalRegistry`) — one-time, irreversible | Multi-sig signer #1 | On-chain binding transaction recorded in activation manifest |
| G-10 | Activation manifest committed and `network-matrix.md` updated atomically | `@konard` | PR linking commit hash + manifest path |

> Gate G-2 implies all of B2's own gates (G-1 … G-10 in `B2-mainnet/STATUS.md`) are ✅. Gate G-9 is irreversible because `SnapshotVerifier.SetProposalRegistry` rejects further calls once `proposal_registry != null`.

---

## 5. Phases

### Phase 1 — Preparation (this PR)

- Author `PARAMETERS.md`, `SNAPSHOT.md`, the engagement package.
- CI verifies parameter table cross-walk against contract constants (see [`PARAMETERS.md`](../PARAMETERS.md) §4 — extension of `scripts/deploy/verify.ts`).
- No on-chain actions.

### Phase 2 — Testnet round-trip

- Run the round-trip per [`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md).
- Output: signed report attached to [`STATUS.md`](./STATUS.md) §4.
- Failure path: any `CRITICAL` finding aborts the engagement, restarts at Phase 1.

### Phase 3 — Indexer enable (staging only)

- Indexer mirror activated in staging (`B3-monitoring` shows green for governance events).
- No mainnet contract calls.
- Output: B3 dashboard screenshot + alert-rule attestation in [`STATUS.md`](./STATUS.md) §5.

### Phase 4 — Mainnet bind (one-time)

- Multi-sig signs the typed `SetProposalRegistry` transaction (G-9).
- Activation manifest written, `network-matrix.md` updated in the same PR.
- Output: signed manifest + PR URL in [`STATUS.md`](./STATUS.md) §6.

### Phase 5 — First proposal

- `E1-PROP-001` submitted on mainnet per [`ACTIVATION_PROPOSAL.md`](./ACTIVATION_PROPOSAL.md).
- 7-day voting window.
- Finalisation by any wallet.
- Outcome recorded in [`STATUS.md`](./STATUS.md) §7.

### Phase 6 — Verdict

- Verdict `ACTIVATED-LIVE` declared **only** if Phase 5 outcome is `ACCEPTED` and no `CRITICAL` finding from the indexer / audit script.
- A `REJECTED` or `NO_QUORUM` outcome **does not** roll the activation back — it triggers a follow-up proposal cycle to amend parameters, but the contracts remain activated.

---

## 6. Security requirements (issue #132 §7)

| Requirement | Mapping |
|-------------|---------|
| A1 audit complete before mainnet deployment | Gate G-1 + B2 owns deployment |
| Proposal execution timelock ≥ 48 h | Re-interpreted as off-chain implementation cooldown ≥ 48 h — see [`../PARAMETERS.md`](../PARAMETERS.md) §5. No on-chain timelock is introduced (would re-introduce execution authority) |
| Quorum set conservatively (high) | P-4 fixed at 23 votes (ceil 10 % of supply), at the conservative end of the 10–20 % band in `docs/dao-governance.md` |
| Snapshot block taken before proposal creation to prevent vote buying | Enforced by [`../SNAPSHOT.md`](../SNAPSHOT.md) §3 and runbook step 5 ordering |

Additional engagement-level hardening:

- The `SetProposalRegistry` transaction (G-9) is irreversible; the runbook treats accidental re-call as a CRITICAL incident and the contract correctly rejects it with `"Registry already set"` (write-once guard). The binding is also **sender-authenticated** — accepted only from `sender() == deployer` — and the typed payload stores the actual registry address (Issue #414).
- **Eligibility-oracle writer authentication (Issue #370 / PC-01).** `SnapshotVerifier.RegisterSnapshot` is accepted **only** from the on-chain–authorised `trusted_indexer`; the slot starts `null`, so the handler **fails closed** until the deployer (governance multi-sig) designates the indexer wallet via deployer-only, rotatable `SetTrustedIndexer` (RUNBOOK §5 step 3). Forged eligibility rolls from arbitrary senders are rejected on-chain.
- The `SnapshotVerifier.isEligible` default is **fail-closed**: it returns `false` for any NFT when no authorised snapshot is registered (audit L-2 — there is no permissive "all in-range NFTs eligible" fallback). The indexer additionally refuses to count votes unless `hasSnapshot == true`, so a missing or unauthorised snapshot can never enfranchise voters.
- The activation does not enable any **mutable** state on the governance contracts beyond what the contracts themselves expose; there is no admin key, no upgrade path, no pause primitive.

---

## 7. Non-functional requirements (issue #132 §6)

| Requirement | Mapping |
|-------------|---------|
| Governance deploy uses same multi-sig deployer as B2 | Deployment is done by B2; the only mainnet write E1 performs (`SetProposalRegistry`) uses the same multi-sig per [`RUNBOOK.md`](./RUNBOOK.md) §4 |
| Voting period ≥ 7 days | P-3 fixed at 604 800 s |
| Quorum high enough to prevent capture | P-4 fixed at 23 |
| All governance actions logged via TransparencyRegistry | Indexer mirror enabled in Phase 3; the contract already emits events natively |

---

## 8. Acceptance gate

The engagement transitions to **verdict** state only when every row in §1 success criteria is ✅. Verdicts:

- `READY-FOR-E2` — Phase 6 complete, `E1-PROP-001` ACCEPTED, no CRITICAL findings.
- `ACTIVATED-LIVE` — synonym used by downstream tracks once `network-matrix.md` shows `activated: yes` for all three governance contracts.
- `ABORTED` — any CRITICAL finding before G-9; engagement re-cycles.

The verdict is recorded in [`STATUS.md`](./STATUS.md) §1 by the engagement maintainer, attested by the verification reviewer.

---

## 9. References

- Issue [#132](https://github.com/xlabtg/tonbankcard-protocol/issues/132)
- [`../PARAMETERS.md`](../PARAMETERS.md)
- [`../SNAPSHOT.md`](../SNAPSHOT.md)
- [`RUNBOOK.md`](./RUNBOOK.md)
- [`TESTNET_VALIDATION.md`](./TESTNET_VALIDATION.md)
- [`ACTIVATION_PROPOSAL.md`](./ACTIVATION_PROPOSAL.md)
- [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json)
- [`STATUS.md`](./STATUS.md)
- [`../../deployments/B2-mainnet/ENGAGEMENT.md`](../../deployments/B2-mainnet/ENGAGEMENT.md)
- [`../../deployments/B2-mainnet/MULTISIG_CEREMONY.md`](../../deployments/B2-mainnet/MULTISIG_CEREMONY.md)
- [`../../production/B3-monitoring/ENGAGEMENT.md`](../../production/B3-monitoring/ENGAGEMENT.md)
- [`../../dao-governance.md`](../../dao-governance.md)
- [`../../governance-process.md`](../../governance-process.md)
- [`../../governance-transparency.md`](../../governance-transparency.md)
- `contracts/governance/ProposalRegistry.tact`
- `contracts/governance/SnapshotVerifier.tact`
- `contracts/governance/TransparencyRegistry.tact`
