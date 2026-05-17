/**
 * Tonbankcard merchant-demo — reference Express.js merchant server.
 *
 * Demonstrates the three things every TONBANKCARD merchant needs to know:
 *
 *   1. INVOICE CREATION — server-side issuance of an invoice payload that
 *      the browser checkout widget can mount against. The default flow uses
 *      the public C3 sandbox (`SANDBOX_API_URL`) and fetches a real sandbox
 *      invoice; if that endpoint is unreachable (e.g. in a CI environment
 *      with no outbound network) the server falls back to a locally-signed
 *      invoice so the demo remains usable.
 *
 *   2. WIDGET EMBEDDING — the static `public/index.html` page loads the
 *      `@tonbankcard/merchant-sdk` browser bundle from a CDN and mounts
 *      `Tonbankcard.PaymentWidget` against the invoice returned by (1).
 *
 *   3. WEBHOOK RECEIPT — `POST /webhook` accepts payment notifications and
 *      stores them in memory. `GET /api/payments` exposes the list back to
 *      the page so the demo can show "payment received" without manual
 *      refresh.
 *
 * Non-custodial guarantees (see CONTRIBUTING.md §3, §5):
 *   - This server NEVER signs blockchain transactions.
 *   - This server NEVER stores user private keys.
 *   - All settlement is reported by the on-chain indexer; this demo trusts
 *     the user's wallet to broadcast the transaction and the C3 sandbox to
 *     observe it.
 *
 * Configuration (all optional — defaults target the public C3 sandbox so
 * `npm start` works with no environment variables, per Issue #125 §6):
 *
 *   PORT                       Demo HTTP port (default 8080).
 *   SANDBOX_API_URL            Upstream Merchant API base URL.
 *                              Default: https://sandbox.api.tonbankcard.com
 *   SANDBOX_MERCHANT_NFT       Recipient NFT card on testnet.
 *                              Default: the public sandbox-default merchant.
 *   SANDBOX_DEFAULT_AMOUNT_TBC Default checkout amount in TBC (decimal).
 *                              Default: 1.50
 *   DEMO_DISABLE_REMOTE        Set to 1 to never call the upstream sandbox
 *                              (useful for offline CI runs).
 */

'use strict';

const path = require('path');
const crypto = require('crypto');
const express = require('express');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const SANDBOX_API_URL = (
  process.env.SANDBOX_API_URL || 'https://sandbox.api.tonbankcard.com'
).replace(/\/+$/, '');
const SANDBOX_MERCHANT_NFT =
  process.env.SANDBOX_MERCHANT_NFT ||
  'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const SANDBOX_DEFAULT_AMOUNT_TBC =
  process.env.SANDBOX_DEFAULT_AMOUNT_TBC || '1.50';
const DEMO_DISABLE_REMOTE = process.env.DEMO_DISABLE_REMOTE === '1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const recentWebhooks = [];
const MAX_RECENT_WEBHOOKS = 20;

/**
 * Convert a decimal TBC string ("1.50") to the integer nanocoin
 * representation expected by the payment widget (1_500_000_000n). We render
 * it as a string because JSON cannot carry a bigint.
 */
function parseTbcToNanocoinsString(decimal) {
  const trimmed = String(decimal).trim();
  if (!/^\d+(\.\d{1,9})?$/.test(trimmed)) {
    throw new Error('Amount must be a decimal with up to 9 fractional digits');
  }
  const [whole, frac = ''] = trimmed.split('.');
  const padded = (frac + '000000000').slice(0, 9);
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  if (combined === '') return '0';
  return combined;
}

/**
 * Build a deterministic invoice id (sha256 of merchant + amount + orderId +
 * timestamp). Mirrors `TonbankcardSDK.createInvoice()` so the local fallback
 * payload looks indistinguishable from a sandbox-issued one to the widget.
 */
function buildLocalInvoice({ merchantNft, amountTbcNanocoins, orderId, description }) {
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + 60 * 60;
  const seed = [merchantNft, amountTbcNanocoins, orderId || '', String(createdAt)].join('|');
  const id = crypto.createHash('sha256').update(seed).digest('hex');
  return {
    id,
    merchant_nft: merchantNft,
    amount_tbc: amountTbcNanocoins,
    order_id: orderId,
    description,
    created_at: createdAt,
    expires_at: expiresAt,
    status: 'pending',
    source: 'local-fallback',
  };
}

