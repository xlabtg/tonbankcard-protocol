BEGIN;
CREATE TABLE IF NOT EXISTS invoices (
 invoice_id VARCHAR(32) PRIMARY KEY, merchant_nft VARCHAR(128) NOT NULL,
 amount_tbc VARCHAR(40) NOT NULL, currency VARCHAR(8) NOT NULL DEFAULT 'TBC',
 status VARCHAR(16) NOT NULL DEFAULT 'pending', metadata JSONB, settlement JSONB,
 created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL, payment_url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_expires_at ON invoices(expires_at);
CREATE TABLE IF NOT EXISTS api_keys (
 key_hash VARCHAR(64) PRIMARY KEY, key_id VARCHAR(40) UNIQUE NOT NULL, record JSONB NOT NULL
);
COMMIT;
