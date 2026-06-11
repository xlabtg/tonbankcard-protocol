// Standalone sanity-check of the new TS canonicalJson string/number logic.
// Built entirely from char codes to keep this source pure ASCII.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

function encodeCanonicalString(value) {
  return JSON.stringify(value)
    .replace(new RegExp(LS, 'g'), '\\u2028')
    .replace(new RegExp(PS, 'g'), '\\u2029');
}

const samples = {
  'line sep value': 'a' + LS + 'b',
  'para sep value': 'a' + PS + 'b',
  'html chars': "<a> & 'b'",
  control: '\b\f\t\n\r',
  'non-ascii': 'é中\u{1f600}',
};
for (const name of Object.keys(samples)) {
  const out = encodeCanonicalString(samples[name]);
  console.log(name.padEnd(18), '->', Buffer.from(out, 'utf8').toString('hex'));
}

function numCheck(value) {
  if (!Number.isInteger(value)) {
    return Number.isFinite(value) ? 'REJECT-float' : 'REJECT-nonfinite';
  }
  if (!Number.isSafeInteger(value)) return 'REJECT-unsafe';
  return value.toString();
}
const nums = [
  0, -42, 9007199254740991, -9007199254740991, 9007199254740992, 2.5, 1e16,
  1e-7, Infinity, NaN,
];
for (const v of nums) {
  console.log('num', String(v).padEnd(22), '->', numCheck(v));
}
