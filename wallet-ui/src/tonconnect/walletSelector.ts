/**
 * TONBANKCARD Wallet UI - Wallet Selector Modal
 *
 * Vanilla-DOM modal that lets the user choose a TON Connect-compatible
 * wallet to connect to. Renders a list of supported wallets along with
 * a QR code for desktop fallback.
 *
 * SECURITY NOTICE:
 * - This modal renders metadata and URLs only. No key material crosses
 *   the modal boundary.
 * - All connections are initiated via universal/deep links handed off
 *   to the user's chosen wallet app.
 */

import {
  KNOWN_WALLETS,
  detectPlatform,
  walletsForPlatform,
  type TonConnectWallet,
  type WalletPlatform,
} from './wallets';
import { buildWalletConnectLink, type TonConnectRequestItem } from './deepLink';
import { generateQRSvg } from './qrCode';
import { validateManifest, type TonConnectManifest } from './manifest';

/**
 * Configuration for {@link WalletSelector}.
 */
export interface WalletSelectorOptions {
  /** Public HTTPS URL of the dapp's TON Connect manifest */
  manifestUrl: string;

  /** Optional manifest object for inline validation */
  manifest?: TonConnectManifest;

  /** Wallets to display (defaults to {@link KNOWN_WALLETS}) */
  wallets?: readonly TonConnectWallet[];

  /** TON Connect request items (defaults to `[{ name: 'ton_addr' }]`) */
  items?: TonConnectRequestItem[];

  /** Visual theme (defaults to 'light') */
  theme?: 'light' | 'dark';

  /** Override platform detection (useful for tests) */
  platform?: WalletPlatform | 'unknown';

  /** Callback when the user picks a wallet and the link is opened */
  onWalletSelected?: (wallet: TonConnectWallet, link: string) => void;

  /** Callback when the modal closes (Cancel or backdrop click) */
  onClose?: () => void;

  /** Callback fired on configuration errors */
  onError?: (error: Error) => void;
}

/**
 * Lightweight modal for choosing a TON Connect wallet.
 */
export class WalletSelector {
  private opts: Required<Pick<WalletSelectorOptions, 'manifestUrl'>> &
    WalletSelectorOptions;
  private root: HTMLElement | null = null;

  constructor(options: WalletSelectorOptions) {
    if (!options.manifestUrl) {
      throw new Error('manifestUrl is required');
    }

    if (options.manifest) {
      const validation = validateManifest(options.manifest);
      if (!validation.ok) {
        throw new Error(
          `Invalid TON Connect manifest: ${validation.errors.join(', ')}`
        );
      }
    }

    this.opts = { theme: 'light', ...options };
  }

