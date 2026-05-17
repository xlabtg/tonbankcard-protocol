import { defineConfig } from 'tsup';

/**
 * Three build artefacts are produced:
 *
 *   1. Main entry (CJS + ESM + .d.ts) — for Node and bundled SPAs.
 *   2. Browser entry (CJS + ESM + .d.ts) — same surface as main but limited
 *      to the dependency-free parts that work in browsers.
 *   3. IIFE bundle (`dist/index.global.js`) — for the vanilla HTML example
 *      and other `<script>`-tag integrations. Exposes the browser surface on
 *      `window.Tonbankcard`. All TON peer deps are intentionally excluded
 *      because the browser entry does not import them.
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'es2020',
  },
  {
    entry: { browser: 'src/browser.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    target: 'es2020',
  },
  {
    entry: { index: 'src/browser.ts' },
    format: 'iife',
    globalName: 'Tonbankcard',
    minify: true,
    sourcemap: true,
    target: 'es2020',
    outExtension: () => ({ js: '.global.js' }),
  },
]);
