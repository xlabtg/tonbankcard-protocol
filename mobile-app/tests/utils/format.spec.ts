import { describe, it, expect } from '@jest/globals';
import {
  formatBalance,
  formatRecipient,
  formatPercentage,
  parseDecimalToNanocoins,
} from '../../src/lib/utils/format';

describe('formatBalance', () => {
  it('renders nanocoins with two decimal places and TBC suffix', () => {
    expect(formatBalance('1000000000')).toBe('1.00 TBC');
    expect(formatBalance('1234567890')).toBe('1.23 TBC');
    expect(formatBalance('0')).toBe('0.00 TBC');
  });
});

describe('formatRecipient', () => {
  it('shortens addresses but preserves short ones', () => {
    const short = 'EQAB';
    expect(formatRecipient(short)).toBe(short);
    const full = 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le';
    const formatted = formatRecipient(full);
    expect(formatted.length).toBeLessThan(full.length);
    expect(formatted).toContain('...');
  });
});

describe('formatPercentage', () => {
  it('renders fractions as percentages with one decimal', () => {
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(0.123)).toBe('12.3%');
    expect(formatPercentage(1)).toBe('100.0%');
  });
});

describe('parseDecimalToNanocoins', () => {
  it('converts whole numbers', () => {
    expect(parseDecimalToNanocoins('1')).toBe('1000000000');
    expect(parseDecimalToNanocoins('0')).toBe('0');
    expect(parseDecimalToNanocoins('123')).toBe('123000000000');
  });

  it('converts fractional values up to 9 decimal places', () => {
    expect(parseDecimalToNanocoins('0.1')).toBe('100000000');
    expect(parseDecimalToNanocoins('1.5')).toBe('1500000000');
    expect(parseDecimalToNanocoins('0.000000001')).toBe('1');
    expect(parseDecimalToNanocoins('12.345678901')).toBe('12345678901');
  });

  it('trims whitespace', () => {
    expect(parseDecimalToNanocoins('  2.5  ')).toBe('2500000000');
  });

  it('rejects empty, malformed, or over-precise values', () => {
    expect(() => parseDecimalToNanocoins('')).toThrow(/Empty amount/);
    expect(() => parseDecimalToNanocoins('   ')).toThrow(/Empty amount/);
    expect(() => parseDecimalToNanocoins('1.2.3')).toThrow(/Invalid TBC amount/);
    expect(() => parseDecimalToNanocoins('-1')).toThrow(/Invalid TBC amount/);
    expect(() => parseDecimalToNanocoins('abc')).toThrow(/Invalid TBC amount/);
    expect(() => parseDecimalToNanocoins('1.1234567890')).toThrow(/Invalid TBC amount/);
  });
});
