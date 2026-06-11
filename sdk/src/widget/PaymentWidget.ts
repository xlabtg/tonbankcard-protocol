/**
 * TONBANKCARD Payment Widget
 *
 * Embeddable payment widget for merchants to accept TBC payments.
 * The widget renders a payment button or inline form that generates
 * a TON Connect deep link for the user's wallet.
 *
 * SECURITY NOTICE:
 * - This widget is PURELY PRESENTATIONAL
 * - It does NOT sign transactions or hold keys
 * - It does NOT custody funds
 * - Payment is executed ONLY by the user's wallet
 * - Settlement verification is done on-chain
 */

import { assertAmount, formatTBC } from '../amount';

/**
 * TON address shape accepted in the deep-link `merchantNft` path component:
 * a user-friendly base64url address (48 chars) or a raw `workchain:account_hex`
 * address.
 *
 * This is a dependency-free format check rather than a full `@ton/core`
 * checksum validation on purpose: the widget is bundled for direct
 * `<script>`-tag use (see `src/browser.ts`) and must stay free of
 * `@ton/core` / `@ton/crypto`. Combined with `encodeURIComponent`, it stops a
 * crafted address from injecting or overriding query parameters in the link.
 */
const TON_ADDRESS_FORMAT = /^(?:-?\d+:[0-9a-fA-F]{64}|[A-Za-z0-9_-]{48})$/;

/**
 * Validate that `merchantNft` is a well-formed TON address before embedding it
 * in a payment deep link.
 *
 * @param merchantNft - Merchant NFT address string
 * @returns The validated address string (unchanged)
 * @throws Error if the value is not a well-formed TON address
 */
function assertMerchantNft(merchantNft: string): string {
  if (
    typeof merchantNft !== 'string' ||
    !TON_ADDRESS_FORMAT.test(merchantNft)
  ) {
    throw new Error(`Invalid merchant NFT address: ${String(merchantNft)}`);
  }
  return merchantNft;
}

export interface PaymentWidgetConfig {
  /** Merchant NFT address (required) */
  merchantNft: string;

  /** Payment amount in TBC nanocoins (required) */
  amountTbc: string;

  /** Container element ID to render the widget into */
  containerId: string;

  /** Optional order ID for merchant tracking */
  orderId?: string;

  /** Optional payment description shown to user */
  description?: string;

  /** Optional callback URL after payment */
  returnUrl?: string;

  /** Widget display mode */
  mode?: 'button' | 'inline';

  /** Widget theme */
  theme?: 'light' | 'dark';

  /** API endpoint for invoice creation (optional) */
  apiEndpoint?: string;

  /** Callback when payment link is generated */
  onPaymentLinkGenerated?: (link: string) => void;

  /** Callback when widget is ready */
  onReady?: () => void;

  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Payment Widget class
 *
 * Usage:
 * ```html
 * <div id="tonbankcard-pay"></div>
 * <script>
 *   const widget = new TonbankcardPaymentWidget({
 *     containerId: 'tonbankcard-pay',
 *     merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
 *     amountTbc: '1000000000',
 *     description: 'Order #123',
 *   });
 *   widget.mount();
 * </script>
 * ```
 */
export class TonbankcardPaymentWidget {
  private config: Required<
    Pick<PaymentWidgetConfig, 'merchantNft' | 'amountTbc' | 'containerId'>
  > &
    PaymentWidgetConfig;
  private container: HTMLElement | null = null;
  private mounted = false;

  constructor(config: PaymentWidgetConfig) {
    if (!config.merchantNft) {
      throw new Error('merchantNft is required');
    }
    if (!config.amountTbc) {
      throw new Error('amountTbc is required');
    }
    if (!config.containerId) {
      throw new Error('containerId is required');
    }

    this.config = {
      mode: 'button',
      theme: 'light',
      ...config,
    };
  }

  /**
   * Mount the widget into the container element
   */
  mount(): void {
    if (this.mounted) {
      return;
    }

    this.container = document.getElementById(this.config.containerId);
    if (!this.container) {
      const error = new Error(
        `Container element not found: #${this.config.containerId}`
      );
      this.config.onError?.(error);
      throw error;
    }

    this.render();
    this.mounted = true;
    this.config.onReady?.();
  }

  /**
   * Unmount the widget and clean up
   */
  unmount(): void {
    if (!this.mounted || !this.container) {
      return;
    }

    this.container.innerHTML = '';
    this.mounted = false;
  }

  /**
   * Generate TON Connect payment deep link
   *
   * Every interpolated component is validated and percent-encoded exactly once
   * so that a value containing reserved characters (e.g. `&`, `?`, `#`, or
   * `=`) cannot inject or override query parameters in the generated deep link.
   *
   * @throws Error if `merchantNft` is not a well-formed TON address or
   *         `amountTbc` is not a non-negative numeric string
   */
  generatePaymentLink(): string {
    const merchantNft = assertMerchantNft(this.config.merchantNft);
    const amount = assertAmount(this.config.amountTbc);
    const parts = [
      `TONBANKCARD Payment`,
      this.config.orderId ? `Order: ${this.config.orderId}` : '',
      this.config.description || '',
    ]
      .filter(Boolean)
      .join(' | ');

    const text = encodeURIComponent(parts);
    let link = `ton://transfer/${encodeURIComponent(
      merchantNft
    )}?amount=${encodeURIComponent(amount)}&text=${text}`;

    if (this.config.returnUrl) {
      link += `&return=${encodeURIComponent(this.config.returnUrl)}`;
    }

    this.config.onPaymentLinkGenerated?.(link);
    return link;
  }

