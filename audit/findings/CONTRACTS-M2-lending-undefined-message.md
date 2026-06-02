---
title: "[CONTRACTS-M2] LendingProtocolCoordinator references undefined message RegisterNFTOwner"
severity: medium
area: contracts
priority: medium
stage: 3
labels: ["bug","audit","type:contract","priority:medium","stage:3-medium"]
---

## Summary

`LendingProtocolCoordinator` declares a handler for a message type `RegisterNFTOwner` that is not defined or imported anywhere, while the message actually declared in the file is `RegisterNFTOwnerLending`. The handler is therefore dead/unreachable or a compile error, and the discrepancy is currently masked because the active build manifest only compiles `account-state`.

## Severity & Category

- Severity: Medium
- Category: Correctness / Build integrity (undefined message type)

## Affected Code

- `contracts/LendingProtocolCoordinator.tact` line `357` (`receive(msg: RegisterNFTOwner)`)
- `contracts/LendingProtocolCoordinator.tact` line `370` (`message(0x7e8764ef) RegisterNFTOwnerLending` definition)

## Description

The handler at line 357 receives `RegisterNFTOwner`:

```tact
receive(msg: RegisterNFTOwner) { ... }
```

but the only message defined in the file is `RegisterNFTOwnerLending` (line 370, opcode `0x7e8764ef`). `RegisterNFTOwner` is not defined in this file nor in any imported interface. Depending on how the file is compiled, this is either an unreachable handler bound to a non-existent type or a compilation failure. The type error does not surface today because the active build manifest compiles only `account-state`, so this contract is never built in CI.

## Impact

Owner registration for the lending coordinator is effectively broken or unbuildable: the intended `RegisterNFTOwnerLending` message has no handler, and the declared `RegisterNFTOwner` handler can never be invoked. Because the contract is excluded from the active build, the defect is hidden from CI and could ship or be relied upon incorrectly.

## Suggested Fix

- Rename the handler to `receive(msg: RegisterNFTOwnerLending)` so it matches the declared message, or define/import the intended `RegisterNFTOwner` message type.
- Add `LendingProtocolCoordinator` to a build manifest so the compiler enforces message-type correctness in CI.

## Acceptance Criteria

- [ ] The handler binds to a defined, imported message type (no undefined `RegisterNFTOwner`).
- [ ] `LendingProtocolCoordinator` compiles cleanly and is included in a build manifest exercised by CI.
- [ ] Regression test / build check: CI fails if the coordinator references an undefined message type.

## References

- Audit umbrella issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/SMART_CONTRACTS_SECURITY_AUDIT.md`
- `audit/BUILD_INSTRUCTIONS.md`

---

**Tracking issue:** [#280](https://github.com/xlabtg/tonbankcard-protocol/issues/280)
