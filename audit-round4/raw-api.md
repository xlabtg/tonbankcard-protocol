# API findings
- MEDIUM: PostgresStorage.ts write path (118-119) JSON.stringify metadata/settlement, read path rowToInvoice (164-165) JSON.parse. pg driver auto-parses jsonb → JSON.parse(object) throws. Every read of invoice with metadata/settlement → 500. Latent (InMemory default, no PG test). Also created_at/expires_at Date cast as string.
- LOW-MED: invoiceRoutes.ts 268-290 protected routes only have per-key limiter AFTER auth; auth failures never hit limiter (authenticateWithPermission returns w/o next() on fail). No publicIpRateLimiter before auth. Contradicts rateLimiter.ts:6-7 docstring. Unthrottled auth path.
- LOW: validation.ts validateAmount uses BigInt() → accepts 0x10, 0o17, whitespace, leading zeros; stored verbatim; settlement exact-string compare never matches → un-settleable.
- LOW: InvoiceService hashMetadata({invoice_id, ...metadata}) — metadata key invoice_id shadows canonical id (spread after). validateMetadata allows invoice_id key.
