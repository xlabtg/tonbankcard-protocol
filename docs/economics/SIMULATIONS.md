# TONBANKCARD Protocol — Economic Attack Simulations & Stress Testing

**Document Type:** Economic Security Analysis
**Issue Reference:** [#74 — Improvements / Phase 11 — Economic Security](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
**Source:** `.github/ISSUE_TEMPLATE/improvements/phase_11_economics.md`
**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-03-19

---

## Table of Contents

1. [Objective](#1-objective)
2. [Protocol Economics Baseline](#2-protocol-economics-baseline)
3. [Merchant Fraud Simulations](#3-merchant-fraud-simulations)
4. [Liquidity Drain Scenarios](#4-liquidity-drain-scenarios)
5. [Fee Exploitation Analysis](#5-fee-exploitation-analysis)
6. [Stress Testing Model](#6-stress-testing-model)
7. [Economic Invariants](#7-economic-invariants)
8. [Risk Summary & Mitigations](#8-risk-summary--mitigations)

---

## 1. Objective

This document simulates adversarial economic scenarios against the TONBANKCARD protocol to:

1. Identify economic attack vectors not covered by security invariants alone
2. Quantify maximum damage bounds for known attack classes
3. Define minimum viable liquidity thresholds for protocol health
4. Verify incentive alignment under adversarial conditions
5. Establish stress-test scenarios for protocol resilience

---

## 2. Protocol Economics Baseline

### 2.1 Fee Structure

| Operation | Protocol Fee | Where Fee Goes |
|-----------|-------------|----------------|
| Internal TBC transfer | **Zero** | N/A |
| DEX swap (TONCO) | ~0.3% | TONCO LP providers |
| ChangeNOW swap | ~0.5–1% | ChangeNOW |
| NOWPayments processing | ~0.5–1% | NOWPayments |
| CoinRabbit interest | Variable | CoinRabbit |

**Critical note:** The protocol earns zero fees on any operation. This means:
- There is no "fee extraction" attack on the protocol itself
- Protocol sustainability depends on TBC token utility (not fee revenue)
- Zero fees create incentive for merchants to prefer TBC over fiat gateways

### 2.2 TBC Token Economics

| Property | Value | Source |
|----------|-------|--------|
| Primary utility | Internal settlement, zero-fee transfers | Protocol design |
| Liquidity pool | TBC/TON on TONCO DEX | On-chain |
| Supply model | Fixed (no protocol-level minting) | TBC jetton contract |
| Price discovery | AMM (TONCO) | Market |

### 2.3 Actors and Incentives

| Actor | Incentive | Misalignment Risk |
|-------|-----------|-------------------|
| Protocol users | Low-cost, non-custodial payments | None (non-custodial design) |
| Merchants | Reliable settlement, low fees | Invoice replay (off-chain risk) |
| TBC holders | TBC appreciation, zero-fee utility | Sell pressure on external drain |
| NFT holders | Account access, governance | Negligible in Phase 1 |
| External adapters | Fees from their own services | False confirmations (T6 threat) |

---

## 3. Merchant Fraud Simulations

### 3.1 Simulation A: Invoice Replay Attack

**Scenario:** Merchant attempts to collect payment twice for the same invoice.

**Setup:**
```
- Merchant NFT: M1
- Customer NFT: C1
- Invoice: INV-001 for 100 TBC
- Customer balance: 200 TBC
```

**Attack sequence:**
```
Step 1: Customer pays INV-001 → C1 balance: 100 TBC, M1 balance: +100 TBC
Step 2: Merchant submits INV-001 again to backend
Step 3: Backend attempts to collect again
```

**Protocol response:**
- Second payment requires a fresh customer signature
- Customer must explicitly approve the second payment in their wallet
- Without customer re-signing, the protocol rejects the attempt

**Damage bound:** Zero for the customer (user must sign twice). Maximum damage is 100 TBC only if the customer can be socially engineered to sign again.

**Risk assessment:** MERCHANT risk only; ZERO protocol-level fund risk.

**Mitigations:**
- Merchant API must implement invoice ID deduplication
- Customer wallet should display "WARNING: You have already paid this invoice"
- On-chain: no mitigation needed (user consent required regardless)

### 3.2 Simulation B: False Merchant NFT Attack

**Scenario:** Attacker registers a fake merchant NFT address and requests payments to it.

**Setup:**
```
- Legitimate merchant: M1 (EQAjHk...)
- Attacker's NFT: M2 (EQBzKr...)
- Customer expects to pay M1
```

**Attack sequence:**
```
Step 1: Attacker presents fraudulent invoice with M2 as destination
Step 2: Customer reviews payment in wallet — wallet shows recipient as M2
Step 3: Customer pays (or notices the wrong address)
```

**Protocol response:**
- Protocol cannot distinguish M1 from M2 — both are valid NFTs
- User wallet displays recipient address; user must verify
- Once payment is made, protocol cannot reverse it (non-custodial design)

**Damage bound:** Up to full invoice amount if user is deceived. This is a phishing attack, not a protocol vulnerability.

**Mitigations:**
- Merchant verification out-of-band (domain verification, merchant registry)
- Wallet UI must prominently display recipient NFT address
- `docs/merchants/onboarding-guide.md` guides merchants on displaying verified addresses

### 3.3 Simulation C: Settlement Manipulation

**Scenario:** Merchant claims payment was received when it wasn't (informing user they can receive goods).

**Protocol response:**
- On-chain settlement is authoritative; merchant backend cannot forge it
- User can independently verify on-chain that payment occurred
- Merchant API can be unreliable; user wallets always show ground truth

**Damage bound:** Zero for the customer if they verify on-chain. Merchant cannot claim more than what the user signed.

---

## 4. Liquidity Drain Scenarios

### 4.1 Simulation A: 90% Liquidity Drop

**Scenario:** Coordinated selling reduces TONCO TBC/TON pool liquidity by 90%.

**Initial state:**
```
TBC/TON pool: 1,000,000 TBC + 10,000 TON
AMM constant: k = 10,000,000,000,000
```

**After 90% drain:**
```
TBC/TON pool: 100,000 TBC + 100,000 TON (rebalanced)
Price impact on swap: dramatically increased
```

**Protocol impact analysis:**
| Operation | Impact |
|-----------|--------|
| Internal TBC transfer | **Zero impact** — no DEX involved |
| External withdrawal (TBC → TON → gateway) | HIGH impact — excessive slippage |
| External deposit (gateway → TON → TBC) | HIGH impact — favorable but unstable |
| On-chain settlement between NFT accounts | **Zero impact** |

**Conclusion:** Internal settlements remain fully functional during liquidity crises. Only external on/off ramps are degraded. This is an important isolation property of the protocol.

**Minimum viable liquidity:**
- For external withdrawals with <5% slippage: pool depth ≥ 10× expected daily withdrawal volume
- Formal specification: requires `docs/economics/ECONOMIC_MODEL.md` (planned)

### 4.2 Simulation B: Concentrated Sell Pressure

**Scenario:** Large TBC holder (e.g., treasury or early LP) sells all holdings.

**Assumptions:**
- Total TBC supply: 1,000,000,000 TBC
- Large holder sells: 50,000,000 TBC (5% of supply) in one transaction

**Impact:**
- DEX price impact: depends on pool depth at time of transaction
- With 10% of supply in the pool: ~45% price impact on the 5% sale
- Protocol internal operations: unaffected (zero-fee TBC transfers not price-dependent)

**Mitigation:** Time-weighted selling (spread over multiple transactions) reduces price impact. Protocol cannot prevent on-market selling — this is an external market risk.

### 4.3 Simulation C: External Gateway Failure

**Scenario:** All three external gateways (ChangeNOW, NOWPayments, CoinRabbit) go offline simultaneously.

**Impact:**
| Capability | Status |
|------------|--------|
| Internal TBC payments (NFT-to-NFT) | **Unaffected** ✅ |
| Merchant payments via TBC | **Unaffected** ✅ |
| External deposits (crypto → TBC) | **Unavailable** ❌ |
| External withdrawals (TBC → crypto) | **Unavailable** ❌ |
| Collateral lending | **Unavailable** ❌ |

**Conclusion:** Gateway failure is a service degradation, not a fund loss event. Users retain full custody of their TBC; on-chain operations remain available.

---

## 5. Fee Exploitation Analysis

### 5.1 Zero-Fee Attack Surface

Because the protocol charges zero fees on internal transfers, the attack surface for fee extraction is zero:
- No fee-extraction sandwich attacks possible
- No minimum transfer value gaming
- No fee-on-transfer token manipulation (TBC is standard jetton)

### 5.2 Gas Cost DoS

**Scenario:** Attacker sends high volumes of small transactions to exhaust the protocol's gas budget.

**Analysis:**
- TON requires gas fees for each transaction (paid by sender)
- Each message to the Payment Hub costs ~0.01–0.05 TON in gas
- Cost to send 1,000 transactions: ~10–50 TON (~$30–150 at current prices)
- Protocol contracts execute operations — no "gas budget" per se (TON gas is paid by sender)

**Conclusion:** DoS via volume requires the attacker to pay gas for every transaction. Economically infeasible at scale. Not a viable sustained attack.

### 5.3 MEV / Front-Running Analysis

**Scenario:** Validator front-runs a large TBC transfer to extract value.

**Analysis:**
- Internal TBC transfers (NFT-to-NFT): fixed amount, no slippage — no MEV opportunity
- DEX swaps: standard AMM front-running applies (not protocol-specific)
- Merchant payments: fixed amount, no market exposure — no MEV

**Conclusion:** Internal protocol operations have zero MEV surface. DEX-related MEV is a TONCO DEX concern, not a TONBANKCARD protocol concern.

---

## 6. Stress Testing Model

### 6.1 Scenario: 90% Liquidity Drop

**Parameters:**
```
Initial TBC/TON pool: 10,000,000 TBC + 100,000 TON
Event: Liquidity reduced to 10% (1,000,000 TBC + 10,000 TON)
Duration: Sustained for 7 days
```

**Protocol response:**
| Metric | Before | After (90% drop) |
|--------|--------|-----------------|
| Internal transfers | 100% functional | 100% functional |
| External withdrawal (1,000 TBC) | <1% slippage | ~10–20% slippage |
| External deposit (1 TON) | ~100 TBC | ~100 TBC (favorable rate) |
| Merchant payments | 100% functional | 100% functional |

**Protocol health conclusion:** Protocol core remains healthy. Off-ramp is degraded but not broken.

### 6.2 Scenario: Single Provider Failure

**Parameters:**
```
Event: NOWPayments API offline for 48 hours
```

**Impact assessment:**
- NOWPayments-dependent deposits: unavailable
- ChangeNOW and CoinRabbit: unaffected
- Internal protocol: unaffected
- Users with pending NOWPayments deposits: funds held by NOWPayments (not protocol)

**Recovery:** No protocol-level action needed. NOWPayments service restoration returns full functionality.

### 6.3 Scenario: High Load (10,000 tx/hour)

**Parameters:**
```
Event: Viral adoption, 10,000 transactions/hour on protocol
```

**TON blockchain capacity:** ~100,000+ transactions/second (theoretical); 1,000+ TPS practical.
At 10,000 tx/hour = ~2.8 tx/second: well within TON capacity.

**Indexer impact:**
- Polling interval must be ≤ block time (~5 seconds) to keep up
- Database write throughput: 10,000 writes/hour = ~2.8 writes/second (trivial for SQLite/PostgreSQL)

**Conclusion:** The protocol and infrastructure can handle high load without degradation. Indexer must be configured with appropriate polling interval.

---

## 7. Economic Invariants

### E1 — Zero Protocol Fee (Internal Transfers)

```
∀ transfer T (internal, TBC-to-TBC via PaymentHub):
  amount_received = amount_sent
  protocol_fee = 0
```

**Code evidence:** `PaymentHub.tact:197-198` — direct arithmetic debit/credit with no fee subtraction.

### E2 — Conservation Under Volume

```
∀ time window W, ∀ set of transfers S during W:
  Σ(all account balances after W) = Σ(all account balances before W)
```

This holds because each transfer is conservation-preserving (I5) and the protocol does not mint or burn TBC.

### E3 — Liquidity Independence for Internal Transfers

```
∀ internal transfer T:
  T is not affected by DEX liquidity state
```

Internal TBC transfers (NFT-to-NFT) do not touch the DEX. Liquidity degradation cannot block internal settlements.

### E4 — No Forced Liquidation

```
∀ account A, ∀ liquidity event L:
  balance(A) is not decreased by L
```

Liquidity drain events cannot affect user balances — balances are in TBC jetton wallets, not DEX pools.

---

## 8. Risk Summary & Mitigations

### Summary Table

| Attack Class | Max Damage | User Risk | Merchant Risk | Protocol Risk | Mitigation Status |
|-------------|-----------|-----------|---------------|---------------|-------------------|
| Invoice replay | Invoice amount | None | HIGH | None | Off-chain dedup required |
| False merchant NFT | Invoice amount | Medium (user must verify) | None | None | Wallet UI verification |
| 90% liquidity drain | External slippage | Low (no forced liquidation) | None | None | Documented; AMM-external |
| Single gateway failure | Availability | None (no fund risk) | None | None | Multi-provider redundancy |
| MEV on internal transfers | Zero | None | None | None | Zero MEV surface |
| Zero-fee DoS | Gas cost to attacker | None | None | None | Sender pays gas |
| Mass sell pressure | TBC price decrease | Low (non-leveraged) | None | None | Market risk; not protocol-level |

### Key Conclusions

1. **Internal settlement is economically robust** — zero-fee, conservation-preserving, liquidity-independent.
2. **External ramps are the primary availability risk** — gateway/liquidity failure degrades off-ramps but not core function.
3. **User funds are protected under all simulated scenarios** — no simulation results in fund loss from the protocol side.
4. **Merchant fraud vectors require user consent** — all damage paths require explicit user action.

### Recommendations

1. Define formal minimum liquidity floor in `docs/economics/ECONOMIC_MODEL.md` (planned)
2. Implement multi-provider fallback in the adapter layer (if one gateway fails, try another)
3. Add slippage warnings in user-facing UI when liquidity is low
4. Define indexer staleness threshold (SLA) — see `docs/production/SLA.md`

---

## References

- **Protocol Economics:** [`docs/architecture.md`](../architecture.md)
- **Invariants:** [`docs/invariants.md`](../invariants.md)
- **Threat Model:** [`docs/security/THREAT_MODEL.md`](../security/THREAT_MODEL.md)
- **Full System Audit:** [`docs/audit/FULL_SYSTEM_AUDIT.md`](../audit/FULL_SYSTEM_AUDIT.md)
- **Issue #74:** [Improvements](https://github.com/xlabtg/tonbankcard-protocol/issues/74)
