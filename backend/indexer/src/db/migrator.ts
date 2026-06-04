// Schema migrator for the Payment Status Indexer.
//
// Discovers numbered migration directories under `src/db/migrations/`
// and applies the dialect-specific (`*.sqlite.sql` / `*.postgres.sql`)
// up/down scripts in version order. A `schema_migrations` bookkeeping
// table tracks which versions have been applied to the current
// database. Re-running an already-applied migration is a no-op.
//
// Public surface:
//   - createMigrator(opts) → Migrator     // pick the backend from env
//   - migrator.up()                       // apply pending migrations
//   - migrator.down(steps)                // roll back the last N migrations
//   - migrator.status()                   // structured status report
//   - migrator.close()                    // release the underlying connection
//
// The CLI entry point lives at `scripts/migrate.ts`.

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type MigrationDialect = 'sqlite' | 'postgres';

export interface Migration {
  /** Three-digit (or longer) version string, e.g. "001". */
  version: string;
  /** Short human-readable slug, e.g. "initial". */
  name: string;
  /** Absolute path to the migration directory. */
  dir: string;
}

export interface AppliedMigration {
  version: string;
  name: string;
  appliedAt: number;
  checksum: string;
}

export interface MigrationStatus {
  dialect: MigrationDialect;
  applied: AppliedMigration[];
  pending: Migration[];
  drift: Array<{ version: string; recordedChecksum: string; currentChecksum: string }>;
}

/**
 * Lightweight DB driver façade — the migrator never touches the
 * concrete client directly, which keeps the SQLite / PostgreSQL split
 * confined to two small wrappers.
 */
export interface MigrationDriver {
  readonly dialect: MigrationDialect;
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface MigratorOptions {
  driver: MigrationDriver;
  migrationsDir: string;
  logger?: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

const DEFAULT_LOGGER = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(meta ? `[migrate] ${msg} ${JSON.stringify(meta)}` : `[migrate] ${msg}`),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(meta ? `[migrate] ${msg} ${JSON.stringify(meta)}` : `[migrate] ${msg}`),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(meta ? `[migrate] ${msg} ${JSON.stringify(meta)}` : `[migrate] ${msg}`),
};

const MIGRATION_DIR_RE = /^(\d{3,})_([A-Za-z0-9][A-Za-z0-9_-]*)$/;

export function compareMigrationVersions(
  a: { version: string },
  b: { version: string }
): number {
  const aVersion = BigInt(a.version);
  const bVersion = BigInt(b.version);
  if (aVersion < bVersion) return -1;
  if (aVersion > bVersion) return 1;
  return a.version.localeCompare(b.version, 'en');
}

export class Migrator {
  private readonly driver: MigrationDriver;
  private readonly migrationsDir: string;
  private readonly logger: NonNullable<MigratorOptions['logger']>;

  constructor(opts: MigratorOptions) {
    this.driver = opts.driver;
    this.migrationsDir = opts.migrationsDir;
    this.logger = opts.logger ?? DEFAULT_LOGGER;
  }

  /**
   * Discover migration directories on disk, sorted by version.
   * Directories that do not match the `NNN_name` pattern are ignored
   * with a warning — this avoids picking up README files etc.
   */
  discover(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }
    const entries = fs.readdirSync(this.migrationsDir, { withFileTypes: true });
    const migrations: Migration[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = MIGRATION_DIR_RE.exec(entry.name);
      if (!match) {
        this.logger.warn(`Ignoring non-migration directory: ${entry.name}`);
        continue;
      }
      migrations.push({
        version: match[1],
        name: match[2],
        dir: path.join(this.migrationsDir, entry.name),
      });
    }
    migrations.sort(compareMigrationVersions);

    // Reject duplicate version numbers — they would cause non-deterministic ordering.
    const seen = new Set<string>();
    for (const m of migrations) {
      if (seen.has(m.version)) {
        throw new Error(`Duplicate migration version: ${m.version}`);
      }
      seen.add(m.version);
    }
    return migrations;
  }

  /**
   * Returns the SQL for the requested direction in the active dialect.
   * Throws when the expected file is missing.
   */
  private readSql(migration: Migration, direction: 'up' | 'down'): string {
    const file = path.join(migration.dir, `${direction}.${this.driver.dialect}.sql`);
    if (!fs.existsSync(file)) {
      throw new Error(
        `Migration ${migration.version}_${migration.name} is missing ${direction}.${this.driver.dialect}.sql`
      );
    }
    return fs.readFileSync(file, 'utf-8');
  }

  private checksum(sql: string): string {
    return crypto.createHash('sha256').update(sql).digest('hex');
  }

