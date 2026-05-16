# B2 — Mainnet Multi-Sig Signing Ceremony

**Engagement:** [B2](./ENGAGEMENT.md)
**Runbook reference:** [`../../../scripts/deploy/MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §5, §8
**Status:** Procedure frozen — followed verbatim at kickoff
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

> ⚠️ **Single-key mainnet deployment is forbidden.** This document is the canonical contract for who signs what, on which device, in which order. Any deviation aborts the ceremony.

---

## 1. Purpose

This document specifies:

- The **multi-sig deployer wallet** that signs every mainnet deploy transaction (issue #118 §7).
- The **signer roster** — identities, hardware-wallet devices, custody constraints.
- The **signing flow** — how unsigned transactions are produced, distributed, signed, and broadcast.
- The **recovery procedure** if quorum cannot be reached, or if a signing device is lost or compromised.

Multi-sig protects against three threat models:

1. **Single-key theft** — no single compromised key can deploy malicious contracts.
2. **Single-operator coercion** — at least two independent signers must agree.
3. **Single-device failure** — at least one alternate signer remains operational.

---

## 2. Signer roster

The mainnet deployer multi-sig has at least **3 signers** with a **threshold of at least 2** (configurable to `2-of-3` or `3-of-5`; default `2-of-3` per issue #118 §7).

| # | Role | Identity | Device class | Address (mainnet) | Notes |
|---|------|----------|--------------|-------------------|-------|
| 1 | Lead deployer | TBD | Ledger Nano X / S Plus (hardware) | TBD | Cannot be a B1 testnet signer; cannot be the risk authority custodian. |
| 2 | Secondary signer | TBD | Ledger Nano X / S Plus (hardware) | TBD | Cannot be a B1 testnet signer; cannot be the risk authority custodian. |
| 3 | Tertiary signer (cold backup) | TBD | Ledger Nano X / S Plus (hardware), stored air-gapped | TBD | Used only when signer #1 or #2 is unreachable. |

### 2.1 Hard constraints (non-negotiable)

The following constraints are enforced by `scripts/deploy/verify.ts` and by manifest schema (`MANIFEST_TEMPLATE.json`):

- **Hardware-only.** Software wallets, browser extensions, mobile wallets, and any custodial service are **forbidden**.
- **Distinct devices.** Each signer uses a different physical device. No "two signers, one Ledger".
- **Distinct custodians.** Each signer is a distinct person; no single individual holds two devices for the deployer multi-sig.
- **No testnet reuse.** No deployer signer address appears in the B1 testnet manifest. `verify.ts` reads the B1 manifest and aborts on overlap.
- **No admin/risk reuse.** No deployer signer is the `risk_authority` custodian (independent custody — see [`docs/security/KEY_MANAGEMENT.md`](../../security/KEY_MANAGEMENT.md)).
- **No CI/CD storage.** Mnemonics, seed phrases, and PIN codes MUST NEVER appear in GitHub Actions secrets, `.env`, CI logs, or any cloud-stored note.

### 2.2 Threshold selection

| Threshold | Acceptable? | Notes |
|-----------|-------------|-------|
| `1-of-N` | ❌ Rejected | Equivalent to single-key, forbidden by issue #118 §7. |
| `2-of-3` | ✅ Default | Issue #118 minimum. |
| `2-of-4` | ✅ Acceptable | Adds a hot-swappable spare. |
| `3-of-5` | ✅ Preferred for large-treasury deployments | Tolerates 2 simultaneous signer outages. |

The chosen threshold is recorded in [`STATUS.md`](./STATUS.md) §3 and embedded in the manifest under `deployer.threshold`.

---

## 3. Signing flow

The ceremony is a **structured, witnessed event**. The participants are: the deployment operator, the multi-sig signers, and at least one verification reviewer who is **not** a signer.

### 3.1 Pre-flight (T-7 days)

1. Each signer generates / confirms a hardware-wallet address on a clean device.
2. The deployment operator collects the **public addresses only** (never the mnemonics) and records them in [`STATUS.md`](./STATUS.md) §3.
3. The multi-sig wallet (e.g. [TON multi-sig contract](https://github.com/ton-blockchain/multisig-contract-v2)) is initialised on **testnet first** as a rehearsal. The rehearsal multi-sig is **not** the mainnet multi-sig — it is discarded after the rehearsal.
4. The mainnet multi-sig is deployed by the lead deployer with the agreed signer set and threshold. The deploy transaction is observable on TONviewer and its address is recorded in [`STATUS.md`](./STATUS.md) §3.
5. The mainnet multi-sig is funded from the project treasury wallet. Funding tx is recorded.

### 3.2 Per-contract signing (the ceremony itself)

For **each** contract row in [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3:

1. **Build the unsigned tx.** The deployment operator runs `scripts/deploy/deploy.ts --network mainnet --confirm` with the contract name. The script produces an **unsigned BOC** representing the deploy message.
2. **Distribute the unsigned BOC.** Operator broadcasts the unsigned BOC to all signers via a secure side-channel (Signal, a dedicated Matrix room, or in-person review). The BOC carries a deterministic hash. Each signer verifies:
   - The recipient address (multi-sig wallet).
   - The payload (contract init data) matches `DEPLOYMENT_PLAN.md` §3.1.
   - The gas budget is within the dry-run estimate.
3. **Sign in turn.** Each participating signer signs the BOC on their hardware device, prints the **address being deployed** on the device screen, and confirms the operation locally. Only after a signer has visually confirmed the address on their hardware display do they press "approve".
4. **Collect signatures.** Operator collects ≥ `threshold` signatures and assembles the multi-sig wrapper.
5. **Broadcast.** Operator broadcasts the assembled tx to mainnet via a public RPC endpoint (or via `tonsh`/`@ton/ton`). The deploy tx hash is recorded immediately in [`STATUS.md`](./STATUS.md) §7 / §8.
6. **Verify before next contract.** `scripts/deploy/verify.ts --manifest <path>` runs against the updated manifest and **must** return `allPassed: true`. The next contract is **NOT** started until verification passes.

The order of contracts is the deterministic order from [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md) §3. **Do not parallelise** — one contract at a time.

### 3.3 Cool-down between contracts

A minimum **10-minute pause** between successful contracts is mandatory. It gives second-reviewer eyes time to spot anomalies (unexpected addresses, mismatched code hashes, gas spikes) before the next deploy is committed.

### 3.4 Atomic-PR after every contract

The post-deploy doc-update PR ([`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §10) is opened after the last contract is verified. The PR updates `STATUS.md` §7/§8, `docs/existing-contracts.md`, `docs/deployments/network-matrix.md`, `README.md`, and `CHANGELOG.md` **atomically in a single commit**. The PR is reviewed by **two** independent reviewers before merge.