async function fetchSandboxInvoice({ merchantNft, amountTbcNanocoins, orderId, description }) {
  if (DEMO_DISABLE_REMOTE || typeof fetch !== 'function') return null;
  const url = `${SANDBOX_API_URL}/v1/invoice/create`;
  const body = {
    merchant_nft: merchantNft,
    amount_tbc: amountTbcNanocoins,
    metadata: { order_id: orderId, description, source: 'merchant-demo' },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return { ...payload, source: 'c3-sandbox' };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- routes --------------------------------------------------------

app.get('/api/config', (_req, res) => {
  res.json({
    sandboxApiUrl: SANDBOX_API_URL,
    sandboxMerchantNft: SANDBOX_MERCHANT_NFT,
    sandboxDefaultAmountTbc: SANDBOX_DEFAULT_AMOUNT_TBC,
    faucetUrl: `${SANDBOX_API_URL}/faucet`,
    network: 'testnet',
    note: 'Sandbox values served from environment defaults. No mainnet.',
  });
});

app.post('/api/invoice', async (req, res) => {
  const { amountTbc, orderId, description, merchantNft } = req.body || {};
  let amountTbcNanocoins;
  try {
    amountTbcNanocoins = parseTbcToNanocoinsString(
      amountTbc || SANDBOX_DEFAULT_AMOUNT_TBC,
    );
  } catch (e) {
    return res.status(400).json({ error: { code: 'INVALID_AMOUNT', message: e.message } });
  }
  const orderIdResolved =
    orderId || `DEMO-${Date.now().toString(36).toUpperCase()}`;
  const merchantResolved = merchantNft || SANDBOX_MERCHANT_NFT;
  const payload = {
    merchantNft: merchantResolved,
    amountTbcNanocoins,
    orderId: orderIdResolved,
    description: description || `Merchant demo order ${orderIdResolved}`,
  };

  const remote = await fetchSandboxInvoice(payload);
  const invoice = remote || buildLocalInvoice(payload);
  res.json({ invoice });
});

/**
 * Webhook endpoint. In a real merchant integration this would:
 *   1. Verify the HMAC signature from the Merchant API (see merchant-api-spec.md)
 *   2. Look up the matching internal order
 *   3. Mark the order as paid only after re-verifying the on-chain tx
 *
 * The demo records the payload so the page can show "we received it".
 */
app.post('/webhook', (req, res) => {
  const event = {
    receivedAt: new Date().toISOString(),
    headers: {
      'content-type': req.headers['content-type'],
      'x-tonbankcard-environment': req.headers['x-tonbankcard-environment'],
      'x-tonbankcard-signature': req.headers['x-tonbankcard-signature'],
    },
    body: req.body,
  };
  recentWebhooks.unshift(event);
  if (recentWebhooks.length > MAX_RECENT_WEBHOOKS) {
    recentWebhooks.length = MAX_RECENT_WEBHOOKS;
  }
  res.json({ ok: true });
});

app.get('/api/webhooks', (_req, res) => {
  res.json({ count: recentWebhooks.length, events: recentWebhooks });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sandboxApiUrl: SANDBOX_API_URL });
});

/**
 * Serve the locally-built SDK browser bundle if available. This makes the
 * demo work offline / before the package has been published to npm: if
 * `sdk/dist/index.global.js` exists (i.e. `npm run build` succeeded at the
 * repo root), we serve it from `/vendor/tonbankcard.global.js`. The
 * `public/index.html` falls back to the CDN when this route 404s.
 */
const LOCAL_SDK_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'sdk',
  'dist',
  'index.global.js',
);
app.get('/vendor/tonbankcard.global.js', (_req, res) => {
  res.type('application/javascript');
  res.sendFile(LOCAL_SDK_PATH, (err) => {
    if (err) {
      res.status(404).type('text/plain').send(
        '// Local SDK bundle not found.\n// Run `npm run build` inside `sdk/` to populate sdk/dist/index.global.js.\n',
      );
    }
  });
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- start --------------------------------------------------------

function start() {
  return app.listen(PORT, HOST, () => {
    const url = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
    /* eslint-disable no-console */
    console.log(`\nTonbankcard merchant-demo listening on ${url}`);
    console.log(`  Sandbox API:    ${SANDBOX_API_URL}`);
    console.log(`  Merchant NFT:   ${SANDBOX_MERCHANT_NFT}`);
    console.log(`  Default amount: ${SANDBOX_DEFAULT_AMOUNT_TBC} TBC`);
    console.log(`  Faucet:         ${SANDBOX_API_URL}/faucet`);
    console.log(`\nOpen ${url} to try the checkout.`);
    /* eslint-enable no-console */
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start, parseTbcToNanocoinsString, buildLocalInvoice };
