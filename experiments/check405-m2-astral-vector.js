// CHECK405-M2: compute the shared canonical bytes + SHA-256 for an
// astral-plane key-ordering fixture, replicating the TS canonicalJson exactly.
const crypto = require('crypto');

const U2028 = String.fromCharCode(0x2028);
const U2029 = String.fromCharCode(0x2029);

function enc(s) {
  return JSON.stringify(s)
    .split(U2028)
    .join('\\u2028')
    .split(U2029)
    .join('\\u2029');
}
function cmp(a, b) {
  const A = Array.from(a);
  const B = Array.from(b);
  const n = Math.min(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const d = A[i].codePointAt(0) - B[i].codePointAt(0);
    if (d) return d;
  }
  return A.length - B.length;
}
function canon(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return enc(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (typeof v === 'object')
    return (
      '{' +
      Object.keys(v)
        .sort(cmp)
        .map((k) => enc(k) + ':' + canon(v[k]))
        .join(',') +
      '}'
    );
}

const input = { b: 'x', '\u{E000}': 'pua', '\u{1F600}': 'emoji', a: 'z' };
const c = canon(input);
const h = crypto.createHash('sha256').update(c, 'utf8').digest('hex');
console.log('CANONICAL:', c);
console.log('SHA256:', h);
console.log('KEYS(codepoint):', JSON.stringify(Object.keys(input).sort(cmp)));
console.log('KEYS(default   ):', JSON.stringify(Object.keys(input).sort()));
