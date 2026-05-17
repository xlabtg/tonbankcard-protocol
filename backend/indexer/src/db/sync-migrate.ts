// Synchronous SQLite migration runner used during application startup.
//
// The async `Migrator` (./migrator.ts) is the canonical implementation
// and powers the `db:migrate` CLI; it supports both PostgreSQL and
// SQLite. For SQLite specifically, `better-sqlite3` is fully
// synchronous, so we can also expose a tiny sync façade that the
// `IndexerDatabase` constructor calls during startup. This means tests
// and the local indexer process never have to await migrations to be
// ready, while still going through the same migration files and the
// same `schema_migrations` bookkeeping table.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';

const MIGRATION_DIR_RE = /^(\d{3,})_([A-Za-z0-9][A-Za-z0-9_-]*)$/;

/**
 * Find the migrations directory relative to the caller. When the
 * service is run from source the file sits at `src/db/sync-migrate.ts`
 * and migrations live at `src/db/migrations/`. After `tsc`, the file is
 * at `dist/db/sync-migrate.js` and migrations are copied to
 * `dist/db/migrations/` (see `backend/indexer/Dockerfile`).
 */
export function locateMigrationsDir(callerDir: string): string {
  return path.join(callerDir, 'migrations');
}

interface DiscoveredMigration {
  version: string;
  name: string;
  upSqlPath: string;
}

function discoverSqliteMigrations(migrationsDir: string): DiscoveredMigration[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const result: DiscoveredMigration[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = MIGRATION_DIR_RE.exec(entry.name);
    if (!match) continue;
    const upSqlPath = path.join(migrationsDir, entry.name, 'up.sqlite.sql');
    if (!fs.existsSync(upSqlPath)) {
      throw new Error(`Migration ${entry.name} is missing up.sqlite.sql`);
    }
    result.push({ version: match[1], name: match[2], upSqlPath });
  }
  result.sort((a, b) => a.version.localeCompare(b.version, 'en'));
  const seen = new Set<string>();
  for (const m of result) {
    if (seen.has(m.version)) {
      throw new Error(`Duplicate migration version: ${m.version}`);
    }
    seen.add(m.version);
  }
  return result;
}

function ensureSchemaMigrationsTable(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       applied_at INTEGER NOT NULL,
       checksum TEXT NOT NULL
     )`
  );
}

/**
 * Apply every pending SQLite migration synchronously.
 *
 * Each migration runs inside its own transaction so a failure halves
 * the database back into a known-good state. Halting service startup
 * on migration failure is intentional — the indexer must never query
 * tables that haven't been created.
 */
export function applySqliteMigrationsSync(
  db: Database.Database,
  migrationsDir: string
): { applied: string[] } {
  ensureSchemaMigrationsTable(db);
  const discovered = discoverSqliteMigrations(migrationsDir);

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: string }>;
  const appliedSet = new Set(appliedRows.map((row) => row.version));

  const applied: string[] = [];
  for (const migration of discovered) {
    if (appliedSet.has(migration.version)) continue;
    const sql = fs.readFileSync(migration.upSqlPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const appliedAt = Math.floor(Date.now() / 1000);
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)'
      ).run(migration.version, migration.name, appliedAt, checksum);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to apply migration ${migration.version}_${migration.name}: ${message}`
      );
    }
    applied.push(`${migration.version}_${migration.name}`);
  }
  return { applied };
}
