# B2 — Mainnet Immutability Verification

**Engagement:** [B2](./ENGAGEMENT.md)
**Runbook reference:** [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §9.1
**Status:** Procedure frozen — scan output committed at kickoff and re-run after deploy
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

The TONBANKCARD protocol is deployed under the **strong immutability** posture: once a contract is on mainnet, its bytecode **cannot be changed by anyone** — not by admins, not by the multi-sig signers, not by the maintainer. This document records the verification that this posture holds for every in-scope contract.

The verification is required by issue #118 §8 acceptance criterion 5 ("Immutability of deployed contracts verified") and by protocol invariant **I3** ("No Admin Fund Control"), since any upgrade primitive would trivially bypass I3.

Three layers of verification are applied:

1. **Source-level scan** — no upgrade primitive in the Tact / FunC source (§3).
2. **Compiled-cell scan** — no `SETCODE` opcode in the compiled cell (§4).
3. **Post-deploy state inspection** — no `seqno`/`version` field that could be flipped by an admin call (§5).

---

## 2. Strong immutability — definition

A contract is **strongly immutable** if, after deployment, no message any party can send results in the bytecode being replaced or extended. In TON terms, this requires the absence of:

- `SETCODE` TVM opcode — direct bytecode replacement.
- `set_data()` calls that overwrite the code cell stored in persistent state.
- A `code` continuation stored in state that is later passed to `EXECUTE` — indirect re-routing.
- Any admin-controlled storage variable that the contract reads as a target for self-modification.

The audit pass A1 ([`docs/security/audits/A1-core-contracts/ENGAGEMENT.md`](../../security/audits/A1-core-contracts/ENGAGEMENT.md)) explicitly attests to all four items for the Phase 2 contract set. This document is the post-A1 confirmation that the deploy commit and the live mainnet bytecode preserve the property.

---

## 3. Source-level forbidden-pattern scan

`scripts/deploy/verify.ts` §`verifyInvariants` scans the deploy-commit source for the following patterns and aborts on any match. The patterns are deliberately broad — they catch obvious upgrade primitives and admin back-doors alike.

| Pattern | Forbidden artifact | Status (deploy commit) |
|---------|---------------------|------------------------|
| `adminWithdraw` (case-insensitive) | Admin withdrawal function | ⏳ Scan recorded at kickoff |
| `emergencyDrain` (case-insensitive) | Emergency drain function | ⏳ |
| `forcedTransfer` (case-insensitive) | Forced-transfer function | ⏳ |
| `set_code(` | Bytecode replacement primitive | ⏳ |

The scan target is every file in:

- `contracts/payments/`
- `contracts/payment-hub/`
- `contracts/nft-resolver/`
- `contracts/collateral-lookup/`
- `contracts/governance/`
- `contracts/MerchantPaymentHub.tact`
- `contracts/CollateralSignal.tact`

Files outside this list (Phase 4 contracts, test helpers, mocks) are not scanned by this gate because Phase 4 is out of scope of B2.

The full scan output is committed at kickoff alongside the freeze metadata as:

```
deployments/mainnet/<timestamp>.immutability-source.txt
```

### 3.1 Reproducing the scan locally

The dedicated three-layer scanner is [`scripts/deploy/check-immutability.ts`](../../../scripts/deploy/check-immutability.ts). It scans every in-scope B2 contract (10 contracts as of this engagement) and reports per layer.

```bash
# Run from the repo root, on the deploy commit
npx ts-node \
  --transpile-only \
  --compiler-options '{"module":"commonjs","target":"ES2020","esModuleInterop":true,"ignoreDeprecations":"6.0"}' \
  scripts/deploy/check-immutability.ts

# To also run Layer 2 (compiled-cell SETCODE scan), pass the disassembly dir:
npx ts-node \
  --transpile-only \
  --compiler-options '{"module":"commonjs","target":"ES2020","esModuleInterop":true,"ignoreDeprecations":"6.0"}' \
  scripts/deploy/check-immutability.ts \
  --disasm-dir deployments/mainnet/<timestamp>.immutability-bytecode
```

The Layer 1 scan is also embedded into [`scripts/deploy/verify.ts`](../../../scripts/deploy/verify.ts) `verifyInvariants` and runs automatically during every deploy / verify cycle.

The expected output is `PASS` for every layer on the deploy commit.

---

## 4. Compiled-cell opcode scan

Source-level patterns are a strong indicator but not a proof. After `npx blueprint build` produces the compiled cells, the operator runs an **opcode-level scan** on the compiled bytecode and confirms the absence of `SETCODE` opcodes.

| Tool | Purpose | Pass criterion |
|------|---------|----------------|
| `@ton/blueprint` `dump` command (or `func -P` for FunC) | Produce a human-readable disassembly of each compiled cell | No `SETCODE` opcode appears in any disassembly file |
| `sha256sum` over the compiled cell BOC | Pin the compiled artifact to its hash | Hash equals the value in `audit/FREEZE_METADATA.md` |

The disassembly artefacts are committed to git under:

```
deployments/mainnet/<timestamp>.immutability-bytecode/
  AccountLocks.disasm.txt
  NFTAccountResolver.disasm.txt
  AccountStateMachine.disasm.txt
  PaymentHub.disasm.txt
  MerchantPaymentHub.disasm.txt
  CollateralSignal.disasm.txt
  PublicCollateralLookup.disasm.txt
  ProposalRegistry.disasm.txt
  SnapshotVerifier.disasm.txt
  TransparencyRegistry.disasm.txt
```

A grep over the disassembly files for `SETCODE` MUST return zero matches:

```bash
grep -RIn "SETCODE" deployments/mainnet/<timestamp>.immutability-bytecode/
# Expected: no output, exit code 1
```

Any non-empty output aborts the deployment.

---

## 5. Post-deploy state inspection

After deployment, the operator queries each contract's persistent state and inspects the field list for the **absence** of:

- A `code` field of type `cell`.
- A `pending_code` / `next_code` / `code_v2` field of any type.
- A `seqno` that gates an admin upgrade message (distinct from the standard wallet seqno, which is benign).

The expected state schema for each contract is documented in [`audit/INVARIANTS.md`](../../../audit/INVARIANTS.md). The post-deploy state read is performed by:

```bash
npx ts-node scripts/deploy/verify.ts --manifest deployments/mainnet/<timestamp>.json
```

and the per-contract state schema is preserved in the verification report under `results[].stateValid`. Any deviation aborts the verdict transition.

---

## 6. Verdict attestation

The immutability verdict is recorded in [`STATUS.md`](./STATUS.md) §9.3 by **two** independent reviewers:

| Reviewer | Role | Attestation |
|----------|------|-------------|
| Deployment operator | Primary | "Confirmed: source scan PASS, opcode scan PASS, state inspection PASS for all in-scope contracts." |
| Verification reviewer | Independent | "Confirmed: re-ran scans against the same deploy commit; results match the primary attestation." |

Both attestations are required for the `MAINNET-LIVE` verdict.

---

## 7. Re-verification

The immutability verdict is **not** a one-shot artefact. The following triggers re-verification:

- New forbidden pattern added to `verify.ts` `verifyInvariants` — re-run §3 against current source.
- New TVM opcode taxonomy from the TON core team that adds an upgrade primitive — re-run §4 against the deployed bytecode.
- Discovery of a state-level upgrade pattern in any TON contract (industry-wide) — re-run §5 against deployed state.
- 90-day cadence — quarterly re-verification archived alongside the original.

Re-verification reports follow the naming `deployments/mainnet/<original-timestamp>.immutability.<re-run-timestamp>.txt`.

---

## 8. Why a separate document

This verification is split out from `VERIFICATION_PLAN.md` because:

1. Immutability is a **policy-level** property of the protocol, not just a deployment check. It deserves a dedicated record so future engagements (B3 monitoring, audits A2, future upgrades) can cite it directly.
2. The verdict gates `MAINNET-LIVE` independently of the end-to-end test transaction.
3. The supporting artefacts (disassembly files, state schema documents) are large and benefit from a dedicated directory.

---

## 9. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Verification plan](./VERIFICATION_PLAN.md)
- [Roll-back procedures](./ROLLBACK_PROCEDURES.md)
- [Mainnet runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md)
- [Formal invariants — I3 No Admin Fund Control](../../../audit/INVARIANTS.md)
- [Freeze metadata](../../../audit/FREEZE_METADATA.md)
- [Engagement A1 — Core contracts audit](../../security/audits/A1-core-contracts/ENGAGEMENT.md)
- [Verify script](../../../scripts/deploy/verify.ts)
