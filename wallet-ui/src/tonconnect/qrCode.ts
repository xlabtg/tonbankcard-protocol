/**
 * TONBANKCARD Wallet UI - QR Code Generator
 *
 * Self-contained pure-TypeScript QR Code encoder following ISO/IEC 18004.
 * Used to render scannable QR codes for TON payment links at the point
 * of sale.
 *
 * Supports:
 * - Byte mode (8-bit data)
 * - Error correction levels L and M
 * - Versions 1 through 20 (matrix sizes 21x21 to 97x97; up to 858 bytes
 *   of payload at EC-L)
 * - SVG output (no canvas/DOM dependency for rendering)
 *
 * SECURITY NOTICE:
 * - QR contents are public; never embed secrets such as session keys.
 * - The encoder is deterministic: the same input always yields the same
 *   matrix (the optimal mask is selected by the standard penalty score).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type QRErrorLevel = 'L' | 'M';

/**
 * Options for {@link generateQRSvg} / {@link generateQRMatrix}.
 */
export interface QRCodeOptions {
  /** Error correction level (default: 'M') */
  errorLevel?: QRErrorLevel;

  /** Minimum QR version 1-20 (default: smallest fitting the data) */
  minVersion?: number;

  /** Pixel size of each module in SVG output (default: 4) */
  scale?: number;

  /** Quiet-zone border in modules (default: 4 per spec) */
  margin?: number;

  /** Dark module CSS color (default: '#000000') */
  darkColor?: string;

  /** Light module CSS color (default: '#ffffff') */
  lightColor?: string;
}

interface BlockInfo {
  ecCodewordsPerBlock: number;
  blocks: { count: number; dataCount: number }[];
}

/**
 * Total data codewords per (version, ecLevel) pair and the block layout
 * used for Reed-Solomon error correction. Source: ISO/IEC 18004 Table 9.
 *
 * Each entry is `[ecCodewordsPerBlock, g1Blocks, g1DataCount,
 * g2Blocks, g2DataCount]`. g2 may be zero, in which case all blocks
 * have the same data size.
 */
const BLOCK_TABLE: Record<QRErrorLevel, number[][]> = {
  L: [
    [7, 1, 19, 0, 0],
    [10, 1, 34, 0, 0],
    [15, 1, 55, 0, 0],
    [20, 1, 80, 0, 0],
    [26, 1, 108, 0, 0],
    [18, 2, 68, 0, 0],
    [20, 2, 78, 0, 0],
    [24, 2, 97, 0, 0],
    [30, 2, 116, 0, 0],
    [18, 2, 68, 2, 69],
    [20, 4, 81, 0, 0],
    [24, 2, 92, 2, 93],
    [26, 4, 107, 0, 0],
    [30, 3, 115, 1, 116],
    [22, 5, 87, 1, 88],
    [24, 5, 98, 1, 99],
    [28, 1, 107, 5, 108],
    [30, 5, 120, 1, 121],
    [28, 3, 113, 4, 114],
    [28, 3, 107, 5, 108],
  ],
  M: [
    [10, 1, 16, 0, 0],
    [16, 1, 28, 0, 0],
    [26, 1, 44, 0, 0],
    [18, 2, 32, 0, 0],
    [24, 2, 43, 0, 0],
    [16, 4, 27, 0, 0],
    [18, 4, 31, 0, 0],
    [22, 2, 38, 2, 39],
    [22, 3, 36, 2, 37],
    [26, 4, 43, 1, 44],
    [30, 1, 50, 4, 51],
    [22, 6, 36, 2, 37],
    [22, 8, 37, 1, 38],
    [24, 4, 40, 5, 41],
    [24, 5, 41, 5, 42],
    [28, 7, 45, 3, 46],
    [28, 10, 46, 1, 47],
    [26, 9, 43, 4, 44],
    [26, 3, 44, 11, 45],
    [26, 3, 41, 13, 42],
  ],
};

