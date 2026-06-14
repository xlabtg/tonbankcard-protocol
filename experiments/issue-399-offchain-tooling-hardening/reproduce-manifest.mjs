#!/usr/bin/env node
// Issue #399 finding 1 — literal `startsWith('https://')` diverges from real
// URL parsing. Prints the divergence table; exits non-zero if any case where
// the two methods disagree is NOT present (i.e. the bug stopped reproducing).
const cases = [
  'https://x.app',
  'HTTPS://x.app',
  'Https://x.app',
  '  https://x.app',
  'https://',
  'https://#frag',
];

let divergences = 0;
for (const c of cases) {
  const viaStartsWith = c.startsWith('https://');
  let viaUrl;
  try {
    viaUrl = new URL(c).protocol === 'https:';
  } catch {
    viaUrl = false;
  }
  const flag = viaStartsWith === viaUrl ? ' ' : '✗';
  if (viaStartsWith !== viaUrl) divergences += 1;
  console.log(
    `${flag} ${JSON.stringify(c).padEnd(20)} startsWith=${viaStartsWith}\turl=${viaUrl}`,
  );
}

console.log(`\n${divergences} divergent case(s) — these are the manifest parsing bugs.`);
process.exit(divergences > 0 ? 0 : 1);
