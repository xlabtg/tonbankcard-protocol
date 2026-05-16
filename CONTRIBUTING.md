### 1. Project Philosophy

TONBANKCARD is a **non-custodial financial infrastructure protocol** built on TON.

The protocol is designed to:

* preserve user ownership
* avoid custody at all levels
* remain auditable and deterministic
* integrate with external partners without trust assumptions

TONBANKCARD is **not** a bank, payment processor, or lender.

---

### 2. What TONBANKCARD Is / Is Not

**TONBANKCARD IS:**

* an on-chain account abstraction using NFTs
* a settlement layer using TBC
* a payment orchestration protocol
* a collateral signaling layer

**TONBANKCARD IS NOT:**

* a custodian
* a credit issuer
* a yield protocol
* an admin-controlled system

---

### 3. Non-Custodial Rules (MANDATORY)

All contributions MUST comply with:

* no storage of user private keys
* no admin withdrawal of user funds
* no forced transfers
* no balance manipulation

Funds must always remain:

* user-owned
* on-chain
* transferable only by the user

---

### 4. Smart Contract Rules

Smart contract contributions MUST ensure:

* NFT ownership is the only account authority
* no upgradeable proxies
* no hidden privileged roles
* immutable logic after deployment
* explicit failure handling

Any contract introducing admin-level fund control will be rejected.

---

### 5. Backend & Frontend Rules

Off-chain components MUST:

* be stateless where possible
* never act as a source of truth
* never custody funds
* only orchestrate user-initiated actions

The blockchain is the **single source of truth**.

---

### 6. AI-Bot Rules (CRITICAL)

AI-generated contributions MUST:

* strictly follow the referenced Issue
* implement only what is explicitly specified
* avoid inferred or “helpful” additions
* include full documentation and tests

AI must not:

* change protocol economics
* introduce shortcuts
* add admin controls

Violations result in immediate PR rejection.

---

### 6.1 Property-Based Invariant Tests

The protocol invariants I1–I7 defined in [docs/invariants.md](docs/invariants.md)
are continuously verified by a property-based test suite using
[`fast-check`](https://fast-check.dev/) on a TypeScript state-machine
model. The suite lives at `tests/invariants/` as a standalone npm
project and is the **authoritative machine-checked verification** of
the protocol invariants.

**Layout:**

```
tests/invariants/
├── model/
│   └── protocol-model.ts          # state-machine model mirroring the on-chain contracts
└── property/
    ├── arbitraries.ts             # fast-check generators (NFTs, users, amounts, roles)
    ├── helpers.ts                 # snapshot + caller helpers
    ├── I1-non-custodial.spec.ts
    ├── I2-nft-authority.spec.ts
    ├── I3-no-admin-fund-control.spec.ts
    ├── I4-atomic-transfers.spec.ts
    ├── I4-adversarial.spec.ts     # deterministic attack scenarios
    ├── I5-ledger-conservation.spec.ts
    ├── I6-lock-not-confiscation.spec.ts
    ├── I7-lock-enforcement.spec.ts
    └── I7-adversarial.spec.ts     # deterministic attack scenarios
```

**Running locally:**

```bash
cd tests/invariants
npm install        # one-off
npm test           # runs property-based + adversarial specs
npm run typecheck  # validates the TypeScript model under strict mode
```

The full suite must complete in well under 60 seconds (current wall
clock ≈4 seconds). CI runs both commands above on every pull request
via the `test-invariants` job in `.github/workflows/ci.yml`.

**When to add tests:**

* Any new protocol operation (transfer-like action, lock, or admin role
  change) MUST extend the model in `tests/invariants/model/protocol-model.ts`
  and add property-based coverage proving the relevant invariants still
  hold.
* Any new threat-model entry MUST add a deterministic adversarial spec
  under `tests/invariants/property/*-adversarial.spec.ts`.
* If a new invariant Ik is introduced, add `Ik-<slug>.spec.ts` and
  update `docs/invariants.md` proof-status table.

**Formal-verification artifacts (stretch goal):**

A bounded TLA+ model lives in `docs/formal-verification/Protocol.tla`
and `Protocol.cfg` (see the `README.md` in that directory). It mirrors
the same invariants and is intended as documentation of the protocol
state machine — the property-based suite remains authoritative.

---

### 7. Review & Merge Process

All Pull Requests:

1. Must reference an Issue
2. Are reviewed for:

   * architectural alignment
   * security impact
   * scope compliance
3. Require at least one approving review
4. Must pass CI checks

Direct pushes to `main` are prohibited.

---

### 8. Architecture Governance

The protocol architecture is frozen and defined in the Architecture Baseline (PR #10).

Any changes to:
- protocol layers
- trust boundaries
- core responsibilities

require a dedicated Architecture Issue and explicit approval.

Architecture changes must not be introduced implicitly via implementation PRs.

---

### 9. Security & Disclosure

Security issues must NOT be disclosed publicly.

Please report vulnerabilities via private communication channels.

---

## Final Note

TONBANKCARD prioritizes:

* user sovereignty
* clarity over speed
* correctness over convenience

Contributions that compromise these principles will not be accepted.
