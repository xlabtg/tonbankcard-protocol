/**
 * Smoke tests for the merchant-demo Express server.
 *
 * Runs under the built-in `node:test` runner so the demo has zero test-time
 * dependencies. Invoked via `npm test` and by the root `bash scripts/test-all.sh`.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

process.env.DEMO_DISABLE_REMOTE = '1';
process.env.PORT = '0';

const { app, parseTbcToNanocoinsString, buildLocalInvoice } = require('./server');
const http = require('node:http');

function listenOnRandomPort() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function fetchFromServer(server, path, init = {}) {
  const { port } = server.address();
  return fetch(`http://127.0.0.1:${port}${path}`, init);
}

test('parseTbcToNanocoinsString — integer', () => {
  assert.equal(parseTbcToNanocoinsString('1'), '1000000000');
});

test('parseTbcToNanocoinsString — fractional', () => {
  assert.equal(parseTbcToNanocoinsString('1.50'), '1500000000');
  assert.equal(parseTbcToNanocoinsString('0.000000001'), '1');
});

test('parseTbcToNanocoinsString — rejects invalid input', () => {
  assert.throws(() => parseTbcToNanocoinsString('abc'));
  assert.throws(() => parseTbcToNanocoinsString('1.0000000001'));
  assert.throws(() => parseTbcToNanocoinsString('-1'));
});

test('buildLocalInvoice — deterministic shape', () => {
  const inv = buildLocalInvoice({
    merchantNft: 'EQTEST',
    amountTbcNanocoins: '1000000000',
    orderId: 'ORDER-1',
    description: 'demo',
  });
  assert.equal(typeof inv.id, 'string');
  assert.equal(inv.id.length, 64);
  assert.equal(inv.merchant_nft, 'EQTEST');
  assert.equal(inv.amount_tbc, '1000000000');
  assert.equal(inv.order_id, 'ORDER-1');
  assert.equal(inv.status, 'pending');
  assert.equal(inv.source, 'local-fallback');
});

test('GET /health returns ok', async () => {
  const server = await listenOnRandomPort();
  try {
    const res = await fetchFromServer(server, '/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    server.close();
  }
});

test('GET /api/config returns sandbox defaults', async () => {
  const server = await listenOnRandomPort();
  try {
    const res = await fetchFromServer(server, '/api/config');
    const body = await res.json();
    assert.equal(body.network, 'testnet');
    assert.ok(body.sandboxApiUrl);
    assert.ok(body.sandboxMerchantNft);
  } finally {
    server.close();
  }
});

test('POST /api/invoice falls back to local invoice when remote disabled', async () => {
  const server = await listenOnRandomPort();
  try {
    const res = await fetchFromServer(server, '/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountTbc: '2.5', orderId: 'TEST-1' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.invoice.amount_tbc, '2500000000');
    assert.equal(body.invoice.order_id, 'TEST-1');
    assert.equal(body.invoice.source, 'local-fallback');
  } finally {
    server.close();
  }
});

test('POST /webhook records events visible via /api/webhooks', async () => {
  const server = await listenOnRandomPort();
  try {
    const post = await fetchFromServer(server, '/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tonbankcard-environment': 'sandbox',
      },
      body: JSON.stringify({ event: 'payment.completed', invoice_id: 'abc' }),
    });
    assert.equal(post.status, 200);

    const list = await fetchFromServer(server, '/api/webhooks');
    const body = await list.json();
    assert.ok(body.count >= 1);
    assert.equal(body.events[0].body.event, 'payment.completed');
    assert.equal(body.events[0].headers['x-tonbankcard-environment'], 'sandbox');
  } finally {
    server.close();
  }
});

test('POST /api/invoice — rejects malformed amount', async () => {
  const server = await listenOnRandomPort();
  try {
    const res = await fetchFromServer(server, '/api/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountTbc: 'not-a-number' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_AMOUNT');
  } finally {
    server.close();
  }
});
