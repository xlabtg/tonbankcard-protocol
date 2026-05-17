import { describe, it, expect } from '@jest/globals';
import { FaucetRateLimiter, normaliseAddress } from '../src/rateLimit';

describe('FaucetRateLimiter', () => {
  const ADDR = 'EQAbcDefGhiJklMnoPqrStuVwxYz0123456789ABCDEFGHIjk';
  const ADDR_VARIANT = '  eqabcdefghijklmnopqrstuvwxyz0123456789abcdefghijk  ';

  it('allows the first dispense and records the slot', () => {
    let now = 1_700_000_000_000;
    const limiter = new FaucetRateLimiter({ windowMs: 60_000, maxPerWindow: 1, now: () => now });
    const decision = limiter.consume(ADDR);
    expect(decision.allowed).toBe(true);
    expect(decision.retryAfterSeconds).toBe(0);
  });

  it('rejects a second dispense within the window', () => {
    let now = 1_700_000_000_000;
    const limiter = new FaucetRateLimiter({ windowMs: 60_000, maxPerWindow: 1, now: () => now });

    expect(limiter.consume(ADDR).allowed).toBe(true);
    now += 10_000;
    const second = limiter.consume(ADDR);

    expect(second.allowed).toBe(false);
    expect(second.retryAfterSeconds).toBeGreaterThanOrEqual(49);
    expect(second.nextAvailableAt).toBe(1_700_000_000_000 + 60_000);
  });

  it('treats mixed-case / whitespace variants of the same address as one identity', () => {
    let now = 1_700_000_000_000;
    const limiter = new FaucetRateLimiter({ windowMs: 60_000, maxPerWindow: 1, now: () => now });

    expect(limiter.consume(ADDR).allowed).toBe(true);
    const variantDecision = limiter.consume(ADDR_VARIANT);

    expect(variantDecision.allowed).toBe(false);
  });

  it('permits a fresh dispense once the window rolls over', () => {
    let now = 1_700_000_000_000;
    const limiter = new FaucetRateLimiter({ windowMs: 60_000, maxPerWindow: 1, now: () => now });

    expect(limiter.consume(ADDR).allowed).toBe(true);
    now += 60_001;
    const followUp = limiter.consume(ADDR);
    expect(followUp.allowed).toBe(true);
  });

  it('peek() does not consume a slot', () => {
    let now = 1_700_000_000_000;
    const limiter = new FaucetRateLimiter({ windowMs: 60_000, maxPerWindow: 1, now: () => now });

    expect(limiter.peek(ADDR).allowed).toBe(true);
    expect(limiter.peek(ADDR).allowed).toBe(true);
    expect(limiter.consume(ADDR).allowed).toBe(true);
    expect(limiter.peek(ADDR).allowed).toBe(false);
  });

  it('reset(address) clears state for that address only', () => {
    let now = 1_700_000_000_000;
    const limiter = new FaucetRateLimiter({ windowMs: 60_000, maxPerWindow: 1, now: () => now });
    const OTHER = '0:' + 'a'.repeat(64);

    limiter.consume(ADDR);
    limiter.consume(OTHER);
    limiter.reset(ADDR);

    expect(limiter.consume(ADDR).allowed).toBe(true);
    expect(limiter.consume(OTHER).allowed).toBe(false);
  });

  it('rejects pathological constructor arguments', () => {
    expect(() => new FaucetRateLimiter({ windowMs: 0 })).toThrow();
    expect(() => new FaucetRateLimiter({ maxPerWindow: 0 })).toThrow();
  });
});

describe('normaliseAddress', () => {
  it('lower-cases and trims', () => {
    expect(normaliseAddress('  EQAbc  ')).toBe('eqabc');
  });
});
