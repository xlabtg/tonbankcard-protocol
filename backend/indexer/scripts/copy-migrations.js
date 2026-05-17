#!/usr/bin/env node
// Post-tsc step: copy SQL migration files from `src/db/migrations/` to
// `dist/db/migrations/` so the compiled service can load them at
// runtime (the synchronous bootstrap in `IndexerDatabase` and the
// `db:migrate` CLI both look there). tsc only compiles `.ts` sources,
// so this little helper picks up the SQL siblings.

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src', 'db', 'migrations');
const DST = path.resolve(__dirname, '..', 'dist', 'db', 'migrations');

function copyTree(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-migrations] source not found: ${src}`);
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, dstPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyTree(SRC, DST);
console.log(`[copy-migrations] migrations staged at ${DST}`);
