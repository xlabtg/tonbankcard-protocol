/**
 * TONBANKCARD Wallet UI - TON Deep Link Builder
 *
 * Generates `ton://` deep links and wallet-specific universal links for
 * TON Connect v2. Pure URL building; no I/O, no signing, no storage of
 * secrets.
 *
 * References:
 * - ton:// transfer scheme: https://github.com/tonkeeper/wallet-api#payment-urls
 * - TON Connect protocol:   https://docs.ton.org/develop/dapps/ton-connect/protocol
 */

import { Address } from '@ton/core';

import { KNOWN_WALLETS, type TonConnectWallet } from './wallets';
import type { TonConnectManifest } from './manifest';

/**
 * Parameters for a `ton://transfer/<address>?...` link.
 */
export interface TonTransferParams {
  /** Recipient TON address (raw or user-friendly form) */
  address: string;

  /** Optional amount in nanocoins as a string of digits */
  amount?: string;

  /** Optional text comment forwarded to the recipient */
  text?: string;

  /** Optional binary payload (base64url) for advanced flows */
  bin?: string;

  /** Optional state init (base64url) for deploy + transfer flows */
  init?: string;
}

/**
 * TON Connect connection request items the dapp asks the wallet for.
 */
export interface TonConnectRequestItem {
  /** Item name; "ton_addr" returns the wallet address, "ton_proof" returns a signed proof */
  name: 'ton_addr' | 'ton_proof';

  /**
   * Required payload for `ton_proof` items: a short string the wallet
   * will sign so the dapp can verify wallet ownership.
   */
  payload?: string;
}

/**
 * Payload of a TON Connect v2 connection request.
 *
 * Reference: https://docs.ton.org/develop/dapps/ton-connect/protocol#sending-the-request
 */
export interface TonConnectRequest {
  /** Always 2 for TON Connect v2 */
  v: 2;

  /** HTTPS URL to the dapp's TON Connect manifest */
  manifestUrl: string;

  /** Items the dapp wants the wallet to return */
  items: TonConnectRequestItem[];
}

/**
 * Throws if the supplied address is empty or is not a parseable TON
 * user-friendly / raw address.
 *
 * Exported so callers that build deep links from a configured address (e.g.
 * `WalletApp.generateConnectLink`) can validate it up front instead of
 * interpolating an unvalidated string into a `ton://` URL.
 */
export function assertValidAddress(address: string): void {
  if (typeof address !== 'string' || address.length === 0) {
    throw new Error('address is required');
  }
  try {
    Address.parse(address);
  } catch {
    throw new Error(`invalid TON address: ${address}`);
  }
}

