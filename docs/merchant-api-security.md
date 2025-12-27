# Merchant API Security Considerations

**Issue**: [#24 — Merchant API (Non-Custodial Payment Orchestration)](https://github.com/xlabtg/tonbankcard-protocol/issues/24)

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Non-Custodial Guarantees](#non-custodial-guarantees)
3. [Authentication & Authorization](#authentication--authorization)
4. [Input Validation](#input-validation)
5. [Rate Limiting](#rate-limiting)
6. [Replay Protection](#replay-protection)
7. [Settlement Verification](#settlement-verification)
8. [Data Privacy](#data-privacy)
9. [Network Security](#network-security)
10. [Incident Response](#incident-response)

---

## 1. Security Principles

The Merchant API adheres to the following security principles:

### Core Principles

1. **Zero Trust**: API responses are informational, not authoritative
2. **Defense in Depth**: Multiple layers of security controls
3. **Least Privilege**: Minimal permissions for all operations
4. **Fail Secure**: Errors default to denying access
5. **Auditability**: All actions are logged and traceable

### Security by Design

- ✅ Stateless architecture (no session state)
- ✅ Read-only blockchain access
- ✅ No private key storage
- ✅ No transaction signing
- ✅ No fund custody

---

## 2. Non-Custodial Guarantees

### What the API Does NOT Do

The Merchant API provides **absolute guarantees** that it will **NEVER**:

1. ❌ **Store private keys**
   - No wallet generation
   - No key derivation
   - No encrypted key storage
   - No key backup

2. ❌ **Sign transactions**
   - No transaction creation
   - No signature generation
   - No message signing
   - No delegated signing

3. ❌ **Initiate transfers**
   - No blockchain write operations
   - No balance modifications
   - No smart contract calls (except read-only getters)

4. ❌ **Custody funds**
   - No user fund deposits
   - No escrow services
   - No temporary holdings
   - No merchant balances

5. ❌ **Authorize payments**
   - No payment approvals
   - No admin overrides
   - No force transfers
   - No balance locks

### Verification

Merchants can verify these guarantees by:

- **Code Audit**: Review open-source API implementation
- **On-Chain Verification**: Independently verify all settlements
- **Smart Contract Review**: Audit on-chain logic

**The blockchain is the ONLY source of truth.**

---

## 3. Authentication & Authorization

### API Key Management

**Generation**:
```
API Key Format: tbck_<environment>_<32 hex characters>

Examples:
- Production: tbck_live_9f3a7b2c1d4e5f6a8b9c0d1e2f3a4b5c
- Testnet:    tbck_test_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
```

**Storage**:
- Keys stored hashed (SHA-256 + salt) in database
- Never logged in plaintext
- Transmitted only via HTTPS
- Rotation supported every 90 days

**Scoping**:
```typescript
interface ApiKey {
  key_id: string;
  key_hash: string;
  merchant_nft: string;      // Authorized merchant NFT
  permissions: string[];      // ['invoice:create', 'invoice:read']
  rate_limits: RateLimits;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
}
```

### Authorization Flow

```
1. Client Request
   ↓
   Headers: { Authorization: "Bearer tbck_live_..." }

2. API Gateway
   ↓
   Extract API key from header

3. Key Validation Service
   ↓
   - Hash incoming key
   - Lookup in database
   - Check expiration
   - Verify permissions
   - Check rate limits

4. Merchant Context
   ↓
   - Load merchant NFT address
   - Verify merchant status (active, not banned)

5. Request Processing
   ↓
   - Validate merchant_nft in request matches API key
   - Process request with merchant context

6. Response + Audit Log
```

### Permission Model

| Permission | Endpoints | Description |
|------------|-----------|-------------|
| `invoice:create` | `POST /invoice/create` | Create invoices |
| `invoice:read` | `GET /invoice/:id` | Read invoice details |
| `invoice:status` | `GET /invoice/:id/status` | Check settlement status |

**Default permissions**: All new API keys get all permissions.

**Future**: Granular permissions for specific operations.

---

## 4. Input Validation

### Validation Layers

**Layer 1: Schema Validation**
```typescript
const createInvoiceSchema = {
  type: 'object',
  required: ['merchant_nft', 'amount_tbc', 'currency'],
  properties: {
    merchant_nft: {
      type: 'string',
      pattern: '^[Ek][Qq][A-Za-z0-9_-]{46}$', // TON address format
    },
    amount_tbc: {
      type: 'string',
      pattern: '^[0-9]+$', // Positive integer
    },
    currency: {
      type: 'string',
      enum: ['TBC'],
    },
    metadata: {
      type: 'object',
      maxProperties: 10,
    },
    expires_at: {
      type: 'string',
      format: 'date-time', // ISO 8601
    },
  },
};
```

**Layer 2: Business Logic Validation**
```typescript
function validateAmount(amountTbc: string): void {
  const amount = BigInt(amountTbc);

  if (amount <= 0n) {
    throw new ValidationError('Amount must be positive');
  }

  if (amount > 2n ** 120n - 1n) {
    throw new ValidationError('Amount exceeds maximum');
  }
}
```

**Layer 3: On-Chain Verification**
```typescript
async function validateNftWhitelist(nftAddress: string): Promise<void> {
  const nftData = await tonClient.getNftData(nftAddress);

  const collection = nftData.collection_address;

  if (!WHITELISTED_COLLECTIONS.includes(collection)) {
    throw new ValidationError('NFT not in whitelisted collection');
  }
}
```

### Sanitization

**Metadata Sanitization**:
```typescript
function sanitizeMetadata(metadata: any): InvoiceMetadata {
  const sanitized: InvoiceMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Remove undefined values
    if (value === undefined) continue;

    // Sanitize key (alphanumeric + underscore only)
    const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '');

    // Sanitize value based on type
    if (typeof value === 'string') {
      // Trim whitespace, limit length
      sanitized[cleanKey] = value.trim().substring(0, 256);
    } else if (typeof value === 'number') {
      // Ensure finite number
      sanitized[cleanKey] = Number.isFinite(value) ? value : 0;
    } else if (typeof value === 'boolean') {
      sanitized[cleanKey] = Boolean(value);
    }
  }

  return sanitized;
}
```

**SQL Injection Prevention**:
```typescript
// Use parameterized queries ALWAYS
const result = await db.query(
  'SELECT * FROM invoices WHERE invoice_id = $1',
  [invoiceId] // Parameterized
);

// NEVER:
// const result = await db.query(
//   `SELECT * FROM invoices WHERE invoice_id = '${invoiceId}'`
// );
```

---

## 5. Rate Limiting

### Rate Limit Configuration

| Endpoint | Limit | Window | Burst |
|----------|-------|--------|-------|
| `POST /invoice/create` | 100 requests | 1 minute | 10 |
| `GET /invoice/:id` | 1000 requests | 1 minute | 50 |
| `GET /invoice/:id/status` | 500 requests | 1 minute | 20 |

### Implementation

**Token Bucket Algorithm**:
```typescript
class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  async checkLimit(key: string, limit: RateLimit): Promise<boolean> {
    const bucket = this.getBucket(key, limit);

    if (bucket.tokens < 1) {
      // Rate limit exceeded
      throw new RateLimitError(bucket.refillAt);
    }

    // Consume token
    bucket.tokens -= 1;
    return true;
  }

  private getBucket(key: string, limit: RateLimit): TokenBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: limit.maxTokens,
        maxTokens: limit.maxTokens,
        refillRate: limit.refillRate,
        lastRefill: Date.now(),
        refillAt: Date.now() + limit.window,
      };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillAmount = (elapsed / limit.window) * limit.maxTokens;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refillAmount);
    bucket.lastRefill = now;

    return bucket;
  }
}
```

**Response Headers**:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1672531200

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "retryAfter": 30,
      "limit": 100,
      "window": 60
    }
  }
}
```

### DDoS Protection

**Additional Layers**:
1. **WAF (Web Application Firewall)**
   - Cloudflare, AWS WAF, or similar
   - Block malicious traffic patterns
   - Geo-blocking if needed

2. **IP Reputation**
   - Block known malicious IPs
   - Challenge suspicious IPs with CAPTCHA

3. **Adaptive Rate Limiting**
   - Detect anomalous traffic patterns
   - Automatically adjust limits during attacks

---

## 6. Replay Protection

### Invoice ID Uniqueness

**Cryptographic Randomness**:
```typescript
import crypto from 'crypto';

function generateInvoiceId(): string {
  // 8 bytes = 16 hex chars = 64 bits of entropy
  const randomBytes = crypto.randomBytes(8);
  return `inv_${randomBytes.toString('hex')}`;
}

// Collision probability:
// P(collision) ≈ n^2 / (2 * 2^64)
// For 1 billion invoices: P ≈ 2.7 * 10^-8 (negligible)
```

**Uniqueness Constraint**:
```sql
CREATE TABLE invoices (
  invoice_id VARCHAR(32) PRIMARY KEY, -- Enforces uniqueness
  -- ...
);
```

### Idempotency

**Idempotency Key Generation**:
```typescript
function generateIdempotencyKey(request: CreateInvoiceRequest): string {
  const data = {
    merchant_nft: request.merchant_nft,
    amount_tbc: request.amount_tbc,
    metadata: request.metadata || {},
  };

  // Deterministic hash
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}
```

**Idempotent Invoice Creation**:
```typescript
async function createInvoiceIdempotent(request: CreateInvoiceRequest): Promise<Invoice> {
  const idempotencyKey = generateIdempotencyKey(request);

  // Check if invoice already exists
  const existing = await db.invoices.findByIdempotencyKey(idempotencyKey);

  if (existing && !isExpired(existing.expires_at)) {
    // Return existing invoice (idempotent)
    return existing;
  }

  // Create new invoice
  const invoice = await createInvoice(request);
  await db.invoices.setIdempotencyKey(invoice.invoice_id, idempotencyKey);

  return invoice;
}
```

### Timestamp Validation

**Reject Stale Requests**:
```typescript
function validateRequestTimestamp(timestamp: string): void {
  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (now - requestTime > maxAge) {
    throw new ValidationError('Request timestamp too old');
  }

  if (requestTime > now + 60000) {
    throw new ValidationError('Request timestamp in future');
  }
}
```

---

## 7. Settlement Verification

### On-Chain Verification Process

**Step 1: Event Detection**
```typescript
// Blockchain indexer detects MerchantPayment event
interface MerchantPaymentEvent {
  payer_nft: string;
  merchant_nft: string;
  amount_tbc: bigint;
  payload_hash: string;
  block_number: number;
  tx_hash: string;
  timestamp: number;
}
```

**Step 2: Event Matching**
```typescript
async function matchEventToInvoice(event: MerchantPaymentEvent): Promise<Invoice | null> {
  // Find pending invoices for this merchant
  const pendingInvoices = await db.invoices.findPending({
    merchant_nft: event.merchant_nft,
    amount_tbc: event.amount_tbc.toString(),
  });

  for (const invoice of pendingInvoices) {
    // Compute expected payload hash
    const expectedHash = hashMetadata({
      invoice_id: invoice.invoice_id,
      ...invoice.metadata,
    });

    if (expectedHash === event.payload_hash) {
      return invoice; // Match found!
    }
  }

  return null; // No match
}
```

**Step 3: Confirmation Verification**
```typescript
async function verifyConfirmations(blockNumber: number): Promise<boolean> {
  const latestBlock = await tonClient.getLatestBlock();
  const confirmations = latestBlock - blockNumber;

  return confirmations >= MIN_CONFIRMATIONS; // ≥6
}
```

**Step 4: Settlement Proof**
```typescript
async function createSettlementProof(event: MerchantPaymentEvent): Promise<Settlement> {
  return {
    payer_nft: event.payer_nft,
    merchant_nft: event.merchant_nft,
    amount_tbc: event.amount_tbc.toString(),
    block_number: event.block_number,
    tx_hash: event.tx_hash,
    timestamp: new Date(event.timestamp * 1000).toISOString(),
    payload_hash: event.payload_hash,
    on_chain_verified: true,
    verification_url: `https://tonscan.org/tx/${event.tx_hash}`,
  };
}
```

### Independent Merchant Verification

**Merchants should ALWAYS verify settlements independently**:

```typescript
import { TonClient } from '@ton/ton';

async function merchantVerifySettlement(settlement: Settlement): Promise<boolean> {
  const tonClient = new TonClient({
    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
  });

  // 1. Get transaction by hash
  const tx = await tonClient.getTransaction(settlement.tx_hash);

  if (!tx) {
    console.error('Transaction not found');
    return false;
  }

  // 2. Verify transaction is confirmed
  const latestBlock = await tonClient.getLatestBlock();
  const confirmations = latestBlock - settlement.block_number;

  if (confirmations < 6) {
    console.warn('Insufficient confirmations');
    return false;
  }

  // 3. Verify transaction details
  // (Exact verification depends on transaction structure)
  // - Check sender address
  // - Check recipient address
  // - Check amount
  // - Check payload

  return true;
}
```

---

## 8. Data Privacy

### Personal Data Handling

**GDPR / Privacy Compliance**:

| Data Type | Storage | Retention | Purpose |
|-----------|---------|-----------|---------|
| Merchant NFT Address | Database | Indefinite | Authentication |
| Invoice Metadata | Database | 90 days | Payment processing |
| Customer Email | Metadata (optional) | 90 days | Order fulfillment |
| API Keys | Database (hashed) | Until revoked | Authentication |
| Request Logs | Log files | 30 days | Audit / debugging |

**Data Minimization**:
- Only collect necessary data
- No PII (Personally Identifiable Information) required
- Metadata is merchant-defined (not required)

**Data Encryption**:
```typescript
// At rest
const encryptedMetadata = encrypt(metadata, ENCRYPTION_KEY);
await db.invoices.create({ ...invoice, metadata: encryptedMetadata });

// In transit (HTTPS only)
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'HTTPS required' });
  }
  next();
});
```

**Right to Deletion**:
```typescript
async function deleteInvoiceData(invoiceId: string): Promise<void> {
  // Anonymize invoice (keep financial records, remove PII)
  await db.invoices.update(invoiceId, {
    metadata: null, // Remove metadata containing PII
    deleted_at: new Date().toISOString(),
  });

  // Note: Settlement data must be retained for financial audits
}
```

---

## 9. Network Security

### Transport Security

**HTTPS Enforcement**:
```typescript
// Redirect HTTP to HTTPS
app.use((req, res, next) => {
  if (!req.secure && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.hostname}${req.url}`);
  }
  next();
});

// HSTS Header
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

**TLS Configuration**:
```
Minimum TLS version: 1.2
Preferred TLS version: 1.3
Cipher suites: Strong ciphers only (ECDHE, AES-GCM)
Certificate: Valid, not expired, trusted CA
```

### CORS Policy

**Restrictive CORS**:
```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false, // No cookies
  maxAge: 600, // 10 minutes
};

app.use(cors(corsOptions));
```

### Security Headers

```typescript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');

  next();
});
```

---

## 10. Incident Response

### Incident Categories

| Severity | Examples | Response Time |
|----------|----------|---------------|
| **Critical** | Private key exposure (N/A), Fund loss (N/A) | Immediate |
| **High** | API key leak, DDoS attack | < 1 hour |
| **Medium** | Rate limit bypass, Validation bypass | < 4 hours |
| **Low** | Informational errors, Performance issues | < 24 hours |

### Response Procedures

**1. Detection**
- Automated monitoring alerts
- Merchant reports
- Security audits

**2. Containment**
- Revoke compromised API keys immediately
- Block malicious IPs
- Enable maintenance mode if necessary

**3. Investigation**
- Review logs and audit trails
- Identify root cause
- Assess impact

**4. Remediation**
- Deploy fixes
- Rotate affected credentials
- Update security controls

**5. Communication**
- Notify affected merchants
- Publish incident report (if public impact)
- Update documentation

**6. Post-Mortem**
- Document lessons learned
- Implement preventive measures
- Update runbooks

### Security Audit Trail

**Logging Requirements**:
```typescript
interface AuditLog {
  timestamp: string;
  event_type: 'invoice_created' | 'invoice_viewed' | 'api_key_used' | 'error';
  merchant_id: string;
  api_key_id: string;
  request_id: string;
  ip_address: string;
  user_agent: string;
  request: {
    method: string;
    path: string;
    params: any;
  };
  response: {
    status_code: number;
    error?: string;
  };
}
```

**Log Retention**:
- Critical events: 1 year
- Security events: 90 days
- Access logs: 30 days
- Debug logs: 7 days

---

## Conclusion

The Merchant API is designed with **security as a fundamental requirement**, not an afterthought. By maintaining stateless, non-custodial architecture and treating the blockchain as the sole source of truth, the API minimizes trust assumptions and attack surfaces.

**Key Takeaways**:

✅ **Non-Custodial**: API never holds private keys or funds
✅ **Stateless**: No mutable server-side state
✅ **Read-Only**: Blockchain access is read-only
✅ **Verified**: Merchants independently verify settlements
✅ **Auditable**: All actions logged and traceable

**Security is everyone's responsibility** — merchants, developers, and users must all participate in maintaining the system's integrity.

---

**Issue Reference**: [#24 — Merchant API](https://github.com/xlabtg/tonbankcard-protocol/issues/24)
**API Specification**: [docs/merchant-api-spec.md](./merchant-api-spec.md)
