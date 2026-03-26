---
name: "[F3] Cross-Chain Bridge Production Readiness"
about: Prepare CrossChainBridge.tact for production with multi-sig validators, replay protection, and circuit breakers
labels: type:contract
track: F
priority: low
---

## 1. Goal

Prepare `CrossChainBridge.tact` for production deployment by defining the supported chain set, designing the bridge validator multi-sig structure, verifying replay protection, implementing TVL circuit breakers, and adding bridge-specific monitoring.

## 2. Context

`CrossChainBridge.tact` exists in the repository as Phase 4 implementation code. It is **not audited and not deployed**. The bridge is the highest-risk component in the protocol due to:
- Cross-chain message replay potential
- Bridge validator compromise scenarios
- Large TVL (all bridged assets at risk if exploited)

This work requires A2 audit completion as a strict prerequisite.

Related to: [DEVELOPMENT_ROADMAP.md — Track F, F3](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

### Supported Chains
- Define the initial chain set (priority: Ethereum, BSC, Polygon)
- Chain ID registry and validation
- Per-chain TVL limits

### Bridge Validator Set
- Multi-sig validator architecture (e.g., 5-of-9 validators)
- Validator onboarding process
- Validator key rotation procedure
- Slashing conditions for malicious validators (if technically feasible)

### Replay Protection
- Verify current replay protection implementation in `CrossChainBridge.tact`
- Add nonce-based or message-hash-based replay protection if not already present
- Cross-chain replay: same message cannot be replayed on multiple destination chains

### TVL Circuit Breakers
- Daily outflow limit: maximum TBC bridged per 24 hours
- Total TVL limit: maximum assets locked in the bridge contract
- Circuit breaker: auto-pause bridge if anomalous activity detected
- Manual pause capability for security incidents

### Bridge-Specific Monitoring
- Alert on any bridge event (immediate notification, per B3)
- TVL monitoring dashboard
- Bridge-specific bug bounty category (per A5)

## 4. Out of Scope

- EVM-side bridge contracts (separate repositories and audit)
- Validator compensation/incentive mechanism
- Bridge liquidity provision (users bridge their own assets)

## 5. Functional Requirements

1. Bridge supports at least Ethereum and one other EVM chain
2. Validator set: minimum 5-of-9 multi-sig required for bridge message approval
3. Replay protection: each cross-chain message has a unique ID, processed exactly once
4. Circuit breaker: bridge auto-pauses if daily outflow exceeds configured limit
5. Manual pause: team multi-sig can pause/unpause bridge in case of emergency

## 6. Non-Functional Requirements

- Bridge transaction finality: maximum 30 minutes end-to-end
- TVL circuit breaker threshold adjustable via governance (E2)
- Validator set changes require governance vote (E2)

## 7. Security Requirements

- **A2 audit must be complete** before any production deployment
- No single validator can approve a bridge transaction
- Replay protection must be verified by auditors
- Circuit breaker auto-pause threshold must be conservative initially (e.g., 1% of TVL per day)

## 8. Acceptance Criteria

- [ ] A2 audit complete (strict prerequisite)
- [ ] Supported chain list documented in `docs/bridge/SUPPORTED_CHAINS.md`
- [ ] Bridge validator set architecture documented in `docs/bridge/VALIDATORS.md`
- [ ] Replay protection verified by auditor
- [ ] TVL circuit breaker implemented and tested
- [ ] Manual pause function tested on testnet
- [ ] Bridge monitoring alerts configured (per B3)
- [ ] Bridge-specific bug bounty category added (per A5)
- [ ] Bridge deployed to testnet and end-to-end transfer tested

## 9. References

- [CrossChainBridge.tact](../contracts/CrossChainBridge.tact)
- [Threat Model](../docs/security/THREAT_MODEL.md)
- Issue A2: [A2-formal-security-audit-phase4-contracts.md](./A2-formal-security-audit-phase4-contracts.md)
- Issue B3: [B3-production-monitoring-and-alerting.md](./B3-production-monitoring-and-alerting.md)
- Issue E2: [E2-protocol-parameter-governance.md](./E2-protocol-parameter-governance.md)