/**
 * Alignment pattern center coordinates per version (1-indexed).
 * Source: ISO/IEC 18004 Annex E.
 */
const ALIGNMENT_PATTERNS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

/**
 * Character-count indicator length (in bits) for byte mode per version.
 * Versions 1-9: 8 bits; versions 10-26: 16 bits.
 */
function charCountBits(version: number): number {
  return version < 10 ? 8 : 16;
}

function blockInfoFor(version: number, ec: QRErrorLevel): BlockInfo {
  const row = BLOCK_TABLE[ec][version - 1];
  if (!row) throw new Error(`unsupported QR version ${version}`);
  const [ecPer, g1, g1Data, g2, g2Data] = row;
  const blocks = [{ count: g1, dataCount: g1Data }];
  if (g2 > 0) blocks.push({ count: g2, dataCount: g2Data });
  return { ecCodewordsPerBlock: ecPer, blocks };
}

function dataCodewordsFor(version: number, ec: QRErrorLevel): number {
  const info = blockInfoFor(version, ec);
  return info.blocks.reduce((sum, b) => sum + b.count * b.dataCount, 0);
}

/**
 * Find the smallest QR version (≥ minVersion) that can fit `dataLen`
 * bytes in byte mode at the given EC level.
 */
function selectVersion(
  dataLen: number,
  ec: QRErrorLevel,
  minVersion: number
): number {
  for (let v = Math.max(1, minVersion); v <= 20; v++) {
    const totalDataBits = dataCodewordsFor(v, ec) * 8;
    const usedBits = 4 + charCountBits(v) + dataLen * 8;
    if (usedBits <= totalDataBits) return v;
  }
  throw new Error(
    `data too long for QR versions 1-20 at EC-${ec}: ${dataLen} bytes`
  );
}

// ---------------------------------------------------------------------------
// Galois Field GF(256) arithmetic for Reed-Solomon error correction
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGf(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

/**
 * Build the Reed-Solomon generator polynomial of degree `degree`.
 */
function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/**
 * Compute EC codewords for a single block via polynomial division.
 */
function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const generator = rsGenerator(ecLen);
  const out = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ out[0];
    out.copyWithin(0, 1);
    out[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        out[j] ^= gfMul(generator[j + 1], factor);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bit stream construction
// ---------------------------------------------------------------------------

class BitBuffer {
  private buffer: number[] = [];
  private length = 0;

  put(value: number, bits: number): void {
    for (let i = bits - 1; i >= 0; i--) {
      this.putBit(((value >>> i) & 1) === 1);
    }
  }

  putBit(bit: boolean): void {
    const bytePos = this.length >>> 3;
    if (bytePos >= this.buffer.length) this.buffer.push(0);
    if (bit) this.buffer[bytePos] |= 0x80 >>> (this.length & 7);
    this.length++;
  }

  bitLength(): number {
    return this.length;
  }

  bytes(): Uint8Array {
    return Uint8Array.from(this.buffer);
  }
}

/**
 * Build the final data + EC codeword sequence according to the spec's
 * interleaving rules (Section 8.6 of ISO/IEC 18004).
 */
function buildCodewords(
  data: Uint8Array,
  version: number,
  ec: QRErrorLevel
): Uint8Array {
  const info = blockInfoFor(version, ec);
  const totalData = dataCodewordsFor(version, ec);

  if (data.length !== totalData) {
    throw new Error(
      `internal: data length ${data.length} !== expected ${totalData}`
    );
  }

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (const group of info.blocks) {
    for (let i = 0; i < group.count; i++) {
      const slice = data.slice(offset, offset + group.dataCount);
      offset += group.dataCount;
      dataBlocks.push(slice);
      ecBlocks.push(rsEncode(slice, info.ecCodewordsPerBlock));
    }
  }

  const maxData = Math.max(...dataBlocks.map(b => b.length));
  const interleaved: number[] = [];

  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  for (let i = 0; i < info.ecCodewordsPerBlock; i++) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }

  return Uint8Array.from(interleaved);
}

function utf8Bytes(input: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(input);
  }
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return Uint8Array.from(out);
}

