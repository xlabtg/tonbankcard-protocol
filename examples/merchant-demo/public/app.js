/*
 * Tonbankcard merchant-demo — browser controller.
 *
 * Responsibilities:
 *   1. Load sandbox config from /api/config (filled from server-side env).
 *   2. Render a tiny catalogue and let the user pick a product.
 *   3. POST /api/invoice to obtain an invoice payload (sandbox or local).
 *   4. Mount Tonbankcard.PaymentWidget against the invoice.
 *   5. Poll /api/webhooks every 2 seconds and surface incoming events.
 *
 * Non-custodial: this script never asks for a mnemonic. The wallet signs
 * the transaction; we just verify on-chain status.
 */
(function () {
  'use strict';

  var SDK = window.Tonbankcard;
  if (!SDK || !SDK.PaymentWidget) {
    var banner = document.createElement('p');
    banner.className = 'error';
    banner.innerHTML =
      'The <code>@tonbankcard/merchant-sdk</code> browser bundle did not load. ' +
      'The demo will still create invoices and receive webhooks; only the ' +
      'embedded payment widget is unavailable. ' +
      'To restore it, run <code>cd sdk &amp;&amp; npm install &amp;&amp; npm run build</code> ' +
      'so the local bundle at <code>/vendor/tonbankcard.global.js</code> is populated.';
    document.querySelector('main').insertBefore(banner, document.querySelector('main').firstChild);
  }
  var els = {
    productList: document.getElementById('productList'),
    checkoutCard: document.getElementById('checkoutCard'),
    invoiceMeta: document.getElementById('invoiceMeta'),
    invoiceJson: document.getElementById('invoiceJson'),
    container: document.getElementById('tonbankcard-checkout'),
    webhookList: document.getElementById('webhookList'),
    error: document.getElementById('error'),
    faucetLink: document.getElementById('faucetLink'),
  };

  var CATALOGUE = [
    { id: 'coffee',   name: 'Espresso',     amountTbc: '0.50', desc: 'Single shot, sandbox priced' },
    { id: 'bagel',    name: 'Bagel + jam',  amountTbc: '1.50', desc: 'Demo default — matches faucet drop' },
    { id: 'merch',    name: 'TONBANKCARD T-shirt', amountTbc: '12.00', desc: 'Larger amount for indexer stress-test' },
  ];

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
    if (!addr || addr.length <= 16) return addr || '';
    return addr.slice(0, 8) + '…' + addr.slice(-6);
  }

  function fmtTbc(nanoStr) {
    var n = BigInt(nanoStr);
    var whole = n / 1000000000n;
    var frac = (n % 1000000000n).toString().padStart(9, '0').replace(/0+$/, '');
    return frac ? whole.toString() + '.' + frac : whole.toString();
  }

  function renderProducts(_config) {
    els.productList.innerHTML = '';
    CATALOGUE.forEach(function (product) {
      var li = document.createElement('li');
      var info = document.createElement('div');
      info.innerHTML =
        '<div class="product-name">' + product.name + '</div>' +
        '<div class="product-desc">' + product.desc + '</div>';
      var right = document.createElement('div');
      right.style.display = 'flex';
      right.style.alignItems = 'center';
      right.style.gap = '12px';
      var price = document.createElement('span');
      price.className = 'meta';
      price.textContent = product.amountTbc + ' TBC';
      var btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = 'Buy';
      btn.addEventListener('click', function () {
        startCheckout(product, btn);
      });
      right.appendChild(price);
      right.appendChild(btn);
      li.appendChild(info);
      li.appendChild(right);
      els.productList.appendChild(li);
    });
  }

  async function startCheckout(product, btn) {
    clearError();
    btn.disabled = true;
    btn.textContent = 'Creating invoice…';
    try {
      var res = await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountTbc: product.amountTbc,
          orderId: 'DEMO-' + product.id.toUpperCase() + '-' + Date.now().toString(36),
          description: product.name + ' (merchant-demo)',
        }),
      });
      if (!res.ok) {
        var err = await res.json().catch(function () { return null; });
        throw new Error(err && err.error ? err.error.message : 'HTTP ' + res.status);
      }
      var data = await res.json();
      mountWidget(data.invoice);
    } catch (e) {
      showError('Failed to create invoice: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Buy';
    }
  }

  function mountWidget(invoice) {
    els.checkoutCard.hidden = false;
    els.invoiceMeta.innerHTML =
      'Invoice <code>' + invoice.id.slice(0, 12) + '…</code> · ' +
      '<strong>' + fmtTbc(invoice.amount_tbc) + ' TBC</strong>' +
      ' · merchant <code>' + shortAddress(invoice.merchant_nft) + '</code>' +
      ' · source <code>' + (invoice.source || 'remote') + '</code>';
    els.invoiceJson.textContent = JSON.stringify(invoice, null, 2);

    if (currentWidget) {
      try { currentWidget.unmount(); } catch (e) { /* ignore */ }
    }
    els.container.innerHTML = '';

    if (!SDK || !SDK.PaymentWidget) {
      showError(
        'Payment widget bundle is unavailable. The page failed to load ' +
        '@tonbankcard/merchant-sdk from the CDN. Check your network.',
      );
      return;
    }

    currentWidget = new SDK.PaymentWidget({
      containerId: els.container.id,
      merchantNft: invoice.merchant_nft,
      amountTbc: invoice.amount_tbc.toString(),
      orderId: invoice.order_id,
      description: invoice.description,
      mode: 'inline',
      theme: 'light',
      onError: function (err) { showError(err.message || String(err)); },
    });
    currentWidget.mount();
    els.checkoutCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadConfig() {
    try {
      var res = await fetch('/api/config');
      var cfg = await res.json();
      if (cfg.faucetUrl && els.faucetLink) {
        els.faucetLink.href = cfg.faucetUrl;
      }
      renderProducts(cfg);
    } catch (e) {
      showError('Failed to load sandbox config: ' + e.message);
    }
  }

  function renderWebhooks(events) {
    if (!events || events.length === 0) {
      els.webhookList.innerHTML = '<li class="empty">No webhooks received yet.</li>';
      return;
    }
    els.webhookList.innerHTML = '';
    events.forEach(function (event) {
      var li = document.createElement('li');
      var when = document.createElement('div');
      when.className = 'timestamp';
      when.textContent = event.receivedAt;
      var payload = document.createElement('span');
      payload.className = 'payload';
      payload.textContent = JSON.stringify(event.body || {});
      li.appendChild(when);
      li.appendChild(payload);
      els.webhookList.appendChild(li);
    });
  }

  async function pollWebhooks() {
    try {
      var res = await fetch('/api/webhooks');
      var data = await res.json();
      renderWebhooks(data.events);
    } catch (_e) { /* network blips are fine; the demo keeps polling */ }
  }

  // ---- bootstrap --------------------------------------------------------
  loadConfig();
  pollWebhooks();
  setInterval(pollWebhooks, 2000);
})();
