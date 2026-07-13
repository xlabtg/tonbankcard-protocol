/**
 * TONBANKCARD Wallet UI - Main Application Component
 *
 * Presentational wallet interface for viewing NFT card balances,
 * transaction history, and account settings.
 *
 * SECURITY NOTICE:
 * =================
 * 1. This component is PURELY PRESENTATIONAL
 * 2. It does NOT sign transactions or hold private keys
 * 3. It does NOT custody funds in any way
 * 4. It does NOT act as a payment authority
 * 5. The blockchain is the ONLY source of truth
 * 6. All data displayed is READ-ONLY
 * 7. Wallet connection uses TON Connect deep links only (no signing)
 *
 * TRUST MODEL:
 * =============
 * - Users trust THEIR WALLET for signing
 * - This UI is a CONVENIENCE WRAPPER for viewing on-chain state
 * - No sensitive operations are performed by this component
 */

import {
  WalletUIConfig,
  WalletAccount,
  TransactionRecord,
  WalletView,
  AccountState,
} from '../types';
import { formatTBC, shortAddress, formatDate, getAccountStateLabel } from '../utils';
import {
  WalletSelector,
  TonConnectConnector,
  generateQRSvg,
  buildTonTransferLink,
  assertValidAddress,
  type TonConnectManifest,
  type TonTransferParams,
  type ConnectionState,
  type ConnectorEvent,
} from '../tonconnect';

/**
 * TonbankcardWalletUI
 *
 * Main wallet UI class that renders a card-style interface for viewing
 * TONBANKCARD NFT account information.
 *
 * Usage:
 * ```html
 * <div id="tonbankcard-wallet"></div>
 * <script>
 *   const wallet = new TonbankcardWalletUI({
 *     containerId: 'tonbankcard-wallet',
 *     network: 'mainnet',
 *     paymentHubAddress: 'EQAjHkHtt1MIoU5c7dks73Rz8NMxAA3oStSrcQ_qgn3il-Le',
 *   });
 *   wallet.mount();
 *   wallet.setAccount({ ... });
 * </script>
 * ```
 *
 * SECURITY NOTICE: This class is READ-ONLY. It never signs transactions,
 * stores private keys, or custodies funds.
 */
export class TonbankcardWalletUI {
  private config: Required<Pick<WalletUIConfig, 'network' | 'paymentHubAddress' | 'containerId'>> &
    WalletUIConfig;
  private container: HTMLElement | null = null;
  private mounted = false;
  private currentView: WalletView = WalletView.BALANCE;
  private account: WalletAccount | null = null;
  private transactions: TransactionRecord[] = [];
  private connector: TonConnectConnector | null = null;
  private connectorUnsubscribe: (() => void) | null = null;
  private activeSelector: WalletSelector | null = null;

  /**
   * Create a new TonbankcardWalletUI instance
   *
   * @param config - Wallet UI configuration
   * @throws Error if required configuration fields are missing
   */
  constructor(config: WalletUIConfig) {
    if (!config.containerId) {
      throw new Error('containerId is required');
    }
    if (!config.network) {
      throw new Error('network is required');
    }
    if (!config.paymentHubAddress) {
      throw new Error('paymentHubAddress is required');
    }
    // Reject a malformed payment hub address up front so it can never be
    // interpolated into a ton:// deep link (see generateConnectLink).
    assertValidAddress(config.paymentHubAddress);

    this.config = {
      theme: 'light',
      ...config,
    };

    if (config.tonConnectManifestUrl) {
      const manifest: TonConnectManifest | undefined = config.tonConnectManifest
        ? {
            url: config.tonConnectManifest.url,
            name: config.tonConnectManifest.name,
            iconUrl: config.tonConnectManifest.iconUrl,
            ...(config.tonConnectManifest.termsOfUseUrl
              ? { termsOfUseUrl: config.tonConnectManifest.termsOfUseUrl }
              : {}),
            ...(config.tonConnectManifest.privacyPolicyUrl
              ? { privacyPolicyUrl: config.tonConnectManifest.privacyPolicyUrl }
              : {}),
          }
        : undefined;

      this.connector = new TonConnectConnector({
        manifestUrl: config.tonConnectManifestUrl,
        manifest,
        network: config.network,
      });
      this.connectorUnsubscribe = this.connector.on(event => this.handleConnectorEvent(event));
    }
  }

