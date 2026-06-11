# NOWPayments adapter — IPN HMAC regression suite (PC-03 / #372)

Permanent, CI-enforced regression coverage for the NOWPayments IPN webhook
signature check in `backend/adapters/nowpayments.ts`.

## Why this exists

Audit finding **PC-03** ([#372](https://github.com/xlabtg/tonbankcard-protocol/issues/372))
reported that `verifyCallback()` authenticated callbacks with a **placeholder**
digest (`hmac_placeholder_${data.length}_${secret.length}`) instead of a real
HMAC. Because that value never depends on the secret's bytes, an attacker could
forge a `payment_status: "finished"` IPN and have it accepted. This suite locks
the fix so the placeholder can never come back.

## What it pins (the four PC-03 acceptance criteria)

`nowpayments-hmac.spec.ts` drives the **real adapter** and asserts:

1. **Real HMAC-SHA512** — the signature is exactly
   `HMAC-SHA512(canonical-json, ipnSecret)` hex, recomputed independently with
   `crypto` and matched against a hard-coded golden vector.
2. **Accept genuine / reject forged** — a correctly-signed callback (object form,
   raw-string form, and scrambled key order) is accepted; a placeholder-style
   signature, a wrong-secret signature, a tampered payload, and an empty header
   are all rejected; a missing IPN secret throws.
3. **Constant-time comparison** — a one-byte difference at either the start or
   the end is rejected (full-content compare, no early-exit), and a wrong-length
   signature is rejected rather than throwing inside `crypto.timingSafeEqual`.
4. **Fixed vector** — `secret = "test_ipn_secret_key"`, the 9-field
   `CALLBACK`, and the pinned 128-char hex digest
   (`1cd29b09…65feb0b`) are constants in the spec.

## Running locally

```sh
cd tests/nowpayments-adapter
npm install
npm test
```

Expected: **14 passed**.

## Notes

- **No committed lockfile (Pattern A).** This workspace deliberately ships
  without a `package-lock.json` so CI installs with `npm install --no-audit
  --no-fund` (the repo's DEVOPS-M2 policy only mandates `npm ci` where a lockfile
  is committed). `node_modules/` and any generated lockfile are git-ignored at
  the repo root.
- **Transpile-only (`isolatedModules`).** ts-jest runs in transpile-only mode so
  the runtime behaviour of the fix is validated without type-checking the wider
  `backend/adapters` tree, which carries pre-existing latent type issues outside
  PC-03's scope. The behavioural reproduction lives in
  `experiments/issue-372-nowpayments-hmac/`.
