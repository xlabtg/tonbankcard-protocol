#!/usr/bin/env ts-node
// CLI entry point for schema migrations.
//
// Usage:
//   npm run db:migrate            # apply all pending migrations
//   npm run db:migrate:status     # show applied vs. pending migrations
//   npm run db:migrate:rollback   # roll back the most recent migration
//
// Direct invocation (with explicit subcommand or steps):
//   ts-node scripts/migrate.ts up
//   ts-node scripts/migrate.ts status
//   ts-node scripts/migrate.ts down [steps]
//
// Backend selection is automatic: PostgreSQL when `DATABASE_URL` is
// exported, SQLite otherwise (path from `DB_PATH`, defaulting to
// `./data/indexer.db`).

import path from 'path';
import dotenv from 'dotenv';
import { createDriverFromEnv } from '../src/db/drivers';
import { Migrator } from '../src/db/migrator';

dotenv.config();

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'src', 'db', 'migrations');

type Command = 'up' | 'down' | 'status';

function parseArgs(argv: string[]): { command: Command; steps: number } {
  const cmd = (argv[0] ?? 'up').toLowerCase();
  if (cmd === 'up' || cmd === 'status') {
    return { command: cmd, steps: 1 };
  }
  if (cmd === 'down' || cmd === 'rollback') {
    const steps = argv[1] ? Number.parseInt(argv[1], 10) : 1;
    if (!Number.isFinite(steps) || steps < 1) {
      throw new Error(`Invalid step count for rollback: ${argv[1]}`);
    }
    return { command: 'down', steps };
  }
  throw new Error(`Unknown migrate command: ${cmd}`);
}

function formatStatusTable(rows: Array<{ version: string; name: string; state: string; appliedAt?: number }>): string {
  if (rows.length === 0) return '(no migrations discovered)';
  const header = ['VERSION', 'NAME', 'STATE', 'APPLIED_AT'];
  const lines = rows.map((row) => [
    row.version,
    row.name,
    row.state,
    row.appliedAt ? new Date(row.appliedAt * 1000).toISOString() : '—',
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...lines.map((line) => line[i].length))
  );
  const renderLine = (cells: string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  return [renderLine(header), renderLine(widths.map((w) => '-'.repeat(w))), ...lines.map(renderLine)].join('\n');
}

async function main(): Promise<void> {
  const { command, steps } = parseArgs(process.argv.slice(2));
  const driver = await createDriverFromEnv();
  const migrator = new Migrator({ driver, migrationsDir: MIGRATIONS_DIR });
  try {
    if (command === 'up') {
      const applied = await migrator.up();
      console.log(`✓ Applied ${applied.length} migration(s)`);
      if (applied.length > 0) {
        for (const m of applied) {
          console.log(`  • ${m.version}_${m.name}`);
        }
      }
    } else if (command === 'down') {
      const rolled = await migrator.down(steps);
      console.log(`✓ Rolled back ${rolled.length} migration(s)`);
      for (const m of rolled) {
        console.log(`  • ${m.version}_${m.name}`);
      }
    } else {
      const status = await migrator.status();
      const rows: Array<{ version: string; name: string; state: string; appliedAt?: number }> = [];
      const appliedByVersion = new Map(status.applied.map((m) => [m.version, m] as const));
      const allVersions = new Set<string>([
        ...status.applied.map((m) => m.version),
        ...status.pending.map((m) => m.version),
      ]);
      const sorted = Array.from(allVersions).sort();
      for (const version of sorted) {
        const appliedRecord = appliedByVersion.get(version);
        const pending = status.pending.find((m) => m.version === version);
        const drift = status.drift.find((d) => d.version === version);
        if (appliedRecord) {
          rows.push({
            version,
            name: appliedRecord.name,
            state: drift ? 'applied (DRIFT)' : 'applied',
            appliedAt: appliedRecord.appliedAt,
          });
        } else if (pending) {
          rows.push({ version, name: pending.name, state: 'pending' });
        }
      }
      console.log(`Backend: ${status.dialect}`);
      console.log(formatStatusTable(rows));
      if (status.drift.length > 0) {
        console.error(
          `\n⚠ Detected ${status.drift.length} migration(s) with checksum drift. ` +
            'Inspect the changed files — applied migrations should be immutable.'
        );
        process.exitCode = 2;
      }
    }
  } finally {
    await migrator.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
