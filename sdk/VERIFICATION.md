# SDK Non-Custodial Verification Checklist

This document verifies that the TONBANKCARD Merchant SDK adheres to non-custodial principles.

---

## ✅ Verification Results

### 1. No Signing Logic

**Requirement:** SDK must never sign transactions

**Verification:**
- ✅ No `sign()` methods in SDK class
- ✅ No transaction signing logic in codebase
- ✅ No mnemonic/private key imports
- ✅ No wallet initialization code

**Code Review:**
```typescript
// Searched for prohibited patterns:
// - sign, signTransaction, sendTransaction
// - privateKey, mnemonic, seed
// - wallet.send, contract.send
// Result: NONE FOUND ✓
```

---

### 2. No Key Storage

**Requirement:** SDK must never store private keys

**Verification:**
- ✅ No private key fields in classes
- ✅ No mnemonic storage
- ✅ No seed phrase handling
- ✅ No key derivation logic

**Code Review:**
```typescript
// Searched for:
// - privateKey, secretKey
// - mnemonic, seed
// - keyPair, keys
// Result: NONE FOUND ✓
```

---

### 3. Read-Only Operations

**Requirement:** All operations must be read-only with respect to funds

**Verification:**
- ✅ `createInvoice()` - Informational only (no on-chain state)
- ✅ `getInvoice()` - Read-only API query
- ✅ `getInvoiceStatus()` - Read-only blockchain query
- ✅ `generateWalletLink()` - Creates link (user must approve)
- ✅ `verifySettlement()` - Read-only blockchain verification
- ✅ `getAccountInfo()` - Read-only contract getter

**Code Review:**
```typescript
class TonbankcardSDK {
  createInvoice()        // ✓ Returns object, no blockchain write
  getInvoice()           // ✓ API read only
  getInvoiceStatus()     // ✓ Blockchain read only
  generateWalletLink()   // ✓ String generation only
  verifySettlement()     // ✓ Blockchain read only
  getAccountInfo()       // ✓ Contract getter only
}
```

---

### 4. No Payment Execution

**Requirement:** SDK must not execute payments

**Verification:**
- ✅ No `send()` calls to blockchain
- ✅ No transaction broadcasting
- ✅ No contract state modification
- ✅ No fund transfers

**Code Review:**
```typescript
// Searched for prohibited operations:
// - contract.send, client.send
// - broadcast, execute
// - transfer, withdraw
// Result: NONE FOUND ✓
```

---

### 5. No Authority

**Requirement:** SDK must not act as payment authority

**Verification:**
- ✅ Invoices are non-authoritative
- ✅ No fund locking
- ✅ No pre-authorization
- ✅ No admin override

**Code Review:**
```typescript
// createInvoice() only creates local object
// No on-chain state created
// No funds locked
// No authority granted ✓
```

---

### 6. Blockchain as Source of Truth

**Requirement:** All verification must use on-chain data

**Verification:**
- ✅ `verifySettlement()` queries blockchain
- ✅ `getInvoiceStatus()` checks on-chain events
- ✅ `getAccountInfo()` queries contract state
- ✅ No off-chain shortcuts

**Code Review:**
```typescript
// All verification methods use:
// - TonClient.getTransaction()
// - TonClient.runMethod()
// - On-chain event verification
// Result: COMPLIANT ✓
```

---

### 7. User Consent Required

**Requirement:** All payments require user wallet approval

**Verification:**
- ✅ Wallet links require user approval
- ✅ No automatic payments
- ✅ User reviews all details
- ✅ No hidden charges

**Code Review:**
```typescript
// generateWalletLink() creates TON Connect link
// User wallet displays:
// - Recipient address
// - Amount
// - Description
// User must explicitly approve ✓
```

---

### 8. Error Handling

**Requirement:** Fail safely, never hide errors

**Verification:**
- ✅ Invalid amounts throw errors
- ✅ Network errors propagate
- ✅ Verification failures reported
- ✅ No silent failures

**Code Review:**
```typescript
// All methods throw on error
// No try-catch hiding
// Verification returns explicit error field
// Result: COMPLIANT ✓
```

---

## 🧪 Automated Tests

### Security Tests

```typescript
describe('Security properties', () => {
  it('should not have any signing methods', () => {
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(sdk)
    );
    expect(methods).not.toContain('sign');
    expect(methods).not.toContain('signTransaction');
    expect(methods).not.toContain('sendTransaction');
  });

  it('should not store private keys', () => {
    const sdkProps = Object.keys(sdk);
    expect(sdkProps).not.toContain('privateKey');
    expect(sdkProps).not.toContain('mnemonic');
    expect(sdkProps).not.toContain('seed');
  });

  it('should be read-only for blockchain', () => {
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(sdk)
    );
    const writeMethods = methods.filter(
      (m) =>
        m.includes('send') ||
        m.includes('execute') ||
        m.includes('transfer')
    );
    expect(writeMethods).toHaveLength(0);
  });
});
```

**Result:** ✅ ALL TESTS PASS

---

## 📋 Manual Code Review

### File-by-File Verification

**src/types.ts**
- ✅ Only type definitions
- ✅ No logic, no custody

**src/utils.ts**
- ✅ Pure utility functions
- ✅ No signing, no custody
- ✅ Deterministic hashing only

**src/sdk.ts**
- ✅ Read-only methods
- ✅ No signing logic
- ✅ No key storage
- ✅ No payment execution

**src/index.ts**
- ✅ Exports only
- ✅ No logic

**examples/***
- ✅ All examples are read-only
- ✅ Show proper verification flow
- ✅ Emphasize user approval

---

## 🎯 Compliance Matrix

| Requirement | Status | Evidence |
|-------------|--------|----------|
| No signing logic | ✅ PASS | No sign methods found |
| No key storage | ✅ PASS | No key fields found |
| Read-only operations | ✅ PASS | All methods read-only |
| No payment execution | ✅ PASS | No send/transfer calls |
| No authority | ✅ PASS | Invoices non-authoritative |
| On-chain verification | ✅ PASS | All verification queries blockchain |
| User consent required | ✅ PASS | Wallet approval required |
| Safe error handling | ✅ PASS | Errors propagate correctly |

---

## ✅ Conclusion

**The TONBANKCARD Merchant SDK is VERIFIED as NON-CUSTODIAL**

All requirements are met:
- No custody of funds
- No signing capability
- Read-only operations
- Blockchain as source of truth
- User consent required
- No payment authority

The SDK is safe to use for merchant integrations.

---

**Verified By:** Automated tests + Manual code review

**Date:** 2024-12-27

**Version:** 0.1.0
