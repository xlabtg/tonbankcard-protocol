/**
 * Browser-only entry point for `@tonbankcard/merchant-sdk`.
 *
 * This entry bundles the dependency-free pieces of the SDK that can run
 * directly in a browser via a `<script>` tag, with no module bundler:
 *
 *   - `TonbankcardPaymentWidget` (zero dependencies)
 *   - Pure-JS helpers: `formatTBC`, `parseTBC`, `serializeBigInt`
 *
 * The full TON-blockchain-aware surface (`TonbankcardSDK`, `verifySettlement`,
 * etc.) requires `@ton/ton` and `@ton/core` and is therefore only available
 * through the main entry. Browser integrations that need on-chain verification
 * should either rely on a server-side check or bundle the main entry with a
 * tool such as Vite, esbuild, or Webpack.
 *
 * Built as an IIFE bundle (see tsup config) and exposed on
 * `window.Tonbankcard`. Example:
 *
 * ```html
 * <script src="https://unpkg.com/@tonbankcard/merchant-sdk@1.0.0/dist/index.global.js"></script>
 * <script>
 *   const widget = new Tonbankcard.PaymentWidget({ ... });
 *   widget.mount();
 * </script>
 * ```
 */

export { TonbankcardPaymentWidget as PaymentWidget } from './widget/PaymentWidget';
export type { PaymentWidgetConfig } from './widget/PaymentWidget';
export { formatTBC, parseTBC, serializeBigInt } from './utils.browser';