  /** Ensure the bookkeeping table exists. Idempotent. */
  async ensureMetaTable(): Promise<void> {
    if (this.driver.dialect === 'sqlite') {
      await this.driver.exec(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           applied_at INTEGER NOT NULL,
           checksum TEXT NOT NULL
         )`
      );
    } else {
      await this.driver.exec(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           applied_at BIGINT NOT NULL,
           checksum TEXT NOT NULL
         )`
      );
    }
  }

  /** Read the full list of already-applied migrations, oldest first. */
  async listApplied(): Promise<AppliedMigration[]> {
    await this.ensureMetaTable();
    const rows = await this.driver.query<{
      version: string;
      name: string;
      applied_at: number | string;
      checksum: string;
    }>('SELECT version, name, applied_at, checksum FROM schema_migrations ORDER BY version ASC');
    return rows
      .map((row) => ({
        version: row.version,
        name: row.name,
        appliedAt: Number(row.applied_at),
        checksum: row.checksum,
      }))
      .sort(compareMigrationVersions);
  }

  /** Apply every migration that has not been recorded yet. */
  async up(): Promise<AppliedMigration[]> {
    await this.ensureMetaTable();
    const all = this.discover();
    const applied = await this.listApplied();
    const appliedVersions = new Set(applied.map((m) => m.version));

    const pending = all.filter((m) => !appliedVersions.has(m.version));
    if (pending.length === 0) {
      this.logger.info('No pending migrations');
      return [];
    }

    const newlyApplied: AppliedMigration[] = [];
    for (const migration of pending) {
      const sql = this.readSql(migration, 'up');
      const checksum = this.checksum(sql);
      this.logger.info(`Applying migration ${migration.version}_${migration.name}`);
      const appliedAt = Math.floor(Date.now() / 1000);
      await this.driver.transaction(async () => {
        await this.driver.exec(sql);
        if (this.driver.dialect === 'sqlite') {
          await this.driver.query(
            'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?, ?, ?, ?)',
            [migration.version, migration.name, appliedAt, checksum]
          );
        } else {
          await this.driver.query(
            'INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES ($1, $2, $3, $4)',
            [migration.version, migration.name, appliedAt, checksum]
          );
        }
      });
      newlyApplied.push({ version: migration.version, name: migration.name, appliedAt, checksum });
    }
    this.logger.info(`Applied ${newlyApplied.length} migration(s)`);
    return newlyApplied;
  }

  /** Roll back the most recently applied migrations (default: 1). */
  async down(steps = 1): Promise<AppliedMigration[]> {
    if (steps < 1) throw new Error('steps must be >= 1');
    await this.ensureMetaTable();
    const applied = await this.listApplied();
    if (applied.length === 0) {
      this.logger.info('Nothing to roll back');
      return [];
    }

    const all = this.discover();
    const byVersion = new Map(all.map((m) => [m.version, m] as const));

    const toRollback = applied.slice(-steps).reverse(); // newest first
    const rolledBack: AppliedMigration[] = [];
    for (const record of toRollback) {
      const migration = byVersion.get(record.version);
      if (!migration) {
        throw new Error(
          `Cannot roll back ${record.version}: migration files no longer exist on disk`
        );
      }
      const sql = this.readSql(migration, 'down');
      this.logger.info(`Rolling back migration ${migration.version}_${migration.name}`);
      await this.driver.transaction(async () => {
        await this.driver.exec(sql);
        if (this.driver.dialect === 'sqlite') {
          await this.driver.query('DELETE FROM schema_migrations WHERE version = ?', [
            migration.version,
          ]);
        } else {
          await this.driver.query('DELETE FROM schema_migrations WHERE version = $1', [
            migration.version,
          ]);
        }
      });
      rolledBack.push(record);
    }
    this.logger.info(`Rolled back ${rolledBack.length} migration(s)`);
    return rolledBack;
  }

  /** Return a structured status report (applied / pending / checksum drift). */
  async status(): Promise<MigrationStatus> {
    await this.ensureMetaTable();
    const all = this.discover();
    const applied = await this.listApplied();
    const appliedByVersion = new Map(applied.map((m) => [m.version, m] as const));

    const drift: MigrationStatus['drift'] = [];
    for (const record of applied) {
      const migration = all.find((m) => m.version === record.version);
      if (!migration) continue;
      const sql = this.readSql(migration, 'up');
      const current = this.checksum(sql);
      if (current !== record.checksum) {
        drift.push({ version: record.version, recordedChecksum: record.checksum, currentChecksum: current });
      }
    }

    const pending = all.filter((m) => !appliedByVersion.has(m.version));
    return { dialect: this.driver.dialect, applied, pending, drift };
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
