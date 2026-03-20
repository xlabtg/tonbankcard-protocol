/**
 * TONBANKCARD Merchant Dashboard
 *
 * A read-only dashboard for merchants to monitor payments, generate
 * payment links, and manage webhook configurations.
 *
 * SECURITY NOTICE:
 * ================
 * 1. This dashboard is PURELY PRESENTATIONAL
 * 2. It does NOT sign transactions or hold keys
 * 3. It does NOT custody funds
 * 4. All data is READ-ONLY, sourced from the blockchain
 * 5. Payment link generation creates deep links for the USER'S wallet
 * 6. The blockchain is the ONLY source of truth
 *
 * TRUST MODEL:
 * ============
 * - Merchants trust ON-CHAIN settlement events
 * - Users trust THEIR WALLET
 * - Dashboard is a CONVENIENCE WRAPPER, not a protocol layer
 */

import {
  DashboardConfig,
  DashboardView,
  MerchantStats,
  PaymentRecord,
  WebhookConfig,
} from '../types';
import {
  formatTBC,
  shortAddress,
  formatDate,
  formatCurrency,
  generateInvoiceLink,
} from '../utils';

/**
 * TONBANKCARD Merchant Dashboard
 *
 * Renders a complete merchant dashboard UI using vanilla DOM elements.
 * Supports light and dark themes, navigation between views, and
 * data-driven rendering of payment history, statistics, and webhooks.
 *
 * @example
 * ```html
 * <div id="merchant-dashboard"></div>
 * <script>
 *   const dashboard = new TonbankcardDashboard({
 *     containerId: 'merchant-dashboard',
 *     merchantNft: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
 *     theme: 'light',
 *   });
 *   dashboard.mount();
 *   dashboard.setStats({ totalPayments: 42, ... });
 * </script>
 * ```
 */
export class TonbankcardDashboard {
  private config: Required<Pick<DashboardConfig, 'merchantNft' | 'containerId'>> &
    DashboardConfig;
  private container: HTMLElement | null = null;
  private mounted = false;
  private currentView: DashboardView = DashboardView.OVERVIEW;
  private stats: MerchantStats | null = null;
  private payments: PaymentRecord[] = [];
  private webhooks: WebhookConfig[] = [];

  constructor(config: DashboardConfig) {
    if (!config.merchantNft) {
      throw new Error('merchantNft is required');
    }
    if (!config.containerId) {
      throw new Error('containerId is required');
    }

    this.config = {
      theme: 'light',
      ...config,
    };
  }

  /**
   * Mount the dashboard into the container element
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
   * Unmount the dashboard and clean up
   */
  unmount(): void {
    if (!this.mounted || !this.container) {
      return;
    }

    this.container.innerHTML = '';
    this.mounted = false;
  }

  /**
   * Set merchant statistics data and re-render if mounted
   *
   * @param stats - Aggregated merchant statistics from on-chain data
   */
  setStats(stats: MerchantStats): void {
    this.stats = stats;
    if (this.mounted) {
      this.rerender();
    }
  }

  /**
   * Set payment records and re-render if mounted
   *
   * @param payments - Array of payment records from on-chain data
   */
  setPayments(payments: PaymentRecord[]): void {
    this.payments = payments;
    if (this.mounted) {
      this.rerender();
    }
  }

  /**
   * Set webhook configurations and re-render if mounted
   *
   * @param webhooks - Array of webhook configurations
   */
  setWebhooks(webhooks: WebhookConfig[]): void {
    this.webhooks = webhooks;
    if (this.mounted) {
      this.rerender();
    }
  }

  /**
   * Get current dashboard view
   */
  getCurrentView(): DashboardView {
    return this.currentView;
  }

  /**
   * Get current stats
   */
  getStats(): MerchantStats | null {
    return this.stats;
  }

  /**
   * Get current payments
   */
  getPayments(): PaymentRecord[] {
    return this.payments;
  }

  /**
   * Get current webhooks
   */
  getWebhooks(): WebhookConfig[] {
    return this.webhooks;
  }

  /**
   * Navigate to a specific view
   */
  navigateTo(view: DashboardView): void {
    this.currentView = view;
    if (this.mounted) {
      this.rerender();
    }
  }

