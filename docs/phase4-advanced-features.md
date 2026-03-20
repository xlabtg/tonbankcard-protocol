# Phase 4: Advanced Features

## Overview

Phase 4 implements four advanced features for the TONBANKCARD protocol:

1. **Lending Protocol Integration** — Enhanced coordination with external lenders
2. **Multi-Signature Cards** — Co-approval requirements for NFT card payments
3. **Recurring Payments** — User-controlled subscription payment mandates
4. **Cross-Chain Bridges** — Cross-chain asset bridging via external providers

All features follow the protocol's core principles:
- **Non-Custodial**: Protocol never custodies user funds
- **NFT Authority**: NFT ownership determines account control
- **User-Initiated**: All operations require explicit user consent
- **Blockchain Truth**: On-chain state is the single source of truth

---

## 1. Lending Protocol Integration

### Architecture

The lending integration adds an on-chain coordination contract (`LendingProtocolCoordinator.tact`) that works alongside the existing CoinRabbit adapter.

**On-Chain (Tact Contract)**:
- Registers lending intents (user-initiated)
- Tracks intent state (active, cancelled)
- Emits events for indexer consumption
- Read-only getters for intent verification

**Off-Chain (CoinRabbit Adapter — Enhanced)**:
- Identity resolution via NFT account
- Collateral signal verification (read-only)
- Loan intent creation with lender deep-links
- Loan reference tracking (off-chain only)

### Non-Custodial Guarantees

The lending integration is **intentionally weak by design**:
- Does NOT issue loans
- Does NOT custody collateral
- Does NOT enforce repayments
- Does NOT liquidate assets
- Does NOT track debt
- Does NOT grant lender any protocol-level authority

### Usage Flow

1. User signals collateral via CollateralSignal contract
2. User registers lending intent via LendingProtocolCoordinator
3. CoinRabbit adapter resolves borrower identity
4. User receives lender deep-link with verification data
5. User interacts with external lender directly
6. Protocol remains a passive observer

---

## 2. Multi-Signature Cards

### Architecture

Multi-sig adds a co-approval layer to NFT card payments via the `MultiSigCard.tact` contract.

**On-Chain (Tact Contract)**:
- Configure multi-sig (owner-only, up to 3 co-signers)
- Submit payment proposals (owner-only)
- Approve proposals (co-signer only)
- Reject proposals (owner or co-signer)
- Remove multi-sig configuration (owner-only)

**Off-Chain (MultiSig Adapter)**:
- Configuration management
- Proposal tracking
- Approval workflow coordination
- Status display for UI

### Key Design Decisions

1. **Owner Primacy**: NFT owner is ALWAYS the primary authority. Co-signers add requirements but cannot override or block the owner permanently
2. **Permission Layer**: Multi-sig is additive — it can only add requirements, never remove owner control
3. **No Custody Change**: Multi-sig does not change fund custody. Funds remain controlled by the NFT
4. **Threshold Model**: Requires N-of-M co-signer approvals (M ≤ 3)

### Usage Flow

1. NFT owner configures multi-sig with co-signer addresses and threshold
2. Owner submits payment proposals with recipient and amount
3. Co-signers approve or reject proposals
4. When threshold is met, proposal is marked as approved
5. Owner or Payment Hub can execute approved proposals
6. Owner can remove multi-sig at any time

---

## 3. Recurring Payments

### Architecture

Recurring payments enable user-controlled subscription mandates via the `RecurringPayments.tact` contract.

**On-Chain (Tact Contract)**:
- Create mandates (payer-only)
- Cancel mandates (payer-only, at any time)
- Execute recurring payments (merchant or owner trigger)
- Track execution count and timing

**Off-Chain (Recurring Adapter)**:
- Mandate lifecycle management
- Execution eligibility checking
- Next execution time calculation
- Execution record tracking

### Key Design Decisions

1. **User Control**: Only the payer (NFT owner) can create mandates
2. **Instant Cancellation**: Users can cancel at any time, no lock-in
3. **Execution Limits**: Maximum executions and minimum periods enforced on-chain
4. **No Auto-Deduction**: Each execution requires an explicit on-chain trigger
5. **Merchant Trigger**: Merchants can trigger execution within mandate limits
6. **Minimum Period**: 1 hour minimum between executions (prevents abuse)

### Usage Flow