  /**
   * Render the modal into `document.body` and return its root element.
   */
  show(): HTMLElement {
    if (this.root) return this.root;
    if (typeof document === 'undefined') {
      throw new Error('WalletSelector.show() requires a DOM environment');
    }

    const wallets = this.opts.wallets ?? KNOWN_WALLETS;
    const platform = this.opts.platform ?? detectPlatform();
    const visibleWallets =
      platform === 'unknown'
        ? [...wallets]
        : walletsForPlatform(platform, wallets);

    const isDark = this.opts.theme === 'dark';

    const overlay = document.createElement('div');
    overlay.className = 'tonbankcard-wallet-selector-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Choose a TON Connect wallet');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.55)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:2147483000',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close();
    });

    const dialog = document.createElement('div');
    dialog.style.cssText = [
      'min-width:320px',
      'max-width:420px',
      'width:90%',
      'border-radius:16px',
      'padding:24px',
      'box-shadow:0 12px 48px rgba(0,0,0,0.32)',
      isDark
        ? 'background:#1a1a2e;color:#e0e0ff;border:1px solid #333'
        : 'background:#ffffff;color:#1a1a1a',
    ].join(';');

    dialog.appendChild(this.renderHeader(isDark));
    dialog.appendChild(this.renderWalletList(visibleWallets, isDark));
    dialog.appendChild(this.renderQRSection(visibleWallets, isDark));
    dialog.appendChild(this.renderCancel(isDark));

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    this.root = overlay;
    return overlay;
  }

  /**
   * Remove the modal from the DOM, if mounted.
   */
  close(): void {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    this.opts.onClose?.();
  }

  /**
   * Returns true while the modal is mounted in the DOM.
   */
  isOpen(): boolean {
    return this.root !== null;
  }

  // ---- private rendering helpers --------------------------------------

  private renderHeader(isDark: boolean): HTMLElement {
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:16px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:18px;font-weight:700;';
    title.textContent = 'Connect TON wallet';
    header.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.style.cssText = `margin-top:4px;font-size:13px;${isDark ? 'color:#aaa;' : 'color:#666;'}`;
    subtitle.textContent = 'Pick a wallet to approve the connection.';
    header.appendChild(subtitle);

    return header;
  }

  private renderWalletList(wallets: TonConnectWallet[], isDark: boolean): HTMLElement {
    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

    if (wallets.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = `padding:12px;font-size:13px;text-align:center;${isDark ? 'color:#888;' : 'color:#999;'}`;
      empty.textContent = 'No TON Connect wallets available for this platform.';
      list.appendChild(empty);
      return list;
    }

    for (const wallet of wallets) {
      const link = buildWalletConnectLink(wallet, this.opts.manifestUrl, {
        items: this.opts.items,
      });
      const row = document.createElement('a');
      row.setAttribute('data-wallet-id', wallet.id);
      row.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:12px',
        'padding:12px',
        'border-radius:12px',
        'cursor:pointer',
        'text-decoration:none',
        'transition:background 0.15s',
        isDark
          ? 'background:#23233a;color:#e0e0ff;border:1px solid #333'
          : 'background:#f7f7fb;color:#1a1a1a;border:1px solid #e0e0e0',
      ].join(';');
      row.href = link ?? '#';
      row.target = '_blank';
      row.rel = 'noopener noreferrer';
      if (!link) {
        row.removeAttribute('href');
        row.style.cursor = 'not-allowed';
        row.style.opacity = '0.5';
      }

      const icon = document.createElement('img');
      icon.alt = '';
      icon.src = wallet.imageUrl;
      icon.width = 32;
      icon.height = 32;
      icon.style.cssText = 'border-radius:8px;flex-shrink:0;';
      icon.addEventListener('error', () => {
        icon.style.display = 'none';
      });
      row.appendChild(icon);

      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      const name = document.createElement('div');
      name.style.cssText = 'font-size:14px;font-weight:600;';
      name.textContent = wallet.name;
      info.appendChild(name);
      const platforms = document.createElement('div');
      platforms.style.cssText = `font-size:11px;${isDark ? 'color:#888;' : 'color:#888;'}`;
      platforms.textContent = wallet.platforms.join(' · ');
      info.appendChild(platforms);
      row.appendChild(info);

      row.addEventListener('click', e => {
        if (!link) {
          e.preventDefault();
          return;
        }
        this.opts.onWalletSelected?.(wallet, link);
      });

      list.appendChild(row);
    }

    return list;
  }

  private renderQRSection(wallets: TonConnectWallet[], isDark: boolean): HTMLElement {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top:16px;';

    const universalWallet = wallets.find(w => w.universalLink);
    if (!universalWallet) return section;

    const link = buildWalletConnectLink(universalWallet, this.opts.manifestUrl, {
      items: this.opts.items,
    });
    if (!link) return section;

    const label = document.createElement('div');
    label.style.cssText = `font-size:12px;text-align:center;margin-bottom:8px;${isDark ? 'color:#aaa;' : 'color:#666;'}`;
    label.textContent = 'Or scan with your phone:';
    section.appendChild(label);

    let svgMarkup: string;
    try {
      svgMarkup = generateQRSvg(link, {
        errorLevel: 'M',
        scale: 4,
        margin: 2,
        darkColor: isDark ? '#e0e0ff' : '#1a1a1a',
        lightColor: isDark ? '#1a1a2e' : '#ffffff',
      });
    } catch (err) {
      this.opts.onError?.(err as Error);
      return section;
    }

    const qrWrap = document.createElement('div');
    qrWrap.setAttribute('data-testid', 'tonconnect-qr');
    qrWrap.style.cssText = 'display:flex;justify-content:center;';
    qrWrap.innerHTML = svgMarkup;
    section.appendChild(qrWrap);

    return section;
  }

  private renderCancel(isDark: boolean): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:16px;display:flex;justify-content:center;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Cancel';
    btn.style.cssText = [
      'padding:10px 24px',
      'border:none',
      'border-radius:10px',
      'font-size:13px',
      'font-weight:500',
      'cursor:pointer',
      isDark
        ? 'background:#2a2a3e;color:#aaa'
        : 'background:#f0f0f0;color:#666',
    ].join(';');
    btn.addEventListener('click', () => this.close());
    wrap.appendChild(btn);

    return wrap;
  }
}
