# B2 — Mainnet Roll-back Procedures

**Engagement:** [B2](./ENGAGEMENT.md)
**Runbook reference:** [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §11
**Status:** Procedure frozen — rehearsed before kickoff, applied if a Critical/High finding surfaces post-deploy
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

> ⚠️ **There is no "undo" on mainnet.** Deployed bytecode is immutable. "Roll-back" on mainnet means **pause + supersede**, never "delete and redeploy". This document is the contract for how the protocol treats post-deploy issues.

---

## 1. Purpose

This document covers the case where a Critical or High-severity issue is discovered **after** mainnet contracts are deployed. It specifies:

- What "roll-back" means in an immutable system (§2).
- The append-only manifest convention that records the roll-back (§3).
- The classification of post-deploy issues and the response per class (§4).
- The rehearsal procedure performed before mainnet kickoff (§5).
- The decision authority for invoking a roll-back (§6).

---

## 2. Roll-back semantics on an immutable chain

The deployed contracts are immutable (see [`IMMUTABILITY_VERIFICATION.md`](./IMMUTABILITY_VERIFICATION.md)). The only operational levers available post-deploy are:

| Lever | Holder | Effect | Reversibility |
|-------|--------|--------|---------------|
| Account lock (`AccountLocks.set_lock`) | `risk_authority` (cold wallet) | Block transfers out of a specific account | Reversible by `clear_lock` |
| Admin parameter freeze (e.g. stop accepting new NFT collections in `PaymentHub`) | `admin` (multi-sig) | Prevent further allow-list growth | Reversible by re-issuing the parameter call |
| Off-chain client-code redirect | Maintainers | New SDK / merchant adapters point at a fresh deployment | Reversible by reverting the client update |
| Manifest supersede (append a new manifest, mark old as `paused`) | `@konard` + reviewers | Documentation signal that contracts are no longer endorsed | Documentation-level only |

What the protocol **cannot** do post-deploy:

- Replace the bytecode of a deployed contract.
- Withdraw or freeze user funds globally — invariant **I3** holds.
- Delete or alter manifest history — manifests are append-only.

A "roll-back" is therefore a **client-level redirect plus an on-chain pause**, accompanied by a new deployment if a fix is required.

---

## 3. Append-only manifest convention

Every mainnet manifest file is **never edited or deleted**. Corrections add new manifests. The schema (`MANIFEST_TEMPLATE.json`) supports this with three top-level fields:

| Field | Type | Semantics |
|-------|------|-----------|
| `paused` | `boolean` | `true` if the manifest is no longer endorsed; consumers must look up the superseding manifest. |
| `supersedes` | `string \| null` | Filename of the prior manifest this one replaces. `null` for the first manifest of a phase. |
| `supersededBy` | `string \| null` | Filename of the follow-up manifest that supersedes this one. `null` while this manifest is current. |

### 3.1 Worked example — pause a payment-block manifest

Starting state: `deployments/mainnet/2026-06-15T10-00-00Z.json` (initial mainnet deploy).

A Critical bug surfaces. The procedure is:

1. **Open `2026-06-15T10-00-00Z.json` in a new commit and set `paused = true`.** Commit message: `manifest(b2): pause initial mainnet deploy after F-CRIT-6 disclosure`.
2. **Apply the fix on a new branch.** The fix is reviewed via the standard remediation workflow ([`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md)).
3. **Deploy a new set of contracts** following the full [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) procedure. This produces `deployments/mainnet/2026-06-22T10-00-00Z.json`.
4. **Set `supersedes = "2026-06-15T10-00-00Z.json"` on the new manifest** and **`supersededBy = "2026-06-22T10-00-00Z.json"` on the paused one**.
5. **Update documentation atomically:**
   - `STATUS.md` §14 — Change log entry referencing both manifests.
   - `docs/existing-contracts.md` — Mainnet section is updated to the new addresses with a note linking to the paused manifest.
   - `docs/deployments/network-matrix.md` — Same.
   - `README.md` — Same.
   - `CHANGELOG.md` — Disclosure entry with both manifest filenames.
6. **Publish a public disclosure note** describing the issue, the new deployment, and the transition guidance for merchants / SDK consumers. This is gated on the same 24-hour soak window as the original deployment ([`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §4).

The paused manifest **stays in git history forever**. Auditors can re-derive every state the project ever endorsed.

---

## 4. Issue classification & response

Issues discovered post-deploy are classified by severity. The response per class is fixed.

| Severity | Definition | Response window | Action |
|----------|------------|------------------|--------|
| **Critical** | Funds at risk, invariant I3–I7 violated, or upgrade primitive accidentally deployed | Immediate (< 1 hour from discovery) | Account-lock-blanket on affected accounts; pause manifest; new deployment within 7 days |
| **High** | Functional regression, no fund risk, but user-facing impact | Within 24 hours | Pause manifest only if the regression blocks a core flow; otherwise patch via new deployment within 14 days |
| **Medium** | Behavioural divergence from the audit report, no immediate impact | Within 7 days | Disclosure note + patch in next planned release |
| **Low** | Documentation, cosmetic, or off-chain issue | Within 30 days | Standard PR workflow |

Severity is assigned by the maintainer in consultation with the verification reviewer. The classification is logged in [`STATUS.md`](./STATUS.md) §14.

### 4.1 Critical response — operational steps

1. **Engage signers.** Convene the multi-sig signers immediately.
2. **Apply on-chain mitigation.** If the issue allows specific accounts to be drained, the `risk_authority` issues a blanket account-lock on the affected wallets.
3. **Pause the manifest.** Commit `paused = true` on the affected manifest within 1 hour.
4. **Public disclosure.** Issue a holding statement to all comms channels: confirm the issue, confirm funds are safe (or describe scope of impact), commit to a patch timeline.
5. **Fix + redeploy.** Apply the patch, run a new B2 cycle (G-1 … G-10 gates re-verified, multi-sig ceremony re-performed). Patch deployment must complete within 7 days.
6. **Post-mortem.** Written post-mortem committed under `docs/security/incidents/` (out of scope of this directory but referenced).

The 1-hour pause window is realistic only if the multi-sig signers are pre-coordinated. The pre-flight rehearsal in §5 ensures signers can re-quorum in under an hour.

---

## 5. Rehearsal — pre-kickoff drill

Before mainnet kickoff, the engagement performs a **roll-back rehearsal** against the latest B1 testnet manifest (G-9 gate in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §4). The rehearsal exercises:

| Drill step | Procedure | Pass criterion |
|------------|-----------|----------------|
| D-1 | Convene all multi-sig signers within 1 hour of a simulated incident | All signers reachable; quorum confirmed |
| D-2 | Apply an account-lock to a designated test account on testnet | Lock applied, transfer rejected |
| D-3 | Pause a testnet manifest by setting `paused = true` in a follow-up commit | Commit lands; CI green |
| D-4 | Generate a superseding manifest entry (no actual redeploy, just the JSON skeleton) | Schema validates; `supersedes` / `supersededBy` set correctly |
| D-5 | Confirm the public disclosure draft template is on-hand and editable in ≤ 30 minutes | Comms lead confirms |

The rehearsal output is signed off by `@konard` in [`STATUS.md`](./STATUS.md) §5 row 12 ("Roll-back procedure rehearsed against the latest B1 manifest").

A failed rehearsal pauses kickoff until remediation.

---

## 6. Decision authority

The decision to invoke a roll-back is made by the **maintainer** (`@konard`) in consultation with at least one **independent verification reviewer**. The decision is recorded in [`STATUS.md`](./STATUS.md) §14 and is **append-only**: a roll-back, once invoked, is never silently reversed.

If the maintainer is unreachable, decision authority transfers to the deployer multi-sig as a body (≥ `threshold` signers concur in writing). This fallback is itself a fallback — the primary expectation is that the maintainer remains reachable during the soak window.

---

## 7. What roll-back is **not**

For clarity, the following operations are **not** considered roll-backs and are explicitly forbidden under this engagement:

- Editing or deleting a committed mainnet manifest file. (Manifests are append-only — §3.)
- Force-pushing to `main` or `issue-118-*` to rewrite the deploy history.
- Using a single key to issue a "correction" tx without multi-sig.
- Publishing announcement copy before the 24-hour soak completes on the new manifest.
- Marking a paused manifest's contracts as "live" again without a fresh ceremony.

Any of these is a critical procedural failure and is treated as such.

---

## 8. Cross-references

- Pause / supersede mechanics are mirrored in [`MANIFEST_TEMPLATE.json`](./MANIFEST_TEMPLATE.json) (`paused`, `supersedes`, `supersededBy`).
- The remediation workflow that produces the patch is [`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md).
- The communications discipline (no public announcement during soak) is owned by [`MULTISIG_CEREMONY.md`](./MULTISIG_CEREMONY.md) AF-6.
- Account-lock mechanics are documented in [`audit/INVARIANTS.md`](../../../audit/INVARIANTS.md) (invariant **I7**).

---

## 9. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Verification plan](./VERIFICATION_PLAN.md)
- [Immutability verification](./IMMUTABILITY_VERIFICATION.md)
- [Multi-sig ceremony](./MULTISIG_CEREMONY.md)
- [Mainnet runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md)
- [Manifest template](./MANIFEST_TEMPLATE.json)
- [Remediation workflow](../../security/audits/REMEDIATION_WORKFLOW.md)
- [Formal invariants — I7 Account Locks](../../../audit/INVARIANTS.md)