1. User creates a mandate specifying merchant, amount, period, and max executions
2. Merchant (or user) triggers execution when period elapses
3. Contract verifies mandate is active, period elapsed, and max not reached
4. Execution event is emitted for Payment Hub to process
5. User can cancel mandate at any time

### Mandate Parameters

| Parameter | Description | Constraints |
|-----------|-------------|-------------|
| `amount_per_period` | TBC amount per execution | Must be positive |
| `period_seconds` | Interval between executions | Minimum 3600 (1 hour) |
| `max_executions` | Maximum total executions | 0 = unlimited |
| `merchant_address` | Recipient NFT address | Must be valid |

---

## 4. Cross-Chain Bridges

### Architecture

Cross-chain bridging coordinates asset transfers between TON and external blockchains via the `CrossChainBridge.tact` contract and external swap providers.

**On-Chain (Tact Contract)**:
- Register bridge intents (user-initiated)
- Confirm bridge execution (relayer or owner)
- Cancel pending intents (owner-only)
- Track intent status and external tx hashes

**Off-Chain (Bridge Adapter)**:
- Bridge intent creation and lifecycle
- Quote parameter generation for external providers
- Chain support management
- Intent-to-provider linking

### Supported Chains

| Chain | ID | Ticker | Network |
|-------|------|--------|---------|
| Ethereum | 1 | ETH | eth |
| Bitcoin | 2 | BTC | btc |
| BSC | 3 | BNB | bsc |
| Polygon | 4 | MATIC | matic |
| Solana | 5 | SOL | sol |

### Key Design Decisions

1. **Coordination Only**: Contract is a coordination layer, NOT a custodial bridge
2. **External Verification**: Cross-chain finality verified by external providers (ChangeNOW)
3. **Privacy**: Target addresses stored as hashes on-chain
4. **Relayer Model**: Authorized relayers can confirm bridge execution
5. **User Cancel**: Users can cancel pending intents at any time

### Usage Flow

1. User creates bridge intent specifying target chain, amount, and destination
2. Bridge adapter generates quote parameters for ChangeNOW
3. User initiates swap through ChangeNOW (receives deposit address)
4. User sends funds to deposit address
5. ChangeNOW executes the cross-chain swap
6. Relayer or user confirms execution on-chain
7. Intent marked as confirmed with external tx hash

### Security Considerations

- Protocol CANNOT verify cross-chain transaction finality
- Cross-chain verification is external service responsibility
- Users must verify external provider reputation independently
- Bridge contract only records intents, does not move funds
- See `docs/security/THREAT_MODEL.md` section 4.4.4 for cross-chain threat analysis

---

## File Structure

```
contracts/
├── LendingProtocolCoordinator.tact   # Lending intent coordination
├── MultiSigCard.tact                  # Multi-signature card logic
├── RecurringPayments.tact             # Recurring payment mandates
└── CrossChainBridge.tact              # Cross-chain bridge coordination

backend/adapters/
├── bridge.ts                          # Cross-chain bridge adapter
├── multisig.ts                        # Multi-sig card adapter
├── recurring.ts                       # Recurring payments adapter
├── coinrabbit.ts                      # Enhanced lending adapter
└── types.ts                           # Extended type definitions

tests/
├── multisig/MultiSigAdapter.spec.ts
├── recurring-payments/RecurringPaymentsAdapter.spec.ts
├── cross-chain-bridge/BridgeAdapter.spec.ts
└── lending-adapter/LendingProtocolIntegration.spec.ts

sdk/src/types.ts                       # Phase 4 SDK types
wallet-ui/src/types.ts                 # Phase 4 wallet UI types
mobile/src/types.ts                    # Phase 4 mobile types
dashboard/src/types.ts                 # Phase 4 dashboard types
```

---

## Protocol Invariants

All Phase 4 features maintain the protocol's core invariants:

- **I1 (Non-Custodial)**: No feature custodies user funds
- **I2 (NFT Authority)**: NFT ownership controls all operations
- **I3 (No Admin Control)**: No admin can override user decisions
- **I4 (Atomic Transfers)**: All state changes are atomic
- **I5 (Ledger Conservation)**: Zero fees on internal TBC transfers
- **I6 (Lock ≠ Confiscation)**: Locks restrict send, not ownership
- **I7 (Adapter Isolation)**: External adapters have no protocol authority
