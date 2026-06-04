/**
 * TBC faucet HTTP server.
 *
 * Exposes a thin REST surface that integrators can call from their CI or local
 * dev environment to top up a testnet wallet with TBC:
 *
 *   GET  /health                  → liveness probe
 *   GET  /faucet/status           → faucet configuration, balance hints
 *   GET  /faucet/status?address=X → per-address rate-limit window
 *   POST /faucet/dispense         → request a dispense for `{ address }`
 *
 * The server is intentionally stateless apart from the in-memory rate limiter
 * — in production it expects to sit behind a load balancer with a shared
 * Redis-backed limiter and a single signing key held in KMS.
 *
 * Funds are dispensed by an injected `IDispenser` strategy so callers can
 * plug in either:
 *   - `DryRunDispenser`   (default; logs the intent and returns a synthetic txHash)
 *   - a real `TonDispenser` that signs a TBC jetton transfer via a faucet wallet
 *
 * The sandbox never holds mainnet funds, so loss of the faucet key only
 * affects testnet token distribution.
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { FaucetRateLimiter } from './rateLimit';
import {
  assertValidTonAddress,
  DEFAULT_DISPENSE_NANOCOINS,
  FaucetValidationError,
  parseDispenseAmount,
} from './validation';

export interface IDispenser {
  /** Hand out `amountNanocoins` TBC to `address` and return the transaction hash. */
  dispense(address: string, amountNanocoins: bigint): Promise<DispenseResult>;
  /** Optional balance hint reported by `GET /faucet/status`. */
  reservoirBalance?(): Promise<bigint | null>;
  /** Symbolic faucet wallet address, surfaced in `GET /faucet/status`. */
  walletAddress?: string;
}

export interface DispenseResult {
  txHash: string;
  amountNanocoins: bigint;
  network: string;
  explorerUrl?: string;
}

export interface FaucetServerOptions {
  dispenser: IDispenser;
  rateLimiter?: FaucetRateLimiter;
  /** Default dispense amount in TBC nanocoins (overrides per-request defaults). */
  defaultDispenseNanocoins?: bigint;
  /** Surfaced in `/faucet/status`; e.g. `ton-testnet`. */
  network?: string;
  /** CORS origins. Empty array (default) blocks browser callers entirely. */
  allowedOrigins?: string[];
  /** Logger; defaults to `console`. */
  logger?: Pick<Console, 'info' | 'warn' | 'error'>;
}

const SANDBOX_HEADERS: Record<string, string> = {
  'X-Tonbankcard-Environment': 'sandbox',
};

export function createFaucetServer(options: FaucetServerOptions): Express {
  const {
    dispenser,
    rateLimiter = new FaucetRateLimiter(),
    defaultDispenseNanocoins = DEFAULT_DISPENSE_NANOCOINS,
    network = 'ton-testnet',
    allowedOrigins = [],
    logger = console,
  } = options;

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2kb' }));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      credentials: false,
    }),
  );

  app.use((_req, res, next) => {
    for (const [name, value] of Object.entries(SANDBOX_HEADERS)) {
      res.setHeader(name, value);
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', network, timestamp: new Date().toISOString() });
  });

  app.get('/faucet/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = typeof req.query.address === 'string' ? req.query.address : undefined;
      const reservoir = dispenser.reservoirBalance ? await dispenser.reservoirBalance() : null;
      const rateLimitConfig = rateLimiter.getConfig();
      const baseStatus = {
        network,
        defaultDispenseNanocoins: defaultDispenseNanocoins.toString(),
        walletAddress: dispenser.walletAddress ?? null,
        reservoirBalanceNanocoins: reservoir !== null ? reservoir.toString() : null,
        rateLimit: {
          windowSeconds: Math.ceil(rateLimitConfig.windowMs / 1000),
          maxPerWindow: rateLimitConfig.maxPerWindow,
        },
      };
      if (address) {
        const trimmed = assertValidTonAddress(address);
        const decision = rateLimiter.peek(trimmed);
        return res.json({
          ...baseStatus,
          address: trimmed,
          allowedNow: decision.allowed,
          nextAvailableAt: decision.nextAvailableAt
            ? new Date(decision.nextAvailableAt).toISOString()
            : null,
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }
      return res.json(baseStatus);
    } catch (err) {
      next(err);
    }
  });

  app.post('/faucet/dispense', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const address = assertValidTonAddress(req.body?.address);
      const amount = parseDispenseAmount(req.body?.amount ?? defaultDispenseNanocoins);

      const decision = rateLimiter.consume(address);
      if (!decision.allowed) {
        res.setHeader('Retry-After', String(decision.retryAfterSeconds));
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Faucet rate limit exceeded. Each address may request once per hour.`,
            details: {
              retryAfterSeconds: decision.retryAfterSeconds,
              nextAvailableAt: new Date(decision.nextAvailableAt).toISOString(),
            },
          },
        });
      }

      try {
        const result = await dispenser.dispense(address, amount);
        logger.info(
          `[faucet] dispensed ${amount.toString()} nanocoins to ${address} → tx=${result.txHash}`,
        );
        return res.status(200).json({
          ok: true,
          address,
          amountNanocoins: result.amountNanocoins.toString(),
          network: result.network,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        });
      } catch (dispenseErr) {
        rateLimiter.reset(address);
        throw dispenseErr;
      }
    } catch (err) {
      next(err);
    }
  });

  app.use(((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof FaucetValidationError) {
      const status = err.code === 'AMOUNT_EXCEEDED' ? 422 : 400;
      return res.status(status).json({
        error: { code: err.code, message: err.message },
      });
    }
    logger.error('[faucet] unexpected error', err);
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal faucet error' },
    });
  }) as express.ErrorRequestHandler);

  return app;
}

/**
 * Dry-run dispenser used by the default sandbox deployment. It logs the
 * intent and produces a deterministic synthetic transaction hash so that
 * integrators can wire up their happy-path even before a real signing wallet
 * is provisioned.
 */
export class DryRunDispenser implements IDispenser {
  readonly walletAddress = '0:dryrun000000000000000000000000000000000000000000000000000000000000';

  constructor(private readonly network: string = 'ton-testnet') {}

  async dispense(address: string, amountNanocoins: bigint): Promise<DispenseResult> {
    const seed = `${address}|${amountNanocoins.toString()}|${Date.now()}`;
    const txHash = await sha256Hex(seed);
    return {
      txHash,
      amountNanocoins,
      network: this.network,
      explorerUrl: `https://testnet.tonscan.org/tx/${txHash}`,
    };
  }

  async reservoirBalance(): Promise<bigint | null> {
    return null;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(input).digest('hex');
}
