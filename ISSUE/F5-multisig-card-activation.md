---
name: "[F5] Multi-Sig Card Activation"
about: Production spec and wallet UX for MultiSigCard.tact with M-of-N signing and guardian recovery
labels: type:contract
track: F
priority: low
---

## 1. Goal

Define the production specification for `MultiSigCard.tact`, define M-of-N threshold models for corporate and personal accounts, build multi-sig approval flow UX in `wallet-ui/`, and implement guardian recovery mechanisms.

## 2. Context

`MultiSigCard.tact` exists as Phase 4 code and is not yet audited or deployed. Multi-sig cards are the primary mechanism for corporate accounts (multiple authorized signers) and enhanced personal account security (guardian recovery). A2 audit is a strict prerequisite for production use.

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F5](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Production Specification
- Define supported M-of-N models:
  - 2-of-3 (personal with guardian recovery)
  - 3-of-5 (small corporate team)
  - Custom M-of-N (up to 10 signers)
- Define signing ceremony flow
- Define signer addition/removal process (requires existing quorum)
- Document in `docs/multisig/SPECIFICATION.md`

### Corporate Account Use Case
- Signer invitation flow: owner invites additional signers
- Pending transaction queue: transactions await required signatures
- Signer notifications: each signer notified when their approval is needed
- Audit log: all signers and their approval times recorded

### Guardian Recovery
- Designated guardians (separate from signers) can help recover access
- Recovery requires guardian quorum (e.g., 2-of-3 guardians)
- Recovery cooldown period to prevent rushed recovery attacks
- Recovery documented in user-facing documentation

### Wallet UI
- Multi-sig creation flow (choose M-of-N, invite signers)
- Pending approvals screen (transactions awaiting signatures)
- Sign/reject transaction action
- Signer management (add/remove with existing quorum)

## 4. Out of Scope

- Corporate legal entity integration (KYC for corporate accounts is out of scope)
- EVM multi-sig (TON only for this issue)
- Changes to `MultiSigCard.tact` contract logic

## 5. Functional Requirements

1. User can create a 2-of-3 or 3-of-5 multi-sig card
2. Transactions require M signatures before execution
3. Each signer receives a notification when their approval is needed
4. Guardian recovery flow works end-to-end on testnet
5. Signer addition/removal requires existing quorum

## 6. Non-Functional Requirements

- Pending transaction queue accessible without all signers being online simultaneously
- Transaction approval window: at least 7 days before expiry
- Recovery cooldown: minimum 72 hours to prevent rushed social engineering attacks

## 7. Security Requirements

- A2 audit must be complete before production deployment
- Signature replay protection: each transaction signed with a unique nonce
- Guardian recovery must not be exploitable for unauthorized takeover
- Signer removal must require quorum (owner cannot remove all signers to regain sole control)

## 8. Acceptance Criteria

- [ ] A2 audit complete (strict prerequisite)
- [ ] `docs/multisig/SPECIFICATION.md` written
- [ ] `MultiSigCard.tact` deployed to testnet
- [ ] Multi-sig creation flow implemented in `wallet-ui/`
- [ ] Pending approvals screen implemented
- [ ] Guardian recovery flow implemented and tested
- [ ] End-to-end 2-of-3 flow tested on testnet
- [ ] All wallet-ui tests pass (28 tests)

## 9. References

- [MultiSigCard.tact](../contracts/MultiSigCard.tact)
- [Wallet UI](../wallet-ui/)
- Issue A2: [A2-formal-security-audit-phase4-contracts.md](./A2-formal-security-audit-phase4-contracts.md)
- Issue F1: [F1-ton-connect-deep-integration.md](./F1-ton-connect-deep-integration.md)
