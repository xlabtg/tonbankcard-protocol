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

    this.config = {
      theme: 'light',
      ...config,
    };
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
   * Generate a TON Connect deep link for wallet connection
   *
   * SECURITY NOTICE: This link only opens the user's wallet app.
   * No signing or fund transfers are initiated by this method.
   *
   * @returns ton:// deep link URL
   */
  generateConnectLink(): string {
    const text = encodeURIComponent('TONBANKCARD Wallet Connection');
    return `ton://transfer/${this.config.paymentHubAddress}?text=${text}`;
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
   * Render the Connect Wallet button
   *
   * SECURITY NOTICE: This button generates a ton:// deep link that opens
   * the user's wallet app. No signing or fund transfers are initiated.
   */
  private renderConnectButton(isDark: boolean): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top:16px;';

    const btn = document.createElement('a');
    btn.href = this.generateConnectLink();
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
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
      isDark
        ? 'background:#3a5aff;color:#ffffff'
        : 'background:#0088cc;color:#ffffff',
    ].join(';');
    btn.textContent = 'Connect Wallet';
    btn.onmouseover = () => {
      btn.style.opacity = '0.85';
    };
    btn.onmouseout = () => {
      btn.style.opacity = '1';
    };

    wrapper.appendChild(btn);
    return wrapper;
  }
}
