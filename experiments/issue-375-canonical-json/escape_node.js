// Battery: how does Node JSON.stringify escape each interesting code point?
// Emits "<codepoint-hex>\t<utf8-hex-of-stringified>" lines.
const codepoints = [];
for (let c = 0x00; c <= 0x20; c++) codepoints.push(c);
codepoints.push(
  0x22, // "
  0x5c, // backslash
  0x2f, // /
  0x3c, // <
  0x3e, // >
  0x26, // &
  0x7f, // DEL
  0xe9, // é
  0x2028,
  0x2029,
  0x4e2d, // 中
  0x1f600 // 😀
);
for (const cp of codepoints) {
  const s = String.fromCodePoint(cp);
  const out = JSON.stringify(s);
  console.log(`${cp.toString(16).padStart(6, '0')}\t${Buffer.from(out, 'utf8').toString('hex')}`);
}
