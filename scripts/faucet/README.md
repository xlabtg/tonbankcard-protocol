# TBC Faucet

Standalone service that dispenses testnet **TBC** tokens to integrators
working against the Tonbankcard sandbox (`sandbox.api.tonbankcard.com`). See
[`docs/sandbox.md`](../../docs/sandbox.md) for the full sandbox topology.

The faucet is **testnet-only** by construction:

- It refuses to start without `FAUCET_NETWORK` set to a non-mainnet value.
- It only knows how to call a `IDispenser` strategy; the default `DryRunDispenser`
  produces synthetic transaction hashes, so a misconfiguration can never move
  real funds.
- Per-address rate limiting (1 dispense / hour by default) is enforced before
  any signing path is reached.

---

## Quick start

```bash
cd scripts/faucet
npm install
npm run dev
# → http://localhost:4500

curl -s http://localhost:4500/health
curl -s -X POST http://localhost:4500/faucet/dispense \
  -H 'Content-Type: application/json' \
  -d '{"address":"0:0000000000000000000000000000000000000000000000000000000000000000"}'
```

The default `DryRunDispenser` returns a synthetic `txHash` so happy-path
integration can be exercised end-to-end without a funded faucet wallet.

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Liveness probe used by Docker / Kubernetes. |
| `GET`  | `/faucet/status` | Reports configured network, default amount, faucet wallet address, and reservoir balance. |
| `GET`  | `/faucet/status?address=…` | Adds the per-address rate-limit window: `allowedNow`, `nextAvailableAt`, `retryAfterSeconds`. |
| `POST` | `/faucet/dispense` | Body: `{ "address": "EQ…", "amount"?: "<nanocoins>" }`. Returns `{ ok, txHash, amountNanocoins, explorerUrl }`. |

Every response includes the `X-Tonbankcard-Environment: sandbox` header so
clients can verify they are talking to the sandbox and not production.

### Errors

| Status | `error.code` | Cause |
|--------|--------------|-------|
| 400 | `MISSING_FIELD` | Missing `address` body field. |
| 400 | `INVALID_ADDRESS` | `address` failed the raw / base64url shape check. |
| 422 | `AMOUNT_EXCEEDED` | `amount` exceeds `MAX_DISPENSE_NANOCOINS` (100 TBC). |
| 429 | `RATE_LIMIT_EXCEEDED` | This address already received a dispense in the active window. `Retry-After` header is set in seconds. |
| 500 | `INTERNAL_ERROR` | Underlying dispenser failed; the rate-limit slot is rolled back so the user can retry. |

---

## Configuration

| Env var | Default | Notes |
|---------|---------|-------|
| `FAUCET_PORT` | `4500` | TCP port to bind. |
| `FAUCET_HOST` | `0.0.0.0` | Bind address. |
| `FAUCET_NETWORK` | `ton-testnet` | Surfaced in `/faucet/status` and the dispense response. |
| `FAUCET_DEFAULT_DISPENSE_NANOCOINS` | `10000000000` (10 TBC) | Default amount per request when the caller omits `amount`. |
| `FAUCET_RATE_LIMIT_WINDOW_MS` | `3600000` (1 hour) | Sliding-window length per address. |
| `FAUCET_RATE_LIMIT_MAX` | `1` | Maximum dispenses per address inside the window. |
| `FAUCET_ALLOWED_ORIGINS` | _(empty — blocks browser CORS)_ | Comma-separated origins permitted by CORS for direct browser use. |

---

## Production hardening

Before exposing the faucet to the internet, the default `DryRunDispenser`
must be replaced with a real implementation. Implement `IDispenser` from
`src/server.ts` and wire it in `src/index.ts`:

```ts
class TonDispenser implements IDispenser {
  async dispense(address: string, amountNanocoins: bigint) {
    // 1. load mnemonic from KMS (never from disk)
    // 2. build TBC jetton transfer
    // 3. broadcast through testnet RPC
    return { txHash, amountNanocoins, network: 'ton-testnet', explorerUrl };
  }
}
```

Operational notes:

- Run multiple replicas behind a shared Redis-backed rate limiter (the
  in-memory limiter only protects a single process).
- Mount `/metrics` behind authentication and emit `faucet_dispense_total`,
  `faucet_rate_limit_rejections_total`, and `faucet_reservoir_balance` so the
  on-call dashboard can flag a drained reservoir.
- Cap monthly dispenses per IP at the load balancer in addition to the
  per-address limit enforced here.
- Set `FAUCET_ALLOWED_ORIGINS` to the documented sandbox dashboard origin
  only; never use `*`.

---

## Tests

```bash
cd scripts/faucet
npm install
npm test
```

The suite covers the rate limiter, address validation, and the HTTP surface
(including the rate-limit roll-over, sandbox header, and error mapping).

---

## File map

```
scripts/faucet/
├── Dockerfile            # multi-stage build → non-root runtime image
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── index.ts          # entry point — boots the express app
│   ├── server.ts         # createFaucetServer + DryRunDispenser
│   ├── rateLimit.ts      # FaucetRateLimiter (per-address sliding window)
│   └── validation.ts     # address + amount parsing
└── tests/
    ├── rateLimit.test.ts
    ├── server.test.ts
    └── validation.test.ts
```
