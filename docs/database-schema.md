# Database Schema — Payment Status Indexer

> Single source of truth for the database schema used by `backend/indexer/`.
> The indexer is a **read-only**, advisory cache of on-chain events. The
> blockchain remains the authoritative state — the database can be wiped
> and reconstructed from chain at any time.

This document describes every table managed by the indexer, the role of
each column, the indexes that back the API query paths, and the
SQLite/PostgreSQL parity rules that migrations must respect.

---

## 1. Storage backends

| Environment | Engine        | Driver           | Notes                                                                 |
|-------------|---------------|------------------|----------------------------------------------------------------------|
| Local dev   | SQLite 3      | `better-sqlite3` | File on a docker named volume (`indexer-data`) or local `./data/`.   |
| Production  | PostgreSQL 16 | `pg`             | Managed instance with daily backups (see `docs/production/BACKUP.md`).|

The same logical schema is materialised by per-dialect migration files
under `backend/indexer/src/db/migrations/<NNN>_<name>/`:

```
backend/indexer/src/db/migrations/
└── 001_initial/
    ├── up.sqlite.sql
    ├── up.postgres.sql
    ├── down.sqlite.sql
    └── down.postgres.sql
```

The `npm run db:migrate` command auto-detects the backend (PostgreSQL
when `DATABASE_URL` is set, SQLite otherwise) and applies the matching
files in version order. See `backend/indexer/docs/MIGRATIONS.md` for the
runtime contract.

---

## 2. Migration metadata

### `schema_migrations`

Tracks which migrations have been applied to the current database.

| Column        | SQLite       | PostgreSQL              | Description                                  |
|---------------|--------------|-------------------------|----------------------------------------------|
| `version`     | `TEXT PK`    | `TEXT PRIMARY KEY`      | Numeric identifier, e.g. `"001"`.            |
| `name`        | `TEXT NOT NULL` | `TEXT NOT NULL`      | Human-readable slug, e.g. `"initial"`.       |
| `applied_at`  | `INTEGER`    | `BIGINT`                | Unix seconds when the migration was applied. |
| `checksum`    | `TEXT`       | `TEXT`                  | SHA-256 of the up SQL — detects drift.       |

`schema_migrations` is created automatically by the migrator before the
first migration runs and must never be modified by application code.

---

## 3. Application tables

All tables below are part of migration `001_initial`.

### 3.1 `indexer_state`

Singleton table holding the highest block the indexer has fully
processed. Acts as the resume cursor on restart.

| Column                    | SQLite                          | PostgreSQL                          | Description                                                  |
|---------------------------|---------------------------------|-------------------------------------|--------------------------------------------------------------|
| `id`                      | `INTEGER PRIMARY KEY CHECK (id=1)` | `SMALLINT PRIMARY KEY CHECK (id=1)` | Always `1` — enforces singleton row.                         |
| `latest_block_indexed`    | `INTEGER NOT NULL DEFAULT 0`    | `BIGINT NOT NULL DEFAULT 0`         | Highest block number whose events have been written.         |
| `latest_block_timestamp`  | `INTEGER NOT NULL DEFAULT 0`    | `BIGINT NOT NULL DEFAULT 0`         | Block timestamp (Unix seconds) for that block.               |
| `last_update_time`        | `INTEGER NOT NULL DEFAULT 0`    | `BIGINT NOT NULL DEFAULT 0`         | Wall-clock Unix seconds of the last update.                  |
| `version`                 | `TEXT NOT NULL DEFAULT '1.0.0'` | `TEXT NOT NULL DEFAULT '1.0.0'`     | Logical data version (separate from `schema_migrations`).    |

The row is seeded with `INSERT … WHERE NOT EXISTS` to keep the
migration idempotent.

### 3.2 `blocks`

Block header cache used to detect reorgs.

