---
title: "[FRONTEND-M2] SendPaymentScreen never enforces the documented biometric gate"
severity: medium
area: frontend
priority: medium
stage: 3
labels: ["bug","audit","type:frontend","type:security","priority:medium","stage:3-medium"]
---

## Summary

`SendPaymentScreen` documents that biometric confirmation gates emission of the payment deep link, but no biometric/auth check is actually performed before the link is opened. The documented gate is effectively absent.

## Severity & Category

- Severity: Medium
- Category: Security / Missing authentication control

## Affected Code

- `mobile-app/src/screens/SendPaymentScreen.tsx:5-8` — header comment claiming a biometric gate.
- `mobile-app/src/screens/SendPaymentScreen.tsx:23-50` — `onSubmit`, which builds and opens the link with no auth step.

## Description

The file header states:

```ts
// mobile-app/src/screens/SendPaymentScreen.tsx:5-8
 * SECURITY:
 * - The screen never signs.
 * - Biometric confirmation gates the deep-link emission when configured.
```

However, `onSubmit` proceeds directly from input to `Alert.alert` to `Linking.openURL` with no call to a biometric authenticator:

```ts
// mobile-app/src/screens/SendPaymentScreen.tsx:36-46
Alert.alert('Open wallet?', `${bundle.amountFormatted} → ${recipient}`, [
  { text: 'Cancel', style: 'cancel' },
  {
    text: 'Open',
    onPress: () => {
      Linking.openURL(bundle.link).catch((openError: unknown) => {
        setError(openError instanceof Error ? openError.message : String(openError));
      });
    },
  },
]);
```

There is no reference to `BiometricAuthenticator` (defined in `mobile-app/src/lib/secure/interfaces.ts`) anywhere in this flow, so the claimed gate does not execute. This is closely related to FRONTEND-M3 (the authenticator interface is declared but unused).

## Impact

- A device unlocked at the OS level (or one shoulder-surfed mid-session) can emit a payment deep link without the local re-authentication the documentation promises.
- The non-custodial guarantee still holds — the user's wallet performs the final signature and consent — but the documented local control that should precede handing off the payment intent is missing, weakening defense-in-depth against an opportunistic local attacker.

## Suggested Fix

- Inject a concrete `BiometricAuthenticator` (see FRONTEND-M3) into the screen.
- Before constructing/opening the link, call `isAvailable()` and, when biometrics are available/configured, `authenticate(...)`; proceed only on success.
- Fail closed: on authentication failure or error, do not open the link and surface an error.
- The authenticator only gates emission of a deep link; it does not introduce key handling or signing in the app, preserving the non-custodial design.

## Acceptance Criteria

- [ ] A successful biometric/auth check is required immediately before the payment deep link is constructed/opened.
- [ ] On auth failure or error, the link is not opened and the flow fails closed with a user-visible error.
- [ ] The screen consumes the `BiometricAuthenticator` abstraction rather than inlining platform calls.
- [ ] The fix introduces no key handling or signing in the app (non-custodial property preserved).
- [ ] Regression test: a stubbed authenticator returning `false` (and one that throws) prevents `Linking.openURL` from being called; a stub returning `true` permits it.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- Related: `audit/findings/FRONTEND-M3-biometric-authenticator-unused.md`
- `audit/THREAT_MODEL.md`
- `audit/SCOPE.md`

---

**Tracking issue:** [#288](https://github.com/xlabtg/tonbankcard-protocol/issues/288)
