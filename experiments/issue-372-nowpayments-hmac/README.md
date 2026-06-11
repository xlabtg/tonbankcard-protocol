# Issue #372 / PC-03 — NOWPayments IPN HMAC must be a real signature

Minimal, self-contained reproduction of the **PC-03** finding:
`backend/adapters/nowpayments.ts`'s `verifyCallback()` authenticated IPN
callbacks with a **placeholder** digest —

```ts
// pre-fix calculateHMAC
return `hmac_placeholder_${data.length}_${secret.length}`;
```

— instead of a real HMAC. The "signature" is derived from two string *lengths*
and **never from the secret's bytes**, so it cannot authenticate anything. Worse,
the placeholder embeds `secret.length` in its own suffix, so a single legitimate
callback **leaks** the only secret-derived input. An attacker can then forge a
`payment_status: "finished"` IPN for a payment that never happened; the forged
callback passes `verifyCallback()`, and `emitPaymentSettledEvent()` credits a
merchant's NFT Account off-chain. This breaks the trust boundary the webhook
signature is supposed to enforce.

## What `hmac-forgery.repro.spec.ts` proves

The spec inlines the **exact pre-fix verifier** (`oldVerifyCallback`) for the
"before" column and drives the **real adapter** (`createNOWPaymentsAdapter`) for
the "after" column, so the contrast is against live code:

- **before — the attack:** the attacker reads `secret.length` from one genuine
  callback, crafts a brand-new malicious `finished` callback, and computes a
  matching placeholder signature using only public information (their own payload
  length + the leaked secret length). The vulnerable verifier **accepts** it. A
  second test shows the placeholder yields the same value for a *completely
  different secret of the same length* — proof it authenticates nothing.
- **after — the fix:** the same forged signature is **rejected**; a
  correctly-computed HMAC-SHA512 digest is **accepted**; canonicalization makes
  key order irrelevant; a one-byte tamper and an empty header are both rejected
  (the latter without throwing).

| Forged "finished" callback (attacker, no secret) | Correctly-signed callback (genuine) |
| --- | --- |
| **Before the fix** (placeholder digest) | **ACCEPTED** ❌ — settlement credited for a payment that never happened | accepted |
| **After the fix** (HMAC-SHA512 + `timingSafeEqual`) | **REJECTED** ✅ | **ACCEPTED** ✅ |

## The golden vector

The fix is pinned to a fixed `(secret, payload) → signature` vector so the
algorithm can never silently drift:

```
secret  = "test_ipn_secret_key"
payload = GENUINE_CALLBACK  (9 flat fields)

canonical JSON (keys sorted recursively):
{"order_description":"Synthetic regression vector","order_id":"ORDER-12345","pay_address":"TQAsynthetic_pay_address","pay_amount":45.5,"pay_currency":"ton","payment_id":5077125051,"payment_status":"finished","price_amount":99.99,"price_currency":"usd"}

HMAC-SHA512(canonical, secret) =
1cd29b09828a5186afea90080567d3d9df75be898863749ff9f8fc449b68102eb1ca1a9a7e92a3f1eb90230941437779f4a980c44fa394ca9444b9c4665feb0b
```

The spec both re-derives this digest with `crypto.createHmac` **and** asserts the
hard-coded literal, then confirms the live adapter accepts exactly that value.
The same vector is locked into the permanent CI regression test (see below).

## How to run

This experiment imports the live production adapter
(`../../backend/adapters`), so the test always runs against the real code.
`ts-jest` is configured with `isolatedModules` (transpile-only) so the
behavioural reproduction does not depend on unrelated type-checking of the
adapter tree.

```sh
cd experiments/issue-372-nowpayments-hmac
npm install
npm test
```

Expected against the fixed adapter: **all tests pass** (the "before" tests pass
by *demonstrating* the forgery against the inlined pre-fix verifier; the "after"
tests pass by showing the real adapter rejects it).

To witness the original vulnerability in the production code itself, check out
`backend/adapters/nowpayments.ts` prior to the Issue #372 fix (or restore the
`hmac_placeholder_...` body of `calculateHMAC`), and the "after" rejection tests
will fail because the forged signature is accepted.

## Permanent regression coverage

`backend/adapters` is otherwise not part of the CI test matrix. The CI-enforced
lock for this fix is the dedicated **`tests/nowpayments-adapter/`** workspace
(wired into `.github/workflows/ci.yml`), which pins the same golden vector and
asserts forgery rejection / genuine acceptance / constant-time comparison. This
standalone experiment is kept only as the behavioural reproduction.