  /**
   * Re-render the dashboard content
   */
  private rerender(): void {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.render();
  }

  /**
   * Check if theme is dark
   */
  private isDark(): boolean {
    return this.config.theme === 'dark';
  }

  /**
   * Render the complete dashboard
   */
  private render(): void {
    if (!this.container) return;

    const isDark = this.isDark();

    const wrapper = document.createElement('div');
    wrapper.className = 'tonbankcard-dashboard';
    wrapper.style.cssText = [
      'font-family:system-ui,-apple-system,sans-serif',
      'border-radius:16px',
      'padding:24px',
      'min-height:400px',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff;border:1px solid #333'
        : 'background:#ffffff;color:#1a1a1a;border:1px solid #e0e0e0',
    ].join(';');

    // Header
    wrapper.appendChild(this.renderHeader());

    // Navigation
    wrapper.appendChild(this.renderNavigation());

    // Content
    wrapper.appendChild(this.renderContent());

    // Footer
    wrapper.appendChild(this.renderFooter());

    this.container.appendChild(wrapper);
  }

  /**
   * Render the dashboard header
   */
  private renderHeader(): HTMLElement {
    const isDark = this.isDark();

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';

    const titleArea = document.createElement('div');
    titleArea.style.cssText = 'display:flex;align-items:center;gap:10px;';

    const title = document.createElement('h1');
    title.style.cssText = 'margin:0;font-size:22px;font-weight:700;';
    title.textContent = 'Merchant Dashboard';
    titleArea.appendChild(title);

    header.appendChild(titleArea);

    const merchantAddr = document.createElement('div');
    merchantAddr.style.cssText = `font-size:13px;font-family:monospace;${isDark ? 'color:#888;' : 'color:#999;'}`;
    merchantAddr.textContent = shortAddress(this.config.merchantNft);
    header.appendChild(merchantAddr);

    return header;
  }

  /**
   * Render the navigation tabs
   */
  private renderNavigation(): HTMLElement {
    const isDark = this.isDark();

    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid ' + (isDark ? '#333' : '#e0e0e0') + ';padding-bottom:0;';

    const tabs: Array<{ label: string; view: DashboardView }> = [
      { label: 'Overview', view: DashboardView.OVERVIEW },
      { label: 'Payments', view: DashboardView.PAYMENTS },
      { label: 'Generate Link', view: DashboardView.GENERATE },
      { label: 'Webhooks', view: DashboardView.WEBHOOKS },
    ];

    for (const tab of tabs) {
      const isActive = this.currentView === tab.view;
      const btn = document.createElement('button');
      btn.style.cssText = [
        'padding:10px 18px',
        'border:none',
        'border-bottom:2px solid ' + (isActive ? (isDark ? '#6c8aff' : '#0088cc') : 'transparent'),
        'cursor:pointer',
        'font-size:14px',
        'font-weight:' + (isActive ? '600' : '400'),
        'transition:all 0.2s',
        'margin-bottom:-1px',
        isDark
          ? `background:transparent;color:${isActive ? '#e0e0ff' : '#888'};`
          : `background:transparent;color:${isActive ? '#1a1a1a' : '#666'};`,
      ].join(';');
      btn.textContent = tab.label;
      btn.setAttribute('data-view', tab.view);
      btn.onclick = () => {
        this.currentView = tab.view;
        this.rerender();
      };
      nav.appendChild(btn);
    }

    return nav;
  }

  /**
   * Render content for the current view
   */
  private renderContent(): HTMLElement {
    switch (this.currentView) {
      case DashboardView.OVERVIEW:
        return this.renderOverview();
      case DashboardView.PAYMENTS:
        return this.renderPayments();
      case DashboardView.GENERATE:
        return this.renderGenerate();
      case DashboardView.WEBHOOKS:
        return this.renderWebhooksView();
    }
  }

