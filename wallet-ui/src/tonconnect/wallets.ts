/**
 * TONBANKCARD Wallet UI - TON Connect Wallet Registry
 *
 * Static metadata for TON Connect v2 compatible wallets. The protocol
 * itself relies on the wallet to hold all signing material; this module
 * only describes how to address each wallet (universal link, deep link
 * scheme, platforms).
 *
 * SECURITY NOTICE:
 * - This module is metadata only. It NEVER stores keys.
 * - All connection requests are routed through the user's wallet app.
 */

/**
 * Platforms a wallet can be reached on.
 */
export type WalletPlatform =
  | 'ios'
  | 'android'
  | 'macos'
  | 'windows'
  | 'linux'
  | 'web'
  | 'browser-extension';

/**
 * Bridge type for TON Connect v2.
 * - 'js' wallets are reached through an injected `window.tonconnect`-style provider.
 * - 'sse' wallets are reached through an HTTP bridge with Server-Sent Events.
 */
export type WalletBridgeType = 'sse' | 'js';

/**
 * SSE bridge configuration entry.
 */
export interface SseBridgeConfig {
  type: 'sse';
  /** HTTPS URL of the wallet's TON Connect bridge */
  url: string;
}

/**
 * Injected JS bridge configuration entry.
 */
export interface JsBridgeConfig {
  type: 'js';
  /** Property name on window for the injected provider */
  key: string;
}

export type WalletBridgeConfig = SseBridgeConfig | JsBridgeConfig;

/**
 * TON Connect compatible wallet descriptor.
 */
export interface TonConnectWallet {
  /** Unique wallet identifier (e.g. "tonkeeper") */
  id: string;

  /** Human-readable wallet name */
  name: string;

  /** URL to the wallet's home page */
  aboutUrl: string;

  /** Public URL for the wallet's square icon (PNG/SVG) */
  imageUrl: string;

  /** Platforms supported by the wallet */
  platforms: WalletPlatform[];

  /**
   * Universal HTTPS link template.
   * Use `{payload}` as the placeholder for the URL-encoded TON Connect
   * request payload. If not provided, the wallet does not support
   * universal links (use deepLinkBase or bridge instead).
   */
  universalLink?: string;

  /**
   * Native deep-link scheme template (e.g. `tonkeeper-tc://...`).
   * Use `{payload}` as the placeholder for the URL-encoded TON Connect
   * request payload. If not provided, fall back to the universal link.
   */
  deepLink?: string;

  /**
   * TON Connect bridge configuration. SSE wallets use an HTTP bridge; JS
   * wallets are reached through an injected provider in the page.
   */
  bridge: WalletBridgeConfig[];
}

/**
 * Built-in registry of well-known TON Connect wallets.
 *
 * Sources: https://github.com/ton-blockchain/wallets-list and the
 * official wallet documentation pages.
 */
export const KNOWN_WALLETS: readonly TonConnectWallet[] = Object.freeze([
  {
    id: 'tonkeeper',
    name: 'Tonkeeper',
    aboutUrl: 'https://tonkeeper.com',
    imageUrl: 'https://tonkeeper.com/assets/tonconnect-icon.png',
    platforms: ['ios', 'android', 'macos', 'windows', 'linux', 'browser-extension'],
    universalLink: 'https://app.tonkeeper.com/ton-connect?{payload}',
    deepLink: 'tonkeeper-tc://?{payload}',
    bridge: [
      { type: 'sse', url: 'https://bridge.tonapi.io/bridge' },
      { type: 'js', key: 'tonkeeper' },
    ],
  },
  {
    id: 'tonhub',
    name: 'Tonhub',
    aboutUrl: 'https://tonhub.com',
    imageUrl: 'https://tonhub.com/tonconnect_logo.png',
    platforms: ['ios', 'android'],
    universalLink: 'https://tonhub.com/ton-connect?{payload}',
    bridge: [{ type: 'sse', url: 'https://connect.tonhubapi.com/tonconnect' }],
  },
  {
    id: 'openmask',
    name: 'OpenMask',
    aboutUrl: 'https://www.openmask.app',
    imageUrl: 'https://raw.githubusercontent.com/OpenProduct/openmask-extension/main/public/openmask-logo-288.png',
    platforms: ['browser-extension'],
    bridge: [{ type: 'js', key: 'openmask' }],
  },
  {
    id: 'mytonwallet',
    name: 'MyTonWallet',
    aboutUrl: 'https://mytonwallet.io',
    imageUrl: 'https://mytonwallet.io/icon-256.png',
    platforms: ['ios', 'android', 'macos', 'windows', 'linux', 'web', 'browser-extension'],
    universalLink: 'https://connect.mytonwallet.org?{payload}',
    deepLink: 'mytonwallet-tc://?{payload}',
    bridge: [
      { type: 'sse', url: 'https://tonconnectbridge.mytonwallet.org/bridge/' },
      { type: 'js', key: 'mytonwallet' },
    ],
  },
]);

/**
 * Find a wallet by id. Returns `undefined` if no wallet matches.
 *
 * @param id - Case-insensitive wallet identifier
 */
export function getWalletById(id: string): TonConnectWallet | undefined {
  if (!id) return undefined;
  const target = id.toLowerCase();
  return KNOWN_WALLETS.find(w => w.id.toLowerCase() === target);
}

/**
 * Detect the user's runtime platform from a User-Agent string.
 *
 * @param userAgent - Optional UA string; defaults to `navigator.userAgent`
 *   when available, otherwise `''`.
 */
export function detectPlatform(userAgent?: string): WalletPlatform | 'unknown' {
  const ua =
    userAgent ??
    (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
      ? navigator.userAgent
      : '');

  if (!ua) return 'unknown';

  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Mac OS X/i.test(ua)) return 'macos';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Linux/i.test(ua)) return 'linux';
  return 'web';
}

/**
 * Filter the wallet registry to wallets compatible with a given platform.
 *
 * @param platform - Runtime platform to match
 * @param wallets - Wallet pool (defaults to {@link KNOWN_WALLETS})
 */
export function walletsForPlatform(
  platform: WalletPlatform | 'unknown',
  wallets: readonly TonConnectWallet[] = KNOWN_WALLETS
): TonConnectWallet[] {
  if (platform === 'unknown') return [...wallets];
  return wallets.filter(w => w.platforms.includes(platform));
}
