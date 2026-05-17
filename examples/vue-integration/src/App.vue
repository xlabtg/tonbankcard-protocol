<script setup lang="ts">
import { computed, ref } from 'vue';
import { Address } from '@ton/core';
import {
  TonbankcardSDK,
  TESTNET_CONFIG,
  parseTBC,
  formatTBC,
  shortAddress,
  type Invoice,
} from '@tonbankcard/merchant-sdk';
import TonbankcardCheckout from './TonbankcardCheckout.vue';

const MERCHANT_NFT_ADDRESS = import.meta.env.VITE_MERCHANT_NFT;
const PAYMENT_HUB_ADDRESS = import.meta.env.VITE_PAYMENT_HUB ?? '';
const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT;

const orderId = ref('ORDER-' + Date.now().toString(36).toUpperCase());
const amountTbc = ref('1.50');
const invoice = ref<Invoice | null>(null);
const error = ref<string | null>(null);
const completedTxHash = ref<string | null>(null);

const sdk = computed(() => {
  if (!MERCHANT_NFT_ADDRESS) return null;
  try {
    return new TonbankcardSDK({
      ...TESTNET_CONFIG,
      paymentHubAddress: PAYMENT_HUB_ADDRESS
        ? Address.parse(PAYMENT_HUB_ADDRESS)
        : Address.parse(MERCHANT_NFT_ADDRESS),
      rpcEndpoint: RPC_ENDPOINT,
    });
  } catch (e) {
    error.value = (e as Error).message;
    return null;
  }
});

function createInvoice() {
  error.value = null;
  completedTxHash.value = null;
  if (!sdk.value) {
    error.value = 'SDK not initialised. Check VITE_MERCHANT_NFT in .env.local.';
    return;
  }
  try {
    invoice.value = sdk.value.createInvoice({
      merchantNft: Address.parse(MERCHANT_NFT_ADDRESS),
      amountTbc: parseTBC(amountTbc.value),
      orderId: orderId.value,
      description: `Vue demo order ${orderId.value}`,
      expirationSeconds: 60 * 60,
    });
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function handlePaymentComplete(txHash: string) {
  completedTxHash.value = txHash;
}
</script>

<template>
  <main class="page">
    <header class="header">
      <h1>TONBANKCARD Vue example</h1>
      <p>
        Non-custodial checkout against TON testnet using
        <code>@tonbankcard/merchant-sdk</code>.
      </p>
    </header>

    <section class="card">
      <h2>1. Configure the order</h2>
      <label>
        Order ID
        <input v-model="orderId" />
      </label>
      <label>
        Amount (TBC)
        <input v-model="amountTbc" inputmode="decimal" />
      </label>
      <button class="primary" @click="createInvoice">Create invoice</button>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="MERCHANT_NFT_ADDRESS" class="meta">
        Merchant NFT: <code>{{ shortAddress(MERCHANT_NFT_ADDRESS) }}</code>
      </p>
    </section>

    <section v-if="invoice" class="card">
      <h2>2. Pay with a TON wallet</h2>
      <p class="meta">
        Invoice <code>{{ invoice.id.slice(0, 12) }}…</code> ·
        <strong>{{ formatTBC(invoice.amountTbc) }} TBC</strong>
      </p>
      <TonbankcardCheckout
        :invoice="invoice"
        @payment-complete="handlePaymentComplete"
      />
      <p v-if="completedTxHash" class="success">
        Payment reported by wallet: <code>{{ completedTxHash }}</code>.
        <br />
        Verify it on-chain before granting access to the customer.
      </p>
    </section>

    <footer class="footer">
      <strong>Trust model:</strong> the SDK is informational. Always verify
      the on-chain settlement event before delivering goods.
    </footer>
  </main>
</template>

<style scoped>
.page {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 16px 64px;
  color: #1a1a1a;
}
.header h1 {
  margin: 0 0 4px;
  font-size: 28px;
}
.header p {
  color: #555;
  line-height: 1.5;
}
code {
  background: #f1f3f5;
  padding: 2px 6px;
  border-radius: 4px;
}
.card {
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  background: #fff;
}
.card h2 {
  margin-top: 0;
  font-size: 18px;
}
label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
  color: #333;
}
input {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 8px 10px;
  font-size: 14px;
  border: 1px solid #ccd0d5;
  border-radius: 8px;
  box-sizing: border-box;
}
.primary {
  background: #0088cc;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
}
.meta {
  font-size: 13px;
  color: #555;
  margin-top: 12px;
}
.error {
  color: #c0392b;
  margin-top: 12px;
}
.success {
  color: #1d7a3a;
  margin-top: 12px;
  word-break: break-all;
}
.footer {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}
</style>