  /**
   * Mount the wallet UI into the container element
   *
   * @throws Error if container element is not found in the DOM
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
   * Unmount the wallet UI and clean up
   */
  unmount(): void {
    if (this.activeSelector?.isOpen()) {
      this.activeSelector.close();
    }
    this.activeSelector = null;

    if (this.connectorUnsubscribe) {
      this.connectorUnsubscribe();
      this.connectorUnsubscribe = null;
    }

    if (!this.mounted || !this.container) {
      return;
    }

    this.container.innerHTML = '';
    this.mounted = false;
  }

  /**
   * Set the account data to display
   *
   * SECURITY NOTICE: This method only updates the displayed data.
   * It does NOT modify any on-chain state.
   *
   * @param account - Wallet account data (read-only view of on-chain state)
   */
  setAccount(account: WalletAccount): void {
    this.account = account;
    if (this.mounted && this.container) {
      this.container.innerHTML = '';
      this.render();
    }
  }

  /**
   * Set the transaction list to display
   *
   * SECURITY NOTICE: This method only updates the displayed data.
   * It does NOT modify any on-chain state.
   *
   * @param txs - Array of transaction records for display
   */
  setTransactions(txs: TransactionRecord[]): void {
    this.transactions = txs;
    if (this.mounted && this.container) {
      this.container.innerHTML = '';
      this.render();
    }
  }

  /**
   * Generate a TON Connect deep link for wallet connection.
   *
   * When a TON Connect manifest URL is configured, the UI defers wallet
   * selection to the WalletSelector modal and this method continues to
   * expose a simple `ton://transfer` link for legacy callers/tests.
   *
   * SECURITY NOTICE: This link only opens the user's wallet app.
   * No signing or fund transfers are initiated by this method.
   *
   * @returns ton:// deep link URL
   */
  generateConnectLink(): string {
    // Build through buildTonTransferLink so the configured address is validated
    // (Address.parse) and URL-encoded rather than interpolated verbatim into the
    // ton:// URL. This prevents a malformed/hostile paymentHubAddress from
    // injecting extra path segments or query parameters into the deep link.
    return buildTonTransferLink({
      address: this.config.paymentHubAddress,
      text: 'TONBANKCARD Wallet Connection',
    });
  }

  /**
   * Return the active TON Connect connector, if one was configured.
   *
   * SECURITY NOTICE: The connector exposes only public connection
   * metadata; signing always happens inside the user's wallet app.
   */
  getConnector(): TonConnectConnector | null {
    return this.connector;
  }

  /**
   * Snapshot of the current TON Connect connection state, or `null` when
   * no connector is configured.
   */
  getConnectionState(): ConnectionState | null {
    return this.connector ? this.connector.getState() : null;
  }

  /**
   * Open the wallet selector modal. No-op when TON Connect is not
   * configured. Returns the {@link WalletSelector} so callers (and
   * tests) can interact with the open modal.
   */
  openWalletSelector(): WalletSelector | null {
    if (!this.connector) return null;
    if (this.activeSelector?.isOpen()) return this.activeSelector;

    const selector = new WalletSelector({
      manifestUrl: this.config.tonConnectManifestUrl as string,
      theme: this.config.theme === 'dark' ? 'dark' : 'light',
      onWalletSelected: wallet => {
        try {
          this.connector?.connect(wallet.id);
        } catch (err) {
          this.config.onError?.(err as Error);
        }
        selector.close();
      },
      onClose: () => {
        this.activeSelector = null;
      },
      onError: err => this.config.onError?.(err),
    });

    selector.show();
    this.activeSelector = selector;
    return selector;
  }

  /**
   * Tear down the active TON Connect session. No-op when no connector is
   * configured or no session exists.
   */
  disconnect(): void {
    this.connector?.disconnect();
  }

