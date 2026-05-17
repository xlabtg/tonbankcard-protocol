import { useEffect, useRef } from 'react';
import {
  TonbankcardPaymentWidget,
  serializeBigInt,
  type Invoice,
} from '@tonbankcard/merchant-sdk';

export interface TonbankcardCheckoutProps {
  invoice: Invoice;
  /**
   * Fires once the wallet returns from the deep link with a transaction hash.
   * The hash is reported by the wallet and MUST be re-verified on-chain
   * (e.g., via `sdk.verifySettlement`) before fulfilling the order.
   */
  onPaymentComplete?: (txHash: string) => void;
}

/**
 * Thin React wrapper around `TonbankcardPaymentWidget` from the SDK.
 * The widget itself is framework-agnostic; React only owns the lifecycle.
 */
export function TonbankcardCheckout({ invoice, onPaymentComplete }: TonbankcardCheckoutProps) {
  const containerId = `tonbankcard-checkout-${invoice.id.slice(0, 8)}`;
  const widgetRef = useRef<TonbankcardPaymentWidget | null>(null);

  useEffect(() => {
    const widget = new TonbankcardPaymentWidget({
      containerId,
      merchantNft: invoice.merchantNft.toString(),
      amountTbc: invoice.amountTbc.toString(),
      orderId: invoice.orderId,
      description: invoice.description,
      mode: 'inline',
      theme: 'light',
    });
    widget.mount();
    widgetRef.current = widget;

    return () => {
      widget.unmount();
      widgetRef.current = null;
    };
  }, [containerId, invoice]);

  // Listen for the wallet's return-URL callback. Real integrations should
  // resolve the txHash from a dedicated `/payment/return` route; here we
  // simulate it by watching the `?tx=` query parameter on focus.
  useEffect(() => {
    if (!onPaymentComplete) return;
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const tx = params.get('tx');
      if (tx) onPaymentComplete(tx);
    };
    window.addEventListener('focus', handler);
    handler();
    return () => window.removeEventListener('focus', handler);
  }, [onPaymentComplete]);

  return (
    <>
      <div id={containerId} />
      <details style={{ marginTop: 12, fontSize: 12, color: '#555' }}>
        <summary>Invoice JSON (debug)</summary>
        <pre style={{ overflowX: 'auto' }}>
          {JSON.stringify(serializeBigInt(invoice), null, 2)}
        </pre>
      </details>
    </>
  );
}
