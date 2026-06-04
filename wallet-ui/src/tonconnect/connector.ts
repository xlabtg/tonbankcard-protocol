/**
 * TONBANKCARD Wallet UI - TON Connect Connector
 *
 * Connection-state management for TON Connect v2 sessions. Persists
 * only public data (wallet id, public address) in `localStorage`. The
 * dapp NEVER touches private keys; signing always happens inside the
 * user's wallet app.
 *
 * Reference: https://docs.ton.org/develop/dapps/ton-connect/protocol
 */

import { Address } from '@ton/core';

import {
  buildWalletConnectLink,
  buildWalletTransferLink,
  type TonConnectRequestItem,
  type TonTransferParams,
} from './deepLink';
import { KNOWN_WALLETS, getWalletById, type TonConnectWallet } from './wallets';
import { validateManifest, type TonConnectManifest } from './manifest';

/**
 * Connection status of the active TON Connect session.
 */
export type ConnectionStatus = 'disconnected' | 'pending' | 'connected';

/**
 * Persisted session data — public information only.
 */
export interface ConnectionState {
  /** Current connection status */
  status: ConnectionStatus;

  /** Wallet id (e.g. "tonkeeper") when status !== 'disconnected' */
  walletId?: string;

  /** User's TON address as returned by the wallet (user-friendly form) */
  address?: string;

  /** Network: 'mainnet' or 'testnet' */
  network?: 'mainnet' | 'testnet';

  /** UNIX seconds when the session was established (or last updated) */
  updatedAt?: number;
}

/**
 * Events emitted by the connector. Use {@link TonConnectConnector.on}
 * to subscribe.
 */
export type ConnectorEvent =
  | { type: 'statusChange'; state: ConnectionState }
  | { type: 'connected'; state: ConnectionState; wallet: TonConnectWallet }
  | { type: 'disconnected' }
  | { type: 'error'; error: Error };

export type ConnectorEventHandler = (event: ConnectorEvent) => void;

/**
 * Storage backend abstraction. The default uses `window.localStorage`
 * when available; tests can inject an in-memory implementation.
 */
export interface ConnectorStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const DEFAULT_STORAGE_KEY = 'tonbankcard.tonconnect.session';

function isValidTonAddress(address: string): boolean {
  try {
    Address.parse(address);
    return true;
  } catch {
    return false;
  }
}

function defaultStorage(): ConnectorStorage {
  if (typeof localStorage !== 'undefined') {
    return {
      get: (k: string): string | null => localStorage.getItem(k),
      set: (k: string, v: string): void => localStorage.setItem(k, v),
      remove: (k: string): void => localStorage.removeItem(k),
    };
  }
  const mem = new Map<string, string>();
  return {
    get: (k: string): string | null => mem.get(k) ?? null,
    set: (k: string, v: string): void => {
      mem.set(k, v);
    },
    remove: (k: string): void => {
      mem.delete(k);
    },
  };
}

/**
 * Options for {@link TonConnectConnector}.
 */
export interface TonConnectConnectorOptions {
  /** Public HTTPS URL of the dapp's TON Connect manifest */
  manifestUrl: string;

  /** Optional inline manifest for validation at construction time */
  manifest?: TonConnectManifest;

  /** Wallets the dapp is willing to integrate with (defaults to all known) */
  wallets?: readonly TonConnectWallet[];

  /** TON Connect items requested at connection (defaults to ton_addr) */
  items?: TonConnectRequestItem[];

  /** Storage backend (defaults to `window.localStorage`) */
  storage?: ConnectorStorage;

  /** Storage key prefix (defaults to "tonbankcard.tonconnect.session") */
  storageKey?: string;

  /** Network identifier persisted with the session */
  network?: 'mainnet' | 'testnet';
}

/**
 * High-level TON Connect v2 connector.
 *
 * Responsibilities:
 * 1. Build wallet-specific connection / transfer URLs.
 * 2. Persist session state across page reloads (public data only).
 * 3. Expose lifecycle events to the UI.
 *
 * The connector itself is transport-agnostic. Browser environments can
 * plug an SSE bridge in by calling {@link TonConnectConnector.applyReply}
 * with the reply payload extracted from the redirect URL or bridge
 * message. Until a reply arrives, the connector reports a `'pending'`
 * status, allowing the UI to render a spinner.
 */
export class TonConnectConnector {
  private readonly opts: Required<
    Pick<TonConnectConnectorOptions, 'manifestUrl' | 'storageKey' | 'wallets' | 'items'>
  > &
    TonConnectConnectorOptions;
  private readonly storage: ConnectorStorage;
  private readonly handlers = new Set<ConnectorEventHandler>();
  private state: ConnectionState;

