---
title: 'Off-chain & tooling hardening backlog (round 3): manifest HTTPS parsing, docs-site npm install drift'
severity: Low
area: tooling
priority: low
stage: 4-low
labels:
  - bug
  - audit
  - type:tooling
  - priority:low
  - stage:4-low
  - track:C
---

## Summary

Two low-severity, off-chain/tooling hygiene items found in round 3. Grouped per
the repo convention (Low/Info findings collected into a per-subsystem backlog
issue rather than individual issues).

## Items

### L2-a — mobile-app TON Connect manifest validates HTTPS with `startsWith`

- `mobile-app/src/lib/tonconnect/manifest.ts:21-25`:
  `isHttps(url)` returns `url.startsWith('https://')`. A URL such as
  `https://evil.example@attacker.tld` or `https:///` passes the check, and
  userinfo/host confusion is not caught because the string is never parsed as a
  URL. This is the same class as `PC-09` / `FRONTEND-LOW-L3`; `wallet-ui` already
  uses proper `URL` parsing. This is the third instance of the pattern.
- Fix: parse with the WHATWG `URL` API and assert `parsed.protocol === 'https:'`
  (and reject embedded credentials), mirroring `wallet-ui`.

### L2-b — docs-site CI uses `npm install` despite a tracked lockfile

- `.github/workflows/docs-site.yml:38`: `npm install --no-audit --no-fund` in
  `docs-site/`, even though `docs-site/package-lock.json` is committed and
  `cache-dependency-path` (line 34) points at it. `npm install` can silently
  mutate the lockfile and defeats reproducible builds; `npm ci` is the correct
  command when a lockfile exists. The existing `DEVOPS-M2` remediation and the
  `workflow-policy.yml` guard only cover `ci.yml`, so this workflow drifted.
  (Note: `quickstart.yml:59`'s `npm install` targets `examples/merchant-demo`,
  which has no lockfile, and is correctly excluded — same rationale as
  `scripts/faucet` in `PC-08`.)
- Fix: change to `npm ci`; extend the `workflow-policy.yml` guard to cover
  `docs-site.yml` (and any workflow with a tracked lockfile) so the drift cannot
  recur.

## Severity & Category

- Severity: Low (defense-in-depth / build reproducibility). No fund-safety or
  authorization impact.

## Affected Code

- `mobile-app/src/lib/tonconnect/manifest.ts:21-25`
- `.github/workflows/docs-site.yml:38`
- Reference (correct patterns): `wallet-ui` manifest URL parsing; `.github/workflows/ci.yml`
  (`npm ci`); `.github/workflows/workflow-policy.yml` (guard)

## Acceptance Criteria

- [ ] `manifest.ts` validates HTTPS via `URL` parsing and rejects credential/host
      confusion; regression test added.
- [ ] `docs-site.yml` uses `npm ci`.
- [ ] `workflow-policy.yml` guard extended to flag `npm install` in any workflow
      that has a tracked lockfile.

## References

- Round umbrella: https://github.com/xlabtg/tonbankcard-protocol/issues/393
- Related: `PC-09` / `FRONTEND-LOW-L3` (startsWith HTTPS pattern), `DEVOPS-M2`
  (npm ci policy), `PC-08` (lockfile-scope exclusions)

- Tracking issue: https://github.com/xlabtg/tonbankcard-protocol/issues/399
