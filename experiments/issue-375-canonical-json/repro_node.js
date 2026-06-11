// PC-06 reproduction (Node) — mirrors sdk/src/utils.ts canonicalJson before the fix.
// Prints hex-encoded UTF-8 bytes of the canonical output so we can byte-compare
// across SDKs.

function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (typeof value === 'string' || typeof value === 'boolean')
    return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  throw new TypeError('unsupported');
}

const cases = {
  line_sep: { note: 'line sep' },
  para_sep: { note: 'para sep' },
  float_int: { v: 2.0 },
  float_big: { v: 1e16 },
  float_small: { v: 1e-7 },
  float_frac: { v: 2.5 },
};

for (const [name, value] of Object.entries(cases)) {
  let out;
  try {
    out = canonicalJson(value);
  } catch (e) {
    console.log(`${name}\tERROR\t${e.message}`);
    continue;
  }
  const hex = Buffer.from(out, 'utf8').toString('hex');
  console.log(`${name}\t${JSON.stringify(out)}\t${hex}`);
}
