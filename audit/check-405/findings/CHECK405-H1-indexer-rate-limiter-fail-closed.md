---
title: Indexer rate-limit middleware treats every store error as a 429, so a Redis outage self-DoSes the whole read API
severity: High
area: backend/indexer
priority: high
stage: 2-high
labels:
  - bug
  - audit
  - type:backend
  - type:security
  - priority:high
  - stage:2-high
  - package:indexer
  - track:A
---

## Summary

The indexer's global rate-limit middleware (`backend/indexer/src/api/server.ts`)
wraps `RateLimiterRedis.consume(ip)` in a `try/catch` and, in the `catch`,
**assumes the rejection is always a `RateLimiterRes`** (a rate-limit hit). It
casts the caught value with `const rlRes = rateLimiterRes as RateLimiterRes` and
unconditionally returns **HTTP 429**.

But `rate-limiter-flexible` rejects `consume()` with **two very different kinds
of value**: a `RateLimiterRes` when the caller is genuinely over the limit, and
a plain `Error` when the backing store (Redis) is unreachable. The Redis client
is created with `enableOfflineQueue: false` and `lazyConnect: true`, and **no
`insuranceLimiter` is configured**, so when Redis is down every `consume()` call
rejects with an `Error`. The middleware mis-serves that `Error` as a 429 for
**every request, including `/health`**. A Redis blip therefore takes the entire
read-only API offline with 429s — the exact opposite of the stated intent.

## Severity & Category

- Severity: High
- Category: Availability / fail-closed error handling (self-inflicted DoS)

The inline comment at the Redis client (`// Don't let a Redis outage take the
API down – queue commands instead.`) documents a fail-**open** intent, but the
combination of `enableOfflineQueue: false`, no `insuranceLimiter`, and the
catch-all 429 produces fail-**closed** behaviour. A dependency outage that
should degrade gracefully instead amplifies into a full API outage.

## Affected Code

- `backend/indexer/src/api/server.ts:105-126` — Redis client built with
  `enableOfflineQueue: false` and `lazyConnect: true`; `RateLimiterRedis`
  created with **no** `insuranceLimiter`.
- `backend/indexer/src/api/server.ts:181-231` — the middleware. The `catch
  (rateLimiterRes: unknown)` block (200-230) casts the caught value to
  `RateLimiterRes` and always responds `429`, with `msBeforeNext ?? windowMs`
  papering over the fact that a store `Error` has no `msBeforeNext`.

## Description

```ts
// backend/indexer/src/api/server.ts (abridged)
this.redisClient = new Redis({
  host, port, password: password || undefined, db,
  enableOfflineQueue: false,   // reject immediately when Redis is down
  lazyConnect: true,
});
this.rateLimiter = new RateLimiterRedis({
  storeClient: this.redisClient,
  keyPrefix: 'rl_indexer',
  points: maxRequests,
  duration: durationSec,
  // <-- no insuranceLimiter
});

this.app.use(async (req, res, next) => {
  const ip = getClientIp(req, { trustProxy, trustedProxyCount });
  try {
    const rateLimiterRes = await this.rateLimiter.consume(ip);
    // ...set headers, next()...
  } catch (rateLimiterRes: unknown) {
    const rlRes = rateLimiterRes as RateLimiterRes;   // <-- WRONG for store errors
    const secsToReset = Math.ceil((rlRes.msBeforeNext ?? windowMs) / 1000);
    // ...
    res.status(429).json({ error: { code: API_RATE_LIMIT_EXCEEDED, ... } });
  }
});
```

`rate-limiter-flexible` documents this exact fork: on a limit hit the promise
rejects with a `RateLimiterRes`; on a store failure it rejects with an `Error`
(unless an `insuranceLimiter` is set, in which case it silently fails over to
the in-memory limiter). Here neither branch is handled — the code funnels both
into a 429.

With `enableOfflineQueue: false`, a Redis outage (or even the initial
`lazyConnect` window before the first successful connect) makes `consume()`
reject with an `Error` on **every** request. Because the middleware is mounted
before all routes (including `/health`), the whole API answers 429 until Redis
recovers. Naive liveness/readiness probes that treat 429 as "down" then compound
the incident.

## Impact

- A transient Redis outage escalates into a **full read-API outage** (all
  endpoints, including `/health`, return 429).
- The failure mode is silent and counter-intuitive: operators reading the
  "Don't let a Redis outage take the API down" comment will not expect the
  limiter to be the cause.
- No attacker is required; ordinary Redis maintenance or a network blip triggers
  it. An attacker who can pressure Redis gets an amplified DoS for free.

## Suggested Fix

Distinguish a genuine rate-limit rejection from a store error, and fail **open**
on the latter. Two complementary options (do at least the first):

1. In the `catch`, only emit 429 when the caught value is actually a
   `RateLimiterRes` (e.g. `instanceof RateLimiterRes`, or a duck-typed check for
   a numeric `msBeforeNext`/`remainingPoints`). For anything else, log the store
   error and call `next()` so the request proceeds (fail-open), matching the
   documented intent.
2. Configure an `insuranceLimiter: new RateLimiterMemory({ points, duration })`
   on the `RateLimiterRedis` so a Redis outage transparently falls back to
   in-process limiting instead of rejecting with an `Error` at all.

## Acceptance Criteria

- [ ] When `consume()` rejects with a non-`RateLimiterRes` error (Redis down),
      the middleware calls `next()` (fail-open) and does **not** return 429.
- [ ] When `consume()` rejects with a real `RateLimiterRes` (over limit), the
      middleware still returns 429 with correct `Retry-After`/`X-RateLimit-*`
      headers.
- [ ] `/health` remains reachable during a simulated Redis outage.
- [ ] Regression test with a fake limiter that rejects once with an `Error` and
      once with a `RateLimiterRes`, asserting `next()` vs `429` respectively.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/405
- `rate-limiter-flexible` docs — "Difference between block and consume
  rejections" / `insuranceLimiter`.
- `audit/THREAT_MODEL.md`, `audit/INVARIANTS.md`
