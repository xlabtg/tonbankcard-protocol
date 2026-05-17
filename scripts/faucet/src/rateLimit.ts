/**
 * Faucet rate limiter — per-wallet sliding window.
 *
 * In-memory by default; designed to be swapped for a Redis-backed store in
 * production sandboxes that run more than a single replica. The contract is
 * intentionally small (`consume`/`peek`/`reset`) so the same call sites can
 * back onto either store without further changes.
 */

export interface RateLimitDecision {
  /** True when the request fits inside the configured window. */
  allowed: boolean;
  /** Seconds the caller must wait before retrying when `allowed` is false. */
  retryAfterSeconds: number;
  /** Unix epoch (ms) when the next dispense becomes legal. 0 if allowed now. */
  nextAvailableAt: number;
}

export interface RateLimiterOptions {
  /** Window length in milliseconds (default: 1 hour). */
  windowMs?: number;
  /** Maximum allowed dispenses per address inside the window (default: 1). */
  maxPerWindow?: number;
  /** Optional clock injection for deterministic tests. */
  now?: () => number;
}

export const DEFAULT_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_MAX_PER_WINDOW = 1;

/**
 * Tracks recent dispense timestamps per normalised wallet address.
 *
 * The implementation purposely keeps the state per-address rather than global
 * so that one abusive wallet cannot lock the faucet for everyone.
 */
export class FaucetRateLimiter {
  private readonly windowMs: number;
  private readonly maxPerWindow: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxPerWindow = options.maxPerWindow ?? DEFAULT_MAX_PER_WINDOW;
    this.now = options.now ?? (() => Date.now());

    if (this.windowMs <= 0) {
      throw new Error('windowMs must be positive');
    }
    if (this.maxPerWindow <= 0) {
      throw new Error('maxPerWindow must be positive');
    }
  }

  /**
   * Check whether `address` is currently allowed to drain the faucet without
   * consuming the slot. Useful for `GET /faucet/status` endpoints.
   */
  peek(address: string): RateLimitDecision {
    const key = normaliseAddress(address);
    const now = this.now();
    const timestamps = this.activeTimestamps(key, now);
    return this.decide(timestamps, now);
  }

  /**
   * Attempt to consume a slot for `address`. When the request fits inside the
   * window the slot is recorded and `allowed: true` is returned; otherwise the
   * state is untouched and the caller is told when to retry.
   */
  consume(address: string): RateLimitDecision {
    const key = normaliseAddress(address);
    const now = this.now();
    const timestamps = this.activeTimestamps(key, now);
    const decision = this.decide(timestamps, now);

    if (decision.allowed) {
      timestamps.push(now);
      this.hits.set(key, timestamps);
    }

    return decision;
  }

  /**
   * Clear all rate-limit state. Intended for tests and for the weekly sandbox
   * reset documented in `docs/sandbox.md`.
   */
  reset(address?: string): void {
    if (address) {
      this.hits.delete(normaliseAddress(address));
    } else {
      this.hits.clear();
    }
  }

  /** Active address count, primarily for `/metrics` exporters. */
  size(): number {
    return this.hits.size;
  }

  private activeTimestamps(key: string, now: number): number[] {
    const cutoff = now - this.windowMs;
    const previous = this.hits.get(key) ?? [];
    const fresh = previous.filter((ts) => ts > cutoff);
    if (fresh.length !== previous.length) {
      this.hits.set(key, fresh);
    }
    return fresh;
  }

  private decide(timestamps: number[], now: number): RateLimitDecision {
    if (timestamps.length < this.maxPerWindow) {
      return { allowed: true, retryAfterSeconds: 0, nextAvailableAt: 0 };
    }
    const oldest = timestamps[0];
    const nextAvailableAt = oldest + this.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((nextAvailableAt - now) / 1000));
    return { allowed: false, retryAfterSeconds, nextAvailableAt };
  }
}

/**
 * Lower-case + trim a TON address so callers cannot abuse mixed-case
 * variations to bypass the limit. The faucet only cares about the workchain
 * + hash pair; we let strict validation happen in the route layer.
 */
export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}
