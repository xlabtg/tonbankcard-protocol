---
title: "[FRONTEND-M3] BiometricAuthenticator interface declared but never used"
severity: medium
area: frontend
priority: medium
stage: 3
labels: ["bug","audit","type:frontend","type:security","priority:medium","stage:3-medium"]
---

## Summary

The `BiometricAuthenticator` interface is declared in the mobile app's secure module, but no implementation is provided and no code consumes it. The biometric capability therefore exists only as a type, not as a runtime control. This is the root cause behind FRONTEND-M2.

## Severity & Category

- Severity: Medium
- Category: Security / Unimplemented control (dead abstraction)

## Affected Code

- `mobile-app/src/lib/secure/interfaces.ts:32-35` — `BiometricAuthenticator` interface declaration.

## Description

The interface is defined but has no implementor or consumer:

```ts
// mobile-app/src/lib/secure/interfaces.ts:32-35
export interface BiometricAuthenticator {
  isAvailable(): Promise<BiometricsAvailability>;
  authenticate(options: BiometricPromptOptions): Promise<boolean>;
}
```

A search of the mobile app finds no class implementing this interface and no call site invoking `authenticate(...)`. As a result, the biometric gate referenced by `SendPaymentScreen` (see FRONTEND-M2) can never run, and the secure module's documented intent — local biometric confirmation before sensitive actions — is unfulfilled.

## Impact

- The biometric control is non-functional: it cannot gate any action because nothing implements or calls it.
- Documentation and types imply a protection that does not exist at runtime, creating a false sense of security.

## Suggested Fix

- Provide a concrete platform implementation of `BiometricAuthenticator` (e.g. backed by the OS biometric API via the secure module) and export it from `mobile-app/src/lib/secure`.
- Inject and consume it in the send flow (FRONTEND-M2) and any other sensitive action.
- Keep the abstraction narrow as the module documents; the authenticator gates UI actions only and must never observe private keys, preserving the non-custodial design.

## Acceptance Criteria

- [ ] A concrete `BiometricAuthenticator` implementation exists and is exported from the secure module.
- [ ] At least one consumer (the send flow) injects and invokes it.
- [ ] The implementation does not handle or expose private keys (non-custodial property preserved).
- [ ] Regression test: the concrete authenticator is unit-tested (available/unavailable, success/failure) and the send flow is shown to consume it.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- Related: `audit/findings/FRONTEND-M2-send-payment-biometric-gate-missing.md`
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#289](https://github.com/xlabtg/tonbankcard-protocol/issues/289)