  /**
   * Format TBC amount for display
   */
  private formatAmount(): string {
    return `${formatTBC(BigInt(this.config.amountTbc))} TBC`;
  }

  /**
   * Render the widget
   */
  private render(): void {
    if (!this.container) return;

    if (this.config.mode === 'inline') {
      this.renderInline();
    } else {
      this.renderButton();
    }
  }

  /**
   * Render button mode
   */
  private renderButton(): void {
    if (!this.container) return;

    const isDark = this.config.theme === 'dark';
    const amount = this.formatAmount();

    const wrapper = document.createElement('div');
    wrapper.className = 'tonbankcard-widget';
    wrapper.style.cssText = 'display:inline-block;font-family:system-ui,-apple-system,sans-serif;';

    const button = document.createElement('a');
    button.href = this.generatePaymentLink();
    button.target = '_blank';
    button.rel = 'noopener noreferrer';
    button.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'padding:12px 24px',
      'border:none',
      'border-radius:12px',
      'font-size:16px',
      'font-weight:600',
      'cursor:pointer',
      'text-decoration:none',
      'transition:opacity 0.2s',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff'
        : 'background:#0088cc;color:#ffffff',
    ].join(';');

    button.onmouseover = () => {
      button.style.opacity = '0.85';
    };
    button.onmouseout = () => {
      button.style.opacity = '1';
    };

    // TON icon (simple SVG)
    const icon = document.createElement('span');
    icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.8"/>
      <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none"/>
      <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none"/>
    </svg>`;

    const label = document.createElement('span');
    label.textContent = `Pay ${amount}`;

    button.appendChild(icon);
    button.appendChild(label);
    wrapper.appendChild(button);

    if (this.config.description) {
      const desc = document.createElement('div');
      desc.style.cssText = [
        'margin-top:4px',
        'font-size:12px',
        'text-align:center',
        isDark ? 'color:#888' : 'color:#666',
      ].join(';');
      desc.textContent = this.config.description;
      wrapper.appendChild(desc);
    }

    this.container.appendChild(wrapper);
  }

  /**
   * Render inline mode with payment details
   */
  private renderInline(): void {
    if (!this.container) return;

    const isDark = this.config.theme === 'dark';
    const amount = this.formatAmount();
    const shortAddr = `${this.config.merchantNft.slice(0, 8)}...${this.config.merchantNft.slice(-6)}`;

    const card = document.createElement('div');
    card.className = 'tonbankcard-widget-inline';
    card.style.cssText = [
      'font-family:system-ui,-apple-system,sans-serif',
      'border-radius:16px',
      'padding:24px',
      'max-width:360px',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff;border:1px solid #333'
        : 'background:#ffffff;color:#1a1a1a;border:1px solid #e0e0e0',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;';
    header.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="${isDark ? '#6c8aff' : '#0088cc'}" opacity="0.8"/>
      <path d="M2 17l10 5 10-5" stroke="${isDark ? '#6c8aff' : '#0088cc'}" stroke-width="2" fill="none"/>
      <path d="M2 12l10 5 10-5" stroke="${isDark ? '#6c8aff' : '#0088cc'}" stroke-width="2" fill="none"/>
    </svg>
    <span style="font-size:18px;font-weight:700;">TONBANKCARD Payment</span>`;
    card.appendChild(header);

    // Amount
    const amountEl = document.createElement('div');
    amountEl.style.cssText = 'font-size:32px;font-weight:700;margin-bottom:16px;';
    amountEl.textContent = amount;
    card.appendChild(amountEl);

    // Details
    if (this.config.description) {
      const descEl = document.createElement('div');
      descEl.style.cssText = `margin-bottom:8px;font-size:14px;${isDark ? 'color:#aaa;' : 'color:#666;'}`;
      descEl.textContent = this.config.description;
      card.appendChild(descEl);
    }

    const merchantEl = document.createElement('div');
    merchantEl.style.cssText = `margin-bottom:16px;font-size:12px;font-family:monospace;${isDark ? 'color:#888;' : 'color:#999;'}`;
    merchantEl.textContent = `To: ${shortAddr}`;
    card.appendChild(merchantEl);

    // Pay button
    const payBtn = document.createElement('a');
    payBtn.href = this.generatePaymentLink();
    payBtn.target = '_blank';
    payBtn.rel = 'noopener noreferrer';
    payBtn.style.cssText = [
      'display:block',
      'width:100%',
      'padding:14px',
      'border:none',
      'border-radius:12px',
      'font-size:16px',
      'font-weight:600',
      'cursor:pointer',
      'text-align:center',
      'text-decoration:none',
      'box-sizing:border-box',
      'transition:opacity 0.2s',
      isDark
        ? 'background:#3a5aff;color:#ffffff'
        : 'background:#0088cc;color:#ffffff',
    ].join(';');
    payBtn.textContent = 'Open Wallet to Pay';
    payBtn.onmouseover = () => {
      payBtn.style.opacity = '0.85';
    };
    payBtn.onmouseout = () => {
      payBtn.style.opacity = '1';
    };
    card.appendChild(payBtn);

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top:12px;font-size:11px;text-align:center;${isDark ? 'color:#666;' : 'color:#aaa;'}`;
    footer.textContent = 'Non-custodial payment via TON blockchain';
    card.appendChild(footer);

    this.container.appendChild(card);
  }

  /**
   * Update payment amount
   */
  updateAmount(amountTbc: string): void {
    this.config.amountTbc = amountTbc;
    if (this.mounted && this.container) {
      this.container.innerHTML = '';
      this.render();
    }
  }
}
