/**
 * TON Connect session manager for the mobile app.
 *
 * Maintains a connection lifecycle state machine ('disconnected' → 'pending' →
 * 'connected') backed by a pluggable secure store. Mobile platforms typically
 * inject a Keychain/Keystore-backed store; tests use the in-memory store.
 *
 * NON-CUSTODIAL:
 * - Only PUBLIC information is persisted (wallet ID and public TON address).
 * - Private keys NEVER touch this module.
 */

import { isValidTonAddress } from '@tonbankcard/mobile-core';
import type { SecureKeyValueStore } from '../secure/interfaces';
import { validateManifest, type TonConnectManifest } from './manifest';

export type ConnectionStatus = 'disconnected' | 'pending' | 'connected';

export interface ConnectionSession {
  readonly status: ConnectionStatus;
  readonly walletId?: string;
  readonly address?: string;
  readonly platform?: 'ios' | 'android';
  readonly establishedAt?: number;
}

export type ConnectorEvent =
  | { type: 'status_changed'; session: ConnectionSession }
  | { type: 'connected'; session: ConnectionSession }
  | { type: 'disconnected' };

export type ConnectorListener = (event: ConnectorEvent) => void;

const STORAGE_KEY = 'tonbankcard.tonconnect.session.v1';

export interface MobileConnectorOptions {
  readonly manifest: TonConnectManifest;
  readonly storage: SecureKeyValueStore;
  readonly now?: () => number;
}

export interface ConnectArgs {
  readonly walletId: string;
  readonly address: string;
  readonly platform: 'ios' | 'android';
}

export class MobileTonConnectConnector {
  private session: ConnectionSession = { status: 'disconnected' };
  private readonly listeners = new Set<ConnectorListener>();
  private readonly storage: SecureKeyValueStore;
  private readonly now: () => number;

  constructor(options: MobileConnectorOptions) {
    const validation = validateManifest(options.manifest);
    if (!validation.valid) {
      throw new Error(`Invalid TON Connect manifest: ${validation.errors.join(', ')}`);
    }
    this.storage = options.storage;
    this.now = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  async restore(): Promise<ConnectionSession> {
    const stored = await this.storage.get(STORAGE_KEY);
    if (!stored) {
      return this.session;
    }
    try {
      const parsed = JSON.parse(stored) as ConnectionSession;
      if (
        parsed.status === 'connected' &&
        parsed.address &&
        isValidTonAddress(parsed.address)
      ) {
        this.session = parsed;
      }
    } catch {
      await this.storage.delete(STORAGE_KEY);
    }
    return this.session;
  }

  getSession(): ConnectionSession {
    return this.session;
  }

  beginConnect(): void {
    this.setSession({ status: 'pending' });
  }

  async finishConnect(args: ConnectArgs): Promise<ConnectionSession> {
    if (!isValidTonAddress(args.address)) {
      throw new Error(`Invalid TON address: ${args.address}`);
    }
    const session: ConnectionSession = {
      status: 'connected',
      walletId: args.walletId,
      address: args.address,
      platform: args.platform,
      establishedAt: this.now(),
    };
    await this.storage.set(STORAGE_KEY, JSON.stringify(session));
    this.setSession(session);
    this.emit({ type: 'connected', session });
    return session;
  }

  async disconnect(): Promise<void> {
    await this.storage.delete(STORAGE_KEY);
    this.setSession({ status: 'disconnected' });
    this.emit({ type: 'disconnected' });
  }

  subscribe(listener: ConnectorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setSession(session: ConnectionSession): void {
    this.session = session;
    this.emit({ type: 'status_changed', session });
  }

  private emit(event: ConnectorEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener failures must not break the connector.
      }
    }
  }
}