  /**
   * Render the overview tab with stats summary
   */
  private renderOverview(): HTMLElement {
    const isDark = this.isDark();
    const content = document.createElement('div');

    if (!this.stats) {
      const empty = document.createElement('div');
      empty.style.cssText = `text-align:center;padding:40px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      empty.textContent = 'No statistics available. Data is loaded from the blockchain.';
      content.appendChild(empty);
      return content;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:16px;';

    const statCards: Array<{ label: string; value: string }> = [
      { label: 'Total Payments', value: this.stats.totalPayments.toString() },
      { label: 'Total Volume', value: formatCurrency(this.stats.totalVolume) },
      { label: 'Success Rate', value: `${(this.stats.successRate * 100).toFixed(1)}%` },
      { label: 'Average Amount', value: formatTBC(this.stats.averageAmount) + ' TBC' },
    ];

    for (const stat of statCards) {
      const card = document.createElement('div');
      card.style.cssText = [
        'padding:20px',
        'border-radius:12px',
        isDark
          ? 'background:#262640;border:1px solid #333'
          : 'background:#f8f9fa;border:1px solid #e8e8e8',
      ].join(';');

      const label = document.createElement('div');
      label.style.cssText = `font-size:13px;margin-bottom:8px;${isDark ? 'color:#888;' : 'color:#666;'}`;
      label.textContent = stat.label;
      card.appendChild(label);

      const value = document.createElement('div');
      value.style.cssText = 'font-size:24px;font-weight:700;';
      value.textContent = stat.value;
      card.appendChild(value);

      grid.appendChild(card);
    }

    content.appendChild(grid);

    // Period info
    const period = document.createElement('div');
    period.style.cssText = `margin-top:16px;font-size:12px;${isDark ? 'color:#666;' : 'color:#aaa;'}`;
    period.textContent = `Period: ${formatDate(this.stats.periodStart)} - ${formatDate(this.stats.periodEnd)}`;
    content.appendChild(period);

    return content;
  }

  /**
   * Render the payments list tab
   */
  private renderPayments(): HTMLElement {
    const isDark = this.isDark();
    const content = document.createElement('div');

    if (this.payments.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `text-align:center;padding:40px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      empty.textContent = 'No payments recorded. Payment data is sourced from the blockchain.';
      content.appendChild(empty);
      return content;
    }

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    for (const payment of this.payments) {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'padding:14px 16px',
        'border-radius:10px',
        isDark
          ? 'background:#262640;border:1px solid #333'
          : 'background:#f8f9fa;border:1px solid #e8e8e8',
      ].join(';');

      // Left side: address and status
      const left = document.createElement('div');

      const addrLine = document.createElement('div');
      addrLine.style.cssText = 'font-size:14px;font-weight:500;font-family:monospace;';
      addrLine.textContent = shortAddress(payment.payerAddress);
      left.appendChild(addrLine);

      const meta = document.createElement('div');
      meta.style.cssText = `font-size:12px;margin-top:4px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      const metaParts = [formatDate(payment.timestamp)];
      if (payment.orderId) metaParts.push(`Order: ${payment.orderId}`);
      meta.textContent = metaParts.join(' | ');
      left.appendChild(meta);

      row.appendChild(left);

      // Right side: amount and status badge
      const right = document.createElement('div');
      right.style.cssText = 'text-align:right;';

      const amount = document.createElement('div');
      amount.style.cssText = 'font-size:15px;font-weight:600;';
      amount.textContent = formatTBC(payment.amount) + ' TBC';
      right.appendChild(amount);

      const badge = document.createElement('span');
      const statusColors: Record<string, string> = {
        settled: isDark ? 'background:#1a3a1a;color:#4caf50' : 'background:#e8f5e9;color:#2e7d32',
        pending: isDark ? 'background:#3a3a1a;color:#ffc107' : 'background:#fff8e1;color:#f57f17',
        failed: isDark ? 'background:#3a1a1a;color:#f44336' : 'background:#ffebee;color:#c62828',
        expired: isDark ? 'background:#2a2a2a;color:#888' : 'background:#f5f5f5;color:#757575',
      };
      badge.style.cssText = `display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-top:4px;${statusColors[payment.status] || ''}`;
      badge.textContent = payment.status.toUpperCase();
      right.appendChild(badge);

      row.appendChild(right);
      list.appendChild(row);
    }

    content.appendChild(list);
    return content;
  }

  /**
   * Render the payment link generator tab
   *
   * SECURITY NOTICE: This generates a ton:// deep link that opens the
   * user's wallet. The dashboard does NOT sign or authorize any transactions.
   */
  private renderGenerate(): HTMLElement {
    const isDark = this.isDark();
    const content = document.createElement('div');

    const heading = document.createElement('h3');
    heading.style.cssText = 'margin:0 0 16px 0;font-size:18px;';
    heading.textContent = 'Generate Payment Link';
    content.appendChild(heading);

    const notice = document.createElement('div');
    notice.style.cssText = `padding:12px;border-radius:8px;font-size:13px;margin-bottom:20px;${isDark ? 'background:#262640;color:#888;' : 'background:#f0f4ff;color:#666;'}`;
    notice.textContent = 'This generates a ton:// deep link for your customer\'s wallet. No transactions are signed by this dashboard.';
    content.appendChild(notice);

    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:14px;max-width:400px;';

    // Amount input
    const amountGroup = this.createInputGroup('Amount (nanocoins)', 'amount-input', '1000000000', 'number');
    form.appendChild(amountGroup);

    // Order ID input
    const orderGroup = this.createInputGroup('Order ID (optional)', 'order-input', 'ORD-001');
    form.appendChild(orderGroup);

    // Description input
    const descGroup = this.createInputGroup('Description (optional)', 'desc-input', 'Payment for goods');
    form.appendChild(descGroup);

    // Expiration input
    const expGroup = this.createInputGroup('Expiration (minutes, optional)', 'exp-input', '30', 'number');
    form.appendChild(expGroup);

    // Generate button
    const generateBtn = document.createElement('button');
    generateBtn.style.cssText = [
      'padding:12px 24px',
      'border:none',
      'border-radius:10px',
      'font-size:15px',
      'font-weight:600',
      'cursor:pointer',
      'transition:opacity 0.2s',
      isDark
        ? 'background:#3a5aff;color:#ffffff'
        : 'background:#0088cc;color:#ffffff',
    ].join(';');
    generateBtn.textContent = 'Generate Link';
    generateBtn.onmouseover = () => { generateBtn.style.opacity = '0.85'; };
    generateBtn.onmouseout = () => { generateBtn.style.opacity = '1'; };

    // Result area
    const resultArea = document.createElement('div');
    resultArea.style.cssText = 'margin-top:16px;';

    generateBtn.onclick = () => {
      const amountInput = this.container?.querySelector('#tonbankcard-amount-input') as HTMLInputElement | null;
      const orderInput = this.container?.querySelector('#tonbankcard-order-input') as HTMLInputElement | null;
      const descInput = this.container?.querySelector('#tonbankcard-desc-input') as HTMLInputElement | null;
      const expInput = this.container?.querySelector('#tonbankcard-exp-input') as HTMLInputElement | null;

      const amountVal = amountInput?.value || '0';
      const orderVal = orderInput?.value || undefined;
      const descVal = descInput?.value || undefined;
      const expVal = expInput?.value ? parseInt(expInput.value, 10) : undefined;

      const link = generateInvoiceLink(this.config.merchantNft, {
        amountTbc: amountVal,
        orderId: orderVal,
        description: descVal,
        expirationMinutes: expVal,
      });

      resultArea.innerHTML = '';

      const linkLabel = document.createElement('div');
      linkLabel.style.cssText = `font-size:13px;margin-bottom:6px;font-weight:600;${isDark ? 'color:#e0e0ff;' : 'color:#1a1a1a;'}`;
      linkLabel.textContent = 'Generated Payment Link:';
      resultArea.appendChild(linkLabel);

      const linkBox = document.createElement('div');
      linkBox.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:10px 14px',
        'border-radius:8px',
        'font-family:monospace',
        'font-size:12px',
        'word-break:break-all',
        isDark
          ? 'background:#1a1a2e;border:1px solid #444;color:#e0e0ff'
          : 'background:#f5f5f5;border:1px solid #ddd;color:#333',
      ].join(';');

      const linkText = document.createElement('span');
      linkText.style.cssText = 'flex:1;';
      linkText.textContent = link;
      linkBox.appendChild(linkText);

      const copyBtn = document.createElement('button');
      copyBtn.style.cssText = [
        'padding:6px 12px',
        'border:none',
        'border-radius:6px',
        'font-size:12px',
        'font-weight:600',
        'cursor:pointer',
        'white-space:nowrap',
        'transition:opacity 0.2s',
        isDark
          ? 'background:#3a5aff;color:#ffffff'
          : 'background:#0088cc;color:#ffffff',
      ].join(';');
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(link).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          }).catch(() => {
            copyBtn.textContent = 'Failed';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          });
        }
      };
      linkBox.appendChild(copyBtn);

      resultArea.appendChild(linkBox);
    };

    form.appendChild(generateBtn);
    form.appendChild(resultArea);
    content.appendChild(form);

    return content;
  }

  /**
   * Render the webhooks configuration view
   */
  private renderWebhooksView(): HTMLElement {
    const isDark = this.isDark();
    const content = document.createElement('div');

    const heading = document.createElement('h3');
    heading.style.cssText = 'margin:0 0 16px 0;font-size:18px;';
    heading.textContent = 'Webhook Configuration';
    content.appendChild(heading);

    if (this.webhooks.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `text-align:center;padding:40px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      empty.textContent = 'No webhooks configured.';
      content.appendChild(empty);
      return content;
    }

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

