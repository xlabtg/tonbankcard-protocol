# External Payment Providers Adapter - Examples

This directory contains real-world usage examples for the TONBANKCARD external payment providers adapter.

## Examples

### ChangeNOW Example (`changenow-example.ts`)

Demonstrates cryptocurrency swap operations:
- Getting exchange quotes
- Creating standard and fixed-rate swaps
- Tracking swap status
- Mapping swaps to NFT Accounts

### NOWPayments Example (`nowpayments-example.ts`)

Demonstrates merchant payment processing:
- Creating payment invoices
- Handling webhook callbacks
- Verifying payment signatures
- Mapping payments to merchant NFT Accounts

## Running Examples

These examples are designed to show the API usage patterns. To run them:

```bash
# Install dependencies (when package.json is added)
npm install

# Run ChangeNOW example
npx ts-node examples/adapters/changenow-example.ts

# Run NOWPayments example
npx ts-node examples/adapters/nowpayments-example.ts
```

## Important Notes

⚠️ **These are demonstration examples only!**

Before using in production:

1. **Never hardcode API keys** - Use environment variables
2. **Implement proper error handling** - Add retries, logging, monitoring
3. **Use a real database** - Replace mock storage with PostgreSQL/MongoDB
4. **Add validation** - Validate all user inputs and addresses
5. **Implement rate limiting** - Prevent API quota exhaustion
6. **Test thoroughly** - Use sandbox/test environments first

## What These Examples Show

### Non-Custodial Architecture
- All funds flow directly between user and provider
- Adapter only orchestrates and tracks operations
- No ability to hold or modify transactions

### User-Initiated Operations
- Users explicitly create swaps and payments
- Users provide destination addresses
- Users control refund addresses

### NFT Account Mapping
- Operations linked to NFT Accounts for bookkeeping
- Off-chain records for user convenience
- No on-chain dependencies

## Next Steps

After reviewing these examples:

1. Check the `experiments/adapters` directory for test scripts
2. Read the main adapter documentation in `backend/adapters/README.md`
3. Review the type definitions in `backend/adapters/types.ts`
4. Study the adapter implementations for security patterns