| Column              | SQLite                          | PostgreSQL                            | Description                                          |
|---------------------|---------------------------------|---------------------------------------|------------------------------------------------------|
| `block_number`      | `INTEGER PRIMARY KEY`           | `BIGINT PRIMARY KEY`                  | TON masterchain block sequence number.               |
| `block_hash`        | `TEXT NOT NULL UNIQUE`          | `TEXT NOT NULL UNIQUE`                | Hex block hash.                                      |
| `parent_hash`       | `TEXT NOT NULL`                 | `TEXT NOT NULL`                       | Previous block's hash (chain linkage).               |
| `timestamp`         | `INTEGER NOT NULL`              | `BIGINT NOT NULL`                     | Block timestamp (Unix seconds).                      |
| `transaction_count` | `INTEGER NOT NULL DEFAULT 0`    | `INTEGER NOT NULL DEFAULT 0`          | Transactions parsed from this block.                 |
| `indexed_at`        | `INTEGER NOT NULL`              | `BIGINT NOT NULL`                     | Wall-clock when the row was inserted.                |
| `confirmed`         | `BOOLEAN NOT NULL DEFAULT 0`    | `BOOLEAN NOT NULL DEFAULT FALSE`      | `TRUE` after `INDEXER_CONFIRMATION_BLOCKS` ancestors.|

**Indexes**

- `idx_blocks_timestamp` (`timestamp`) — time-range queries.
- `idx_blocks_confirmed` (`confirmed`) — pending vs. confirmed filtering.

### 3.3 `internal_transfers`

TBC transfer events emitted by the PaymentHub contract.

| Column             | SQLite                                   | PostgreSQL                              | Description                                          |
|--------------------|------------------------------------------|-----------------------------------------|------------------------------------------------------|
| `id`               | `INTEGER PRIMARY KEY AUTOINCREMENT`      | `BIGSERIAL PRIMARY KEY`                 | Surrogate key for stable ordering.                   |
| `block_number`     | `INTEGER NOT NULL` (FK → `blocks`)       | `BIGINT NOT NULL` (FK → `blocks`)       | Block containing the event.                          |
| `transaction_hash` | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Hex transaction hash.                                |
| `log_index`        | `INTEGER NOT NULL`                       | `INTEGER NOT NULL`                      | Per-transaction event ordinal.                       |
| `timestamp`        | `INTEGER NOT NULL`                       | `BIGINT NOT NULL`                       | Event timestamp (Unix seconds).                      |
| `from_nft`         | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Source NFT account address (raw form).               |
| `to_nft`           | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Destination NFT account address.                     |
| `amount_tbc`       | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | TBC amount as decimal string (avoid bigint loss).    |
| `payload_hash`     | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Hex hash of the transfer payload (invoice linkage).  |

**Constraints**

- `UNIQUE (transaction_hash, log_index)` — idempotent inserts.
- `FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE` — reorg cleanup propagates.

**Indexes**

- `idx_internal_transfers_from` (`from_nft`)
- `idx_internal_transfers_to` (`to_nft`)
- `idx_internal_transfers_timestamp` (`timestamp`)
- `idx_internal_transfers_payload_hash` (`payload_hash`)
- `idx_internal_transfers_from_ts` (`from_nft`, `timestamp DESC`) — backs account-history union queries.
- `idx_internal_transfers_to_ts` (`to_nft`, `timestamp DESC`) — backs account-history union queries.

### 3.4 `merchant_payments`

Settlement events emitted by the MerchantPaymentHub contract.

| Column             | SQLite                                   | PostgreSQL                              | Description                                          |
|--------------------|------------------------------------------|-----------------------------------------|------------------------------------------------------|
| `id`               | `INTEGER PRIMARY KEY AUTOINCREMENT`      | `BIGSERIAL PRIMARY KEY`                 | Surrogate key.                                       |
| `block_number`     | `INTEGER NOT NULL` (FK → `blocks`)       | `BIGINT NOT NULL` (FK → `blocks`)       | Block containing the event.                          |
| `transaction_hash` | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Hex transaction hash.                                |
| `log_index`        | `INTEGER NOT NULL`                       | `INTEGER NOT NULL`                      | Per-transaction event ordinal.                       |
| `timestamp`        | `INTEGER NOT NULL`                       | `BIGINT NOT NULL`                       | Event timestamp (Unix seconds).                      |
| `payer_nft`        | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | NFT account paying the invoice.                      |
| `merchant_nft`     | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | NFT account receiving the payment.                   |
| `amount_tbc`       | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | TBC amount as decimal string.                        |
| `payload_hash`     | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Hash matching `invoice_mappings.payload_hash`.       |

