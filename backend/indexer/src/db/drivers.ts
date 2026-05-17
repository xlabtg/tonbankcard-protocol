// Driver wrappers used by the schema migrator.
//
// Two concrete drivers are provided:
//   - SqliteDriver — wraps a `better-sqlite3` Database (already a dep).
//   - PostgresDriver — lazily requires the `pg` package so SQLite-only
//     deployments don't need it installed.
//
// The factory `createDriverFromEnv()` picks PostgreSQL when
// `DATABASE_URL` is set, SQLite otherwise.

import fs from 'fs';
import path from 'path';
import BetterSqlite from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { MigrationDriver } from './migrator';

export class SqliteDriver implements MigrationDriver {
  readonly dialect = 'sqlite' as const;
  private readonly db: Database.Database;
  private readonly ownsConnection: boolean;

  constructor(db: Database.Database, ownsConnection = true) {
    this.db = db;
    this.ownsConnection = ownsConnection;
    // Required for ON DELETE CASCADE behaviour.
    this.db.pragma('foreign_keys = ON');
  }

  static fromPath(dbPath: string): SqliteDriver {
    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new BetterSqlite(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    return new SqliteDriver(db, true);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    if (stmt.reader) {
      return stmt.all(...(params as never[])) as T[];
    }
    stmt.run(...(params as never[]));
    return [];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // better-sqlite3 is synchronous, but our migrator interface is async.
    // We can't use db.transaction() directly because it requires a sync
    // callback, so we open a transaction manually and roll it back on
    // any throw. SQLite does not support nested transactions; the
    // migrator never re-enters this method.
    this.db.exec('BEGIN');
    try {
      const result = await fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.ownsConnection) {
      this.db.close();
    }
  }
}

export class PostgresDriver implements MigrationDriver {
  readonly dialect = 'postgres' as const;

  private readonly client: any;


  constructor(client: any) {
    this.client = client;
  }

  static async fromUrl(databaseUrl: string): Promise<PostgresDriver> {
    let pg: typeof import('pg');
    try {
      // Lazy require — `pg` is an optional dependency so SQLite-only
      // deployments don't have to install it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      pg = require('pg');
    } catch {
      throw new Error(
        'PostgreSQL driver requested but the `pg` package is not installed. ' +
          'Run `npm install pg @types/pg` inside backend/indexer.'
      );
    }
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    return new PostgresDriver(client);
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.client.query(sql, params);
    return (result.rows ?? []) as T[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.client.query('BEGIN');
    try {
      const result = await fn();
      await this.client.query('COMMIT');
      return result;
    } catch (err) {
      await this.client.query('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

export interface DriverFromEnvOptions {
  /** Override DATABASE_URL detection (PostgreSQL when truthy). */
  databaseUrl?: string;
  /** SQLite file path; defaults to ./data/indexer.db. */
  sqlitePath?: string;
}

/**
 * Pick the right driver based on environment configuration. If
 * `databaseUrl` (or `DATABASE_URL`) is set, PostgreSQL is used;
 * otherwise SQLite is opened at `sqlitePath` (or `DB_PATH`, defaulting
 * to `./data/indexer.db`).
 */
export async function createDriverFromEnv(opts: DriverFromEnvOptions = {}): Promise<MigrationDriver> {
  const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.length > 0) {
    return PostgresDriver.fromUrl(databaseUrl);
  }
  const sqlitePath = opts.sqlitePath ?? process.env.DB_PATH ?? './data/indexer.db';
  return SqliteDriver.fromPath(sqlitePath);
}
