# B1 — Gateway Adapter Validation Matrix

**Engagement:** [B1](./ENGAGEMENT.md)
**Status:** Plan frozen — run against sandbox / testnet endpoints
**Owner:** `@konard`
**Last Updated:** 2026-05-16

---

## 1. Purpose

This document is the per-adapter validation matrix for the testnet deployment. It defines:

- Which sandbox / testnet endpoints each adapter MUST be tested against (no production endpoints).
- The exact test cases each adapter must pass (happy path + adversarial).
- The credentials policy for testnet/sandbox API keys.
- The findings format mirrored back into [`STATUS.md`](./STATUS.md) §9.2.

The suite enforces acceptance criterion #5 in [`ENGAGEMENT.md`](./ENGAGEMENT.md) §1 ("All backend adapters validated against sandbox/testnet gateways"). It is paired with [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) (on-chain validation) and [`INDEXER_VALIDATION.md`](./INDEXER_VALIDATION.md) (off-chain indexing validation).

---

## 2. Endpoint registry

Every adapter run during B1 MUST point at the rows below. Production endpoints are explicitly forbidden by [`ENGAGEMENT.md`](./ENGAGEMENT.md) §7.4.

| Adapter | Code path | Sandbox / testnet endpoint | Production endpoint (FORBIDDEN in B1) | Sandbox docs |
|---------|-----------|----------------------------|----------------------------------------|--------------|
| ChangeNOW | [`backend/adapters/changenow.ts`](../../../backend/adapters/changenow.ts) | `https://api-sandbox.changenow.io/v2/` (sandbox API) | `https://api.changenow.io/v2/` | [ChangeNOW API](https://changenow.io/api/docs) |
| NOWPayments | [`backend/adapters/nowpayments.ts`](../../../backend/adapters/nowpayments.ts) | `https://api-sandbox.nowpayments.io/v1/` (sandbox API) | `https://api.nowpayments.io/v1/` | [NOWPayments sandbox](https://documenter.getpostman.com/view/7907941/S1a32n38) |
| CoinRabbit | [`backend/adapters/coinrabbit.ts`](../../../backend/adapters/coinrabbit.ts) | CoinRabbit staging / testnet API (loaded via `COINRABBIT_API_BASE_URL` env var, never hard-coded) | CoinRabbit production API | Per partner agreement |

The adapter factories (`createChangeNOWAdapter`, `createNOWPaymentsAdapter`, `createCoinRabbitAdapter` in [`backend/adapters/index.ts`](../../../backend/adapters/index.ts)) accept the base URL as an explicit parameter so the validation harness can inject the sandbox host without source-code changes.

> **Hard guard.** The validation harness asserts that `process.env.ADAPTER_ENV === "sandbox"` before any adapter call. A missing / mismatched value fails the run with `ADAPTER_ENV_MISMATCH` (no API call is dispatched).

---

## 3. Credential policy

| Rule | Enforcement |
|------|-------------|
| Sandbox API keys are stored encrypted, loaded via env vars, never committed | [`RUNBOOK.md`](./RUNBOOK.md) §3.1 — pre-deploy checklist row "No secrets in repo" |
| Sandbox credentials are separate accounts from production (different signup, different e-mail) | Confirmed in writing in [`STATUS.md`](./STATUS.md) §12 row Q-5 before kickoff |
| Sandbox keys are rotated when B1 is closed (whether `READY-FOR-B2` or `BLOCKED`) | `RUNBOOK.md` §7 — post-deploy housekeeping |
| Adapter webhooks during B1 deliver to a sandbox URL only (`https://b1-sandbox.<host>/webhook`) | [`backend/adapters/changenow.ts`](../../../backend/adapters/changenow.ts) `ipn_callback_url`, [`backend/adapters/nowpayments.ts`](../../../backend/adapters/nowpayments.ts) `ipn_callback_url` |
| Webhook signature verification is mandatory (no `dev_mode_bypass_signature`) | NOWPayments `verifyWebhookSignature`, ChangeNOW HMAC equivalent |

---

## 4. ChangeNOW — test matrix

Each row corresponds to an automated test under `backend/adapters/tests/integration/changenow.testnet.spec.ts` (added in the same PR as the deployment). Tests are pointed at the sandbox via `CHANGENOW_API_BASE_URL=https://api-sandbox.changenow.io/v2/`.

| # | Test | Action | Expected | Severity if failing |
|---|------|--------|----------|---------------------|
| CN-1 | Quote round-trip | `getQuote('ton', 'btc', '100', 'standard')` | Returns `estimatedAmount` > 0, no destination address required, no API key for read | Blocker |
| CN-2 | Standard swap creation | `createSwap` with sandbox `address` field set to a sandbox-only BTC address, `nftAccountId` = `7777-testnet-001` | Returns `payinAddress` (sandbox), `payoutAddress === address`, `status === 'new'` | Blocker |
| CN-3 | Fixed-rate swap creation | Same as CN-2 with `flow: 'fixed-rate'` | Same outcome; `rateId` populated | Blocker |
| CN-4 | Swap status polling | `trackSwapStatus(swap.id)` over the sandbox lifecycle (`new` → `waiting` → `confirming` → `exchanging` → `sending` → `finished`) | Each state observed in order; final state is `finished` | Blocker |
| CN-5 | Refund flow | Sandbox refund (operator triggers `?refund=true` on the sandbox) | Status transitions to `refunded`; `refundAddress` honoured | Blocker |
| CN-6 | Invalid destination address | `createSwap` with a malformed BTC address | Adapter raises typed error `CHANGENOW_ERR_INVALID_ADDRESS`; no off-chain record created | Critical (silent failure would put user funds at risk) |
| CN-7 | Rate-limit handling | Submit 60 `getQuote` calls in 60s (sandbox limit) | Adapter back-offs cleanly; final result is success | High |
| CN-8 | NFT account mapping | `mapSwapToNFTAccount(swap, '7777-testnet-001')` | Off-chain record contains `nftAccountId`, `swapId`, `fromAmount`, `payinAddress`, `payoutAddress`; **no private keys** | Blocker |
| CN-9 | No-custody invariant | Inspect the off-chain record from CN-8 | No `mnemonic`, no `signature`, no `privateKey` fields anywhere in adapter logs or DB | Critical |

A Blocker row failing stops Phase 2 sign-off until the gateway is healthy or [`STATUS.md`](./STATUS.md) §13 ("Accepted deferrals") records an explicit deferral.

---

## 5. NOWPayments — test matrix

`backend/adapters/tests/integration/nowpayments.testnet.spec.ts`, pointed at `NOWPAYMENTS_API_BASE_URL=https://api-sandbox.nowpayments.io/v1/`.

| # | Test | Action | Expected | Severity if failing |
|---|------|--------|----------|---------------------|
| NP-1 | Invoice creation | `createInvoice({ price_amount: 100, price_currency: 'USD', pay_currency: 'ton', nftAccountId: '8888-testnet-001', order_id: 'B1-TEST-001' })` | 200 OK, `invoice_url` returned, `pay_amount` populated | Blocker |
| NP-2 | Invoice → payment lifecycle | Sandbox simulates payment via `POST /v1/sandbox/payment` | Status transitions `waiting` → `confirming` → `confirmed` → `finished` | Blocker |
| NP-3 | Webhook signature — valid | NOWPayments sandbox sends an IPN with a valid HMAC | `verifyWebhookSignature` returns `true`; payment record updated | Blocker |
| NP-4 | Webhook signature — tampered | Operator flips one byte of the IPN body before calling `verifyWebhookSignature` | Returns `false`; payment record is NOT updated; alert logged | Critical |
| NP-5 | Webhook signature — replay | Replay the same IPN twice | Second call is a no-op (idempotency key matches); status unchanged | High |
| NP-6 | Status polling | `getPaymentStatus(paymentId)` after manual webhook drop | Polling recovers the latest status without webhook | High |
| NP-7 | Refund flow | Sandbox refund via `POST /v1/sandbox/refund` | Status flips to `refunded`; payment record records the refund tx hash | Blocker |
| NP-8 | NFT account mapping | `mapPaymentToNFTAccount(invoice, '8888-testnet-001')` | Off-chain record stores `nftAccountId`, `invoiceId`, `payAddress`, `payAmount`; **no private keys** | Blocker |
| NP-9 | No-custody invariant | Inspect logs + DB from NP-8 | No private-key material; `payAddress` is operator-controlled sandbox address, not protocol-owned | Critical |
| NP-10 | Idempotency on duplicate `order_id` | Re-issue `createInvoice` with the same `order_id` | 409 with the original invoice ID | High |

---

## 6. CoinRabbit — test matrix

`backend/adapters/tests/integration/coinrabbit.testnet.spec.ts`. CoinRabbit is the most restricted adapter — [`README`](../../../backend/adapters/README.md) §"CoinRabbit (Lending Adapter)" forbids fund custody, loan issuance, collateral handling, and repayment enforcement.

| # | Test | Action | Expected | Severity if failing |
|---|------|--------|----------|---------------------|
| CR-1 | Identity resolution | `resolveBorrowerIdentity(nftAddress)` for a testnet NFT card | Returns CoinRabbit-side identity blob; no on-chain side effect | Blocker |
| CR-2 | Lender metadata read | `getLenderMetadata()` | Returns lender profile; adapter is read-only | Blocker |
| CR-3 | Collateral signal verification | Read `PublicCollateralLookup` (testnet) → adapter relays the signal | Returns the verbatim signal; adapter does not mutate it | Critical (mutation would imply custody) |
| CR-4 | No `transferCollateral` path | Static + runtime check that the adapter exposes no method that moves protocol-controlled assets | The adapter has no `transferCollateral`, `liquidate`, `forceRepay`, `setBorrowerBalance` exports | Critical |
| CR-5 | Deep-link UX | `buildDeepLink(borrowerId)` | Returns a CoinRabbit-staging URL; deep-link opens in the user's browser only | High |
| CR-6 | Sandbox / staging guard | `coinrabbit.config.environment === 'sandbox'` | Confirmed at run start; production base URL is rejected | Critical |
| CR-7 | LendingProtocolCoordinator handshake | Coordinator on testnet calls the adapter; adapter responds with read-only metadata | No fund movement; coordinator records the response on-chain for transparency | Blocker (gates `LendingProtocolCoordinator` sign-off — P4-4 in [`VALIDATION_PLAN.md`](./VALIDATION_PLAN.md) §5) |

Because CoinRabbit is documented as **non-custodial coordination**, any test that proves the adapter could move user funds is treated as a Critical fail with an automatic engagement pause regardless of severity policy.

---

## 7. Cross-adapter invariants

These invariants apply to every gateway adapter and are enforced once per adapter run.

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| GW-INV-1 | No adapter holds or signs with a protocol-controlled private key | grep for `mnemonic`, `secretKey`, `privateKey` over the adapter source — must remain only in comments / docs |
| GW-INV-2 | No adapter mutates on-chain protocol state | The adapter source contains no `sendInternal`, `provider.send`, or signed `external` transaction calls |
| GW-INV-3 | All webhook handlers verify the provider HMAC before mutating off-chain state | Audited in `NP-3` / `NP-4`; ChangeNOW HMAC equivalent in `CN-*` if exposed |
| GW-INV-4 | Off-chain bookkeeping records carry the `nftAccountId` but nothing that could authorise a transfer (no signatures, no key material) | Audited in `CN-8` / `NP-8` / `CR-1`–`CR-2` |
| GW-INV-5 | Adapter base URLs are loaded from env at runtime and are sandbox values during B1 | Asserted by the validation harness pre-flight (`ADAPTER_ENV_MISMATCH`) |

A failing invariant blocks gateway sign-off **regardless** of the per-adapter row outcomes.

---

## 8. Execution & reporting

```bash
# Single adapter
npm run test:integration:testnet --workspace backend/adapters -- --grep "ChangeNOW"

# Whole suite
npm run test:integration:testnet --workspace backend/adapters
```

The harness writes a per-run report to:

```
deployments/testnet/<phase2-manifest-stem>.gateways.json
```

Schema (informally):

```json
{
  "ranAt": "ISO-8601 UTC timestamp",
  "manifest": "deployments/testnet/<phase2>.json",
  "adapters": [
    {
      "name": "ChangeNOW",
      "endpoint": "https://api-sandbox.changenow.io/v2/",
      "passed": [ "CN-1", "CN-2", "..." ],
      "failed": [],
      "severity": "none",
      "evidence": [ "logs/changenow-<runId>.log" ]
    }
  ],
  "invariants": {
    "GW-INV-1": "passed",
    "GW-INV-2": "passed",
    "GW-INV-3": "passed",
    "GW-INV-4": "passed",
    "GW-INV-5": "passed"
  }
}
```

The summary row is copied into [`STATUS.md`](./STATUS.md) §9.2. Findings (if any) follow the standard remediation flow ([`docs/security/audits/REMEDIATION_WORKFLOW.md`](../../security/audits/REMEDIATION_WORKFLOW.md) §3).

---

## 9. Deferrals

A gateway sandbox being offline is the most common operational deferral. The deferral is recorded in [`STATUS.md`](./STATUS.md) §13 with:

- Affected adapter and rows.
- Compensating control (e.g. existing local unit tests under `backend/adapters/tests/unit/`).
- Mainnet impact statement — adapter is feature-flagged off in production until the sandbox passes.
- Sign-off identity + date.

Critical-severity rows (`CN-6`, `CN-9`, `NP-4`, `NP-9`, `CR-3`, `CR-4`, `CR-6`, `GW-INV-1`–`GW-INV-3`) cannot be deferred — they block `READY-FOR-B2`.

---

## 10. References

- [Engagement plan](./ENGAGEMENT.md)
- [Status](./STATUS.md)
- [Runbook](./RUNBOOK.md)
- [Validation plan](./VALIDATION_PLAN.md)
- [Indexer validation plan](./INDEXER_VALIDATION.md)
- [Backend adapters](../../../backend/adapters/)
- [Backend adapters README](../../../backend/adapters/README.md)
- [ChangeNOW adapter](../../../backend/adapters/changenow.ts)
- [NOWPayments adapter](../../../backend/adapters/nowpayments.ts)
- [CoinRabbit adapter](../../../backend/adapters/coinrabbit.ts)
- [Lending adapter documentation](../../lending-adapter.md)
- [Key management](../../security/KEY_MANAGEMENT.md)
- [Remediation workflow](../../security/audits/REMEDIATION_WORKFLOW.md)