  /**
   * Build a `ton://transfer` deep link for the Payment Hub or an
   * arbitrary address. When a connector is configured and connected, the
   * link is routed through the user's wallet universal link so it opens
   * directly in the connected app.
   *
   * SECURITY NOTICE: Builds a sign-request URL only; the wallet performs
   * any signing.
   */
  buildPaymentLink(params: Partial<TonTransferParams> & { address?: string } = {}): string {
    const merged: TonTransferParams = {
      address: params.address ?? this.config.paymentHubAddress,
      ...(params.amount !== undefined ? { amount: params.amount } : {}),
      ...(params.text !== undefined ? { text: params.text } : {}),
      ...(params.bin !== undefined ? { bin: params.bin } : {}),
      ...(params.init !== undefined ? { init: params.init } : {}),
    };

    if (this.connector && this.connector.getState().status === 'connected') {
      try {
        return this.connector.buildTransferLink(merged);
      } catch {
        // Fall through to plain ton:// link if the connected wallet has
        // no universal-link template.
      }
    }
    return buildTonTransferLink(merged);
  }

  /**
   * Generate an SVG QR code for a payment request. Useful for desktop
   * checkout flows where the user scans the code with their phone wallet.
   *
   * SECURITY NOTICE: The encoded data is a public payment URL only.
   */
  renderPaymentQR(
    params: Partial<TonTransferParams> & { address?: string } = {},
    options: { scale?: number; margin?: number } = {}
  ): string {
    const link = this.buildPaymentLink(params);
    const isDark = this.config.theme === 'dark';
    return generateQRSvg(link, {
      errorLevel: 'M',
      scale: options.scale ?? 4,
      margin: options.margin ?? 2,
      darkColor: isDark ? '#e0e0ff' : '#1a1a1a',
      lightColor: isDark ? '#1a1a2e' : '#ffffff',
    });
  }

  /**
   * Get the currently active view
   *
   * @returns Current WalletView
   */
  getCurrentView(): WalletView {
    return this.currentView;
  }

  /**
   * Get the current account data
   *
   * @returns Current WalletAccount or null
   */
  getAccount(): WalletAccount | null {
    return this.account;
  }

  /**
   * Get the current transaction list
   *
   * @returns Current array of TransactionRecord
   */
  getTransactions(): TransactionRecord[] {
    return this.transactions;
  }

  /**
   * Render the complete wallet UI
   */
  private render(): void {
    if (!this.container) return;

    const isDark = this.config.theme === 'dark';

    const card = document.createElement('div');
    card.className = 'tonbankcard-wallet';
    card.style.cssText = [
      'font-family:system-ui,-apple-system,sans-serif',
      'border-radius:16px',
      'padding:24px',
      'max-width:420px',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff;border:1px solid #333'
        : 'background:#ffffff;color:#1a1a1a;border:1px solid #e0e0e0',
    ].join(';');

    // Header
    card.appendChild(this.renderHeader(isDark));

    // Navigation
    card.appendChild(this.renderNav(isDark));

    // Content
    switch (this.currentView) {
      case WalletView.BALANCE:
        card.appendChild(this.renderBalanceView(isDark));
        break;
      case WalletView.TRANSACTIONS:
        card.appendChild(this.renderTransactionsView(isDark));
        break;
      case WalletView.SETTINGS:
        card.appendChild(this.renderSettingsView(isDark));
        break;
    }

    // Connect Wallet button
    card.appendChild(this.renderConnectButton(isDark));

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = `margin-top:12px;font-size:11px;text-align:center;${isDark ? 'color:#666;' : 'color:#aaa;'}`;
    footer.textContent = 'Non-custodial wallet interface via TON blockchain';
    card.appendChild(footer);

    this.container.appendChild(card);
  }

