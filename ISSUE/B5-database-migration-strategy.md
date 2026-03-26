---
name: "[B5] Database Migration Strategy"
about: Formalize database schema versioning, migration tooling, and backup procedures for the indexer
labels: type:backend
track: B
priority: medium
---

## 1. Goal

Formalize the database migration strategy for the payment indexer, which currently uses both SQLite (local development) and PostgreSQL (production). Establish schema versioning, migration tooling, and backup/recovery procedures.

## 2. Context

The `backend/indexer/` service uses `better-sqlite3` for local development and PostgreSQL for production. A `npm run db:migrate` command exists but lacks documentation and formal versioning. Without a clear migration strategy, schema changes during upgrades can silently corrupt the indexer's event cache or cause downtime.

Related to: [DEVELOPMENT_ROADMAP.md — Track B, B5](../TEMP/DEVELOPMENT_ROADMAP.md)

## 3. In Scope

- Schema documentation for all tables in `backend/indexer/src/db/`
- Schema versioning using a migration library (e.g., `knex`, `db-migrate`, or `node-pg-migrate`)
- Migration scripts for upgrading from any version to the latest
- Rollback migration scripts for downgrade safety
- Backup and recovery procedure documentation
- SQLite ↔ PostgreSQL parity verification (same migrations work for both)

## 4. Out of Scope

- Changing the core indexer logic or data model (only formalize what exists)
- Migration for smart contract on-chain state (immutable, no migration needed)
- API service database (API uses the indexer's database)

## 5. Functional Requirements

1. All database tables documented in `docs/database-schema.md`:
   - Table name, column names, types, constraints, indexes
   - Description of what each table stores

2. Schema versioning implemented:
   - Version table (`schema_version`) tracks current schema version
   - Each schema change has a numbered migration file (e.g., `001_initial.sql`, `002_add_lock_events.sql`)

3. Migration commands:
   - `npm run db:migrate` — applies pending migrations
   - `npm run db:migrate:rollback` — rolls back last migration
   - `npm run db:migrate:status` — shows applied vs. pending migrations

4. Both SQLite and PostgreSQL supported by the same migration files

5. Backup procedure documented in `docs/production/BACKUP.md`:
   - Frequency: daily automated backup
   - Retention: 30-day rolling window
   - Restore procedure: tested and verified

## 6. Non-Functional Requirements

- Migrations must be idempotent (safe to run multiple times)
- Migration process must complete within the service startup window (< 30 seconds for normal upgrades)
- Backup files must be compressed and checksummed
- Migration failures must halt service startup (not silently proceed with wrong schema)

## 7. Security Requirements

- Database credentials must never be committed to the repository
- Backup files must be encrypted at rest
- Migration scripts must not contain hardcoded data (only schema changes)
- Rollback scripts must be tested before production release

## 8. Acceptance Criteria

- [ ] All existing tables documented in `docs/database-schema.md`
- [ ] Migration library integrated into `backend/indexer/`
- [ ] Existing schema converted to migration `001_initial.sql`
- [ ] `npm run db:migrate`, `db:migrate:rollback`, and `db:migrate:status` commands working
- [ ] Both SQLite and PostgreSQL tested with the same migrations
- [ ] Backup procedure documented in `docs/production/BACKUP.md`
- [ ] Backup and restore procedure tested end-to-end on staging
- [ ] CI runs migrations against a clean database to verify they pass

## 9. References

- [Indexer](../backend/indexer/)
- [Production Docs](../docs/production/)
- [Architecture](../docs/architecture.md)
- Recommended migration library: `knex` (supports SQLite + PostgreSQL)
