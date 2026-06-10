/*
 * Tact build driver for the Collateral Signal package (Issue #364).
 *
 * Why a programmatic driver instead of `tact --config tact.config.json`?
 * The deployable production contract lives at `contracts/CollateralSignal.tact`
 * and imports `contracts/types/*` and `contracts/interfaces/*`. The Tact CLI roots
 * its virtual filesystem at the directory of the config file and forbids any import
 * that escapes that root. Rooting at `contracts/collateral-signal/` would therefore
 * reject the production contract (it lives one level up). This driver roots the
 * compiler filesystem at `contracts/` so the production sources resolve, while
 * keeping every build artifact and project definition inside this package.
 *
 * This driver is the single source of truth for the build (there is intentionally
 * no `tact.config.json`, since the Tact CLI cannot express a root above its config
 * file). It compiles the deployable production contract STANDALONE to prove it has
 * NO test-only `RegisterNFTOwner` handler — NFT ownership is registered ONLY by the
 * trusted NFT Account Resolver via the gated `ResolveNFTOwner` handler.
 */
'use strict';

const path = require('path');
const { build } = require('@tact-lang/compiler/dist/pipeline/build');
const { createNodeFileSystem } = require('@tact-lang/compiler/dist/vfs/createNodeFileSystem');
const { Logger } = require('@tact-lang/compiler/dist/logger');

// Root the compiler filesystem at contracts/ so cross-package imports resolve.
const contractsRoot = path.resolve(__dirname, '..');
// Tact's bundled stdlib ships inside the compiler package.
const stdlibRoot = path.resolve(
  path.dirname(require.resolve('@tact-lang/compiler/package.json')),
  'stdlib',
);

// Project paths/outputs are relative to contractsRoot (the VFS root).
const PROJECTS = [
  {
    name: 'CollateralSignal',
    path: './collateral-signal/entry/CollateralSignal.tact',
    output: './collateral-signal/dist',
    options: { debug: true, external: true },
  },
];

async function main() {
  const project = createNodeFileSystem(contractsRoot, false);
  const stdlib = createNodeFileSystem(stdlibRoot, false);
  const logger = new Logger();

  let ok = true;
  for (const config of PROJECTS) {
    logger.info(`\u{1F4BC} Compiling project ${config.name} ...`);
    const built = await build({ config, project, stdlib, logger });
    ok = ok && built.ok;
    if (!built.ok) {
      for (const err of built.error || []) {
        console.error(err && err.message ? err.message : err);
      }
    }
  }

  if (!ok) {
    console.error('Tact compilation failed');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
