/**
 * TONBANKCARD Payment Widget
 *
 * Embeddable widget for merchants to accept TBC payments.
 *
 * @example
 * ```html
 * <div id="tonbankcard-pay"></div>
 * <script src="https://cdn.tonbankcard.io/widget.js"></script>
 * <script>
 *   const widget = new TonbankcardPaymentWidget({
 *     containerId: 'tonbankcard-pay',
 *     merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
 *     amountTbc: '1000000000',
 *     description: 'Order #123',
 *     mode: 'inline',
 *   });
 *   widget.mount();
 * </script>
 * ```
 */
export { TonbankcardPaymentWidget, PaymentWidgetConfig } from './PaymentWidget';