---

## 4. Anti-foot-gun rules

The following classes of mistakes have been observed in mainnet-deployment post-mortems across the TON ecosystem and are explicitly forbidden by this procedure.

| # | Rule | Enforcement |
|---|------|-------------|
| AF-1 | Never paste a mnemonic into a computer — even momentarily | Hardware-only signers per §2.1 |
| AF-2 | Never deploy directly from a developer laptop using a single key | Multi-sig required per §2 |
| AF-3 | Never reuse testnet keys for mainnet | `verify.ts` overlap check per §2.1 |
| AF-4 | Never deploy multiple contracts in a single batch without per-contract verification | §3.2 step 6 — `verify.ts` between contracts |
| AF-5 | Never skip the dry-run pass | [`MAINNET_RUNBOOK.md`](../../../scripts/deploy/MAINNET_RUNBOOK.md) §7 — dry-run is gated upstream |
| AF-6 | Never announce the deployment publicly inside the 24-hour soak | [`VERIFICATION_PLAN.md`](./VERIFICATION_PLAN.md) §4 |
| AF-7 | Never edit a committed mainnet manifest in place | Manifests append-only ([`ROLLBACK_PROCEDURES.md`](./ROLLBACK_PROCEDURES.md) §3) |
| AF-8 | Never store recovery sheets in the same physical safe as another signer's recovery sheet | §5 below |
| AF-9 | Never run the deploy script under `sudo` or with unrelated network access | Operator workstation hardening checklist (§6) |
| AF-10 | Never approve a tx on the hardware device without reading the destination address from the device screen | §3.2 step 3 |

