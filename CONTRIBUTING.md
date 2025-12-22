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

### 8. Security & Disclosure

Security issues must NOT be disclosed publicly.

Please report vulnerabilities via private communication channels.

---

## Final Note

TONBANKCARD prioritizes:

* user sovereignty
* clarity over speed
* correctness over convenience

Contributions that compromise these principles will not be accepted.
