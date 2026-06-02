/**
 * `trust proxy` configuration
 *
 * Express must be told how many reverse proxies / load balancers sit in front
 * of the API before it can derive the real client address (`req.ip`) from the
 * `X-Forwarded-For` header. The rate limiters key on `req.ip`, so getting this
 * wrong has direct security consequences:
 *
 *   - Trusting *too little* (the default `false`) behind a load balancer makes
 *     every request appear to originate from the proxy. All clients then share
 *     a single per-IP bucket — one noisy client can lock everyone out (DoS).
 *
 *   - Trusting *too much* (blanket `true`, or more hops than actually exist)
 *     lets a client forge `X-Forwarded-For` and present an arbitrary client IP,
 *     bypassing the per-IP limiter entirely.
 *
 * The correct value therefore mirrors the deployment topology exactly. It is
 * read from the `TRUST_PROXY` environment variable so operators can tune it per
 * environment without code changes. The default is `false` (trust nothing),
 * which is safe for a direct-to-internet deployment with no proxy in front.
 *
 * Accepted `TRUST_PROXY` values (see the Express docs for `trust proxy`):
 *
 *   unset / "" / "false"   → false  (no proxy; `req.ip` is the socket address)
 *   "true"                 → true   (trust every hop — NOT recommended)
 *   "1", "2", …            → number (hop count: trust exactly N proxies)
 *   "loopback",            → string presets understood by Express
 *   "linklocal",
 *   "uniquelocal"
 *   "10.0.0.0/8,127.0.0.1" → string (comma-separated trusted IPs / CIDRs)
 *
 * @see https://expressjs.com/en/guide/behind-proxies.html
 * @see https://github.com/xlabtg/tonbankcard-protocol/issues/251
 */

/** Express accepts a boolean, a hop count, or an IP/CIDR/preset string. */
export type TrustProxySetting = boolean | number | string;

/** Name of the environment variable that configures the proxy trust. */
export const TRUST_PROXY_ENV = 'TRUST_PROXY';

/**
 * Parse a raw `TRUST_PROXY` value into the setting Express expects.
 *
 * Unknown / empty input falls back to `false` so a misconfiguration fails
 * closed (no proxy trust) rather than silently trusting forwarded headers.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  if (raw === undefined) return false;

  const value = raw.trim();
  if (value === '') return false;

  const lower = value.toLowerCase();
  if (lower === 'false') return false;
  if (lower === 'true') return true;

  // A bare positive integer is a hop count (trust exactly N proxies).
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  // Otherwise pass the string through: Express understands subnet presets
  // ("loopback", "linklocal", "uniquelocal") and comma-separated IP/CIDR lists.
  return value;
}

/**
 * Resolve the `trust proxy` setting from the environment.
 *
 * @param env Defaults to `process.env`; injectable for tests.
 */
export function getTrustProxySetting(env: NodeJS.ProcessEnv = process.env): TrustProxySetting {
  return parseTrustProxy(env[TRUST_PROXY_ENV]);
}

/**
 * Apply the configured `trust proxy` setting to an Express app and return the
 * resolved value. Emits a one-line log so operators can confirm the value that
 * is actually in effect, and warns when blanket trust (`true`) is enabled.
 */
export function configureTrustProxy(
  app: { set: (name: string, value: unknown) => unknown },
  env: NodeJS.ProcessEnv = process.env,
  logger: Pick<Console, 'log' | 'warn'> = console,
): TrustProxySetting {
  const setting = getTrustProxySetting(env);
  app.set('trust proxy', setting);

  if (setting === true) {
    logger.warn(
      `[trust proxy] ${TRUST_PROXY_ENV}=true trusts EVERY forwarding hop; a ` +
        'client can spoof X-Forwarded-For to bypass per-IP rate limiting. ' +
        'Prefer a hop count or trusted-proxy CIDR matching your topology.',
    );
  } else {
    logger.log(`[trust proxy] configured as ${JSON.stringify(setting)}`);
  }

  return setting;
}
