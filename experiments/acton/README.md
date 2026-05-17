# Acton Compatibility Prototype (D6 / Issue #143)

> Isolated experiment sandbox for the [Acton TON toolchain](https://ton-blockchain.github.io/acton/).
> Companion to [`docs/tooling/ACTON_EVALUATION.md`](../../docs/tooling/ACTON_EVALUATION.md).
> **Decision recorded: NO ADOPTION** for the current roadmap; this sandbox
> exists under the companion **EXPERIMENTS ONLY** posture (Adoption
> Decision #2 in §7 of the evaluation).

This directory is intentionally **not** wired into any of:

- `package.json` / workspace scripts
- `.github/workflows/ci.yml` (any job)
- `scripts/setup.sh` or `docker-compose*.yml`
- `scripts/deploy/*` (B1, B2 anchors)
- `contracts/**` build path

Its only readers are:

1. A future contributor who wants to reproduce the §4 "Compatibility
   Prototype" of `docs/tooling/ACTON_EVALUATION.md`.
2. The validator at
   [`scripts/tooling/check-acton-evaluation.ts`](../../scripts/tooling/check-acton-evaluation.ts)
   which checks that this README and the toy Tolk harness exist and
   stay consistent with the evaluation document.

---

## 1. Pinned version

| Field | Value |
|---|---|
| Acton release | **`v1.0.0`** (2026-05-11, first stable release) |
| License | Dual Apache-2.0 / MIT |
| Source | <https://github.com/ton-blockchain/acton> |
| Docs | <https://ton-blockchain.github.io/acton/> |

The version is pinned because the §10 reconsideration triggers in the
evaluation document compare *against this baseline*. Any future
re-evaluation MUST update both this README and
`docs/tooling/ACTON_EVALUATION.md` §3.1 together.

---

## 2. Operator-driven install (do NOT run in CI)

### 2.1 Binary install (pinned to v1.0.0)

```sh
# Run on a developer workstation only. Not idempotent; not in CI.
curl -LsSf \
  https://github.com/ton-blockchain/acton/releases/download/v1.0.0/acton-installer.sh \
  | sh
acton --version   # expect: acton 1.0.0
```

### 2.2 Docker install (pinned digest required)

```sh
# Replace <DIGEST> with the sha256 published on the v1.0.0 release page
# before running. CI must never pull `:latest`; the evaluation in §8.3
# treats unpinned tags as a high-severity supply-chain risk.
docker pull ghcr.io/ton-blockchain/acton@sha256:<DIGEST>
```

### 2.3 Reproducible playground init

```sh
mkdir -p experiments/acton/playground
cd       experiments/acton/playground
acton init   # creates Acton.toml, contracts/, tests/, scripts/
```

The `playground/` directory is `.gitignore`-eligible — it is the
contributor's scratch space, not a committed artefact. The only
committed Tolk source in this repository is the illustrative harness
at [`tolk-harness/account-locks-toy.tolk`](./tolk-harness/account-locks-toy.tolk).

---

## 3. What this prototype demonstrates

Per `docs/tooling/ACTON_EVALUATION.md` §4.3, the prototype demonstrates:

- The **exact local install / init / test loop** a future contributor
  would run if a Tolk-first contract were ever authorised.
- That `acton init` scaffolds a **self-contained** workspace under
  `experiments/acton/playground/` **without** touching
  `package.json`, `contracts/`, `scripts/deploy/`,
  `docker-compose*.yml`, or `.github/workflows/ci.yml`.
- That the on-chain semantics of one existing frozen FunC helper
  (`contracts/payments/account-locks.fc`) — specifically the
  `FRAUD_LOCK` / `COLLATERAL_LOCK` bit-flag toggle and the I6
  invariant ("Lock ≠ Confiscation") — can be **re-expressed in Tolk
  syntax**. This shows that there is no language-level blocker for a
  future greenfield Tolk contract.

The toy harness is **illustrative**, not executable against the
existing build. It is not byte-for-byte equivalent to the FunC source
and MUST NOT be deployed.

---

## 4. What we did NOT migrate (and why)

Per `docs/audit-scope.md` §G.5 ("Prohibited During Freeze"), no
production contract may be re-implemented in Tolk during the A1/A2
freeze window. The following files were **intentionally not migrated**
by this prototype:

| File | Status | Freeze rule | Why this prototype does not touch it |
|---|---|---|---|
| `contracts/payments/account-locks.fc` | 🔒 frozen | `docs/audit-scope.md` §G.5 | Source of the illustrative model only; no migration |
| `contracts/payments/payment-hub.fc` | 🔒 frozen | `docs/audit-scope.md` §G.5 | Out of scope per Issue #143 §4 |
| `contracts/nft-resolver/nft_account_resolver.fc` | 🔒 frozen | `docs/audit-scope.md` §G.5 | Out of scope per Issue #143 §4 |
| `contracts/collateral-lookup/public-collateral-lookup.fc` | 🔒 frozen | `docs/audit-scope.md` §G.5 | Out of scope per Issue #143 §4 |
| `contracts/governance/diamond_resolver.fc` | 🔒 frozen | `docs/audit-scope.md` §G.5 | Out of scope per Issue #143 §4 |
| All `contracts/**/*.tact` | 🔒 partial (6 of 8 production frozen) | `docs/audit-scope.md` §G.5 | Acton has **no Tact support**; would require rewrite |

Even if the freeze lifts (A1 + A2 verdict=READY, §10 trigger 1), any
actual migration MUST happen behind a **new** GitHub issue with its
own design review, equivalence test plan, and re-audit budget. See
the cost estimate in `docs/tooling/ACTON_EVALUATION.md` §8.1.

---

## 5. Local commands a contributor may run

All commands are **operator-driven** and produce output **only inside**
`experiments/acton/playground/`. They never write outside this
directory tree.

```sh
# Compile the toy harness (after installing acton v1.0.0 per §2.1)
cd experiments/acton
acton check tolk-harness/account-locks-toy.tolk

# Format the harness in place
acton fmt tolk-harness/account-locks-toy.tolk

# Open a sandbox playground for further experiments
cd playground
acton test
acton fuzz --seed 0xD6
```

If `acton` is not installed, every command above fails with a clean
`command not found` — there is **no fallback path** that pulls the
binary automatically. This is deliberate: the supply-chain risk in
`docs/tooling/ACTON_EVALUATION.md` §8.3 (row "Supply-chain attack on
the Acton binary / Docker image") requires explicit operator consent.

---

## 6. Removal procedure

If the decision is later reversed to "no experiments at all":

```sh
git rm -r experiments/acton
git rm    docs/tooling/ACTON_EVALUATION.md
git rm    scripts/tooling/check-acton-evaluation.ts
git rm -r tests/tooling
# Then update docs/INDEX.md and docs/audit-scope.md to drop the D6 references.
```

The removal is safe because no production code, CI job, or deploy
script depends on anything in this directory.

---

## 7. References

- Evaluation document: [`docs/tooling/ACTON_EVALUATION.md`](../../docs/tooling/ACTON_EVALUATION.md)
- Issue #143: <https://github.com/xlabtg/tonbankcard-protocol/issues/143>
- Freeze rules: [`docs/audit-scope.md`](../../docs/audit-scope.md) §G.5
- Source FunC helper that inspired the toy harness: [`contracts/payments/account-locks.fc`](../../contracts/payments/account-locks.fc)
- Validator script: [`scripts/tooling/check-acton-evaluation.ts`](../../scripts/tooling/check-acton-evaluation.ts)
- Validator tests: [`tests/tooling/ActonEvaluationValidator.spec.ts`](../../tests/tooling/ActonEvaluationValidator.spec.ts)
