---
title: "[API-M1] Webhook signing secret stored in plaintext, contradicting its own contract"
severity: medium
area: backend
priority: medium
stage: 3
labels: ["bug","audit","type:backend","type:security","priority:medium","stage:3-medium"]
---

## Summary

The webhook service documents that the signing secret is "never stored in plaintext," yet it stores the secret verbatim and no `secret_hash` field exists. A leak of the store or process memory exposes every merchant's signing secret, enabling forged webhook deliveries.

## Severity & Category

- Severity: Medium
- Category: Secrets Management / Data-at-Rest Protection

## Affected Code

- `api/src/services/WebhookService.ts:39` (doc claims "Never stored in plaintext — see secret_hash")
- `api/src/services/WebhookService.ts:81-93` (stores `secret: string` verbatim; no `secret_hash`)

## Description

The doc comment at `WebhookService.ts:39` states the secret is never stored in plaintext and references a `secret_hash`. In practice, registration (`WebhookService.ts:81-93`) stores the raw `secret` string, and no `secret_hash` field exists anywhere.

```ts
// WebhookService.ts:81-93
// stores secret verbatim; the referenced secret_hash does not exist
```

## Impact

- A store dump or memory disclosure exposes every merchant's webhook signing secret.
- With the secret, an attacker can forge webhook payloads that pass signature verification, spoofing settlement/status notifications to merchants.

## Suggested Fix

- Encrypt secrets at rest using a KMS-managed key, or
- Document the storage model honestly and protect the store accordingly; remove the false `secret_hash` reference so the code and its contract agree.

## Acceptance Criteria

- [ ] Webhook signing secrets are either encrypted at rest or the storage contract is accurately documented and the store is access-protected.
- [ ] The misleading `secret_hash` reference is removed or implemented.
- [ ] Regression test: stored representation of a webhook secret is not the raw plaintext (when encryption is adopted) or the documented protection is asserted.

## References

- Issue: https://github.com/xlabtg/tonbankcard-protocol/issues/241
- `audit/THREAT_MODEL.md`

---

**Tracking issue:** [#269](https://github.com/xlabtg/tonbankcard-protocol/issues/269)
