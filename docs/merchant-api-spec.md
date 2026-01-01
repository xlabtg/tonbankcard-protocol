# Merchant API Specification

**Version:** 1.0.0
**Status:** Draft
**Date:** 2025-12-27
**Issue:** [#24 — Merchant API (Non-Custodial Payment Orchestration)](https://github.com/xlabtg/tonbankcard-protocol/issues/24)

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Trust Model](#trust-model)
4. [Architecture](#architecture)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [Security Considerations](#security-considerations)
8. [Error Handling](#error-handling)
9. [Integration Flow](#integration-flow)
10. [Examples](#examples)

---

## 1. Overview

The **Merchant API** is a stateless, non-custodial orchestration layer that enables third-party websites and services to:

- Create payment intents (invoices)
- Accept payments in TBC
- Verify on-chain settlement

### Key Characteristics

- **Stateless**: No mutable server-side state
- **Non-Custodial**: Never holds private keys or custody funds
- **Read-Only**: Cannot initiate or authorize payments
- **Informational**: Provides coordination, not authority

### What This API Is NOT

- ❌ Not a payment processor
- ❌ Not a source of truth
- ❌ Not an authorization layer
- ❌ Not a custodian

The blockchain is the **single source of truth**.

---

## 2. Design Principles (MANDATORY)

The Merchant API **MUST**:

1. ✅ Be fully **stateless**
2. ✅ Never hold **private keys**
3. ✅ Never initiate **transfers**
4. ✅ Never authorize **payments**
5. ✅ Only **observe** and **orchestrate** user-initiated actions

### Forbidden Operations

The API **MUST NEVER**:

- Store private keys
- Sign transactions
- Move user funds
- Act as custody
- Override on-chain state
- Provide off-chain authorizations

---

## 3. Trust Model

### Who Trusts What

| Entity | Trusts | Does NOT Trust |
|--------|--------|----------------|
| **Merchants** | On-chain events | API responses as authoritative |
| **Users** | Their wallet | API for payment authorization |
| **API** | Smart contracts | Off-chain databases |

### Security Hierarchy

```
High Trust (On-Chain)
├── NFT Ownership
├── TBC Balances
└── Smart Contract Logic

Medium Trust (Off-Chain)
├── Backend Indexer (read-only)
├── Merchant API (orchestration)
└── Frontend UI (presentation)

Low Trust (External)
├── Third-party merchants
└── External services
```

---

## 4. Architecture

### System Components

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Merchant  │         │ Merchant API │         │  Blockchain │
│   Website   │         │  (Stateless) │         │   (Truth)   │
└─────────────┘         └──────────────┘         └─────────────┘
       │                       │                         │
       │ 1. Create Invoice     │                         │
       ├──────────────────────>│                         │
       │                       │                         │
       │ 2. Invoice Details    │                         │
       │<──────────────────────┤                         │
       │                       │                         │
       │ 3. Show Payment Link  │                         │
       │                       │                         │
       │ 4. User Clicks Pay    │                         │
       │                       │                         │
       │ 5. Wallet Resolves    │                         │
       │    Invoice (GET)      │                         │
       ├──────────────────────>│                         │
       │                       │                         │
       │ 6. Invoice Data       │                         │
       │<──────────────────────┤                         │
       │                       │                         │
       │ 7. User Signs TX      │                         │
       ├─────────────────────────────────────────────────>│
       │                       │                         │
       │                       │    8. Event Emitted     │
       │                       │<────────────────────────┤
       │                       │                         │
       │ 9. Check Status (GET) │                         │
       ├──────────────────────>│                         │
       │                       │ 10. Verify On-Chain     │
       │                       ├────────────────────────>│
       │                       │                         │
       │                       │ 11. Settlement Proof    │
       │                       │<────────────────────────┤
       │                       │                         │
       │ 12. Payment Confirmed │                         │
       │<──────────────────────┤                         │
       │                       │                         │
```

### Data Flow

1. **Invoice Creation** (off-chain)
   - Merchant generates unique invoice ID
   - API stores invoice metadata (read-only)
   - No blockchain interaction

2. **Payment Intent Resolution** (off-chain)
   - Wallet fetches invoice details via API
   - User reviews payment terms
   - No state changes

3. **Payment Execution** (on-chain)
   - User signs transaction in wallet
   - Smart contract validates and settles
   - Event emitted on success

4. **Settlement Verification** (on-chain → off-chain)
   - API queries blockchain for settlement event
   - Returns block number, tx hash, and proof
   - Merchant verifies independently

---

## 5. API Endpoints

### Base URL

```
Production:  https://api.tonbankcard.io/v1
Testnet:     https://api-testnet.tonbankcard.io/v1
```

### Authentication

All endpoints require API key authentication:

```http
Authorization: Bearer <MERCHANT_API_KEY>
```

---

### 5.1 Create Invoice

**Purpose**: Generate a unique payment intent (invoice) for a merchant.

**Endpoint**:
```http
POST /invoice/create
```

**Request Headers**:
```http
Content-Type: application/json
Authorization: Bearer <MERCHANT_API_KEY>
```

**Request Body**:
```json
{
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "metadata": {
    "order_id": "ORDER-12345",
    "description": "Product purchase",
    "customer_email": "customer@example.com",
    "custom_field": "value"
  },
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `merchant_nft` | `string` | Yes | Merchant's NFT card address (TON address format) |
| `amount_tbc` | `string` | Yes | Amount in TBC nanocoins (1 TBC = 10^9 nanocoins) |
| `currency` | `string` | Yes | Always "TBC" for this version |
| `metadata` | `object` | No | Arbitrary key-value pairs (max 10 fields) |
| `metadata.order_id` | `string` | No | Merchant's order ID |
| `metadata.description` | `string` | No | Human-readable description |
| `expires_at` | `string` | No | ISO 8601 timestamp (default: 24 hours) |

**Response** (Success):
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "metadata": {
    "order_id": "ORDER-12345",
    "description": "Product purchase",
    "customer_email": "customer@example.com"
  },
  "status": "pending",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a"
}
```

**Response** (Error):
```json
{
  "error": {
    "code": "INVALID_NFT_ADDRESS",
    "message": "Invalid merchant NFT address format",
    "details": {
      "field": "merchant_nft",
      "value": "invalid"
    }
  }
}
```

**HTTP Status Codes**:
- `201 Created` - Invoice created successfully
- `400 Bad Request` - Invalid input parameters
- `401 Unauthorized` - Invalid API key
- `403 Forbidden` - Merchant NFT not verified
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Security**:
- Invoice ID must be **cryptographically random** (UUID v4 or equivalent)
- Idempotent: Same request parameters return same invoice ID within expiry window
- No blockchain interaction (pure metadata storage)

---

### 5.2 Get Invoice

**Purpose**: Retrieve invoice details for payment resolution.

**Endpoint**:
```http
GET /invoice/{invoice_id}
```

**Request Headers**:
```http
Authorization: Bearer <MERCHANT_API_KEY>  [Optional for wallets]
```

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice_id` | `string` | Yes | Unique invoice identifier |

**Response** (Success):
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "metadata": {
    "order_id": "ORDER-12345",
    "description": "Product purchase"
  },
  "status": "pending",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a",
  "settlement": null
}
```

**Response** (Invoice Settled):
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "metadata": {
    "order_id": "ORDER-12345",
    "description": "Product purchase"
  },
  "status": "settled",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a",
  "settlement": {
    "payer_nft": "EQDef456...",
    "block_number": 12345678,
    "tx_hash": "0xabc123...",
    "timestamp": "2025-12-27T10:05:00Z",
    "payload_hash": "0x7f8a9b..."
  }
}
```

**Response** (Error):
```json
{
  "error": {
    "code": "INVOICE_NOT_FOUND",
    "message": "Invoice not found or expired",
    "details": {
      "invoice_id": "inv_9f3a7b2c1d4e5f6a"
    }
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Invoice found
- `404 Not Found` - Invoice not found or expired
- `410 Gone` - Invoice expired
- `500 Internal Server Error` - Server error

**Security**:
- Public endpoint (no auth required for wallet access)
- Rate limited per IP
- No sensitive merchant data exposed

---

### 5.3 Get Invoice Status

**Purpose**: Check settlement status and on-chain verification.

**Endpoint**:
```http
GET /invoice/{invoice_id}/status
```

**Request Headers**:
```http
Authorization: Bearer <MERCHANT_API_KEY>
```

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `invoice_id` | `string` | Yes | Unique invoice identifier |

**Response** (Pending):
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "status": "pending",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "settlement": null
}
```

**Response** (Settled):
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "status": "settled",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "settlement": {
    "payer_nft": "EQDef456...",
    "merchant_nft": "EQAbc123...",
    "amount_tbc": "1000000000",
    "block_number": 12345678,
    "tx_hash": "0xabc123...",
    "timestamp": "2025-12-27T10:05:00Z",
    "payload_hash": "0x7f8a9b...",
    "on_chain_verified": true,
    "verification_url": "https://tonscan.org/tx/0xabc123..."
  }
}
```

**Response** (Expired):
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "status": "expired",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-28T10:00:00Z",
  "settlement": null
}
```

**HTTP Status Codes**:
- `200 OK` - Status retrieved successfully
- `401 Unauthorized` - Invalid API key
- `404 Not Found` - Invoice not found
- `500 Internal Server Error` - Server error

**Security**:
- Requires merchant authentication
- Returns on-chain verification proof
- Merchants should independently verify via blockchain explorer

---

## 6. Data Models

### 6.1 Invoice

```typescript
interface Invoice {
  invoice_id: string;           // Unique identifier (UUID v4)
  merchant_nft: string;         // TON address of merchant NFT
  amount_tbc: string;           // Amount in TBC nanocoins
  currency: "TBC";              // Always TBC
  metadata?: InvoiceMetadata;   // Optional metadata
  status: InvoiceStatus;        // pending | settled | expired
  created_at: string;           // ISO 8601 timestamp
  expires_at: string;           // ISO 8601 timestamp
  payment_url: string;          // Deep link for wallet
  settlement?: Settlement;      // Present if status = settled
}
```

### 6.2 Invoice Metadata

```typescript
interface InvoiceMetadata {
  order_id?: string;            // Merchant's order ID
  description?: string;         // Human-readable description
  customer_email?: string;      // Customer email (optional)
  [key: string]: any;           // Custom fields (max 10)
}
```

### 6.3 Invoice Status

```typescript
type InvoiceStatus = "pending" | "settled" | "expired";
```

**State Transitions**:
- `pending` → `settled` (when payment confirmed on-chain)
- `pending` → `expired` (when expires_at reached)
- `settled` → (terminal state, no further transitions)
- `expired` → (terminal state, no further transitions)

### 6.4 Settlement

```typescript
interface Settlement {
  payer_nft: string;            // TON address of payer NFT
  merchant_nft: string;         // TON address of merchant NFT
  amount_tbc: string;           // Amount in TBC nanocoins
  block_number: number;         // Block number of settlement
  tx_hash: string;              // Transaction hash
  timestamp: string;            // ISO 8601 timestamp
  payload_hash: string;         // Hash of payment metadata
  on_chain_verified: boolean;   // API verified on-chain
  verification_url: string;     // Blockchain explorer link
}
```

### 6.5 Error Response

```typescript
interface ErrorResponse {
  error: {
    code: string;               // Machine-readable error code
    message: string;            // Human-readable message
    details?: Record<string, any>; // Additional context
  };
}
```

---

## 7. Security Considerations

### 7.1 Authentication & Authorization

**API Key Management**:
- Merchants receive API keys via secure channel
- Keys are scoped to merchant NFT address
- Rotation supported via dashboard
- Rate limits enforced per key

**Authorization Model**:
```
API Key → Merchant NFT → Invoice Ownership
```

### 7.2 Replay Protection

**Invoice ID Generation**:
- Cryptographically random (UUID v4)
- No sequential or predictable IDs
- Collision probability: negligible

**Idempotency**:
- Same input → same invoice_id (within expiry window)
- Prevents duplicate invoice creation
- Based on hash of (merchant_nft + amount_tbc + metadata)

### 7.3 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /invoice/create` | 100 requests | 1 minute |
| `GET /invoice/{id}` | 1000 requests | 1 minute |
| `GET /invoice/{id}/status` | 500 requests | 1 minute |

**Exceeded**: HTTP 429 with `Retry-After` header

### 7.4 Input Validation

**NFT Address**:
- Must match TON address format
- Must be in whitelisted NFT collections:
  - Series 7777: `EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le`
  - Series 8888: `EQBedyJo8oEKJEmGUaxPELXM8dQUzXN3QYx7e8WBsfu9aVQ7`

**Amount**:
- Must be positive integer (nanocoins)
- Must be > 0
- Must be ≤ `2^120 - 1` (TON limit)

**Metadata**:
- Max 10 fields
- Max 1KB total size
- Keys: alphanumeric + underscore
- Values: string, number, boolean

### 7.5 No Custody Guarantee

**API NEVER**:
- Stores private keys
- Signs transactions
- Initiates transfers
- Holds user funds
- Authorizes payments

**All payments are user-initiated via wallet**.

### 7.6 Settlement Verification

**On-Chain Verification Process**:
1. API receives `MerchantPayment` event from blockchain indexer
2. Validates:
   - `merchant_nft` matches invoice
   - `amount_tbc` matches invoice
   - `payload_hash` matches invoice metadata hash
   - Event is in confirmed block (≥6 confirmations)
3. Marks invoice as `settled`
4. Stores block number, tx hash, timestamp

**Merchant Responsibility**:
- Merchants MUST independently verify settlement via blockchain
- API verification is **informational**, not authoritative
- Use TON SDK or blockchain explorer for verification

---

## 8. Error Handling

### 8.1 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | API key is invalid or revoked |
| `UNAUTHORIZED_MERCHANT` | 403 | Merchant NFT not authorized for API |
| `INVALID_NFT_ADDRESS` | 400 | NFT address format is invalid |
| `NFT_NOT_WHITELISTED` | 403 | NFT not in whitelisted collections |
| `INVALID_AMOUNT` | 400 | Amount is invalid (≤0 or too large) |
| `INVALID_METADATA` | 400 | Metadata exceeds limits or invalid format |
| `INVOICE_NOT_FOUND` | 404 | Invoice ID not found |
| `INVOICE_EXPIRED` | 410 | Invoice has expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `BLOCKCHAIN_UNAVAILABLE` | 503 | Blockchain node is unavailable |

### 8.2 Error Response Format

```json
{
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be greater than zero",
    "details": {
      "field": "amount_tbc",
      "value": "0",
      "constraint": "amount_tbc > 0"
    }
  }
}
```

### 8.3 Retry Strategy

**Client Recommendations**:
- `5xx` errors: Retry with exponential backoff
- `429` errors: Respect `Retry-After` header
- `4xx` errors: Do not retry (fix request)

---

## 9. Integration Flow

### 9.1 End-to-End Payment Flow

```
Step 1: Merchant Creates Invoice
────────────────────────────────
Merchant Website → API: POST /invoice/create
  {
    "merchant_nft": "EQAbc123...",
    "amount_tbc": "1000000000",
    "metadata": {
      "order_id": "ORDER-12345"
    }
  }

API → Merchant Website: 201 Created
  {
    "invoice_id": "inv_9f3a7b2c1d4e5f6a",
    "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a"
  }

Step 2: Merchant Shows Payment Link
────────────────────────────────────
Merchant Website → User: Display QR code or "Pay with TBC" button

Step 3: User Opens Wallet
──────────────────────────
User → Wallet App: Scans QR or clicks link

Wallet App → API: GET /invoice/inv_9f3a7b2c1d4e5f6a

API → Wallet App: 200 OK
  {
    "invoice_id": "inv_9f3a7b2c1d4e5f6a",
    "merchant_nft": "EQAbc123...",
    "amount_tbc": "1000000000",
    "metadata": {
      "description": "Product purchase"
    }
  }

Step 4: User Confirms Payment
──────────────────────────────
Wallet App → User: Show payment details, request confirmation

User → Wallet App: Approve

Wallet App: Sign transaction with user's private key

Wallet App → Blockchain: Submit MerchantPaymentRequest
  {
    payer_nft: "EQDef456...",
    merchant_nft: "EQAbc123...",
    amount_tbc: 1000000000,
    payload: Cell { invoice_id: "inv_9f3a7b2c1d4e5f6a" }
  }

Step 5: On-Chain Settlement
────────────────────────────
MerchantPaymentHub Contract:
  - Validates ownership
  - Checks account state (ACTIVE)
  - Checks locks (no FRAUD_LOCK, no COLLATERAL_LOCK)
  - Validates balance
  - Debits payer NFT account
  - Credits merchant NFT account
  - Emits MerchantPayment event

Step 6: Event Indexing
──────────────────────
Blockchain → Indexer: MerchantPayment event
  {
    payer_nft: "EQDef456...",
    merchant_nft: "EQAbc123...",
    amount_tbc: 1000000000,
    payload_hash: "0x7f8a9b...",
    timestamp: 1735304700
  }

Indexer → API Database: Store settlement proof
  - Match payload_hash to invoice_id
  - Update invoice status to "settled"
  - Store block_number, tx_hash, timestamp

Step 7: Merchant Verification
──────────────────────────────
Merchant Website (polling or webhook): GET /invoice/inv_9f3a7b2c1d4e5f6a/status

API → Merchant Website: 200 OK
  {
    "status": "settled",
    "settlement": {
      "block_number": 12345678,
      "tx_hash": "0xabc123...",
      "on_chain_verified": true
    }
  }

Merchant Website: Fulfill order (ship product, grant access, etc.)
```

### 9.2 Webhook Support (Future)

**Not included in v1.0.0** - To be specified in future version.

---

## 10. Examples

### 10.1 Create Invoice (cURL)

```bash
curl -X POST https://api.tonbankcard.io/v1/invoice/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "merchant_nft": "EQAbc123...",
    "amount_tbc": "1000000000",
    "currency": "TBC",
    "metadata": {
      "order_id": "ORDER-12345",
      "description": "Premium subscription (1 month)"
    },
    "expires_at": "2025-12-31T23:59:59Z"
  }'
```

**Response**:
```json
{
  "invoice_id": "inv_9f3a7b2c1d4e5f6a",
  "merchant_nft": "EQAbc123...",
  "amount_tbc": "1000000000",
  "currency": "TBC",
  "status": "pending",
  "created_at": "2025-12-27T10:00:00Z",
  "expires_at": "2025-12-31T23:59:59Z",
  "payment_url": "https://wallet.tonbankcard.io/pay/inv_9f3a7b2c1d4e5f6a"
}
```

### 10.2 Get Invoice (JavaScript)

```javascript
const invoiceId = "inv_9f3a7b2c1d4e5f6a";

const response = await fetch(
  `https://api.tonbankcard.io/v1/invoice/${invoiceId}`,
  {
    headers: {
      "Authorization": `Bearer ${MERCHANT_API_KEY}`
    }
  }
);

const invoice = await response.json();

if (invoice.status === "settled") {
  console.log("Payment confirmed!");
  console.log("TX Hash:", invoice.settlement.tx_hash);
  console.log("Block:", invoice.settlement.block_number);
}
```

### 10.3 Check Status (Python)

```python
import requests

invoice_id = "inv_9f3a7b2c1d4e5f6a"
api_key = "YOUR_API_KEY"

response = requests.get(
    f"https://api.tonbankcard.io/v1/invoice/{invoice_id}/status",
    headers={"Authorization": f"Bearer {api_key}"}
)

data = response.json()

if data["status"] == "settled":
    print("Payment settled on-chain")
    print(f"Block: {data['settlement']['block_number']}")
    print(f"TX: {data['settlement']['tx_hash']}")

    # Independent verification (recommended)
    verify_url = data['settlement']['verification_url']
    print(f"Verify at: {verify_url}")
else:
    print(f"Status: {data['status']}")
```

### 10.4 Polling Pattern (TypeScript)

```typescript
async function waitForSettlement(invoiceId: string): Promise<Settlement> {
  const maxAttempts = 60; // 5 minutes (5s interval)
  const interval = 5000; // 5 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://api.tonbankcard.io/v1/invoice/${invoiceId}/status`,
      {
        headers: {
          "Authorization": `Bearer ${process.env.MERCHANT_API_KEY}`
        }
      }
    );

    const data = await response.json();

    if (data.status === "settled") {
      return data.settlement;
    }

    if (data.status === "expired") {
      throw new Error("Invoice expired before settlement");
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error("Settlement timeout");
}

// Usage
try {
  const settlement = await waitForSettlement("inv_9f3a7b2c1d4e5f6a");
  console.log("Payment confirmed:", settlement);

  // Fulfill order
  await fulfillOrder(orderId, settlement);
} catch (error) {
  console.error("Payment failed:", error);
}
```

---

## Appendix A: On-Chain Event Format

### MerchantPayment Event

**Emitted By**: `MerchantPaymentHub` contract

**Structure**:
```tact
message MerchantPayment {
    payer_nft: Address;       // Payer NFT card address
    merchant_nft: Address;    // Merchant NFT card address
    amount_tbc: Int as coins; // Amount transferred in TBC
    payload_hash: Int;        // Hash of payment metadata
    timestamp: Int as uint32; // Block timestamp
}
```

**Matching Logic**:
```typescript
// API matches event to invoice
function matchEventToInvoice(event: MerchantPayment, invoices: Invoice[]): Invoice | null {
  for (const invoice of invoices.filter(inv => inv.status === "pending")) {
    const metadataHash = hashMetadata({
      invoice_id: invoice.invoice_id,
      ...invoice.metadata
    });

    if (
      event.merchant_nft === invoice.merchant_nft &&
      event.amount_tbc === BigInt(invoice.amount_tbc) &&
      event.payload_hash === metadataHash
    ) {
      return invoice;
    }
  }
  return null;
}
```

---

## Appendix B: Deployment Checklist

### Pre-Deployment

- [ ] API key generation system implemented
- [ ] Rate limiting configured
- [ ] Blockchain indexer deployed and synced
- [ ] Database schema created
- [ ] NFT whitelist configured
- [ ] Error logging setup
- [ ] Monitoring and alerting configured

### Post-Deployment

- [ ] Integration tests passed
- [ ] Load tests passed
- [ ] Security audit completed
- [ ] Documentation published
- [ ] SDK examples published
- [ ] Merchant onboarding flow tested

---

## Appendix C: Future Enhancements

The following features are **out of scope** for v1.0.0 but may be considered for future versions:

- ❌ Webhooks (real-time settlement notifications)
- ❌ Refunds (on-chain refund support)
- ❌ Partial payments
- ❌ Multi-currency invoices
- ❌ Subscription management
- ❌ Dispute resolution
- ❌ Fiat conversion
- ❌ KYC/AML integration

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-27 | Initial specification |

---

## References

- **Issue #24**: [Merchant API (Non-Custodial Payment Orchestration)](https://github.com/xlabtg/tonbankcard-protocol/issues/24)
- **Issue #8**: [Merchant Payments Settlement](https://github.com/xlabtg/tonbankcard-protocol/issues/8)
- **Architecture**: [docs/architecture.md](./architecture.md)
- **Contributing**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **TON Address Format**: https://docs.ton.org/learn/overviews/addresses
- **TBC Token**: `EQBzKrzfB2fidoQgB4EpILOF5ISDgCX0rM86txh4M3a4Eygq`

---

**End of Specification**