  constructor(options: TonConnectConnectorOptions) {
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

    this.opts = {
      storageKey: DEFAULT_STORAGE_KEY,
      wallets: KNOWN_WALLETS,
      items: [{ name: 'ton_addr' }],
      ...options,
    };
    this.storage = options.storage ?? defaultStorage();
    this.state = this.loadState();
  }

  /**
   * Subscribe to connector events. Returns an unsubscribe function.
   */
  on(handler: ConnectorEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Get a snapshot of the current connection state.
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Build the connection link for the chosen wallet and move the
   * session to `'pending'`.
   *
   * @returns The URL to open in a new tab (or follow as a link).
   * @throws Error if the wallet id is unknown or the wallet cannot
   *   provide a connection link.
   */
  connect(walletId: string): string {
    const wallet = getWalletById(walletId);
    if (!wallet) {
      throw new Error(`unknown wallet: ${walletId}`);
    }
    const link = buildWalletConnectLink(wallet, this.opts.manifestUrl, {
      items: this.opts.items,
    });
    if (!link) {
      throw new Error(`wallet ${walletId} does not expose a connection link`);
    }
    this.updateState({
      status: 'pending',
      walletId: wallet.id,
      network: this.opts.network,
      updatedAt: Math.floor(Date.now() / 1000),
    });
    return link;
  }

  /**
   * Apply a reply payload from the wallet. The reply provides the
   * user's address and (optionally) the signed proof.
   */
  applyReply(reply: { address: string; walletId?: string }): void {
    if (this.state.status !== 'pending') {
      throw new Error('connector is not waiting for a reply');
    }
    if (!reply.address) {
      throw new Error('reply must include address');
    }
    if (!isValidTonAddress(reply.address)) {
      throw new Error(`invalid TON address: ${reply.address}`);
    }
    const walletId = reply.walletId ?? this.state.walletId;
    const wallet = walletId ? getWalletById(walletId) : undefined;
    if (!wallet) {
      throw new Error('reply does not correspond to a known wallet');
    }
    this.updateState({
      status: 'connected',
      walletId: wallet.id,
      address: reply.address,
      network: this.opts.network,
      updatedAt: Math.floor(Date.now() / 1000),
    });
    this.emit({ type: 'connected', state: { ...this.state }, wallet });
  }

  /**
   * Cancel the in-flight connection attempt and revert to disconnected.
   * No-op when already disconnected.
   */
  cancel(): void {
    if (this.state.status === 'disconnected') return;
    this.updateState({ status: 'disconnected' });
  }

  /**
   * Tear down the active session.
   */
  disconnect(): void {
    if (this.state.status === 'disconnected') return;
    this.updateState({ status: 'disconnected' });
    this.emit({ type: 'disconnected' });
  }

  /**
   * Build a transfer deep link for the currently connected wallet.
   * Useful for invoice flows where the dapp asks the wallet to pre-fill
   * a send screen with a known amount.
   *
   * @throws Error if no wallet is connected.
   */
  buildTransferLink(params: TonTransferParams): string {
    if (this.state.status !== 'connected' || !this.state.walletId) {
      throw new Error('cannot build transfer link: no wallet connected');
    }
    const wallet = getWalletById(this.state.walletId);
    if (!wallet) {
      throw new Error('connected wallet id is no longer known');
    }
    const link = buildWalletTransferLink(wallet, params);
    if (!link) {
      throw new Error(`wallet ${wallet.id} does not expose a transfer link`);
    }
    return link;
  }

  // ---- internal helpers -----------------------------------------------

  private loadState(): ConnectionState {
    try {
      const raw = this.storage.get(this.opts.storageKey);
      if (!raw) return { status: 'disconnected' };
      const parsed = JSON.parse(raw) as ConnectionState;
      if (
        parsed &&
        (parsed.status === 'pending' ||
          parsed.status === 'connected' ||
          parsed.status === 'disconnected')
      ) {
        if (parsed.address && !isValidTonAddress(parsed.address)) {
          this.storage.remove(this.opts.storageKey);
          return { status: 'disconnected' };
        }
        if (parsed.status === 'connected' && !parsed.address) {
          this.storage.remove(this.opts.storageKey);
          return { status: 'disconnected' };
        }
        return parsed;
      }
      return { status: 'disconnected' };
    } catch {
      return { status: 'disconnected' };
    }
  }

  private updateState(next: ConnectionState): void {
    this.state = next;
    if (next.status === 'disconnected') {
      this.storage.remove(this.opts.storageKey);
    } else {
      this.storage.set(this.opts.storageKey, JSON.stringify(next));
    }
    this.emit({ type: 'statusChange', state: { ...next } });
  }

  private emit(event: ConnectorEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        // Surface listener errors as 'error' events but never throw
        // through the dispatcher.
        if (event.type !== 'error') {
          for (const h of this.handlers) {
            try {
              h({ type: 'error', error: err as Error });
            } catch {
              // swallow
            }
          }
        }
      }
    }
  }
}
