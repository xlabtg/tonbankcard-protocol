# Protocol Parameter Change Proposals

**Engagement:** [E2 — Protocol Parameter Governance](https://github.com/xlabtg/tonbankcard-protocol/issues/133)
**Companion document:** [`PARAMETERS.md`](./PARAMETERS.md)
**Status:** Proposed — to be ratified together with the §§ 8–11 additions to `PARAMETERS.md` via the second governance proposal (`E2-PROP-001`)
**Owner:** `@konard`
**Last Updated:** 2026-05-17

---

> **Reminder.** Governance is **non-executable** by design (see [`docs/dao-governance.md`](../dao-governance.md)). This template produces the off-chain proposal text whose SHA-256 hash is anchored on-chain via `ProposalRegistry.SubmitProposal`. After the proposal finalises as `ACCEPTED`, the contract `admin` multi-sig — **not** the ProposalRegistry — sends the setter message that actually mutates the parameter, observing the cooldown in `PARAMETERS.md` §9. The on-chain audit trail in `TransparencyRegistry` links the setter transaction back to the proposal via the embedded `proposal_id`.

---

## 1. When to file a parameter-change proposal

You **must** use this template — and **must not** use any of the shorter category templates (`docs/governance-process.md` Phase 1) — when your proposal would, if implemented, change any parameter listed in [`PARAMETERS.md`](./PARAMETERS.md) §§ 8.2–8.5 with classification **G** (governance-controlled) or **T** (time-locked).

If your proposal only changes a parameter classified **I** (immutable / `const`), it is a redeployment proposal — use the redeployment template in [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) §8 instead. If it only changes a **U** (user-controlled) state element, no governance proposal is required at all.

If you are unsure of the classification, run:

```bash
node scripts/governance/check-parameter-changes.ts --classify PP-<n>
```

The script prints the classification, the recommended quorum, and the cooldown.

---

## 2. Template (copy into your proposal markdown file)

```markdown
# Parameter Change Proposal — `<short-slug>`

**Proposal ID (on-chain):** TBD (assigned by `ProposalRegistry.SubmitProposal`)
**Author NFT ID:** _<your TBC Diamonds NFT ID, 1–222>_
**Category:** _<one of: ROADMAP_SIGNAL (0), INTEGRATION_RECOMMENDATION (1), RISK_DISCLOSURE (3); per `PARAMETERS.md` §9>_
**Snapshot block:** TBD (see [`SNAPSHOT.md`](./SNAPSHOT.md) §3)
**Voting window:** TBD (≥ 7 days)
**Quorum threshold:** _<must be ≥ value in `PARAMETERS.md` §9 for this parameter>_
**Off-chain cooldown:** _<must be ≥ value in `PARAMETERS.md` §9 for this parameter>_
**Last Updated:** YYYY-MM-DD

---

## 1. Abstract

_One paragraph (≤ 80 words) summarising the change. Must name the parameter ID (e.g. `PP-13`), the contract, the current value, the proposed value, and the expected user-visible effect._

## 2. Parameter identification

| Field | Value |
|-------|-------|
| Parameter ID | `PP-<n>` (per [`PARAMETERS.md`](./PARAMETERS.md) §8) |
| Contract | `<contracts/.../*.tact>` |
| Setter message | `<receive(msg: …)>` |
| Current value | `<hex / decimal / address / map content>` |
| Current value SHA-256 | `<32-byte hex digest>` (for non-scalar values) |
| Proposed value | `<hex / decimal / address / map content>` |
| Proposed value SHA-256 | `<32-byte hex digest>` (for non-scalar values) |
| Effective contract address | `<EQ…>` (must match the latest deployment manifest) |
| Executor multi-sig | `<EQ…>` (must equal the contract's `admin` field at finalisation) |
| Executor signer threshold | `<m>-of-<n>` (must be ≥ 2-of-3 per `PARAMETERS.md` §10) |

For map-valued parameters (e.g. `whitelisted_collections`, `authorized_relayers`) the "current value" and "proposed value" fields list the **diff** (entries added, removed, or modified) plus the SHA-256 of the canonical JSON serialisation of the post-change map.

## 3. Rationale

_Explain why this change is necessary, what alternatives were considered, and why those alternatives were rejected. Cite community discussion threads, audit findings, or external dependencies where relevant. ≤ 1000 words._

## 4. Risk assessment

| Risk dimension | Assessment |
|----------------|------------|
| User funds at risk | `<None / Low / Medium / High>` — _justify_ |
| Reversibility | `<Reversible by a follow-up proposal / Irreversible>` |
| Audit coverage | `<Covered by existing audit / Requires re-audit>` — cite audit ID |
| Off-chain dependency | `<None / Indexer / SDK / Wallet UI / Dashboard>` |
| Cross-contract impact | `<List contracts whose behaviour may be affected>` |

The risk assessment **must** be signed by ≥ 2 maintainers (recorded in §10).

## 5. Quorum justification

_If the recommended quorum in `PARAMETERS.md` §9 is the default 23 votes, state so. If a higher quorum is requested (e.g. 44 votes), justify the supermajority._

## 6. Execution plan

1. **T+0** (proposal `ACCEPTED`): the executor multi-sig confirms the outcome and opens an internal ticket.
2. **T+0 → T+<cooldown>**: cooldown window. The multi-sig **must not** sign the setter transaction during this window. Indexer logs the cooldown start in `TransparencyRegistry` via the `proposal_id`.
3. **T+<cooldown>**: the multi-sig signers convene (in person or via documented video ceremony) and produce the setter transaction. The transaction's `msg_body` includes the `proposal_id` as the first 8 bytes for indexer linkage.
4. **T+<cooldown>+<gas confirmation>**: indexer detects the setter transaction, asserts `from == admin`, asserts `proposal_id` matches an `ACCEPTED` proposal whose `parameter_id` matches the setter, and appends a line to `docs/governance/parameter-changes.log`.
5. **T+<cooldown>+24 h**: the maintainer team publishes a confirmation post that cross-links the proposal, the setter transaction, and the audit-log line.

## 7. Rollback plan

_If the change causes a regression, describe the rollback. The rollback is itself a new parameter-change proposal (parameter-revert proposals do not bypass the cooldown). State the worst-case time-to-revert and any compensating controls (e.g. wallet-UI feature flag) that mitigate damage during the rollback window._

## 8. TransparencyRegistry logging requirement

The author **must** confirm:

- [ ] The setter message handler in the target contract embeds the `proposal_id` in the outgoing event (or the indexer is configured to capture the `proposal_id` from the call site).
- [ ] The indexer parameter-change tracker (`scripts/governance/check-parameter-changes.ts`) recognises `PP-<n>` (run the script with `--classify PP-<n>` to confirm).
- [ ] The post-change diff will be reproducible from `TransparencyRegistry` state alone.

If any box is unchecked, the proposal is incomplete and must not be submitted on-chain.

## 9. Voting recommendation

_Author's recommended outcome (FOR / AGAINST / ABSTAIN) and one-paragraph justification. Holders are not bound by the author's recommendation._

## 10. Signatures

| Role | Name / handle | Signature method | Signed at |
|------|---------------|------------------|-----------|
| Author | `@<handle>` (NFT #<id>) | Diamond signature over proposal hash | YYYY-MM-DD |
| Maintainer reviewer 1 | `@<handle>` | GPG-signed commit citing proposal hash | YYYY-MM-DD |
| Maintainer reviewer 2 | `@<handle>` | GPG-signed commit citing proposal hash | YYYY-MM-DD |
| Executor multi-sig (post-cooldown) | `EQ…` | Multi-sig setter transaction | YYYY-MM-DD (filled in at T+cooldown) |

## 11. Appendices

- **A — Proposal metadata JSON**: paste the canonical JSON serialisation here. The SHA-256 of this exact JSON is the on-chain `metadata_hash`.
- **B — Cross-links**: list discussion thread URLs, audit reports, related issues, prior parameter changes for the same parameter.
- **C — Test plan**: list the tests (in `tests/governance/`) that will be re-run before the executor signs the setter transaction. Include the round-trip test in [`tests/governance/ParameterGovernance.spec.ts`](../../tests/governance/ParameterGovernance.spec.ts).
```

---

## 3. Validation checklist

Before submitting a parameter-change proposal on-chain, run:

```bash
node scripts/governance/check-parameter-changes.ts \
  --proposal docs/governance/proposals/<slug>.md \
  --strict
```

The script validates:

1. The proposal markdown matches the template structure in §2.
2. The parameter ID (`PP-<n>`) exists in `PARAMETERS.md` §8.
3. The requested quorum is `>=` the recommended value in `PARAMETERS.md` §9.
4. The requested cooldown is `>=` the recommended value in `PARAMETERS.md` §9.
5. The executor multi-sig threshold is `>=` 2-of-3.
6. The metadata JSON in Appendix A serialises canonically (sorted keys, no whitespace).
7. The SHA-256 of the canonical JSON matches the `metadata_hash` field at the top of the proposal.
8. All `[ ]` checklist items in §8 are checked.

CI rejects the PR if any check fails.

---

## 4. Worked example — whitelisting a new NFT collection (PP-13)

The minimum viable example below shows how a proposal is structured. The full text would normally live in `docs/governance/proposals/2026-Q3-paymenthub-whitelist-9999.md`.

```markdown
# Parameter Change Proposal — paymenthub-whitelist-9999

**Proposal ID (on-chain):** TBD
**Author NFT ID:** 42
**Category:** ROADMAP_SIGNAL (0)
**Snapshot block:** TBD
**Voting window:** 7 days
**Quorum threshold:** 44  (supermajority per PARAMETERS.md §9)
**Off-chain cooldown:** 48 h
**Last Updated:** 2026-06-01

## 1. Abstract
Whitelist NFT collection `EQ…9999` in `PaymentHub.tact` (parameter PP-13) so that
holders of the newly minted "TBC Founders" series (1 111 NFTs) can register
payment accounts. The change adds one entry to `whitelisted_collections`; no
balance, lock state or admin field is mutated.

## 2. Parameter identification
| Field | Value |
| ... (template above)|

## 3. Rationale
The "TBC Founders" collection finished its on-chain mint on 2026-05-25 and the
on-chain holder count exceeds 800. The series ships with a dedicated wallet UI
flow that depends on PaymentHub account registration. Without the whitelist
entry, registration fails with `Not whitelisted`.

## 4. Risk assessment
- User funds at risk: None — whitelisting only enables `InitializeAccount`; it
  does not move funds. PaymentHub `INVARIANT I3` prohibits admin from
  withdrawing funds.
- ...
```

The author submits the full markdown to GitHub, the SHA-256 of the canonical JSON appendix is anchored on-chain via `SubmitProposal`, voting runs for 7 days, the proposal finalises with ≥ 44 votes `FOR`, the maintainer team waits 48 hours, and the PaymentHub admin multi-sig (2-of-3) sends a `WhitelistCollection` transaction whose payload embeds `proposal_id = <on-chain id>`. The indexer appends a line to `parameter-changes.log` and the round-trip is complete.

---

## 5. References

- [`PARAMETERS.md`](./PARAMETERS.md) — protocol parameter inventory (§§ 8–11)
- [`docs/dao-governance.md`](../dao-governance.md) — non-executable governance philosophy
- [`docs/governance-process.md`](../governance-process.md) — generic proposal lifecycle
- [`docs/governance-transparency.md`](../governance-transparency.md) — TransparencyRegistry contract guarantees
- [`SNAPSHOT.md`](./SNAPSHOT.md) — voter snapshot methodology
- [`E1-activation/RUNBOOK.md`](./E1-activation/RUNBOOK.md) — deployment / redeployment runbook
- [`scripts/governance/check-parameter-changes.ts`](../../scripts/governance/check-parameter-changes.ts) — proposal validator
- [`tests/governance/ParameterGovernance.spec.ts`](../../tests/governance/ParameterGovernance.spec.ts) — round-trip test through `ProposalRegistry`
- `contracts/governance/ProposalRegistry.tact` — on-chain anchor for proposal hashes
- `contracts/governance/TransparencyRegistry.tact` — public mirror of governance events
- Issue [#133](https://github.com/xlabtg/tonbankcard-protocol/issues/133) — E2 engagement
