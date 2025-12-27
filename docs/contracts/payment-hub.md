# Payment Hub Contract Documentation

## Overview

The Payment Hub is the core smart contract for the Tonbankcard Protocol, implementing the banking logic that routes payments between NFT-based accounts using the TBC token.

**Contract Language**: FunC (TON smart contract language)
**Location**: `contracts/payments/payment-hub.fc`
**Status**: Implementation draft (Issue #3)

## Purpose

The Payment Hub serves as the protocol's payment orchestration layer:

- Routes TBC payments between NFT card accounts
- Validates NFT ownership for all account operations
- Enables zero-fee internal transfers
- Supports merchant payment flows
- Emits events for off-chain indexing
- Provides anti-fraud account flagging

## Architecture Position

```
┌─────────────────────────────────────────────┐
│          TON Blockchain Layer                │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   NFT    │  │   TBC    │  │  Payment  │  │
│  │  Cards   │◄─┤  Jetton  │◄─┤    Hub    │  │
│  └──────────┘  └──────────┘  └───────────┘  │
│       │              │              │        │
└───────┼──────────────┼──────────────┼────────┘
        │              │              │
        └──────────────┴──────────────┘
                       │
               ┌───────▼────────┐
               │ Backend Indexer │
               └────────────────┘
```

The Payment Hub sits between user accounts (NFT cards) and the TBC token, orchestrating transfers while maintaining non-custodial architecture.

## Core Principles

### 1. Non-Custodial Design
- **No fund custody**: Contract does not hold user funds
- **User-signed only**: All operations require user signature
- **NFT ownership authority**: NFT ownership = account control
- **No admin withdrawal**: Admin cannot withdraw user funds

### 2. Account Abstraction
- Each NFT = unique account identifier
- NFT ownership verification on every operation
- Support for multiple NFT collections
- Account blocking for anti-fraud

### 3. Zero Internal Fees
- Internal TBC transfers have zero protocol fees
- Only TON network gas fees apply
- Merchant payments use same zero-fee model

## Contract Storage

```func
Storage Layout:
- admin_address: slice       // Emergency admin (pause only)
- paused: int                 // Emergency pause flag (0/1)
- nft_collection_addresses: cell  // Allowed NFT collections (dictionary)
- blocked_accounts: cell      // Blocked NFT addresses (dictionary)
- tbc_jetton_master: slice   // TBC jetton master contract
```

## Operations

### 1. Internal Transfer (op: 0x73774302)

Transfer TBC between two NFT accounts with zero fees.

**Message Format**:
```
op: uint32              = 0x73774302 (op::internal_transfer)
query_id: uint64        = unique identifier
from_nft: address       = sender's NFT address
to_nft: address         = recipient's NFT address
amount: coins           = TBC amount to transfer
memo: cell              = optional transfer memo
```

**Flow**:
1. Verify sender owns from_nft
2. Verify from_nft is active (not blocked)
3. Verify to_nft is valid and active
4. Validate amount > 0
5. Execute jetton transfer (in production)
6. Emit TransferInternal event

**Security Checks**:
- ✅ NFT ownership validation
- ✅ Account active status
- ✅ Amount validation
- ✅ Authorization check

**Events Emitted**:
- TransferInternal (from_nft, to_nft, amount, memo)

---

### 2. Merchant Payment (op: 0x73774303)

Process payment from customer to merchant with invoice details.

**Message Format**:
```
op: uint32              = 0x73774303 (op::merchant_payment)
query_id: uint64        = unique identifier
payer_nft: address      = customer's NFT address
merchant_nft: address   = merchant's NFT address
amount: coins           = payment amount in TBC
payment_details: cell   = invoice_id, order_id, memo
```

**Flow**:
1. Verify sender owns payer_nft
2. Verify payer_nft is active
3. Verify merchant_nft is valid
4. Validate amount > 0
5. Execute jetton transfer with payment details
6. Emit MerchantPaid event for indexer/webhook processing

**Payment Details Cell Structure**:
```
payment_details:
  - invoice_id: uint64 or string
  - order_id: string (optional)
  - memo: string (optional)
  - callback_url: string (future - for webhooks)
```

**Events Emitted**:
- MerchantPaid (payer_nft, merchant_nft, amount, payment_details)

---

### 3. Payment Received (op: 0x73774304)

Handle incoming TBC payment from external sources (DEX, partners).

**Message Format**:
```
op: uint32              = 0x73774304 (op::payment_received)
query_id: uint64        = unique identifier
recipient_nft: address  = receiving NFT account
amount: coins           = TBC amount received
source_address: address = payment source (DEX, gateway)
details: cell           = transaction details
```

**Flow**:
1. Verify recipient_nft is valid
2. Verify recipient_nft is not blocked
3. Validate amount > 0
4. Credit TBC to recipient's jetton wallet
5. Emit PaymentReceived event

**Use Cases**:
- User deposits via DEX swap (TON → TBC)
- External gateway credits (ChangeNOW, NOWPayments)
- Cross-contract transfers

**Events Emitted**:
- PaymentReceived (recipient_nft, amount, source_address, details)

---

### 4. Emergency Pause (op: 0x73774306)

Admin-only operation to pause contract in emergency.

**Message Format**:
```
op: uint32              = 0x73774306 (op::set_paused)
query_id: uint64        = unique identifier
pause_state: uint1      = 0 (unpause) or 1 (pause)
```

**Flow**:
1. Verify sender is admin
2. Update paused state
3. Save contract data

**Security**:
- Only admin can execute
- When paused, all user operations blocked
- Admin cannot withdraw funds even when paused
- Pause is for emergency circuit breaker only

**Authorization**: Admin only

---

### 5. Account Flagging (op: 0x73774305)

Admin anti-fraud function to block suspicious accounts.

**Message Format**:
```
op: uint32              = 0x73774305 (op::account_flagged)
query_id: uint64        = unique identifier
nft_address: address    = NFT account to flag/unflag
flag_state: uint1       = 0 (unblock) or 1 (block)
```

**Flow**:
1. Verify sender is admin
2. Add/remove NFT from blocked_accounts dictionary
3. Save contract data
4. Emit AccountFlagged event

**Events Emitted**:
- AccountFlagged (nft_address, flag_state)

**Use Cases**:
- Anti-fraud response
- Collateral enforcement
- Compliance requirements

**Authorization**: Admin only

---

## Get Methods (Read-Only Queries)

### is_account_active(slice nft_address) → int

Check if an NFT account is active and can perform operations.

**Parameters**:
- `nft_address`: NFT item address to check

**Returns**:
- `-1` (true) if account is active
- `0` (false) if account is blocked or invalid

**Logic**:
1. Check if NFT is from allowed collection
2. Check if account is not blocked
3. Return combined status

---

### get_paused() → int

Query current contract pause state.

**Returns**:
- `0`: Contract is active
- `1`: Contract is paused

---

### get_admin() → slice

Get admin address.

**Returns**:
- Admin wallet address (slice)

---

### get_tbc_jetton_master() → slice

Get TBC jetton master contract address.

**Returns**:
- TBC jetton master address (slice)

---

## Events for Indexing

All events are emitted as external messages for off-chain indexers to capture.

### TransferInternal Event

```
event_type: 0x73774302
data:
  - from_nft: address
  - to_nft: address
  - amount: coins
  - memo: cell
```

**Indexer Actions**:
- Update transaction history
- Notify users of incoming/outgoing transfers
- Update analytics dashboards

---

### MerchantPaid Event

```
event_type: 0x73774303
data:
  - payer_nft: address
  - merchant_nft: address
  - amount: coins
  - payment_details: cell
```

**Indexer Actions**:
- Trigger merchant webhook callbacks
- Update order status
- Record payment confirmation
- Generate receipt

---

### PaymentReceived Event

```
event_type: 0x73774304
data:
  - recipient_nft: address
  - amount: coins
  - source_address: address
  - details: cell
```

**Indexer Actions**:
- Credit account balance in cache
- Notify user of deposit
- Track deposit sources

---

### AccountFlagged Event

```
event_type: 0x73774305
data:
  - nft_address: address
  - flag_state: uint1
```

**Indexer Actions**:
- Update account status
- Trigger compliance workflows
- Log security events

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 100 | `error::invalid_sender` | Message sender is invalid |
| 101 | `error::invalid_nft` | NFT not from allowed collection |
| 102 | `error::account_blocked` | Account is flagged/blocked |
| 103 | `error::insufficient_balance` | Insufficient TBC balance |
| 104 | `error::contract_paused` | Contract is in emergency pause |
| 105 | `error::unauthorized` | Sender not authorized for operation |
| 106 | `error::invalid_amount` | Amount is zero or negative |

## Security Features

### 1. NFT Ownership Validation

Every operation validates NFT ownership:

```func
(int, slice) verify_nft_account(slice nft_address, slice expected_owner) {
    // Check collection whitelist
    // Check account not blocked
    // Verify ownership via NFT contract call
    // Return (valid, owner)
}
```

### 2. Access Control

- **User operations**: Require NFT ownership
- **Admin operations**: Require admin signature
- **No fund custody**: Admin cannot access user funds

### 3. Emergency Pause

Circuit breaker for security incidents:
- Admin can pause all user operations
- Pause does NOT enable fund withdrawal
- Pause is defensive only

### 4. Account Blocking

Anti-fraud and compliance:
- Blocked accounts cannot send/receive
- Admin-controlled flagging
- Transparent via events

### 5. Reentrancy Protection

FunC/TVM inherent protections:
- Sequential message processing
- No callback vulnerabilities
- Deterministic execution

### 6. Amount Validation

All operations validate:
- Amount > 0
- No overflow/underflow (TVM built-in)

## Integration Guide

### For Frontend (Wallet UI)

**Initiating Internal Transfer**:

```typescript
import { Address, beginCell, toNano } from 'ton-core';

// Build transfer message
const transferBody = beginCell()
    .storeUint(0x73774302, 32)  // op::internal_transfer
    .storeUint(0, 64)            // query_id
    .storeAddress(fromNFT)       // sender's NFT
    .storeAddress(toNFT)         // recipient's NFT
    .storeCoins(toNano('100'))   // amount
    .storeRef(                   // memo
        beginCell()
            .storeStringTail('Payment for invoice #123')
            .endCell()
    )
    .endCell();

// Send via TON Connect
await wallet.sendTransaction({
    to: paymentHubAddress,
    value: toNano('0.05'),  // gas fee
    body: transferBody,
});
```

### For Backend (Merchant API)

**Listening for MerchantPaid Events**:

```typescript
// Indexer listening for events
indexer.on('transaction', async (tx) => {
    if (tx.outMessages) {
        for (const msg of tx.outMessages) {
            if (msg.info.type === 'external-out') {
                const eventType = msg.body.readUint(32);

                if (eventType === 0x73774303) {  // MerchantPaid
                    const payer = msg.body.readAddress();
                    const merchant = msg.body.readAddress();
                    const amount = msg.body.readCoins();
                    const details = msg.body.readRef();

                    // Trigger webhook
                    await notifyMerchant(merchant, {
                        payer,
                        amount,
                        details,
                    });
                }
            }
        }
    }
});
```

### For DEX Integration

**Sending Payment After Swap**:

```typescript
// After user swaps TON → TBC on DEX
// DEX calls Payment Hub to credit user's NFT

const paymentReceivedBody = beginCell()
    .storeUint(0x73774304, 32)  // op::payment_received
    .storeUint(0, 64)            // query_id
    .storeAddress(userNFT)       // recipient NFT
    .storeCoins(tbcAmount)       // TBC amount from swap
    .storeAddress(dexAddress)    // source
    .storeRef(                   // details
        beginCell()
            .storeStringTail('DEX swap')
            .endCell()
    )
    .endCell();

// DEX sends message to Payment Hub
await sendMessage(paymentHubAddress, paymentReceivedBody);
```

## Deployment Process

### 1. Preparation

**Required Information**:
- Admin wallet address
- TBC jetton master address
- NFT collection addresses (7777, 8888 series)

### 2. Initial State

```typescript
const initialData = beginCell()
    .storeAddress(adminAddress)       // admin_address
    .storeUint(0, 1)                  // paused = false
    .storeDict(nftCollections)        // allowed collections
    .storeDict(null)                  // blocked_accounts (empty)
    .storeAddress(tbcJettonMaster)    // TBC master
    .endCell();
```

### 3. Compilation

```bash
# Compile FunC to Fift
func -o payment-hub.fif -SPA stdlib.fc payment-hub.fc

# Compile Fift to BOC (bag of cells)
fift -s payment-hub.fif
```

### 4. Deployment

```typescript
// Deploy to testnet first
const contract = await blockchain.treasury('payment-hub');
await contract.send({
    code: compiledCode,
    data: initialData,
    value: toNano('0.1'),
});

// Verify deployment
const isActive = await contract.get('get_paused');
console.log('Contract active:', isActive === 0);
```

### 5. Testing

See [payment-hub.test.md](../../tests/payments/payment-hub.test.md) for comprehensive test plan.

### 6. Mainnet Deployment

Only after:
- ✅ Full test coverage passing
- ✅ Security audit completed
- ✅ Testnet verification successful
- ✅ Integration tests with TBC jetton
- ✅ NFT ownership validation tested

## Limitations and Future Work

### Current Limitations

1. **NFT Ownership Lookup**: Simplified placeholder implementation
   - Production needs proper cross-contract `get_nft_data()` call
   - Requires TVM `run_method` or equivalent

2. **Jetton Transfer Execution**: Event emission only
   - Production needs actual jetton wallet interaction
   - Requires jetton transfer message construction

3. **No Balance Tracking**: Contract doesn't store balances
   - Balances are in TBC jetton wallets
   - Payment Hub only orchestrates transfers

4. **Single Admin**: Single admin address
   - Future: Multi-sig admin
   - Future: DAO governance

### Future Enhancements

**Phase 1 Improvements**:
- [ ] Implement actual NFT ownership queries
- [ ] Complete jetton wallet interaction
- [ ] Add query caching for gas optimization
- [ ] Multi-signature admin support

**Phase 2 Features**:
- [ ] Recurring payment subscriptions
- [ ] Payment escrow for disputes
- [ ] Multi-party payments (split bills)
- [ ] Conditional payments (smart invoices)

**Phase 3 Advanced**:
- [ ] Cross-chain payment bridges
- [ ] Privacy-preserving transfers
- [ ] Batch payment processing
- [ ] Advanced fraud detection

## References

- [TON FunC Documentation](https://docs.ton.org/v3/documentation/smart-contracts/func/overview)
- [TON Jetton Standard](https://github.com/ton-blockchain/jetton-contract)
- [TON NFT Standard](https://github.com/ton-blockchain/nft-contract)
- [Tonbankcard Architecture](../architecture.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)

## Related Issues

- Issue #3: Payment Hub Contract — Core Banking Logic (this implementation)
- Future: Merchant API integration
- Future: Lending adapter integration

---

**Document Status**: Initial implementation (Issue #3)
**Contract Status**: Draft - requires testing and audit
**Last Updated**: 2024
**Maintainers**: Tonbankcard Protocol Team