function encodeDataBytes(
  data: Uint8Array,
  version: number,
  ec: QRErrorLevel
): Uint8Array {
  const totalDataBits = dataCodewordsFor(version, ec) * 8;
  const bb = new BitBuffer();

  bb.put(0b0100, 4); // Byte mode indicator
  bb.put(data.length, charCountBits(version));
  for (const b of data) bb.put(b, 8);

  // Terminator (up to 4 zero bits) without overflowing
  const remaining = totalDataBits - bb.bitLength();
  bb.put(0, Math.min(4, remaining));

  // Pad to byte boundary
  while (bb.bitLength() % 8 !== 0) bb.putBit(false);

  // Pad bytes
  const pads = [0xec, 0x11];
  let i = 0;
  while (bb.bitLength() < totalDataBits) {
    bb.put(pads[i++ % pads.length], 8);
  }

  return bb.bytes();
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

type Matrix = number[][];
type ReservedMask = boolean[][];

function makeMatrix(size: number, fill = 0): Matrix {
  const m: Matrix = [];
  for (let i = 0; i < size; i++) m.push(new Array(size).fill(fill));
  return m;
}

function placeFinderPattern(
  m: Matrix,
  reserved: ReservedMask,
  x: number,
  y: number
): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= m.length || yy >= m.length) continue;
      const inOuter =
        (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
        (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6));
      const inInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      m[yy][xx] = inOuter || inInner ? 1 : 0;
      reserved[yy][xx] = true;
    }
  }
}

function placeAlignmentPattern(
  m: Matrix,
  reserved: ReservedMask,
  cx: number,
  cy: number
): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const xx = cx + dx;
      const yy = cy + dy;
      const onRing =
        Math.max(Math.abs(dx), Math.abs(dy)) === 2 ||
        (dx === 0 && dy === 0);
      m[yy][xx] = onRing ? 1 : 0;
      reserved[yy][xx] = true;
    }
  }
}

function reserveFormatArea(reserved: ReservedMask, size: number): void {
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[size - 1 - i][8] = true;
    reserved[8][size - 1 - i] = true;
  }
}

function placeTimingPatterns(m: Matrix, reserved: ReservedMask, size: number): void {
  for (let i = 8; i < size - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0;
    m[i][6] = i % 2 === 0 ? 1 : 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }
}

function placeDarkModule(m: Matrix, reserved: ReservedMask, version: number): void {
  m[4 * version + 9][8] = 1;
  reserved[4 * version + 9][8] = true;
}

function placeData(m: Matrix, reserved: ReservedMask, data: Uint8Array): void {
  const size = m.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let i = 0; i < 2; i++) {
        const x = right - i;
        if (reserved[y][x]) continue;
        const byte = data[bitIndex >>> 3] ?? 0;
        const bit = (byte >>> (7 - (bitIndex & 7))) & 1;
        m[y][x] = bit;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

function maskFn(pattern: number): (x: number, y: number) => boolean {
  switch (pattern) {
    case 0: return (x, y) => (x + y) % 2 === 0;
    case 1: return (_x, y) => y % 2 === 0;
    case 2: return (x, _y) => x % 3 === 0;
    case 3: return (x, y) => (x + y) % 3 === 0;
    case 4: return (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: throw new Error('mask pattern 0-7 expected');
  }
}

function cloneMatrix(m: Matrix): Matrix {
  return m.map(row => row.slice());
}

function applyMask(m: Matrix, reserved: ReservedMask, pattern: number): Matrix {
  const masked = cloneMatrix(m);
  const fn = maskFn(pattern);
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; x++) {
      if (!reserved[y][x] && fn(x, y)) masked[y][x] ^= 1;
    }
  }
  return masked;
}