**Constraints**

- `UNIQUE (transaction_hash, log_index)`.
- `FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE`.

**Indexes**

- `idx_merchant_payments_payer` (`payer_nft`)
- `idx_merchant_payments_merchant` (`merchant_nft`)
- `idx_merchant_payments_timestamp` (`timestamp`)
- `idx_merchant_payments_payload_hash` (`payload_hash`)
- `idx_merchant_payments_payer_ts` (`payer_nft`, `timestamp DESC`)
- `idx_merchant_payments_merchant_ts` (`merchant_nft`, `timestamp DESC`)

### 3.5 `account_state_changes`

Lock-state transitions for NFT accounts (`ACTIVE`, `FROZEN`,
`COLLATERAL_LOCKED`, `CLOSED`).

| Column             | SQLite                                   | PostgreSQL                              | Description                                          |
|--------------------|------------------------------------------|-----------------------------------------|------------------------------------------------------|
| `id`               | `INTEGER PRIMARY KEY AUTOINCREMENT`      | `BIGSERIAL PRIMARY KEY`                 | Surrogate key.                                       |
| `block_number`     | `INTEGER NOT NULL` (FK → `blocks`)       | `BIGINT NOT NULL` (FK → `blocks`)       | Block containing the event.                          |
| `transaction_hash` | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Hex transaction hash.                                |
| `log_index`        | `INTEGER NOT NULL`                       | `INTEGER NOT NULL`                      | Per-transaction event ordinal.                       |
| `timestamp`        | `INTEGER NOT NULL`                       | `BIGINT NOT NULL`                       | Event timestamp (Unix seconds).                      |
| `nft_address`      | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | NFT account whose state changed.                     |
| `old_state`        | `INTEGER NOT NULL`                       | `INTEGER NOT NULL`                      | `0`=ACTIVE, `1`=FROZEN, `2`=COLLATERAL_LOCKED, `3`=CLOSED. |
| `new_state`        | `INTEGER NOT NULL`                       | `INTEGER NOT NULL`                      | Same encoding as `old_state`.                        |

**Constraints**

- `UNIQUE (transaction_hash, log_index)`.
- `FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE`.

**Indexes**

- `idx_account_state_changes_nft` (`nft_address`)
- `idx_account_state_changes_timestamp` (`timestamp`)
- `idx_account_state_changes_nft_ts` (`nft_address`, `timestamp DESC`)

### 3.6 `nft_ownership_changes`

Off-chain mirror of NFT ownership transitions (minting, transfers).

| Column                | SQLite                                   | PostgreSQL                              | Description                                       |
|-----------------------|------------------------------------------|-----------------------------------------|---------------------------------------------------|
| `id`                  | `INTEGER PRIMARY KEY AUTOINCREMENT`      | `BIGSERIAL PRIMARY KEY`                 | Surrogate key.                                    |
| `block_number`        | `INTEGER NOT NULL` (FK → `blocks`)       | `BIGINT NOT NULL` (FK → `blocks`)       | Block containing the event.                       |
| `transaction_hash`    | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Hex transaction hash.                             |
| `log_index`           | `INTEGER NOT NULL`                       | `INTEGER NOT NULL`                      | Per-transaction event ordinal.                    |
| `timestamp`           | `INTEGER NOT NULL`                       | `BIGINT NOT NULL`                       | Event timestamp (Unix seconds).                   |
| `nft_address`         | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | NFT being transferred.                            |
| `collection_address`  | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | Collection the NFT belongs to.                    |
| `old_owner`           | `TEXT`                                   | `TEXT`                                  | `NULL` for minting events.                        |
| `new_owner`           | `TEXT NOT NULL`                          | `TEXT NOT NULL`                         | New owner address.                                |

**Constraints**

- `UNIQUE (transaction_hash, log_index)`.
- `FOREIGN KEY (block_number) REFERENCES blocks(block_number) ON DELETE CASCADE`.

