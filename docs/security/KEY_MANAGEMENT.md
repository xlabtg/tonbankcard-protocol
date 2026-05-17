# TONBANKCARD Protocol — Key Management & Operational Security

**Document Type:** Operational Security Framework
**Issue Reference:** [#60 - Issue 10.4 Key Management & Operational Security (Formalized)](https://github.com/xlabtg/tonbankcard-protocol/issues/60)
**Dependencies:**
- [docs/threat-model.md](../threat-model.md) — Threat T8 (Admin Key Compromise)
- [docs/governance.md](../governance.md) — Development governance principles
- [docs/dao-governance.md](../dao-governance.md) — TBC Diamonds DAO
- [docs/versioning-policy.md](../versioning-policy.md) — Deployment policy
**Status:** Formal Specification
**Last Updated:** 2026-03-05

---

## Table of Contents

1. [Security Philosophy](#1-security-philosophy)
2. [Key Classification](#2-key-classification)
3. [Storage Requirements](#3-storage-requirements)
4. [Role Separation](#4-role-separation)
5. [Key Rotation Policy](#5-key-rotation-policy)
6. [Compromise Scenarios](#6-compromise-scenarios)
7. [Multi-Sig & MPC Requirements](#7-multi-sig--mpc-requirements)
8. [Backup & Recovery](#8-backup--recovery)
9. [Operational Security (OpSec)](#9-operational-security-opsec)
10. [Supply Chain Security](#10-supply-chain-security)
11. [Prohibited Practices](#11-prohibited-practices)
12. [Audit & Institutional Expectations](#12-audit--institutional-expectations)
13. [Documentation Deliverable](#13-documentation-deliverable)
14. [Acceptance Criteria Verification](#14-acceptance-criteria-verification)
15. [Non-Goals](#15-non-goals)

---

## 1. Security Philosophy

### Core Principles

TONBANKCARD is a **non-custodial protocol**. Keys are not merely credentials — they are the operational boundary of the entire system. A compromised key is a compromised perimeter. This framework formalizes the minimum-viable key discipline required for a protocol that touches real financial flows.

**Least Privilege**

Every key, role, and process is granted only the minimum permissions required for its function. No key has more authority than strictly necessary. Admin keys cannot move user funds. Governance keys cannot override smart contract logic. CI/CD secrets cannot access production infrastructure.

**Role Separation**

No individual holds both deployment authority and governance custody. No automated system holds production signing keys. No human holds a key that is also accessible to a CI/CD pipeline.

**Hardware-Backed Storage**

All on-chain authority keys — including deployment keys, governance NFT custody, and adapter signing keys — MUST be stored on hardware security modules (HSMs) or dedicated hardware wallets (Ledger, Trezor, or equivalent). Software-only storage is prohibited for all high-value keys.

**Deterministic Rotation Policy**

Key rotation is not reactive — it is scheduled. Every key class has a defined rotation interval. Rotation is documented, timestamped, and acknowledged by the relevant key holder. Emergency rotation procedures are defined in advance and tested.

**Defense in Depth**

No single key compromise results in loss of user funds. The architecture is designed so that:
- Admin keys can pause the protocol but cannot seize funds
- Governance keys signal preferences but cannot execute transactions
- Deployment keys can deploy new contracts but cannot modify existing immutable ones
- Backend keys can read state but cannot sign fund-moving transactions

---

## 2. Key Classification

### 2.1 On-Chain Authority Keys

These keys have direct on-chain authority and are the highest-risk class.

| Key | Authority | Scope | Current Setup |
|-----|-----------|-------|---------------|
| **Admin Key (Payment Hub)** | `op::set_paused`, `op::account_flagged` | Protocol-wide pause and account flagging | Single key — TEMPORARY (see [T8 in threat-model.md](../threat-model.md)) |
| **Risk Authority Key** | `set_fraud_lock`, `clear_fraud_lock` (Account Locks contract) | Fraud lock management | Single key — TEMPORARY (HIGH RISK); target after E3: 3-of-5 hardware multi-sig (see [`../governance/RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) §2.1) |
| **Lending Adapter Key** | `set_collateral_lock`, `clear_collateral_lock` (Account Locks contract) | Collateral lock management | Not yet deployed |
| **Deployment Key** | Contract deployment authority | One-time deployment; immutable after | Cold storage required |

**Governance Roadmap** (cross-reference: [docs/threat-model.md T8](../threat-model.md)):
- **Phase 1 (Current):** Single admin key — TEMPORARY, acknowledged HIGH RISK
- **Phase 2 (Q1 2026):** Multi-sig admin (3-of-5 threshold)
- **Phase 3 (Q2 2026):** Time-locked governance with DAO oversight (48-hour delay)
- **Phase 4 (Q3 2026):** Full DAO governance, removal of manual admin keys

### 2.2 Governance NFT Custody Keys

| Asset | Description | Supply | Custody Requirement |
|-------|-------------|--------|---------------------|
| **TBC Diamonds** | Governance NFT collection | 222 NFTs | Hardware wallet or MPC; hot wallets FORBIDDEN for majority holdings |

TBC Diamonds ownership confers voting rights in the DAO governance model (see [docs/dao-governance.md](../dao-governance.md)). Governance is advisory and non-binding; however, custody of a majority of diamonds would allow social capture of the protocol's signaling layer.

**Required:**
- No single hardware device holds >33% of TBC Diamonds supply (74+ NFTs)
- Diamonds used for governance participation may be temporarily accessible from hardware wallets
- Cold storage preferred for long-term holdings not actively voting

### 2.3 Infrastructure Keys

| Key | System | Authority | Risk Level |
|-----|--------|-----------|------------|
| **Backend Server SSH Keys** | TON indexer, API servers | Shell access to infrastructure | HIGH |
| **Database Credentials** | PostgreSQL / indexer DB | Read/write to indexed state | MEDIUM |
| **Monitoring API Keys** | Alerting and observability stack | Read metrics, trigger alerts | LOW |
| **Domain / TLS Certificates** | Web infrastructure | HTTPS endpoint control | MEDIUM |

Infrastructure keys cannot move funds but can disrupt service availability and access indexed data.

### 2.4 CI/CD & Build Secrets

| Secret | System | Authority | Risk Level |
|--------|--------|-----------|------------|
| **GitHub Actions Secrets** | CI pipeline | Read repository, run tests, publish packages | MEDIUM |
| **NPM Publish Token** | SDK publication | Publish packages to npm registry | HIGH (supply chain) |
| **Testnet Funding Key** | TON testnet wallet | Fund test deployments on testnet only | LOW |
| **Docker Registry Credentials** | Container builds | Push container images | MEDIUM |

CI/CD secrets MUST NOT have access to mainnet keys, production infrastructure, or governance assets.

---

## 3. Storage Requirements

### 3.1 Hardware Requirements by Key Class

| Key Class | Required Storage | Permitted Alternatives | Prohibited |
|-----------|-----------------|----------------------|------------|
| On-chain authority keys (Admin, Risk Authority) | Ledger / Trezor hardware wallet OR MPC | Cold air-gapped machine (offline, never connected) | Software wallets, cloud storage, plaintext files, password managers |
| Governance NFT custody (majority, >33 diamonds) | Hardware wallet OR MPC threshold scheme | Geographic distribution across multiple hardware devices | Hot wallets, exchange custody, software wallets |
| Deployment keys | Cold storage (air-gapped) | Hardware wallet | Internet-connected machines, shared devices |
| Adapter signing keys | Hardware wallet or dedicated HSM | Software wallet with hardware-backed key storage (TPM) | Unprotected software storage |
| Backend SSH keys | SSH certificate authority with limited-lifetime certificates | Ed25519 keys on dedicated management host | Shared keys, keys stored in repositories, unencrypted on shared machines |
| CI/CD secrets | GitHub Actions encrypted secrets | Vault (HashiCorp or equivalent) | Plaintext in code, environment files in repositories |

### 3.2 Hot Wallet Prohibition

**Hot wallets are FORBIDDEN for:**
- Governance majority custody (>33 TBC Diamonds)
- Deployment authority (deployment keys)
- Admin keys (Payment Hub, Account Locks risk authority)

**Hot wallets are PERMITTED for:**
- Testnet operations only
- Operational monitoring (read-only)
- Individual TBC Diamond holders with <5 diamonds (operational convenience)

### 3.3 Key Isolation Requirements

Keys must be isolated such that:
1. A compromised CI/CD environment cannot access production signing keys
2. A compromised backend server cannot access on-chain authority keys
3. A compromised developer workstation cannot access deployment keys
4. No single machine holds both backup and primary keys

---

## 4. Role Separation

### 4.1 Defined Roles

| Role | Responsibilities | Permitted Key Access | Prohibited |
|------|-----------------|---------------------|------------|
| **Developer** | Code contributions, reviews, tests | Repository access, testnet keys only | Deployment keys, admin keys, production infrastructure |
| **Deployer** | Contract deployments, deployment manifest publication | Deployment key (cold storage), testnet keys | Admin keys, governance NFTs, backend access |
| **Governance Holder** | TBC Diamond custody, DAO voting participation | Governance NFT custody keys | Protocol admin keys, CI/CD secrets |
| **Operator** | Infrastructure management, backend, indexer | SSH keys (backend), database credentials | On-chain authority keys, deployment keys |
| **Security / Risk** | Fraud lock management, incident response | Risk Authority Key (Account Locks) | Deployment keys, governance NFTs |

### 4.2 Separation Rules

**Hard Rules (MUST be enforced):**
- No individual may simultaneously hold the Deployer role and the Admin Key
- No automated system (CI/CD) may hold a production signing key
- No individual holds both Risk Authority Key and Deployment Key
- The Governance Holder role is independent of all operational roles

**Rationale:**
- Preventing a single point of compromise that yields both deployment authority and admin control
- Ensuring CI/CD compromise cannot result in mainnet contract modifications
- Ensuring governance capture cannot result in operational disruption

### 4.3 Role Assignment

Role assignments must be:
- Documented and timestamped in this file's Version History section
- Acknowledged by each individual in writing (or verifiable communication)
- Reviewed and reaffirmed on each key rotation cycle
- Immediately revoked on role change, departure, or compromise

---

## 5. Key Rotation Policy

### 5.1 Rotation Schedule

| Key | Rotation Interval | Trigger Conditions | Documentation Required |
|-----|-------------------|--------------------|----------------------|
| **Admin Key (Payment Hub)** | 12 months OR upon governance phase transition | Suspicious activity, phase change, personnel change | Timestamped rotation log, new key hash, acknowledgment |
| **Risk Authority Key** | 6 months | Suspected compromise, personnel change | Timestamped log, contract redeployment if address-bound |
| **Deployment Key** | Per deployment | After each mainnet deployment (key should be retired) | Deployment manifest entry |
| **Backend SSH Keys** | 12 months | Personnel departure, suspicious access, certificate expiry | SSH CA rotation log |
| **Database Credentials** | 6 months | Personnel departure, application change | Infrastructure changelog |
| **CI/CD Secrets** | 6 months | Repository access change, security incident | GitHub Actions secrets audit log |
| **NPM Publish Token** | 12 months | Suspected compromise, maintainer change | npm security log |

### 5.2 Rotation Procedure

For each key rotation:

1. **Pre-rotation:**
   - Announce rotation to relevant stakeholders minimum 48 hours in advance
   - Prepare new key material on hardware device (never on internet-connected machine for authority keys)
   - Test new key access in controlled environment

2. **Rotation:**
   - Generate new key material
   - Update all systems that reference the old key (contracts, configs, infrastructure)
   - For on-chain address-bound keys: execute governance process to update contract configuration
   - Revoke old key access immediately upon successful cutover

3. **Post-rotation:**
   - Verify new key is functional via test transaction (testnet where possible)
   - Destroy or securely archive old key material (see Section 8 for archive policy)
   - Log rotation: timestamp, key identifier, operator, reason
   - Update this document's Version History

### 5.3 Emergency Rotation

Emergency rotation is triggered when any of the following occur:
- Key material is suspected to have been viewed by unauthorized parties
- Hardware device is lost, stolen, or damaged
- Personnel with key access departs unexpectedly
- CI/CD pipeline behaves anomalously

**Emergency rotation timeline:**
- Discovery to rotation initiation: **< 1 hour**
- Rotation completion: **< 4 hours** for on-chain authority keys, **< 24 hours** for infrastructure keys

Emergency rotations must be logged with timestamp, trigger event description, and rotating operator within 24 hours of completion.

### 5.4 Risk Authority Multi-Sig Rotation Procedure (E3)

The Risk Authority is a 3-of-5 hardware multi-sig wallet (see [`../governance/RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) §§ 2, 6). Rotation has three surfaces, each with its own procedure. All three reuse the existing on-chain handlers in `contracts/payments/account-locks.fc` — no contract redeployment is required.

#### 5.4.1 Single-signer rotation (planned)

Triggered when an RA-x signer's term expires (RA-3: 6 months; RA-4 / RA-5: 12 months), or when an internal handover is required without compromise.

1. **T-30 days** — announce upcoming rotation on the security ops channel and in the public `docs/governance/risk-authority-rotation.log`.
2. **T-14 days** — for RA-3 / RA-5 (DAO-elected seats): submit a `RISK_DISCLOSURE` proposal to the Diamond DAO via [`../governance/PARAMETER_CHANGES.md`](../governance/PARAMETER_CHANGES.md) template; for RA-1 / RA-2 / RA-4: publish the proposed replacement (role only, not identity) and collect community comment for 14 days.
3. **T-7 days** — the **outgoing** signer (or the remaining 3-of-5 quorum if the outgoing signer is unavailable) prepares the signer-set update packet for the multi-sig wallet contract. The packet is reviewed off-chain by all remaining signers on cold air-gapped machines.
4. **T+0** — the remaining signers collect a 3-of-5 signature on the wallet's internal `UpdateSigners` operation. The on-chain `risk_authority` slice in `account-locks.fc` does **not** change (the wallet contract address is unchanged); only the wallet's internal signer roster does.
5. **T+24 h** — append a JSON Lines entry to `docs/governance/risk-authority-rotation.log` with: rotation type (`single-signer`), outgoing role, incoming role, DAO `proposal_id` (if applicable), `tx_hash` of the wallet's `UpdateSigners` call. The SHA-256 of the rotation entry is anchored on-chain via `TransparencyRegistry.RecordSnapshot`.
6. **T+72 h** — the incoming signer publishes their first quarterly readiness attestation (`RISK_AUTHORITY.md` §2.2 step 4) to confirm operational handover is complete.

#### 5.4.2 Whole multi-sig replacement (planned)

Triggered when the wallet implementation must be upgraded (e.g. moving from `org.ton.contracts.multisig.v2` to a newer audited variant), or when ≥ 2 signers must be replaced simultaneously and a fresh wallet is preferred to a sequence of single-signer rotations.

1. **T-30 days** — announce the wallet change; submit `RISK_DISCLOSURE` proposal to the Diamond DAO under [`../governance/PARAMETER_CHANGES.md`](../governance/PARAMETER_CHANGES.md). Quorum ≥ 44 (supermajority, per [`../governance/PARAMETERS.md`](../governance/PARAMETERS.md) §9 for lock-impacting changes).
2. **T-14 days** — deploy the new multi-sig wallet contract on mainnet; record its address and signer hashes in `docs/deployments/B2-mainnet/multisig.risk-authority.json` and commit the manifest.
3. **T+0** — the **current** multi-sig wallet (3-of-5 signatures) sends `op::propose_risk_authority = 0x4001` with the new wallet's address (lines 293–301 of `account-locks.fc`). This opens the 7-day timelock (`ROLE_TRANSFER_DELAY = 7 * 24 * 60 * 60` on line 54).
4. **T+0 → T+7 d** — the Diamond DAO ratification vote runs. The vote can recommend abort (in which case `op::cancel_risk_authority = 0x4003` is signed; lines 315–322) or proceed.
5. **T+7 d** — the **new** multi-sig wallet (3-of-5 signatures) sends `op::execute_risk_authority = 0x4002` (lines 304–312). The on-chain `risk_authority` slice rotates to the new wallet's address. The old wallet is no longer authorised.
6. **T+7 d + 24 h** — append rotation log entry; anchor SHA-256 on-chain; publish a one-page operational note in `docs/governance/risk-authority-rotation.log`. The next quarterly transparency report references the rotation.

#### 5.4.3 Emergency rotation (compromise scenario)

Triggered when ≥ 1 hardware device is lost / stolen / suspected compromised but < 3 signers are affected (so the wallet itself is not yet captured). The contract-level 7-day timelock **cannot be bypassed** — therefore the emergency procedure is "pause first, then rotate".

1. **T+0 → T+1 h** — security ops detect compromise (incident under [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) §3). The PaymentHub admin multi-sig considers signing `op::set_paused = true` if the threat extends beyond the Risk Authority (note: pause does **not** prevent further `op::set_fraud_lock` calls — these are gated on `risk_authority`, not on the pause flag — but the pause itself signals a protocol-wide incident to wallets and indexers).
2. **T+0 → T+4 h** — the remaining uncompromised signers (≥ 3 of 5) sign the wallet's internal `UpdateSigners` to remove the compromised signer(s) and provision a replacement on a freshly procured hardware device. If < 3 uncompromised signers remain, escalate to §5.4.4 below.
3. **T+4 h → T+24 h** — the indexer is instructed to **freeze attention** on the wallet: any setter transaction during the rotation window must be manually reviewed before being mirrored to `TransparencyRegistry`. The `ra.unknown-signer-set` alarm is expected to fire and is treated as expected noise for this window.
4. **T+24 h** — log the emergency rotation; publish a one-page incident note. The post-mortem follows [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) §6.

#### 5.4.4 Catastrophic compromise (≥ 3 of 5 signers compromised simultaneously)

If three signer keys are believed to be in adversarial hands, the wallet itself is captured and a setter transaction may be inevitable. The recovery path is:

1. **T+0** — the PaymentHub admin multi-sig signs `op::set_paused = true`. This does **not** stop further FRAUD_LOCK calls but signals a protocol-wide emergency.
2. **T+0** — the Diamond DAO opens an emergency `RISK_DISCLOSURE` proposal to authorise a contract redeployment with a fresh `risk_authority`. The DAO recognises that the contract-level 7-day timelock makes a clean role transfer impossible within the incident window; redeployment plus on-chain redirection of the wallet-UI is the only safe path.
3. **T+0 → T+7 d** — the DAO ratification vote runs; the on-chain `op::propose_risk_authority` is signed by the captured wallet in parallel, but with a **null** target address (acts as a placeholder; cancellable). The DAO's outcome determines whether the proposal is cancelled and replaced or whether redeployment proceeds.
4. **T+7 d → T+14 d** — execute redeployment (per `E1-activation/RUNBOOK.md` §8); the wallet UI is upgraded to point to the new contract; the captured wallet is left in `risk_authority` of the old contract (orphaned) and the old contract is paused indefinitely.
5. **Post-incident** — publish full timeline in [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) §6. Update [`RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) signer roster.

#### 5.4.5 Rotation log schema

Every rotation event (planned, emergency, catastrophic) appends a JSON Lines record to `docs/governance/risk-authority-rotation.log`:

```jsonl
{"rotation_type":"single-signer","outgoing_role":"RA-3","incoming_role":"RA-3","dao_proposal_id":"E3.5-PROP-014","tx_hash":"<hash>","wallet_address":"<EQ...>","transparency_snapshot":"<hash>","signed_at":"2026-06-15T12:00:00Z"}
```

The log is append-only; corrections are added as new entries with `"correction_of": "<earlier-entry-hash>"`. The indexer asserts every entry matches an on-chain event and raises `ra.rotation-log-mismatch` if not.

---

## 6. Compromise Scenarios

### 6.1 Admin Key Compromise (Payment Hub)

**Blast Radius:**
- Protocol can be paused (DoS)
- Accounts can be flagged (operational disruption)
- User funds CANNOT be moved (architectural guarantee)

**Containment:**
1. Immediately deploy new admin key via governance process (multi-sig when available)
2. Issue public communication about pause status if protocol is halted
3. Review all recent admin actions for unauthorized use

**Notification:**
- Internal team: immediate
- Community / users: within 2 hours if protocol is paused
- Public disclosure: within 72 hours (see Section 12)

**Recovery:**
1. Rotate admin key using governance procedure
2. Audit all account flags set after estimated compromise time
3. Clear any fraudulent flags
4. Unpause protocol after key rotation confirmed
5. Conduct post-mortem within 1 week

---

### 6.2 Risk Authority Key Compromise (Account Locks)

**Pre-E3 (single key) blast radius:**
- Arbitrary fraud locks can be set on any account (operational disruption)
- Existing valid fraud locks can be cleared (fraud risk)
- User funds CANNOT be seized (architectural guarantee, INVARIANT I6)

**Post-E3 (3-of-5 multi-sig) blast radius:**
- A single signer compromise is **non-actionable** — the contract guard `equal_slices(sender_address, risk_authority)` reduces every setter call to "the multi-sig wallet emitted it", and the wallet enforces 3-of-5 — see [`../governance/RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) §4.6 closing paragraph
- Two-signer compromise is detectable but still non-actionable
- Three-or-more signer compromise: see §5.4.4 (catastrophic recovery path)

**Containment (single-key era / pre-E3):**
1. Rotate risk authority key immediately via the existing two-phase `op::propose_risk_authority` (0x4001) → 7-day timelock → `op::execute_risk_authority` (0x4002) flow (`account-locks.fc` lines 293–322)
2. Review all lock changes after estimated compromise time
3. Re-evaluate cleared locks for potential fraud risk
4. Re-apply any fraudulently cleared locks using the new key

**Containment (post-E3, < 3 signers compromised):**
1. Trigger §5.4.3 (emergency rotation) — remove the compromised signer(s) from the multi-sig wallet roster via the wallet's internal `UpdateSigners` op
2. No on-chain role transfer is required (the wallet address is unchanged); the indexer's `ra.unknown-signer-set` alarm is expected to fire and is monitored manually for the duration of the rotation window
3. Audit any setter transactions during the compromise window — every transaction must have a matching evidence anchor (`TransparencyRegistry.RecordSnapshot`); transactions without an anchor trigger fast-track appeals per [`../governance/FRAUD_LOCK_APPEAL.md`](../governance/FRAUD_LOCK_APPEAL.md) §4

**Containment (post-E3, ≥ 3 signers compromised — catastrophic):**
1. Follow §5.4.4 — pause + DAO emergency redeployment proposal + wallet-UI redirection
2. The contract-level 7-day timelock cannot be bypassed; planning for this scenario must therefore assume a multi-day recovery window during which the captured wallet may sign one or more malicious setters
3. All malicious setters from the compromise window are reviewed under the fast-track appeal path (`FRAUD_LOCK_APPEAL.md` §4.1, FT-2) and cleared at no cost to holders

**Notification:**
- Internal team: immediate
- Affected users: within 4 hours if their accounts were flagged (same SLA pre- and post-E3)
- Lending partners (if collateral locks involved): N/A — collateral locks are gated on `lending_adapter`, not `risk_authority` (`account-locks.fc` lines 246–262)

**Recovery:**
1. Rotate per the appropriate §5.4.x sub-procedure
2. Audit lock activity in the compromise window (TransparencyRegistry events plus indexer alarms)
3. Conduct post-mortem within 1 week ([`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) §6)
4. Update [`../governance/RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) signer roster (by role) if a seat is replaced

---

### 6.3 Deployment Key Compromise

**Blast Radius:**
- New malicious contracts can be deployed to the network
- Existing immutable contracts CANNOT be modified (architectural guarantee)
- Users on existing contract versions are unaffected

**Containment:**
1. Retire compromised deployment key immediately
2. Audit all recent deployments to identify any malicious contracts
3. Issue public warning about unauthorized deployments
4. Do not use new deployment key until audit is complete

**Notification:**
- Internal team: immediate
- Community: within 2 hours if malicious contracts are identified
- Deployment manifest: publish signed statement about unauthorized deployments

**Recovery:**
1. Issue new deployment key (cold storage)
2. Publish audit of all deployments under compromised key
3. Mark any unauthorized deployments in deployment manifest with explicit warning
4. Conduct post-mortem within 1 week

---

### 6.4 Governance NFT Custody Compromise

**Blast Radius:**
- Governance signaling can be manipulated (DAO voting)
- Protocol advisory votes can be dominated by attacker
- On-chain state CANNOT be changed (governance is non-binding, non-executing)

**Containment:**
1. Transfer remaining diamonds to new secure custody immediately
2. Disclose compromise to community
3. Invalidate any governance votes cast after estimated compromise time

**Notification:**
- Internal team: immediate
- Community / DAO participants: within 4 hours

**Recovery:**
1. Transfer diamonds to new custody
2. Publish post-mortem on governance compromise
3. Review whether compromised votes influenced any pending decisions

---

### 6.5 CI/CD Secret Compromise

**Blast Radius:**
- NPM package poisoning (supply chain attack — HIGH RISK)
- Test environment disruption
- Repository read access (information disclosure)
- Docker image tampering

**Containment:**
1. Revoke all CI/CD secrets immediately
2. Rotate NPM publish token and audit recent package publications
3. If NPM package was published under compromised token: pull package and issue security advisory
4. Audit recent CI runs for anomalous behavior

**Notification:**
- Internal team: immediate
- npm security: within 1 hour if package is affected
- Users of SDK: within 2 hours via GitHub Security Advisory

**Recovery:**
1. Issue new clean package version with explicit security note
2. Update all CI/CD secrets
3. Audit and clean repository access logs
4. Conduct post-mortem within 1 week

---

### 6.6 Backend Infrastructure Compromise

**Blast Radius:**
- Indexed data may be tampered or deleted (service disruption)
- API responses may be manipulated (misleading users — informational only)
- User funds CANNOT be moved (backend is read-only with no signing authority)

**Containment:**
1. Isolate compromised hosts from network
2. Rotate all backend SSH keys and database credentials
3. Restore from clean backup
4. Audit database for tampered data

**Notification:**
- Internal team: immediate
- Users: only if displayed data was materially misleading about fund safety
- Note: Blockchain is source of truth; no fund loss is possible from backend compromise

**Recovery:**
1. Restore infrastructure from clean baseline
2. Replay blockchain events to rebuild indexer state
3. Conduct post-mortem within 1 week

---

## 7. Multi-Sig & MPC Requirements

### 7.1 High-Impact Key Policy

All keys classified as on-chain authority keys MUST use multi-sig or MPC before mainnet production deployment at scale. Single-key admin operations are a TEMPORARY state acknowledged as HIGH RISK in the threat model.

| Key | Current State | Required State | Target Date |
|-----|---------------|----------------|-------------|
| Admin Key (Payment Hub) | Single key | Multi-sig 3-of-5 | Q1 2026 |
| Risk Authority Key | Single key | Multi-sig 3-of-5 (hardware-backed) — see [`../governance/RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) | E3 activation (#134) |
| Governance NFT majority custody | Single holder (per diamond) | Threshold: no single entity >33% | Ongoing |
| Deployment Key | Single key | Multi-sig 2-of-3 (for future protocol versions) | Q2 2026 |

### 7.2 Threshold Policies

**Admin Key (Payment Hub) — Target: 3-of-5 Multi-Sig**
- 5 signers across at least 3 separate geographic locations
- No single organization controls >2 of 5 keys
- Time-lock of 48 hours on all admin actions (when implemented)

**Risk Authority Key — Target: 3-of-5 Multi-Sig (E3 — Issue [#134](https://github.com/xlabtg/tonbankcard-protocol/issues/134))**
- 5 signers across at least 3 distinct legal jurisdictions and physical locations
- Composition by role: RA-1 Protocol Team Lead, RA-2 Protocol Security Officer, RA-3 Community Representative (Diamond DAO elected, 6-month term), RA-4 External Auditor (12-month term), RA-5 Independent Adjudicator (Diamond DAO elected, 12-month term) — see [`../governance/RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) §2.1
- No single individual may hold more than one Risk Authority seat (§2.2 step 2) and no Risk Authority signer may simultaneously hold the Admin Key (PaymentHub) seat, the Lending Adapter key or the Deployment Key
- All signers use a dedicated Ledger or Trezor device; software wallets, cloud-stored keys and shared HSM partitions are prohibited
- No "emergency 1-of-3" override exists — the 3-of-5 threshold is contract-enforced via the multi-sig wallet (`org.ton.contracts.multisig.v2`) and cannot be bypassed by any single signer
- The fast-track / emergency path in [`RISK_AUTHORITY.md`](../governance/RISK_AUTHORITY.md) §4.6 compresses the *off-chain* ceremony window but still requires three valid hardware signatures and an on-chain evidence anchor before the setter is broadcast
- Quarterly signing-readiness attestation: every signer must re-attest within 72 h once per quarter; two consecutive misses trigger replacement (§2.2 step 4 of `RISK_AUTHORITY.md`)
- Rotation procedure: see §5.4 below

**Lending Adapter Key — Target: Hardware-backed single key with 2-of-3 confirmation**
- Lending operations are high-frequency; MPC preferred over multi-sig for latency
- All collateral lock operations must be logged and auditable

### 7.3 MPC Considerations

Where key operation frequency makes hardware multi-sig impractical (e.g., adapter signing keys), MPC (Multi-Party Computation) threshold schemes are permitted as an alternative, subject to:
- Use of audited MPC libraries only (e.g., Fireblocks, Lit Protocol)
- Threshold configuration equivalent to or stricter than the multi-sig requirement
- Regular participant key refresh according to MPC library recommendations

---

## 8. Backup & Recovery

### 8.1 Seed Phrase Storage

For all keys backed by BIP-39 seed phrases:

| Requirement | Details |
|-------------|---------|
| **Medium** | Metal backup (not paper) — fireproof, waterproof |
| **Copies** | Minimum 2 copies |
| **Geographic separation** | Copies in physically separate locations (different buildings, preferably different cities) |
| **Encryption** | Optional passphrase (BIP-39 25th word) stored separately from seed |
| **Labeling** | Labeled with key class and creation date (NOT the key material itself) |
| **Access logging** | Any physical access to backup location must be logged |

### 8.2 Recovery Test Schedule

| Test Type | Frequency | Procedure |
|-----------|-----------|-----------|
| **Backup integrity check** | Quarterly | Verify backup is legible and undamaged; do NOT import to live device |
| **Recovery drill** | Annually | Full recovery from backup to new hardware device (on testnet only) |
| **Disaster recovery drill** | Annually | Simulate loss of primary key holder; test full recovery chain |

Recovery drills MUST be logged with timestamp, participants, and outcome. Failed drills must be escalated and resolved within 30 days.

### 8.3 Disaster Recovery Plan

**Scenario: Loss of Primary Key Holder (single key era)**

1. Identify backup key holder if designated (multi-sig signatory)
2. If no backup: execute emergency key rotation using backup seed
3. Notify all stakeholders of operational continuity plan
4. Document transition in key management log

**Scenario: Loss of All Copies of a Key (catastrophic)**

1. For on-chain authority keys: deploy new contract version with new admin key (immutable contracts cannot be modified)
2. For governance NFTs: coordinate community governance for migration
3. For deployment keys: generate new key for next deployment cycle
4. For infrastructure keys: rotate from surviving credentials; restore from last clean backup

**Scenario: Geographic Disaster Affecting Backup Locations**

1. Activate geographic separation protocol (move surviving backups to safe location)
2. Assess which keys are compromised or inaccessible
3. Follow compromise scenario procedures for each affected key

---

## 9. Operational Security (OpSec)

### 9.1 Access Logging

All access to systems with key material must be logged:

| System | Required Logging |
|--------|-----------------|
| Production servers (SSH) | All logins, commands executed (auditd), session duration |
| Database | All queries, modifications, authentication attempts |
| CI/CD secrets | All secret access events (GitHub Actions audit log) |
| Physical backup locations | Human log entry on each access |

Logs must be:
- Retained for minimum 12 months
- Stored in a system separate from the one being monitored
- Reviewed weekly for anomalies
- Immutable (append-only; no delete permissions for operators)

### 9.2 SSH Hardening

All production SSH access MUST comply with:

```
# Required sshd_config settings
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
AllowUsers <explicit allowlist>
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
```

Additional requirements:
- SSH certificate authority for fleet management (short-lived certificates, 8-hour maximum TTL)
- MFA for interactive human logins (TOTP or hardware key)
- Jump host / bastion architecture: no direct internet access to production servers
- Key rotation: certificates expire automatically; long-lived host keys rotated annually

### 9.3 Server Isolation

| Zone | Systems | Isolation Requirement |
|------|---------|----------------------|
| **Signing Zone** | Any host involved in key operations | No internet access; air-gapped preferred; never shared with CI/CD |
| **Production Zone** | Indexer, API, database | Private network; no direct internet exposure; ingress via load balancer only |
| **Build Zone** | CI/CD runners | Ephemeral; no persistent state; no access to production zone |
| **Management Zone** | Bastion host | Limited access; strict allowlist; MFA mandatory |

### 9.4 Network Segmentation

- Production services are not directly reachable from the internet
- All external traffic passes through a load balancer or API gateway with WAF rules
- Internal services communicate on a private network segment
- The signing zone (if any) has no inbound or outbound internet connectivity

### 9.5 Zero-Trust Principles

- Every access request is authenticated and authorized regardless of network location
- No implicit trust based on being "inside the network"
- Access is scoped to the minimum required resource set
- All access is logged and auditable

### 9.6 Two-Factor Authentication (2FA)

**Required for:**
- All GitHub repository contributors (GitHub 2FA)
- All SSH interactive logins to production hosts
- All administrative access to cloud infrastructure
- All npm organization members

**Recommended authenticator:** Hardware security key (YubiKey or equivalent) over TOTP for critical access.

---

## 10. Supply Chain Security

### 10.1 Dependency Pinning

All build and deployment dependencies MUST be pinned to exact versions:

```json
// package.json — required pattern
{
  "dependencies": {
    "@ton/core": "0.57.1",        // exact version, no ^ or ~
    "@ton/crypto": "3.3.0"
  }
}
```

| Requirement | Implementation |
|-------------|---------------|
| **Lock files** | `package-lock.json` MUST be committed and kept up to date |
| **No `^` or `~` in production deps** | Use exact versions in `dependencies` |
| **Integrity hashes** | npm lockfile contains integrity hashes for all packages |
| **Audit schedule** | `npm audit` run on every CI build; HIGH/CRITICAL vulnerabilities block merge |

### 10.2 Verified Sources

| Artifact | Verification Requirement |
|----------|--------------------------|
| **npm packages** | Only from registry.npmjs.org with integrity verification |
| **TON toolchain (Tact, FunC)** | Only from official TON Labs / TonTech releases; verify checksums |
| **Docker base images** | Pinned by SHA256 digest, not floating tags |
| **GitHub Actions** | Pin Actions to specific commit SHA (not branch or tag) |

### 10.3 CI Environment Isolation

- CI runners have no access to mainnet keys or production infrastructure
- Each CI run starts from a clean, ephemeral environment
- Secrets are injected at runtime only for the specific job that requires them
- CI logs are audited for unexpected secret exposure (secret scanning enabled)
- Dependencies are installed fresh each run from lockfile (no persistent caches with write access)

### 10.4 Reproducible Builds

Smart contract builds MUST be reproducible:

```bash
# Verify contract bytecode matches deployed hash
git checkout <release-tag>
npm ci                          # Use lockfile for exact versions
npx blueprint build             # Compile contracts
sha256sum build/PaymentHub.cell  # Compare with deployment manifest
```

Reproducibility is verified as part of the deployment checklist in [docs/versioning-policy.md](../versioning-policy.md).

### 10.5 SDK Publication Security

Before any npm package publication:
1. Build on clean machine or CI with no custom environment modifications
2. Review `npm pack` contents for unexpected files
3. Publish with 2FA (OTP) even when using automated token
4. Tag the corresponding git commit immediately after publication
5. Verify published package contents on npm registry match local build

---

## 11. Prohibited Practices

The following practices are **STRICTLY PROHIBITED** regardless of circumstances:

### Key Handling

| Prohibited Practice | Risk | Permitted Alternative |
|--------------------|------|----------------------|
| Sharing private keys via messaging (Telegram, Slack, email, etc.) | Key interception; uncontrolled copies | Hardware device transfer only; never transmit key material digitally |
| Storing seed phrases in cloud notes (iCloud, Google Keep, Notion, etc.) | Cloud breach = key compromise | Metal backup in secure physical location |
| Storing seed phrases in plaintext files on any networked device | File system compromise = key loss | Hardware wallet seed management only |
| Copying private keys into scripts, configs, or `.env` files in repositories | Accidental commit = permanent exposure | GitHub Secrets, Vault, or environment injection only |
| Using the same key for multiple environments (testnet and mainnet) | Testnet key exposure = mainnet key exposure | Strict key isolation by environment |

### Operational Practices

| Prohibited Practice | Risk |
|--------------------|------|
| Shared root or admin accounts | No individual accountability; no audit trail |
| Interactive root login to production servers | Root session compromise = full server access |
| Disabling or bypassing CI security checks (`--no-verify`, skipping audit) | Undetected supply chain or quality issues |
| Deploying to mainnet from a developer laptop | Developer machine compromise = unauthorized deployment |
| Committing any form of secret, key, or credential to any repository | Permanent exposure even after deletion (git history) |
| Using production data in development or test environments | Real user data leakage |

### Process Practices

| Prohibited Practice | Risk |
|--------------------|------|
| Rotating keys without logging the event | Untracked key lineage; undetectable compromise |
| Granting permanent access instead of time-bounded access | Credential accumulation; hard to revoke |
| Skipping backup verification drills | Unknown backup integrity; failed recovery during incident |
| Single person managing all keys without review | Insider risk; no check on misuse |

---

## 12. Audit & Institutional Expectations

### 12.1 External Security Audit

The TONBANKCARD protocol is committed to an external security audit before mainnet scale deployment (see [docs/audit-scope.md](../audit-scope.md) for scope definition). Key management and operational security is part of the audit scope:

- Admin key architecture and multi-sig transition plan
- Risk authority key controls
- CI/CD secret hygiene
- Supply chain security

### 12.2 Banking Partner Due Diligence

Financial institution and banking partner due diligence processes typically require:

| Expectation | TONBANKCARD Response |
|-------------|---------------------|
| Evidence of key management policy | This document |
| Proof of role separation | Section 4 (Role Separation) |
| Backup and recovery procedures | Section 8 (Backup & Recovery) |
| Incident response plan | Section 6 (Compromise Scenarios) |
| Multi-sig or MPC for critical operations | Section 7 (Multi-Sig & MPC) — planned |
| Access control and audit logging | Section 9 (OpSec) |

### 12.3 PSP Risk Assessment

Payment Service Provider (PSP) onboarding typically requires:

| Requirement | Status |
|-------------|--------|
| Key management documentation | **Complete** — this document |
| No hot wallet custody of customer funds | **Compliant** — protocol is non-custodial by design |
| Incident response procedures | **Complete** — Section 6 |
| Supply chain controls for software | **Complete** — Section 10 |
| Access logging and audit trail | **Compliant** — Section 9.1 |

---

## 13. Documentation Deliverable

This document (`docs/security/KEY_MANAGEMENT.md`) fulfills the documentation requirement specified in Issue #60.

### Related Documentation

| Document | Location | Relationship |
|----------|----------|--------------|
| Threat Model | [docs/threat-model.md](../threat-model.md) | T8 (Admin Key Compromise) is the primary on-chain threat addressed here |
| Audit Scope | [docs/audit-scope.md](../audit-scope.md) | External audit covers key management controls |
| Versioning Policy | [docs/versioning-policy.md](../versioning-policy.md) | Deployment key policy integrates with deployment manifest |
| DAO Governance | [docs/dao-governance.md](../dao-governance.md) | Governance NFT custody requirements |
| Merchant API Security | [docs/merchant-api-security.md](../merchant-api-security.md) | API key and authentication security |
| SDK Security | [sdk/SECURITY.md](../../sdk/SECURITY.md) | SDK supply chain security (npm publication) |
| Contributing | [CONTRIBUTING.md](../../CONTRIBUTING.md) | Developer role restrictions on key access |

---

## 14. Acceptance Criteria Verification

This section maps each acceptance criterion from Issue #60 to the corresponding section in this document.

| # | Acceptance Criterion | Satisfied By | Status |
|---|---------------------|--------------|--------|
| AC-1 | All key classes enumerated with storage and rotation requirements | Section 2 (Key Classification), Section 3 (Storage Requirements), Section 5 (Key Rotation Policy) | ✅ |
| AC-2 | Storage requirements defined per key class (hardware vs. software vs. MPC) | Section 3.1 (Hardware Requirements by Key Class), Section 3.2 (Hot Wallet Prohibition) | ✅ |
| AC-3 | Role separation documented (Developer, Deployer, Governance holder, Operator) | Section 4 (Role Separation), Section 4.1 (Defined Roles), Section 4.2 (Separation Rules) | ✅ |
| AC-4 | Rotation policy defined (frequency, triggers, documentation requirements) | Section 5.1 (Rotation Schedule), Section 5.2 (Rotation Procedure), Section 5.3 (Emergency Rotation) | ✅ |
| AC-5 | Compromise scenarios mapped (blast radius, containment, notification, disclosure, recovery) | Section 6 (Compromise Scenarios), Sections 6.1–6.6 | ✅ |
| AC-6 | Prohibited practices listed | Section 11 (Prohibited Practices) | ✅ |
| AC-7 | Backup & recovery defined (seed phrase storage, geographic separation, recovery test schedule, disaster recovery) | Section 8 (Backup & Recovery), Sections 8.1–8.3 | ✅ |
| AC-8 | Supply chain controls documented (dependency pinning, lockfiles, verified sources, CI environment isolation, reproducible builds) | Section 10 (Supply Chain Security), Sections 10.1–10.5 | ✅ |

All 8 acceptance criteria are satisfied.

---

## 15. Non-Goals

This document explicitly does NOT claim or guarantee the following:

1. **Zero-compromise guarantee** — This framework minimizes the probability and blast radius of key compromise. It cannot eliminate the possibility of compromise entirely.

2. **Insider risk elimination** — Role separation and access logging reduce insider risk but cannot prevent a determined and privileged insider from acting maliciously. This framework reduces opportunity, not intent.

3. **Insurance or liability coverage** — This document is an operational policy, not an insurance contract. No financial guarantee is implied or provided.

4. **Regulatory compliance certification** — This document is intended to be consistent with financial regulatory expectations but does not constitute a legal compliance certification.

5. **Third-party service security** — Key management practices for external services (ChangeNOW, NOWPayments, TONCO DEX) are outside the scope of this document. These services are treated as untrusted per the threat model.

---

> **"In a non-custodial protocol, keys are the perimeter."**

---

## Document Maintenance

**Responsibility:** Security / Operations Team
**Review Frequency:** Every 6 months or on any key rotation event
**Update Triggers:**
- Key rotation events
- Role assignment changes
- Governance phase transitions (see Section 2.1 roadmap)
- Security incidents
- External audit findings

**Version History:**

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-05 | Initial formal specification (Issue #60) | AI Issue Solver |
| 1.1 | 2026-05-17 | E3 (Issue #134): raise Risk Authority target to 3-of-5 hardware multi-sig; add §5.4 rotation procedure; expand §6.2 compromise scenario for the multi-sig era | AI Issue Solver |

---

**TONBANKCARD: Non-Custodial. Auditable. Security-First.**