  /**
   * Render the header section
   */
  private renderHeader(isDark: boolean): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:16px;';
    header.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="${isDark ? '#6c8aff' : '#0088cc'}" opacity="0.8"/>
      <path d="M2 17l10 5 10-5" stroke="${isDark ? '#6c8aff' : '#0088cc'}" stroke-width="2" fill="none"/>
      <path d="M2 12l10 5 10-5" stroke="${isDark ? '#6c8aff' : '#0088cc'}" stroke-width="2" fill="none"/>
    </svg>
    <span style="font-size:18px;font-weight:700;">TONBANKCARD Wallet</span>`;
    return header;
  }

  /**
   * Render the navigation tabs
   */
  private renderNav(isDark: boolean): HTMLElement {
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:4px;margin-bottom:16px;';

    const views: { view: WalletView; label: string }[] = [
      { view: WalletView.BALANCE, label: 'Balance' },
      { view: WalletView.TRANSACTIONS, label: 'Transactions' },
      { view: WalletView.SETTINGS, label: 'Settings' },
    ];

    for (const { view, label } of views) {
      const tab = document.createElement('button');
      const isActive = this.currentView === view;
      tab.style.cssText = [
        'padding:8px 16px',
        'border:none',
        'border-radius:8px',
        'font-size:13px',
        'font-weight:500',
        'cursor:pointer',
        'transition:opacity 0.2s',
        isActive
          ? isDark
            ? 'background:#3a5aff;color:#ffffff'
            : 'background:#0088cc;color:#ffffff'
          : isDark
            ? 'background:#2a2a3e;color:#aaa'
            : 'background:#f0f0f0;color:#666',
      ].join(';');
      tab.textContent = label;
      tab.addEventListener('click', () => {
        this.currentView = view;
        if (this.container) {
          this.container.innerHTML = '';
          this.render();
        }
      });
      nav.appendChild(tab);
    }

    return nav;
  }

  /**
   * Render the balance view
   */
  private renderBalanceView(isDark: boolean): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = 'min-height:120px;';

    if (!this.account) {
      const empty = document.createElement('div');
      empty.style.cssText = `text-align:center;padding:32px 0;font-size:14px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      empty.textContent = 'No account connected';
      content.appendChild(empty);
      return content;
    }

    // NFT Address
    const addrEl = document.createElement('div');
    addrEl.style.cssText = `margin-bottom:8px;font-size:12px;font-family:monospace;${isDark ? 'color:#888;' : 'color:#999;'}`;
    addrEl.textContent = shortAddress(this.account.nftAddress);
    content.appendChild(addrEl);

    // Balance
    const balanceEl = document.createElement('div');
    balanceEl.style.cssText = 'font-size:36px;font-weight:700;margin-bottom:8px;';
    balanceEl.textContent = `${formatTBC(this.account.balance)} TBC`;
    content.appendChild(balanceEl);

    // Account state
    const stateEl = document.createElement('div');
    const stateLabel = getAccountStateLabel(this.account.state);
    const stateColor = this.account.state === AccountState.ACTIVE
      ? '#22c55e'
      : this.account.state === AccountState.FROZEN
        ? '#ef4444'
        : '#f59e0b';
    stateEl.style.cssText = `margin-bottom:12px;font-size:13px;color:${stateColor};font-weight:500;`;
    stateEl.textContent = stateLabel;
    content.appendChild(stateEl);

    // Capability badges
    const badges = document.createElement('div');
    badges.style.cssText = 'display:flex;gap:8px;';

    const sendBadge = document.createElement('span');
    sendBadge.style.cssText = [
      'padding:4px 12px',
      'border-radius:12px',
      'font-size:12px',
      'font-weight:500',
      this.account.canSend
        ? isDark
          ? 'background:#1a3a1a;color:#4ade80'
          : 'background:#dcfce7;color:#16a34a'
        : isDark
          ? 'background:#3a1a1a;color:#f87171'
          : 'background:#fef2f2;color:#dc2626',
    ].join(';');
    sendBadge.textContent = this.account.canSend ? 'Can Send' : 'Cannot Send';
    badges.appendChild(sendBadge);

    const receiveBadge = document.createElement('span');
    receiveBadge.style.cssText = [
      'padding:4px 12px',
      'border-radius:12px',
      'font-size:12px',
      'font-weight:500',
      this.account.canReceive
        ? isDark
          ? 'background:#1a3a1a;color:#4ade80'
          : 'background:#dcfce7;color:#16a34a'
        : isDark
          ? 'background:#3a1a1a;color:#f87171'
          : 'background:#fef2f2;color:#dc2626',
    ].join(';');
    receiveBadge.textContent = this.account.canReceive ? 'Can Receive' : 'Cannot Receive';
    badges.appendChild(receiveBadge);

    content.appendChild(badges);

    return content;
  }

  /**
   * Render the transactions view
   */
  private renderTransactionsView(isDark: boolean): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = 'min-height:120px;';

    if (this.transactions.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `text-align:center;padding:32px 0;font-size:14px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      empty.textContent = 'No transactions';
      content.appendChild(empty);
      return content;
    }

    for (const tx of this.transactions) {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:12px',
        'padding:12px 0',
        isDark
          ? 'border-bottom:1px solid #333'
          : 'border-bottom:1px solid #eee',
      ].join(';');

      // Type icon
      const icon = document.createElement('div');
      icon.style.cssText = [
        'width:32px',
        'height:32px',
        'border-radius:50%',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'font-size:16px',
        'flex-shrink:0',
        tx.type === 'receive'
          ? isDark
            ? 'background:#1a3a1a;color:#4ade80'
            : 'background:#dcfce7;color:#16a34a'
          : isDark
            ? 'background:#3a1a1a;color:#f87171'
            : 'background:#fef2f2;color:#dc2626',
      ].join(';');
      icon.textContent = tx.type === 'receive' ? '+' : '-';
      row.appendChild(icon);

      // Details
      const details = document.createElement('div');
      details.style.cssText = 'flex:1;min-width:0;';

      const counterparty = document.createElement('div');
      counterparty.style.cssText = 'font-size:13px;font-weight:500;';
      counterparty.textContent = shortAddress(tx.counterparty, 4);
      details.appendChild(counterparty);

      const date = document.createElement('div');
      date.style.cssText = `font-size:11px;${isDark ? 'color:#888;' : 'color:#999;'}`;
      date.textContent = formatDate(tx.timestamp);
      details.appendChild(date);

      row.appendChild(details);

      // Amount and status
      const amountWrap = document.createElement('div');
      amountWrap.style.cssText = 'text-align:right;';

      const amountEl = document.createElement('div');
      amountEl.style.cssText = `font-size:14px;font-weight:600;${tx.type === 'receive' ? 'color:#22c55e;' : ''}`;
      amountEl.textContent = `${tx.type === 'receive' ? '+' : '-'}${formatTBC(tx.amount)} TBC`;
      amountWrap.appendChild(amountEl);

      const statusEl = document.createElement('div');
      statusEl.style.cssText = `font-size:11px;${tx.status === 'confirmed' ? 'color:#22c55e;' : 'color:#f59e0b;'}`;
      statusEl.textContent = tx.status;
      amountWrap.appendChild(statusEl);

      row.appendChild(amountWrap);

      content.appendChild(row);
    }

    return content;
  }

  /**
   * Render the settings view
   */
  private renderSettingsView(isDark: boolean): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = 'min-height:120px;';

    const rows: { label: string; value: string }[] = [
      { label: 'Network', value: this.config.network },
      { label: 'Payment Hub', value: shortAddress(this.config.paymentHubAddress) },
    ];

    if (this.account) {
      rows.push(
        { label: 'NFT Address', value: shortAddress(this.account.nftAddress) },
        { label: 'Balance', value: `${formatTBC(this.account.balance)} TBC` },
        { label: 'Account State', value: getAccountStateLabel(this.account.state) },
        { label: 'Can Send', value: this.account.canSend ? 'Yes' : 'No' },
        { label: 'Can Receive', value: this.account.canReceive ? 'Yes' : 'No' },
      );
    }

    for (const { label, value } of rows) {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex',
        'justify-content:space-between',
        'padding:10px 0',
        isDark
          ? 'border-bottom:1px solid #333'
          : 'border-bottom:1px solid #eee',
      ].join(';');

      const labelEl = document.createElement('span');
      labelEl.style.cssText = `font-size:13px;${isDark ? 'color:#aaa;' : 'color:#666;'}`;
      labelEl.textContent = label;
      row.appendChild(labelEl);

      const valueEl = document.createElement('span');
      valueEl.style.cssText = 'font-size:13px;font-weight:500;';
      valueEl.textContent = value;
      row.appendChild(valueEl);

      content.appendChild(row);
    }

    return content;
  }

  /**
   * Render the Connect Wallet button. When a TON Connect manifest URL is
   * configured, the button opens the {@link WalletSelector} modal so the
   * user can pick between Tonkeeper, Tonhub, OpenMask, ... Otherwise it
   * falls back to the legacy `ton://transfer` link.
   *
   * SECURITY NOTICE: This button only opens the user's wallet app; no
   * signing or fund transfers happen here.
   */
  private renderConnectButton(isDark: boolean): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:16px;';

    if (this.connector) {
      wrapper.appendChild(this.renderConnectorStatus(isDark));
    }

    const state = this.connector?.getState();
    const isConnected = state?.status === 'connected';

    let btn: HTMLAnchorElement | HTMLButtonElement;
    if (this.connector && !isConnected) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent =
        state?.status === 'pending' ? 'Waiting for wallet...' : 'Connect Wallet';
      button.setAttribute('data-testid', 'tonconnect-open-selector');
      button.addEventListener('click', () => {
        this.openWalletSelector();
      });
      btn = button;
    } else if (this.connector && isConnected) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Disconnect';
      button.setAttribute('data-testid', 'tonconnect-disconnect');
      button.addEventListener('click', () => {
        this.disconnect();
      });
      btn = button;
    } else {
      const link = document.createElement('a');
      link.href = this.generateConnectLink();
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Connect Wallet';
      btn = link;
    }

    btn.style.cssText = [
      'display:block',
      'width:100%',
      'padding:12px',
      'border:none',
      'border-radius:12px',
      'font-size:14px',
      'font-weight:600',
      'cursor:pointer',
      'text-align:center',
      'text-decoration:none',
      'box-sizing:border-box',
      'transition:opacity 0.2s',
      isConnected
        ? isDark
          ? 'background:#3a1a1a;color:#fca5a5'
          : 'background:#fee2e2;color:#b91c1c'
        : isDark
          ? 'background:#3a5aff;color:#ffffff'
          : 'background:#0088cc;color:#ffffff',
    ].join(';');

    btn.onmouseover = () => {
      btn.style.opacity = '0.85';
    };
    btn.onmouseout = () => {
      btn.style.opacity = '1';
    };

    wrapper.appendChild(btn);
    return wrapper;
  }

  /**
   * Render a small status badge above the Connect button so the user
   * always knows whether a wallet is linked, pending, or disconnected.
   */
  private renderConnectorStatus(isDark: boolean): HTMLElement {
    const status = this.connector?.getState();
    const row = document.createElement('div');
    row.setAttribute('data-testid', 'tonconnect-status');
    row.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:8px',
      'margin-bottom:8px',
      'font-size:12px',
      isDark ? 'color:#aaa' : 'color:#555',
    ].join(';');

    const label = document.createElement('span');
    if (!status || status.status === 'disconnected') {
      label.textContent = 'Wallet: not connected';
    } else if (status.status === 'pending') {
      label.textContent = 'Wallet: connecting...';
    } else {
      label.textContent = `Wallet: ${shortAddress(status.address ?? '')}`;
    }
    row.appendChild(label);

    if (status?.status === 'pending') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.style.cssText = [
        'padding:4px 10px',
        'border:none',
        'border-radius:8px',
        'font-size:11px',
        'cursor:pointer',
        isDark ? 'background:#2a2a3e;color:#aaa' : 'background:#f0f0f0;color:#666',
      ].join(';');
      cancel.addEventListener('click', () => {
        this.connector?.cancel();
      });
      row.appendChild(cancel);
    }

    return row;
  }

  /**
   * Connector event handler. Re-renders the UI on every status change so
   * the badge and button reflect the latest session state.
   */
  private handleConnectorEvent(event: ConnectorEvent): void {
    switch (event.type) {
      case 'error':
        this.config.onError?.(event.error);
        break;
      case 'statusChange':
      case 'connected':
      case 'disconnected':
        if (this.mounted && this.container) {
          this.container.innerHTML = '';
          this.render();
        }
        break;
    }
  }
}
