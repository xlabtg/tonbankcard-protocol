/**
 * SSRF Guard for Outbound Webhook Delivery
 *
 * Merchant-supplied webhook URLs are attacker-controlled input. Without
 * validation a merchant can point a webhook at internal-only services or
 * the cloud metadata endpoint (`169.254.169.254`) and turn the API server
 * into a Server-Side Request Forgery (SSRF) proxy.
 *
 * This module enforces, both at registration and immediately before every
 * delivery:
 *
 *   - an HTTPS-only scheme allowlist,
 *   - rejection of any host that resolves to a loopback, link-local,
 *     private (RFC1918 / RFC4193), carrier-grade NAT, multicast, or
 *     otherwise reserved address (IPv4 and IPv6, including IPv4-mapped
 *     IPv6 forms such as `::ffff:169.254.169.254`),
 *   - an optional operator-configured allowlist of permitted hosts.
 *
 * Delivery callers must additionally pass `redirect: 'error'` to `fetch`
 * (a benign HTTPS front door can otherwise 302-redirect to an internal
 * target) and re-run {@link assertSafeWebhookUrl} at delivery time so the
 * host is re-resolved — this shrinks the DNS-rebinding window left open by
 * validating only at registration.
 *
 * @see api/src/services/WebhookService.ts
 * @see audit/findings/API-C2-webhook-ssrf.md
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/244
 */

import dns from 'dns';
import net from 'net';

/**
 * Raised when a webhook URL is rejected by the SSRF guard. The stable
 * {@link reason} is safe to log; the human-readable message intentionally
 * avoids echoing resolved internal IPs back to the caller.
 */
export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | 'invalid_url'
      | 'scheme_not_allowed'
      | 'host_not_allowed'
      | 'dns_resolution_failed'
      | 'blocked_address',
  ) {
    super(message);
    this.name = 'SsrfError';
  }
}

/** Resolves a hostname to a list of IP address strings. */
export type HostLookup = (host: string) => Promise<string[]>;

/** Options controlling {@link assertSafeWebhookUrl}. */
export interface SsrfGuardOptions {
  /**
   * Custom resolver. Defaults to a DNS lookup that returns every A/AAAA
   * record. Primarily an injection seam for tests; production code should
   * leave it unset so real DNS is used.
   */
  lookup?: HostLookup;
  /**
   * Operator allowlist of permitted hostnames (exact, case-insensitive
   * match). When non-empty, any host outside the list is rejected before
   * DNS resolution. Defaults to {@link readAllowHostsFromEnv}.
   */
  allowHosts?: string[];
}

/** Default DNS resolver: returns every resolved address for a host. */
const defaultLookup: HostLookup = async (host) => {
  const records = await dns.promises.lookup(host, { all: true });
  return records.map((r) => r.address);
};

/**
 * Read the operator allowlist from `WEBHOOK_HOST_ALLOWLIST` (comma or
 * whitespace separated). Empty/unset means "no allowlist" (all public
 * hosts permitted).
 */
export function readAllowHostsFromEnv(): string[] {
  const raw = process.env.WEBHOOK_HOST_ALLOWLIST;
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Blocked IPv4 CIDR ranges. Covers loopback, private, link-local
 * (including the `169.254.169.254` metadata address), CGNAT, multicast,
 * documentation/benchmark, and reserved space.
 */
const BLOCKED_IPV4_CIDRS: ReadonlyArray<string> = [
  '0.0.0.0/8', // "this" network / unspecified
  '10.0.0.0/8', // RFC1918 private
  '100.64.0.0/10', // RFC6598 carrier-grade NAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local (cloud metadata 169.254.169.254)
  '172.16.0.0/12', // RFC1918 private
  '192.0.0.0/24', // IETF protocol assignments
  '192.0.2.0/24', // TEST-NET-1 documentation
  '192.168.0.0/16', // RFC1918 private
  '198.18.0.0/15', // benchmarking
  '198.51.100.0/24', // TEST-NET-2 documentation
  '203.0.113.0/24', // TEST-NET-3 documentation
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved (includes 255.255.255.255 broadcast)
];

/**
 * Blocked IPv6 CIDR ranges. IPv4-mapped (`::ffff:0:0/96`) addresses are
 * unwrapped and checked against the IPv4 rules above instead.
 */
const BLOCKED_IPV6_CIDRS: ReadonlyArray<string> = [
  '::/128', // unspecified
  '::1/128', // loopback
  '::/96', // IPv4-compatible (deprecated)
  '64:ff9b::/96', // NAT64 (embeds IPv4 — treated conservatively)
  '100::/64', // discard-only
  '2001:db8::/32', // documentation
  'fc00::/7', // unique local address (RFC4193)
  'fe80::/10', // link-local
  'ff00::/8', // multicast
];

/** Convert dotted-quad IPv4 to a 32-bit BigInt. */
function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new SsrfError(`Malformed IPv4 address: ${ip}`, 'blocked_address');
  }
  let value = 0n;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      throw new SsrfError(`Malformed IPv4 address: ${ip}`, 'blocked_address');
    }
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

