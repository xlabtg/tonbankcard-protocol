<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  TonbankcardPaymentWidget,
  serializeBigInt,
  type Invoice,
} from '@tonbankcard/merchant-sdk';

const props = defineProps<{ invoice: Invoice }>();
const emit = defineEmits<{
  /**
   * Fires once the wallet returns from the deep link with a transaction hash.
   * The hash is reported by the wallet and MUST be re-verified on-chain
   * (e.g., via `sdk.verifySettlement`) before fulfilling the order.
   */
  (e: 'payment-complete', txHash: string): void;
}>();

const containerId = ref(`tonbankcard-checkout-${props.invoice.id.slice(0, 8)}`);
let widget: TonbankcardPaymentWidget | null = null;

function mountWidget() {
  if (widget) widget.unmount();
  widget = new TonbankcardPaymentWidget({
    containerId: containerId.value,
    merchantNft: props.invoice.merchantNft.toString(),
    amountTbc: props.invoice.amountTbc.toString(),
    orderId: props.invoice.orderId,
    description: props.invoice.description,
    mode: 'inline',
    theme: 'light',
  });
  widget.mount();
}

function handleFocus() {
  const params = new URLSearchParams(window.location.search);
  const tx = params.get('tx');
  if (tx) emit('payment-complete', tx);
}

onMounted(() => {
  mountWidget();
  window.addEventListener('focus', handleFocus);
  handleFocus();
});

onBeforeUnmount(() => {
  if (widget) widget.unmount();
  window.removeEventListener('focus', handleFocus);
});

watch(
  () => props.invoice.id,
  () => {
    containerId.value = `tonbankcard-checkout-${props.invoice.id.slice(0, 8)}`;
    mountWidget();
  },
);
</script>

<template>
  <div :id="containerId" />
  <details class="debug">
    <summary>Invoice JSON (debug)</summary>
    <pre>{{ JSON.stringify(serializeBigInt(invoice), null, 2) }}</pre>
  </details>
</template>

<style scoped>
.debug {
  margin-top: 12px;
  font-size: 12px;
  color: #555;
}
pre {
  overflow-x: auto;
}
</style>