function assertNonNegativeIntegerString(value: string, field: string): void {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${field} must be a non-negative integer string`);
  }
}

/**
 * Build a `ton://transfer/<address>?...` deep link.
 *
 * The resulting URL can be opened by any TON Connect-compatible wallet
 * on iOS, Android, or desktop to pre-fill a send screen. The wallet —
 * not this code — is responsible for signing and broadcasting.
 *
 * @throws Error when the address or numeric parameters are malformed.
 */
export function buildTonTransferLink(params: TonTransferParams): string {
  assertValidAddress(params.address);

  const query = new URLSearchParams();
  if (params.amount !== undefined) {
    assertNonNegativeIntegerString(params.amount, 'amount');
    query.set('amount', params.amount);
  }
  if (params.text !== undefined && params.text.length > 0) {
    query.set('text', params.text);
  }
  if (params.bin !== undefined && params.bin.length > 0) {
    query.set('bin', params.bin);
  }
  if (params.init !== undefined && params.init.length > 0) {
    query.set('init', params.init);
  }

  const qs = query.toString();
  return qs.length > 0
    ? `ton://transfer/${encodeURIComponent(params.address)}?${qs}`
    : `ton://transfer/${encodeURIComponent(params.address)}`;
}

/**
 * Encode a {@link TonConnectRequest} as a URL-safe query string suitable
 * for substitution into a wallet's `universalLink` / `deepLink` template.
 */
export function encodeTonConnectRequest(request: TonConnectRequest): string {
  if (request.v !== 2) {
    throw new Error('only TON Connect v2 is supported');
  }
  if (typeof request.manifestUrl !== 'string' || request.manifestUrl.length === 0) {
    throw new Error('manifestUrl is required');
  }
  if (!Array.isArray(request.items) || request.items.length === 0) {
    throw new Error('items must be a non-empty array');
  }
  for (const item of request.items) {
    if (item.name !== 'ton_addr' && item.name !== 'ton_proof') {
      throw new Error(`unknown TON Connect item: ${item.name}`);
    }
    if (item.name === 'ton_proof' && (!item.payload || item.payload.length === 0)) {
      throw new Error('ton_proof item requires a payload');
    }
  }

  const json = JSON.stringify(request);
  return `v=2&id=${cryptoRandomId()}&r=${encodeURIComponent(json)}`;
}

/**
 * Build a wallet-specific connection link by substituting the encoded
 * TON Connect request into the wallet's link template.
 *
 * Prefers the universal HTTPS link (works as a clickable link on web
 * pages without the wallet installed) and falls back to the wallet's
 * native deep-link scheme.
 *
 * @returns The link URL, or `null` if the wallet exposes neither a
 *   universal link nor a deep link (i.e. it is browser-extension only).
 */
export function buildWalletConnectLink(
  wallet: TonConnectWallet,
  manifestUrl: string,
  options: { items?: TonConnectRequestItem[]; preferDeepLink?: boolean } = {}
): string | null {
  const items = options.items ?? [{ name: 'ton_addr' }];
  const payload = encodeTonConnectRequest({ v: 2, manifestUrl, items });
  const template = options.preferDeepLink
    ? (wallet.deepLink ?? wallet.universalLink)
    : (wallet.universalLink ?? wallet.deepLink);

  if (!template) return null;
  return template.replace('{payload}', payload);
}

/**
 * Build a transaction-request deep link for an already-connected wallet.
 *
 * For Tonkeeper / Tonhub, this targets the wallet's `transfer` endpoint
 * with the user-friendly address and amount; the wallet then prompts
 * the user to sign and broadcast. The dapp never sees the signing key.
 *
 * @returns Universal HTTPS link for the wallet, or `null` if the wallet
 *   does not declare a universal link.
 */
export function buildWalletTransferLink(
  wallet: TonConnectWallet,
  params: TonTransferParams
): string | null {
  if (!wallet.universalLink) return null;
  assertValidAddress(params.address);

  const base = wallet.universalLink.replace(/\/ton-connect.*$/, '');
  const transfer = buildTonTransferLink(params).replace(/^ton:\/\//, '');
  return `${base}/${transfer}`;
}

/**
 * Resolve the best opening URL for the current platform.
 *
 * On iOS Safari, `ton://` links may fail silently if the wallet is not
 * installed, so HTTPS universal links are preferred. On Android, the
 * `ton://` scheme is more reliable when the wallet is installed but the
 * universal link is also acceptable. This helper returns both so the UI
 * can present them as a primary action plus a fallback.
 */
export function resolveTonLinks(
  wallet: TonConnectWallet,
  manifestUrl: string
): { primary: string | null; fallback: string | null } {
  return {
    primary: buildWalletConnectLink(wallet, manifestUrl, { preferDeepLink: false }),
    fallback: buildWalletConnectLink(wallet, manifestUrl, { preferDeepLink: true }),
  };
}

/**
 * Generate a short, URL-safe random id. Uses `crypto.getRandomValues`
 * when available; falls back to `Math.random` in environments that lack
 * the Web Crypto API.
 *
 * NOTE: This id is the TON Connect request id, used for replay
 * prevention only — it does not need cryptographic strength.
 */
function cryptoRandomId(): string {
  const bytes = new Uint8Array(8);
  const g: { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } } =
    typeof globalThis !== 'undefined' ? (globalThis as never) : ({} as never);
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Manifest type is re-exported for convenience.
 */
export type { TonConnectManifest };

/**
 * Re-export the well-known wallets registry so consumers can build
 * links for any of them from a single import.
 */
export { KNOWN_WALLETS };