/** Convert a (possibly compressed, possibly IPv4-tailed) IPv6 to BigInt. */
function ipv6ToBigInt(ip: string): bigint {
  const malformed = () => new SsrfError(`Malformed IPv6 address: ${ip}`, 'blocked_address');

  // Strip an optional zone index (e.g. fe80::1%eth0).
  let head = ip.split('%')[0];

  // Pull a trailing embedded IPv4 (e.g. ::ffff:127.0.0.1) into two hextets.
  const tail: string[] = [];
  if (head.includes('.')) {
    const lastColon = head.lastIndexOf(':');
    if (lastColon < 0) throw malformed();
    const v4 = ipv4ToBigInt(head.slice(lastColon + 1));
    tail.push(((v4 >> 16n) & 0xffffn).toString(16));
    tail.push((v4 & 0xffffn).toString(16));
    head = head.slice(0, lastColon); // drop the IPv4 tail and its separator
  }

  const splitGroups = (s: string): string[] => (s.length === 0 ? [] : s.split(':'));

  const halves = head.split('::');
  if (halves.length > 2) throw malformed();

  const left = splitGroups(halves[0]);
  const right = halves.length === 2 ? splitGroups(halves[1]) : [];

  let expanded: string[];
  if (halves.length === 2) {
    // `::` expands to as many zero groups as are missing.
    const missing = 8 - (left.length + right.length + tail.length);
    if (missing < 0) throw malformed();
    expanded = [...left, ...Array(missing).fill('0'), ...right, ...tail];
  } else {
    expanded = [...left, ...tail];
  }

  if (expanded.length !== 8) throw malformed();

  let value = 0n;
  for (const group of expanded) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) throw malformed();
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return value;
}

interface ParsedCidr {
  base: bigint;
  mask: bigint;
}

/** Pre-parse a CIDR string into a base/mask pair for the given bit width. */
function parseCidr(cidr: string, bits: number, toBigInt: (ip: string) => bigint): ParsedCidr {
  const [addr, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  const hostBits = BigInt(bits - prefix);
  const mask = hostBits === 0n ? (1n << BigInt(bits)) - 1n : ~((1n << hostBits) - 1n) & ((1n << BigInt(bits)) - 1n);
  return { base: toBigInt(addr) & mask, mask };
}

const PARSED_IPV4 = BLOCKED_IPV4_CIDRS.map((c) => parseCidr(c, 32, ipv4ToBigInt));
const PARSED_IPV6 = BLOCKED_IPV6_CIDRS.map((c) => parseCidr(c, 128, ipv6ToBigInt));

/**
 * Return `true` if `ip` falls inside any blocked range. Unknown / invalid
 * inputs are treated as blocked (fail-closed).
 */
export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 0) return true; // not a literal IP → fail closed

  try {
    if (family === 4) {
      const value = ipv4ToBigInt(ip);
      return PARSED_IPV4.some((c) => (value & c.mask) === c.base);
    }

    // IPv6 — unwrap IPv4-mapped addresses and apply IPv4 rules to them.
    const lower = ip.toLowerCase();
    const mappedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mappedMatch) {
      return isBlockedAddress(mappedMatch[1]);
    }
    const hexMappedMatch = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMappedMatch) {
      const hi = parseInt(hexMappedMatch[1], 16);
      const lo = parseInt(hexMappedMatch[2], 16);
      const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      return isBlockedAddress(v4);
    }

    const value = ipv6ToBigInt(ip);
    return PARSED_IPV6.some((c) => (value & c.mask) === c.base);
  } catch {
    return true; // parsing failure → fail closed
  }
}

/**
 * Validate a merchant-supplied webhook URL against the SSRF policy.
 *
 * Throws {@link SsrfError} on any violation; resolves silently when the
 * destination is safe. Call this at registration *and* immediately before
 * each delivery so the host is re-resolved.
 *
 * @returns the parsed {@link URL} (handy for callers that want the host).
 */
export async function assertSafeWebhookUrl(
  rawUrl: string,
  options: SsrfGuardOptions = {},
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError('Webhook URL is not a valid URL', 'invalid_url');
  }

  if (parsed.protocol !== 'https:') {
    throw new SsrfError('Webhook URL must use the https scheme', 'scheme_not_allowed');
  }

  const host = parsed.hostname.toLowerCase();

  const allowHosts = (options.allowHosts ?? readAllowHostsFromEnv()).map((h) => h.toLowerCase());
  if (allowHosts.length > 0 && !allowHosts.includes(host)) {
    throw new SsrfError('Webhook host is not in the operator allowlist', 'host_not_allowed');
  }

  // A bare IP literal needs no DNS round-trip; check it directly.
  const literalFamily = net.isIP(host) || net.isIP(stripBrackets(host));
  if (literalFamily !== 0) {
    if (isBlockedAddress(stripBrackets(host))) {
      throw new SsrfError('Webhook host resolves to a blocked address', 'blocked_address');
    }
    return parsed;
  }

  const lookup = options.lookup ?? defaultLookup;
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new SsrfError('Webhook host could not be resolved', 'dns_resolution_failed');
  }

  if (!addresses || addresses.length === 0) {
    throw new SsrfError('Webhook host did not resolve to any address', 'dns_resolution_failed');
  }

  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      throw new SsrfError('Webhook host resolves to a blocked address', 'blocked_address');
    }
  }

  return parsed;
}

/** Strip the `[...]` wrapper from a bracketed IPv6 host, if present. */
function stripBrackets(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}
