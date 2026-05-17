/*
 * Vanilla HTML example for @tonbankcard/merchant-sdk.
 *
 * The SDK browser bundle is loaded by index.html via a <script> tag and
 * exposed as the global `Tonbankcard`. We use:
 *
 *   - `Tonbankcard.PaymentWidget`  → renders the inline payment card
 *   - `Tonbankcard.parseTBC`       → "1.50" → 1_500_000_000n
 *   - `Tonbankcard.serializeBigInt`→ JSON-safe serialisation for debug output
 *
 * The example deliberately avoids any framework, build step, or bundler so
 * that merchants can drop the snippet into a static page and ship it.
 */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.Tonbankcard) {
    document.getElementById('error').hidden = false;
    document.getElementById('error').textContent =
      'Failed to load @tonbankcard/merchant-sdk from the CDN. ' +
      'Check the <script> URL in index.html or your network connection.';
    return;
  }

  var SDK = window.Tonbankcard;

  var els = {
    merchantNft: document.getElementById('merchantNft'),
    orderId: document.getElementById('orderId'),
    amountTbc: document.getElementById('amountTbc'),
    createBtn: document.getElementById('createInvoice'),
    error: document.getElementById('error'),
    success: document.getElementById('success'),
    checkoutCard: document.getElementById('checkoutCard'),
    invoiceMeta: document.getElementById('invoiceMeta'),
    invoiceJson: document.getElementById('invoiceJson'),
    container: document.getElementById('tonbankcard-checkout'),
  };

  // Generate a fresh order id for each page load so the demo is replayable.
  els.orderId.value = 'ORDER-' + Date.now().toString(36).toUpperCase();

  var currentWidget = null;

  function showError(message) {
    els.error.hidden = false;
    els.error.textContent = message;
  }

  function clearError() {
    els.error.hidden = true;
    els.error.textContent = '';
  }

  function shortAddress(addr) {
    if (!addr || addr.length <= 14) return addr || '';
    return addr.slice(0, 8) + '…' + addr.slice(-6);
  }

  /**
   * Mirror of `TonbankcardSDK.createInvoice` for the browser-only bundle.
   * The full SDK derives a deterministic invoice ID via SHA-256, which
   * requires `@ton/crypto`; for the demo we use the Web Crypto API directly
   * so that no Node-only dependency is required.
   */
  async function buildInvoice(params) {
    var encoder = new TextEncoder();
    var seed = [
      params.merchantNft,
      params.amountTbcNanocoins.toString(),
      params.orderId || '',
      String(Math.floor(Date.now() / 1000)),
    ].join('|');
    var digest = await crypto.subtle.digest('SHA-256', encoder.encode(seed));
    var id = Array.from(new Uint8Array(digest))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
    return {
      id: id,
      merchantNft: params.merchantNft,
      amountTbc: params.amountTbcNanocoins,
      orderId: params.orderId,
      description: params.description,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
    };
  }

  els.createBtn.addEventListener('click', async function () {
    clearError();
    els.success.hidden = true;

    var merchantNft = els.merchantNft.value.trim();
    var orderId = els.orderId.value.trim();
    var amountTbcRaw = els.amountTbc.value.trim();

    if (!merchantNft) {
      showError('Enter a testnet merchant NFT address.');
      return;
    }

    var amountTbcNanocoins;
    try {
      amountTbcNanocoins = SDK.parseTBC(amountTbcRaw);
    } catch (e) {
      showError(e.message);
      return;
    }

    var invoice;
    try {
      invoice = await buildInvoice({
        merchantNft: merchantNft,
        amountTbcNanocoins: amountTbcNanocoins,
        orderId: orderId,
        description: 'Vanilla HTML demo order ' + orderId,
      });
    } catch (e) {
      showError('Failed to build invoice: ' + e.message);
      return;
    }

    els.checkoutCard.hidden = false;
    els.invoiceMeta.innerHTML =
      'Invoice <code>' + invoice.id.slice(0, 12) + '…</code> · ' +
      '<strong>' + (Number(invoice.amountTbc) / 1e9).toFixed(2) + ' TBC</strong>' +
      ' · merchant <code>' + shortAddress(invoice.merchantNft) + '</code>';
    els.invoiceJson.textContent = JSON.stringify(
      SDK.serializeBigInt(invoice),
      null,
      2,
    );

    if (currentWidget) currentWidget.unmount();
    els.container.innerHTML = '';

    currentWidget = new SDK.PaymentWidget({
      containerId: els.container.id,
      merchantNft: invoice.merchantNft,
      amountTbc: invoice.amountTbc.toString(),
      orderId: invoice.orderId,
      description: invoice.description,
      mode: 'inline',
      theme: 'light',
      onError: function (err) { showError(err.message); },
    });
    currentWidget.mount();
  });

  /**
   * Listen for the wallet's return-URL callback. In production you would set
   * `returnUrl` on the widget to a dedicated /payment/return page; here we
   * just look at `?tx=` on focus so the demo can be exercised manually.
   */
  function readReturnHash() {
    var params = new URLSearchParams(window.location.search);
    var tx = params.get('tx');
    if (tx) {
      els.success.hidden = false;
      els.success.innerHTML =
        'Payment reported by wallet: <code>' + tx + '</code>.<br>' +
        'Verify it on-chain (e.g. tonscan.org) before granting access.';
    }
  }
  window.addEventListener('focus', readReturnHash);
  readReturnHash();
})();
