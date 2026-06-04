/**
 * Dependency-free helpers re-exported from the browser bundle.
 *
 * These mirror the implementations in `utils.ts` but avoid importing
 * `@ton/core` / `@ton/crypto`, which are not designed for direct use in
 * browsers without a bundler. Amount helpers are shared through `amount.ts` so
 * the main and browser entry points use the same numeric semantics.
 */

export { formatTBC, parseTBC } from './amount';

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