// Format info: 5 bits (EC level + mask) + 10 BCH bits, XOR'd with 0x5412.
function formatInfoBits(ec: QRErrorLevel, mask: number): number {
  const ecBits = ec === 'L' ? 0b01 : 0b00;
  const data = (ecBits << 3) | mask;
  let bch = data;
  for (let i = 0; i < 10; i++) {
    bch = (bch << 1) ^ ((bch >>> 9) & 1 ? 0x537 : 0);
  }
  return (((data << 10) | (bch & 0x3ff)) ^ 0x5412) & 0x7fff;
}

function placeFormatInfo(m: Matrix, ec: QRErrorLevel, mask: number): void {
  const bits = formatInfoBits(ec, mask);
  const size = m.length;

  // Top-left placement: column 8 (rows 0..8 skipping 6), then row 8 (cols 7..0 skipping 6).
  for (let i = 0; i < 15; i++) {
    const bit = (bits >>> i) & 1;
    if (i < 6) {
      m[i][8] = bit;
    } else if (i === 6) {
      m[7][8] = bit;
    } else if (i === 7) {
      m[8][8] = bit;
    } else if (i === 8) {
      m[8][7] = bit;
    } else {
      m[8][14 - i] = bit;
    }
  }

  // Split placement: bottom-left column 8 (bits 0..6) + top-right row 8 (bits 7..14).
  for (let i = 0; i < 15; i++) {
    const bit = (bits >>> i) & 1;
    if (i < 7) {
      m[size - 1 - i][8] = bit;
    } else {
      m[8][size - 15 + i] = bit;
    }
  }

  m[size - 8][8] = 1; // Always-dark module (also set by placeDarkModule)
}

// Version info: 6 bits + 12 BCH bits, used for versions >= 7.
function versionInfoBits(version: number): number {
  let bch = version;
  for (let i = 0; i < 12; i++) {
    bch = (bch << 1) ^ ((bch >>> 11) & 1 ? 0x1f25 : 0);
  }
  return ((version << 12) | (bch & 0xfff)) & 0x3ffff;
}

function placeVersionInfo(m: Matrix, version: number): void {
  if (version < 7) return;
  const bits = versionInfoBits(version);
  const size = m.length;
  for (let i = 0; i < 18; i++) {
    const bit = (bits >>> i) & 1;
    const a = Math.floor(i / 3);
    const b = (i % 3) + size - 11;
    m[a][b] = bit;
    m[b][a] = bit;
  }
}

// Penalty score per ISO/IEC 18004 §8.8.2.
function penaltyScore(m: Matrix): number {
  const size = m.length;
  let score = 0;

  // Rule 1: runs of same-color modules in rows / columns
  for (let i = 0; i < size; i++) {
    let runRow = 1, runCol = 1;
    for (let j = 1; j < size; j++) {
      if (m[i][j] === m[i][j - 1]) {
        runRow++;
      } else {
        if (runRow >= 5) score += runRow - 2;
        runRow = 1;
      }
      if (m[j][i] === m[j - 1][i]) {
        runCol++;
      } else {
        if (runCol >= 5) score += runCol - 2;
        runCol = 1;
      }
    }
    if (runRow >= 5) score += runRow - 2;
    if (runCol >= 5) score += runCol - 2;
  }

  // Rule 2: 2x2 same-color blocks
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = m[y][x];
      if (m[y][x + 1] === v && m[y + 1][x] === v && m[y + 1][x + 1] === v) {
        score += 3;
      }
    }
  }

  // Rule 3: finder-like patterns 1011101 with light surround
  const pattern1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pattern2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size - 10; x++) {
      let m1 = true, m2 = true;
      for (let k = 0; k < 11; k++) {
        if (m[y][x + k] !== pattern1[k]) m1 = false;
        if (m[y][x + k] !== pattern2[k]) m2 = false;
        if (!m1 && !m2) break;
      }
      if (m1 || m2) score += 40;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size - 10; y++) {
      let m1 = true, m2 = true;
      for (let k = 0; k < 11; k++) {
        if (m[y + k][x] !== pattern1[k]) m1 = false;
        if (m[y + k][x] !== pattern2[k]) m2 = false;
        if (!m1 && !m2) break;
      }
      if (m1 || m2) score += 40;
    }
  }

  // Rule 4: proportion of dark modules
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) dark += m[y][x];
  }
  const ratio = (dark * 100) / (size * size);
  const deviation = Math.floor(Math.abs(ratio - 50) / 5) * 10;
  score += deviation;

  return score;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a QR code matrix for `data`. The returned 2D array is row-
 * major and indexed `[y][x]`, with 1 = dark, 0 = light.
 */
