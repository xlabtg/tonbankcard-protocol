/**
 * TBC faucet entry point.
 *
 * Boots the express app configured by `createFaucetServer` and listens on the
 * configured port. Production sandbox deployments are expected to swap the
 * default `DryRunDispenser` for a real `TonDispenser` connected to a faucet
 * wallet — see `scripts/faucet/README.md` §"Production hardening".
 */

import { createFaucetServer, DryRunDispenser } from './server';
import { FaucetRateLimiter } from './rateLimit';
import { DEFAULT_DISPENSE_NANOCOINS } from './validation';

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value <= 0 || value > 65_535) {
    throw new Error(`FAUCET_PORT must be a TCP port in [1, 65535] (got ${raw})`);
  }
  return value;
}

function parseBigIntEnv(raw: string | undefined, fallback: bigint): bigint {
  if (!raw) return fallback;
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`Expected an integer for env var, got "${raw}"`);
  }
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

function start(): void {
  const port = parsePort(process.env.FAUCET_PORT, 4500);
  const host = process.env.FAUCET_HOST || '0.0.0.0';
  const network = process.env.FAUCET_NETWORK || 'ton-testnet';
  const defaultDispense = parseBigIntEnv(
    process.env.FAUCET_DEFAULT_DISPENSE_NANOCOINS,
    DEFAULT_DISPENSE_NANOCOINS,
  );
  const windowMs = parseBigIntEnv(
    process.env.FAUCET_RATE_LIMIT_WINDOW_MS,
    BigInt(60 * 60 * 1000),
  );
  const maxPerWindow = parseBigIntEnv(process.env.FAUCET_RATE_LIMIT_MAX, 1n);

  const rateLimiter = new FaucetRateLimiter({
    windowMs: Number(windowMs),
    maxPerWindow: Number(maxPerWindow),
  });

  const app = createFaucetServer({
    dispenser: new DryRunDispenser(network),
    rateLimiter,
    defaultDispenseNanocoins: defaultDispense,
    network,
    allowedOrigins: parseAllowedOrigins(process.env.FAUCET_ALLOWED_ORIGINS),
  });

  app.listen(port, host, () => {
    console.log(`[faucet] listening on http://${host}:${port}`);
    console.log(`[faucet] network=${network} defaultDispense=${defaultDispense.toString()}`);
  });
}

if (require.main === module) {
  start();
}

export { createFaucetServer, DryRunDispenser } from './server';
export { FaucetRateLimiter, normaliseAddress } from './rateLimit';
export {
  assertValidTonAddress,
  isValidTonAddress,
  parseDispenseAmount,
  DEFAULT_DISPENSE_NANOCOINS,
  MAX_DISPENSE_NANOCOINS,
  FaucetValidationError,
} from './validation';
