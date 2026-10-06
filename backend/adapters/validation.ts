/** Canonical TBC decimal, at most nine fractional digits, without floating point. */
export function isPositiveDecimal(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 80 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,9})?$/.test(value)) return false;
  const [whole, fractional = ''] = value.split('.');
  return BigInt(whole) * 1_000_000_000n + BigInt(fractional.padEnd(9, '0')) > 0n;
}