---

## 5. Recovery procedure

Mainnet contracts are immutable; the multi-sig wallet itself is not. The deployer multi-sig must remain operational for any **post-deploy parameter calls** (admin allow-list updates, lock/clear operations under the risk-authority key). Losing quorum leaves the protocol in a degraded but safe state (no fund movement is possible by anyone — the contracts are designed under invariant **I3**).

### 5.1 Lost single device

1. Operator declares the loss in [`STATUS.md`](./STATUS.md) §12.
2. The remaining `threshold` signers initiate a **multi-sig signer-set rotation** transaction that removes the lost signer and adds a new hardware-wallet address.
3. Rotation tx is signed by the surviving `threshold` signers and broadcast.
4. New signer is provisioned with a fresh device, fresh seed phrase, fresh PIN — never restore the lost device's seed onto a new device.
5. `STATUS.md` §3 is updated; the rotation event is recorded in §14.

### 5.2 Lost quorum (≥ 2 devices lost simultaneously)

1. Operator declares an incident and freezes all admin operations.
2. A **new multi-sig wallet** is deployed with a fresh signer set.
3. The protocol contracts remain operational — they are immutable. Only admin-level operations (NFT allow-listing, parameter updates) are paused until the new multi-sig is in place.
4. The supersede event is recorded by appending a new manifest with `supersedes` pointing to the prior manifest's `configuration.adminAddress`. The old manifest is marked `paused = true`.
5. A public notice is issued only after the new multi-sig is funded and the rotation has been processed.

### 5.3 Suspected device compromise

1. Operator immediately initiates a rotation as in §5.1, treating the suspected device as lost.
2. Forensics is performed off the production path; the suspected device is preserved as evidence.
3. An incident report is filed in `docs/security/incidents/` (out of scope of this engagement's directory but referenced).

---

## 6. Operator workstation hardening

The deployment operator's workstation MUST satisfy the following at the start of the ceremony. The checklist is signed by the operator in [`STATUS.md`](./STATUS.md) §3 before any contract is deployed.

- [ ] Fresh OS install or verified clean OS state (no untrusted user installs since last clean).
- [ ] Full-disk encryption enabled.
- [ ] No password manager extension active in the browser used for broadcasting.
- [ ] No remote-management agent running (no TeamViewer, no AnyDesk, no SSH listener).
- [ ] All hardware-wallet bridge software (Ledger Live, etc.) installed from official sources only.
- [ ] Operator's hardware wallet PIN entered fresh at the start of the ceremony (no cached unlock).
- [ ] Network: wired connection preferred; if wireless, a known trusted network.

These items are **not** verified by automation; they are attestations by the operator and the second reviewer.

---

## 7. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Deployment plan](./DEPLOYMENT_PLAN.md)
- [Mainnet runbook](../../../scripts/deploy/MAINNET_RUNBOOK.md)
- [Verification plan](./VERIFICATION_PLAN.md)
- [Immutability verification](./IMMUTABILITY_VERIFICATION.md)
- [Roll-back procedures](./ROLLBACK_PROCEDURES.md)
- [Key management policy](../../security/KEY_MANAGEMENT.md)
- [TON multi-sig contract reference](https://github.com/ton-blockchain/multisig-contract-v2)
