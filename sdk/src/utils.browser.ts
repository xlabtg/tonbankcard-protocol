/**
 * Dependency-free helpers re-exported from the browser bundle.
 *
 * These mirror the implementations in `utils.ts` but avoid importing
 * `@ton/core` / `@ton/crypto`, which are not designed for direct use in
 * browsers without a bundler. Keeping the implementations in sync is enforced
 * by `utils.spec.ts`, which uses the same numeric semantics.
 */

export function formatTBC(nanocoins: bigint, decimals: number = 2): string {
  const tbc = Number(nanocoins) / 1e9;
  return tbc.toFixed(decimals);
}

export function parseTBC(tbc: string): bigint {
  const num = parseFloat(tbc);
  if (isNaN(num) || num < 0) {
    throw new Error('Invalid TBC amount');
  }
  return BigInt(Math.floor(num * 1e9));
}

export function serializeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeBigInt(val);
    }
    return result;
  }
  return value;
}