export function generateQRMatrix(
  data: string,
  options: QRCodeOptions = {}
): { matrix: number[][]; version: number; size: number } {
  const ec: QRErrorLevel = options.errorLevel ?? 'M';
  const minVersion = options.minVersion ?? 1;
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('data must be a non-empty string');
  }
  const bytes = utf8Bytes(data);
  const version = selectVersion(bytes.length, ec, minVersion);
  const size = 17 + 4 * version;

  const dataCodewords = encodeDataBytes(bytes, version, ec);
  const finalBits = buildCodewords(dataCodewords, version, ec);

  const reserved = makeMatrix(size, 0).map(r => r.map(() => false)) as ReservedMask;
  const base = makeMatrix(size, 0);

  placeFinderPattern(base, reserved, 0, 0);
  placeFinderPattern(base, reserved, size - 7, 0);
  placeFinderPattern(base, reserved, 0, size - 7);
  reserveFormatArea(reserved, size);
  for (const cy of ALIGNMENT_PATTERNS[version - 1]) {
    for (const cx of ALIGNMENT_PATTERNS[version - 1]) {
      if (reserved[cy][cx]) continue;
      placeAlignmentPattern(base, reserved, cx, cy);
    }
  }
  placeTimingPatterns(base, reserved, size);
  placeDarkModule(base, reserved, version);
  if (version >= 7) {
    // Reserve version info areas before placing data
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][size - 11 + j] = true;
        reserved[size - 11 + j][i] = true;
      }
    }
  }

  placeData(base, reserved, finalBits);

  let bestMask = 0;
  let bestScore = Infinity;
  let bestMatrix = base;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(base, reserved, mask);
    placeFormatInfo(candidate, ec, mask);
    placeVersionInfo(candidate, version);
    const score = penaltyScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestMatrix = candidate;
    }
  }
  void bestMask;

  return { matrix: bestMatrix, version, size };
}

/**
 * Render a QR code as an SVG string. Output is self-contained and
 * dependency-free; embed it via `innerHTML` or a `data:` URL.
 */
export function generateQRSvg(data: string, options: QRCodeOptions = {}): string {
  const { matrix, size } = generateQRMatrix(data, options);
  const scale = options.scale ?? 4;
  const margin = options.margin ?? 4;
  const darkColor = options.darkColor ?? '#000000';
  const lightColor = options.lightColor ?? '#ffffff';
  const dim = (size + margin * 2) * scale;

  const rects: string[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (matrix[y][x] === 1) {
        rects.push(
          `<rect x="${(x + margin) * scale}" y="${(y + margin) * scale}" width="${scale}" height="${scale}"/>`
        );
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${lightColor}"/>` +
    `<g fill="${darkColor}">${rects.join('')}</g>` +
    `</svg>`
  );
}

/**
 * Render a QR code as a `data:image/svg+xml` URL — convenient for use
 * as an `<img>` `src` attribute.
 */
export function generateQRDataUrl(data: string, options: QRCodeOptions = {}): string {
  const svg = generateQRSvg(data, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
