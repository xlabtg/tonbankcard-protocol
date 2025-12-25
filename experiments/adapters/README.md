# External Payment Providers Adapter - Experiments

This directory contains test and experiment scripts for validating the adapter implementations.

## Test Scripts

### ChangeNOW Tests (`test-changenow.ts`)

Tests the ChangeNOW adapter functionality:
- API endpoint connectivity
- Quote retrieval
- Currency support verification
- Data mapping functions
- Error handling

### NOWPayments Tests (`test-nowpayments.ts`)

Tests the NOWPayments adapter functionality:
- API endpoint connectivity
- Currency support verification
- Payment mapping functions
- Webhook verification
- Error handling

## Running Tests

### Prerequisites

Set environment variables with your API credentials:

```bash
# ChangeNOW
export CHANGENOW_API_KEY=your-api-key

# NOWPayments
export NOWPAYMENTS_API_KEY=your-api-key
export NOWPAYMENTS_IPN_SECRET=your-ipn-secret
```

### Run Tests

```bash
# Test ChangeNOW adapter
npx ts-node experiments/adapters/test-changenow.ts

# Test NOWPayments adapter
npx ts-node experiments/adapters/test-nowpayments.ts
```

## Test Coverage

### What is Tested

✅ **API Connectivity**
- Verify endpoints are reachable
- Confirm authentication works
- Check response formats

✅ **Data Retrieval**
- Get available currencies
- Fetch minimum amounts
- Retrieve quotes

✅ **Data Mapping**
- NFT Account association
- Status mapping
- Transaction record creation

✅ **Error Handling**
- Invalid API keys
- Network errors
- Malformed requests

### What is NOT Tested

❌ **Actual Transactions**
- No real swaps created
- No real payments processed
- No funds moved

❌ **HMAC Verification**
- Placeholder implementation
- Requires crypto library

## Safety Notes

⚠️ **Safe to Run**
- These tests do NOT create transactions
- They do NOT cost money
- They only query information endpoints
- Mock data is used for mapping tests

⚠️ **API Rate Limits**
- Tests may count against your API quota
- Some providers have rate limits
- Run tests sparingly in production

## Test Results

Expected output:

```
=== ChangeNOW Adapter Tests ===

--- Testing getQuote() ---
✅ Quote retrieved successfully

--- Testing getMinAmount() ---
✅ Min amount retrieved successfully

--- Testing getAvailableCurrencies() ---
✅ Currencies retrieved successfully
   TON supported: ✅

--- Testing mapSwapToNFTAccount() ---
✅ Swap mapped successfully

--- Testing Error Handling ---
✅ Error caught successfully

=== Tests Complete ===
```

## Next Steps

After running these experiments:

1. Review test output for any failures
2. Verify API credentials are working
3. Check that TON/TBC are in supported currencies
4. Implement missing HMAC verification if needed
5. Add more tests for edge cases
6. Create integration tests for full workflows
