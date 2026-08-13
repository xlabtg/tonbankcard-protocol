'use strict';

const path = require('path');
require('ts-node').register({
  transpileOnly: true,
  project: path.resolve(__dirname, '../../tsconfig.deploy.json'),
});

const compilerRoot = path.dirname(require.resolve('@tact-lang/compiler/package.json'));
const { build } = require(path.join(compilerRoot, 'dist/pipeline/build'));
const { createNodeFileSystem } = require(path.join(compilerRoot, 'dist/vfs/createNodeFileSystem'));
const { Logger } = require(path.join(compilerRoot, 'dist/logger'));
const { scanPhase4Artifact } = require('../../scripts/deploy/phase4-release-gate');

const repoRoot = path.resolve(__dirname, '../..');
const stdlibRoot = path.resolve(compilerRoot, 'stdlib');
const outputRoot = path.resolve(__dirname, 'dist');
const names = ['RecurringPayments', 'MultiSigCard', 'CrossChainBridge', 'LendingProtocolCoordinator'];
const harnessOutputs = {
  MultiSigCard: './contracts/multisig/dist',
  LendingProtocolCoordinator: './contracts/lending/dist',
};
const projects = names.flatMap(name => [
  { name, path: `./contracts/${name}.tact`, output: `./contracts/phase4/dist/${name}` },
  {
    name: `${name}Harness`,
    path: `./contracts/phase4/test/${name}Harness.tact`,
    output: harnessOutputs[name] || `./contracts/phase4/dist/${name}Harness`,
  },
]);

async function main() {
  const logger = new Logger();
  for (const config of projects) {
    const result = await build({
      config: { ...config, options: { debug: false, external: true, experimental: { inline: true } } },
      project: createNodeFileSystem(repoRoot, false),
      stdlib: createNodeFileSystem(stdlibRoot, false),
      logger,
    });
    if (!result.ok) throw new Error(`Tact compilation failed: ${config.name}`);
  }
  for (const name of names) {
    const base = path.join(outputRoot, name, `${name}_${name}`);
    const failures = scanPhase4Artifact(`${base}.abi`, `${base}.code.boc`);
    if (failures.length) throw new Error(`${name} release artifact rejected:\n${failures.join('\n')}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