    for (const webhook of this.webhooks) {
      const card = document.createElement('div');
      card.style.cssText = [
        'padding:16px',
        'border-radius:10px',
        isDark
          ? 'background:#262640;border:1px solid #333'
          : 'background:#f8f9fa;border:1px solid #e8e8e8',
      ].join(';');

      // URL and status
      const headerRow = document.createElement('div');
      headerRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';

      const urlEl = document.createElement('div');
      urlEl.style.cssText = 'font-size:14px;font-weight:600;font-family:monospace;';
      urlEl.textContent = webhook.url;
      headerRow.appendChild(urlEl);

      const statusBadge = document.createElement('span');
      statusBadge.style.cssText = `display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:600;${webhook.enabled
        ? (isDark ? 'background:#1a3a1a;color:#4caf50' : 'background:#e8f5e9;color:#2e7d32')
        : (isDark ? 'background:#3a1a1a;color:#f44336' : 'background:#ffebee;color:#c62828')
      }`;
      statusBadge.textContent = webhook.enabled ? 'ENABLED' : 'DISABLED';
      headerRow.appendChild(statusBadge);

      card.appendChild(headerRow);

      // Events
      const eventsEl = document.createElement('div');
      eventsEl.style.cssText = `font-size:12px;${isDark ? 'color:#888;' : 'color:#666;'}`;
      eventsEl.textContent = `Events: ${webhook.events.join(', ')}`;
      card.appendChild(eventsEl);

      list.appendChild(card);
    }

