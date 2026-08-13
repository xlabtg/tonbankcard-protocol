import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('vulnerable image-size package is absent from the locked tree', async () => {
  const lock = JSON.parse(
    await readFile(path.join(siteDir, 'package-lock.json'), 'utf8'),
  );
  const packages = Object.keys(lock.packages);
  assert.equal(packages.some((name) => /(^|\/)image-size$/.test(name)), false);
});

test('vendored MDX loader never imports or calls an image parser', async () => {
  const loaderDir = path.join(siteDir, 'vendor', 'docusaurus-mdx-loader');
  const packageJson = JSON.parse(
    await readFile(path.join(loaderDir, 'package.json'), 'utf8'),
  );
  assert.equal(packageJson.dependencies['image-size'], undefined);

  const transform = await readFile(
    path.join(loaderDir, 'lib', 'remark', 'transformImage', 'index.js'),
    'utf8',
  );
  assert.doesNotMatch(transform, /require\(["']image-size|imageSizeFromFile/);
});
