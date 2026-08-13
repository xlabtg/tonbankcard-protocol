/* Build the deployable PaymentHub source used by scripts/deploy. */
'use strict';

const path = require('path');
const { build } = require('@tact-lang/compiler/dist/pipeline/build');
const { createNodeFileSystem } = require('@tact-lang/compiler/dist/vfs/createNodeFileSystem');
const { Logger } = require('@tact-lang/compiler/dist/logger');

const contractsRoot = path.resolve(__dirname, '..');
const stdlibRoot = path.resolve(
  path.dirname(require.resolve('@tact-lang/compiler/package.json')),
  'stdlib',
);

const projects = [
  {
    name: 'account-state',
    path: './payment-hub/account-state.tact',
    output: './payment-hub/dist',
    options: { debug: true, external: true, experimental: { inline: true } },
  },
  {
    name: 'PaymentHub',
    path: './payments/PaymentHub.tact',
    output: './payment-hub/dist',
    options: { debug: true, external: true, experimental: { inline: true } },
  },
];

async function main() {
  const project = createNodeFileSystem(contractsRoot, false);
  const stdlib = createNodeFileSystem(stdlibRoot, false);
  const logger = new Logger();
  let ok = true;

  for (const config of projects) {
    const result = await build({ config, project, stdlib, logger });
    ok = ok && result.ok;
  }

  if (!ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