**Indexes**

- `idx_nft_ownership_nft` (`nft_address`)
- `idx_nft_ownership_new_owner` (`new_owner`)
- `idx_nft_ownership_timestamp` (`timestamp`)
- `idx_nft_ownership_collection` (`collection_address`)

### 3.7 `account_snapshots`

Materialised "current state" view per NFT account. Updated as events
are inserted; readers consult this table for O(1) lookups.

| Column                       | SQLite                          | PostgreSQL                       | Description                                  |
|------------------------------|---------------------------------|----------------------------------|----------------------------------------------|
| `nft_address`                | `TEXT PRIMARY KEY`              | `TEXT PRIMARY KEY`               | NFT account.                                 |
| `current_owner`              | `TEXT`                          | `TEXT`                           | Latest known owner (NULL pre-mint).          |
| `current_state`              | `INTEGER NOT NULL DEFAULT 0`    | `INTEGER NOT NULL DEFAULT 0`     | Latest lock state.                           |
| `last_transfer_block`        | `INTEGER`                       | `BIGINT`                         | Most recent transfer block.                  |
| `last_state_change_block`    | `INTEGER`                       | `BIGINT`                         | Most recent state-change block.              |
| `last_updated`               | `INTEGER NOT NULL`              | `BIGINT NOT NULL`                | Wall-clock Unix seconds of the last write.   |

**Indexes**

- `idx_account_snapshots_owner` (`current_owner`)
- `idx_account_snapshots_state` (`current_state`)

### 3.8 `invoice_mappings`

Maps invoice IDs to the on-chain payload hash and the settlement
transaction. Built by the API layer for fast `GET /payments/:invoice_id`.

| Column             | SQLite                          | PostgreSQL                       | Description                                  |
|--------------------|---------------------------------|----------------------------------|----------------------------------------------|
| `invoice_id`       | `TEXT PRIMARY KEY`              | `TEXT PRIMARY KEY`               | Merchant-issued invoice identifier.          |
| `payload_hash`     | `TEXT NOT NULL`                 | `TEXT NOT NULL`                  | Hash committed on-chain by the payer.        |
| `transaction_hash` | `TEXT NOT NULL`                 | `TEXT NOT NULL`                  | First transaction whose payload matched.     |
| `created_at`       | `INTEGER NOT NULL`              | `BIGINT NOT NULL`                | Wall-clock Unix seconds of insertion.        |

**Indexes**

- `idx_invoice_mappings_payload_hash` (`payload_hash`)
- `idx_invoice_mappings_tx_hash` (`transaction_hash`)

---

## 4. SQLite ↔ PostgreSQL parity rules

To keep both backends behaviourally identical, migrations follow these
conventions:

| Concept                 | SQLite                                  | PostgreSQL                           |
|-------------------------|-----------------------------------------|--------------------------------------|
| Auto-incrementing key   | `INTEGER PRIMARY KEY AUTOINCREMENT`     | `BIGSERIAL PRIMARY KEY`              |
| 64-bit integer column   | `INTEGER` (stored as 64-bit by SQLite)  | `BIGINT`                             |
| Boolean                 | `BOOLEAN` stored as `0`/`1`             | `BOOLEAN` stored as `TRUE`/`FALSE`   |
| Upsert / idempotent ins.| `INSERT OR IGNORE` / `INSERT OR REPLACE`| `INSERT … ON CONFLICT … DO …`        |
| Conditional seed row    | `INSERT OR IGNORE`                      | `INSERT … ON CONFLICT DO NOTHING`    |
| Foreign-key cascade     | Requires `PRAGMA foreign_keys = ON`     | Enforced by default                  |

Application code paths that perform writes always pass the same logical
arguments — the dialect-specific UPSERT syntax is encapsulated in
`backend/indexer/src/db/database.ts`.

---

## 5. Reconstruction guarantee

Because every table is derived from on-chain events, the entire
database can be deleted and rebuilt by re-running the indexer from
`INDEXER_START_BLOCK`. A migration must therefore never embed business
data — only schema. Seed inserts are limited to the singleton
`indexer_state` row.
