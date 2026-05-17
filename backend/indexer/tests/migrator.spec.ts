// Migration framework tests.
// Exercises the SQLite path end-to-end: discovery, up, down, status,
// idempotency, transaction rollback on failure, and checksum drift.

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Migrator } from '../src/db/migrator';
import { SqliteDriver } from '../src/db/drivers';

const PROJECT_MIGRATIONS = path.join(__dirname, '..', 'src', 'db', 'migrations');

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeMigration(
  baseDir: string,
  version: string,
  name: string,
  up: string,
  down: string
): void {
  const dir = path.join(baseDir, `${version}_${name}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'up.sqlite.sql'), up);
  fs.writeFileSync(path.join(dir, 'down.sqlite.sql'), down);
}

// Discover the actual list of shipped migrations from disk so this suite
// adapts to new migrations being added (e.g. 002_transparency). The
// foundational 001_initial migration is always present and the suite
// pins its semantics; subsequent versions are exercised generically.
const SHIPPED_VERSIONS: string[] = fs
  .readdirSync(PROJECT_MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^\d{3,}_/.test(entry.name))
  .map((entry) => entry.name.split('_')[0])
  .sort();
const LATEST_VERSION = SHIPPED_VERSIONS[SHIPPED_VERSIONS.length - 1];

describe('Migrator (SQLite)', () => {
  let workDir: string;
  let dbPath: string;
  let driver: SqliteDriver;

  beforeEach(() => {
    workDir = makeTempDir('migrator-test-');
    dbPath = path.join(workDir, 'test.db');
    driver = SqliteDriver.fromPath(dbPath);
  });

  afterEach(async () => {
    await driver.close();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  describe('with the shipped migrations', () => {
    it('starts with every shipped migration pending', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      const status = await migrator.status();
      expect(status.dialect).toBe('sqlite');
      expect(status.applied).toEqual([]);
      expect(status.pending.map((m) => m.version)).toEqual(SHIPPED_VERSIONS);
    });

    it('applies migration 001_initial and records it', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      const applied = await migrator.up();
      expect(applied.map((m) => m.version)).toEqual(SHIPPED_VERSIONS);
      const initial = applied.find((m) => m.version === '001');
      expect(initial).toBeDefined();
      expect(initial!.name).toBe('initial');
      expect(initial!.checksum).toMatch(/^[a-f0-9]{64}$/);

      const status = await migrator.status();
      expect(status.applied.map((m) => m.version)).toEqual(SHIPPED_VERSIONS);
      expect(status.pending).toEqual([]);
      expect(status.drift).toEqual([]);
    });

    it('creates every table documented in docs/database-schema.md', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      await migrator.up();

      const tables = (await driver.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )).map((row) => row.name);

      expect(tables).toEqual(
        expect.arrayContaining([
          'account_snapshots',
          'account_state_changes',
          'blocks',
          'indexer_state',
          'internal_transfers',
          'invoice_mappings',
          'merchant_payments',
          'nft_ownership_changes',
          'schema_migrations',
        ])
      );
    });

    it('seeds the singleton indexer_state row', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      await migrator.up();
      const rows = await driver.query<{ id: number; version: string }>(
        'SELECT id, version FROM indexer_state'
      );
      expect(rows).toEqual([{ id: 1, version: '1.0.0' }]);
    });

    it('is idempotent — running up twice is a no-op', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      await migrator.up();
      const second = await migrator.up();
      expect(second).toEqual([]);
    });

    it('rolls back the most recent migration', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      await migrator.up();
      const rolledBack = await migrator.down();
      expect(rolledBack.length).toBe(1);
      expect(rolledBack[0].version).toBe(LATEST_VERSION);

      const status = await migrator.status();
      expect(status.applied.map((m) => m.version)).toEqual(
        SHIPPED_VERSIONS.slice(0, -1)
      );
      expect(status.pending.map((m) => m.version)).toEqual([LATEST_VERSION]);
    });

    it('survives apply → rollback → re-apply cycle', async () => {
      const migrator = new Migrator({ driver, migrationsDir: PROJECT_MIGRATIONS });
      await migrator.up();
      await migrator.down(SHIPPED_VERSIONS.length);
      const reapplied = await migrator.up();
      expect(reapplied.map((m) => m.version)).toEqual(SHIPPED_VERSIONS);

      const tables = (await driver.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )).map((row) => row.name);
      expect(tables).toEqual(expect.arrayContaining(['blocks', 'merchant_payments']));
    });
  });

  describe('with synthetic migrations', () => {
    it('applies migrations in version order', async () => {
      const dir = path.join(workDir, 'migrations');
      writeMigration(dir, '001', 'first', 'CREATE TABLE a (id INTEGER);', 'DROP TABLE a;');
      writeMigration(dir, '002', 'second', 'CREATE TABLE b (id INTEGER);', 'DROP TABLE b;');
      writeMigration(dir, '003', 'third', 'CREATE TABLE c (id INTEGER);', 'DROP TABLE c;');

      const migrator = new Migrator({ driver, migrationsDir: dir });
      const applied = await migrator.up();
      expect(applied.map((m) => m.version)).toEqual(['001', '002', '003']);
    });

    it('rolls back multiple migrations in reverse order', async () => {
      const dir = path.join(workDir, 'migrations');
      writeMigration(dir, '001', 'first', 'CREATE TABLE a (id INTEGER);', 'DROP TABLE a;');
      writeMigration(dir, '002', 'second', 'CREATE TABLE b (id INTEGER);', 'DROP TABLE b;');

      const migrator = new Migrator({ driver, migrationsDir: dir });
      await migrator.up();
      const rolledBack = await migrator.down(2);
      expect(rolledBack.map((m) => m.version)).toEqual(['002', '001']);
    });

    it('rolls back the failing migration entirely (transaction safety)', async () => {
      const dir = path.join(workDir, 'migrations');
      // The second statement re-declares the table created by the first —
      // SQLite raises "table good already exists" mid-migration, so the
      // entire transaction must roll back without leaving the first table
      // behind.
      writeMigration(
        dir,
        '001',
        'broken',
        'CREATE TABLE good (id INTEGER); CREATE TABLE good (id INTEGER);',
        'DROP TABLE IF EXISTS good;'
      );

      const migrator = new Migrator({ driver, migrationsDir: dir });
      await expect(migrator.up()).rejects.toThrow();

      const tables = (await driver.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )).map((row) => row.name);
      expect(tables).not.toContain('good');
      // Nothing must be recorded in schema_migrations either.
      const recorded = await driver.query('SELECT version FROM schema_migrations');
      expect(recorded).toEqual([]);
    });

    it('detects checksum drift between recorded and current SQL', async () => {
      const dir = path.join(workDir, 'migrations');
      writeMigration(dir, '001', 'first', 'CREATE TABLE a (id INTEGER);', 'DROP TABLE a;');
      const migrator = new Migrator({ driver, migrationsDir: dir });
      await migrator.up();

      // Mutate the up.sql in place — simulates a developer editing an
      // already-applied migration (which is never allowed).
      fs.writeFileSync(
        path.join(dir, '001_first', 'up.sqlite.sql'),
        'CREATE TABLE a (id INTEGER, extra TEXT);'
      );

      const status = await migrator.status();
      expect(status.drift.length).toBe(1);
      expect(status.drift[0].version).toBe('001');
      expect(status.drift[0].recordedChecksum).not.toBe(status.drift[0].currentChecksum);
    });

    it('rejects duplicate version numbers at discovery time', () => {
      const dir = path.join(workDir, 'migrations');
      writeMigration(dir, '001', 'first', 'CREATE TABLE a (id INTEGER);', 'DROP TABLE a;');
      writeMigration(dir, '001', 'second', 'CREATE TABLE b (id INTEGER);', 'DROP TABLE b;');
      const migrator = new Migrator({ driver, migrationsDir: dir });
      expect(() => migrator.discover()).toThrow(/Duplicate migration version/);
    });

    it('reports a clean status when no migrations exist', async () => {
      const migrator = new Migrator({ driver, migrationsDir: path.join(workDir, 'empty') });
      const status = await migrator.status();
      expect(status.applied).toEqual([]);
      expect(status.pending).toEqual([]);
      expect(status.drift).toEqual([]);
    });
  });
});
