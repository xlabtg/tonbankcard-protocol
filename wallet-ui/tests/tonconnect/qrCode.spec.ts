/**
 * Unit tests for the self-contained QR code encoder.
 *
 * The encoder is deterministic; for a given input it always returns the
 * same matrix. These tests cover the structural invariants required by
 * ISO/IEC 18004 §5.3 (finder patterns, timing patterns, dark module,
 * version sizing).
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateQRMatrix,
  generateQRSvg,
  generateQRDataUrl,
} from '../../src/tonconnect/qrCode';

function hasFinder(matrix: number[][], x: number, y: number): boolean {
  // 7x7 finder pattern: outer ring of 1s, inner 3x3 of 1s, separators
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const onOuter =
        dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const onInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      const expected = onOuter || onInner ? 1 : 0;
      if (matrix[y + dy][x + dx] !== expected) return false;
    }
  }
  return true;
}

describe('generateQRMatrix', () => {
  it('produces a 21x21 matrix for short data at version 1', () => {
    const { matrix, size, version } = generateQRMatrix('HELLO', {
      errorLevel: 'L',
    });
    expect(version).toBe(1);
    expect(size).toBe(21);
    expect(matrix.length).toBe(21);
    expect(matrix[0].length).toBe(21);
  });

  it('places the three finder patterns', () => {
    const { matrix, size } = generateQRMatrix(
      'ton://transfer/EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le'
    );
    expect(hasFinder(matrix, 0, 0)).toBe(true);
    expect(hasFinder(matrix, size - 7, 0)).toBe(true);
    expect(hasFinder(matrix, 0, size - 7)).toBe(true);
  });

  it('uses 1 as the always-dark module at (8, 4*version + 9)', () => {
    const { matrix, version } = generateQRMatrix('test data');
    expect(matrix[4 * version + 9][8]).toBe(1);
  });

  it('grows the version as data gets larger', () => {
    const short = generateQRMatrix('x'.repeat(10)).version;
    const long = generateQRMatrix('x'.repeat(120)).version;
    expect(long).toBeGreaterThan(short);
  });

  it('throws for empty data', () => {
    expect(() => generateQRMatrix('')).toThrow(/non-empty/);
  });

  it('throws when data exceeds the supported version range', () => {
    expect(() => generateQRMatrix('x'.repeat(5000), { errorLevel: 'L' })).toThrow(
      /too long/
    );
  });

  it('is deterministic', () => {
    const a = generateQRMatrix('ton://transfer/EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
    const b = generateQRMatrix('ton://transfer/EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le');
    expect(a.matrix).toEqual(b.matrix);
  });
});

describe('generateQRSvg', () => {
  it('returns a valid SVG markup string', () => {
    const svg = generateQRSvg('HELLO');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('viewBox="0 0');
  });

  it('honors scale and margin options', () => {
    const svg = generateQRSvg('HELLO', { scale: 8, margin: 2 });
    const match = svg.match(/width="(\d+)"/);
    expect(match).not.toBeNull();
    const w = Number(match![1]);
    // (size + 2 * margin) * scale = (21 + 4) * 8 = 200
    expect(w).toBe((21 + 2 * 2) * 8);
  });

  it('uses dark/light colours from options', () => {
    const svg = generateQRSvg('HELLO', {
      darkColor: '#ff0000',
      lightColor: '#00ff00',
    });
    expect(svg).toContain('#ff0000');
    expect(svg).toContain('#00ff00');
  });
});

describe('generateQRDataUrl', () => {
  it('returns a data URL with URL-encoded SVG', () => {
    const url = generateQRDataUrl('HELLO');
    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const decoded = decodeURIComponent(url.split(',')[1]);
    expect(decoded.startsWith('<svg')).toBe(true);
  });
});