    content.appendChild(list);
    return content;
  }

  /**
   * Create a labeled input group
   */
  private createInputGroup(
    label: string,
    idSuffix: string,
    placeholder: string,
    type: string = 'text'
  ): HTMLElement {
    const isDark = this.isDark();

    const group = document.createElement('div');

    const labelEl = document.createElement('label');
    labelEl.style.cssText = `display:block;font-size:13px;margin-bottom:4px;font-weight:500;${isDark ? 'color:#ccc;' : 'color:#333;'}`;
    labelEl.textContent = label;
    labelEl.htmlFor = `tonbankcard-${idSuffix}`;
    group.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = type;
    input.id = `tonbankcard-${idSuffix}`;
    input.placeholder = placeholder;
    input.style.cssText = [
      'width:100%',
      'padding:10px 12px',
      'border-radius:8px',
      'font-size:14px',
      'box-sizing:border-box',
      'outline:none',
      'transition:border-color 0.2s',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff;border:1px solid #444'
        : 'background:#ffffff;color:#1a1a1a;border:1px solid #ddd',
    ].join(';');
    group.appendChild(input);

    return group;
  }

  /**
   * Render the dashboard footer
   */
  private renderFooter(): HTMLElement {
    const isDark = this.isDark();

    const footer = document.createElement('div');
    footer.style.cssText = `margin-top:24px;padding-top:16px;border-top:1px solid ${isDark ? '#333' : '#e0e0e0'};font-size:11px;text-align:center;${isDark ? 'color:#666;' : 'color:#aaa;'}`;
    footer.textContent = 'TONBANKCARD Merchant Dashboard | Non-custodial | Blockchain is the source of truth';

    return footer;
  }
}
