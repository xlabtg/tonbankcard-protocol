// Event type definitions for Tonbankcard Protocol
// These mirror the on-chain event structures from smart contracts

import { Address } from '@ton/core';

/**
 * Base event interface - all events extend this
 */
export interface BaseEvent {
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  logIndex: number;
}

/**
 * Internal Transfer Event
 * Emitted by: PaymentHub.tact (Issue #6)
 * Event: InternalTransferEvent
 */
export interface InternalTransferEvent extends BaseEvent {
  eventType: 'InternalTransfer';
  fromNft: string; // Address as string
  toNft: string; // Address as string
  amountTbc: bigint; // Amount in nanocoins
  payloadHash: string; // uint256 hash
}

/**
 * Account State Changed Event
 * Emitted by: PaymentHub.tact (Issue #6)
 * Event: AccountStateChangedEvent
 */
export interface AccountStateChangedEvent extends BaseEvent {
  eventType: 'AccountStateChanged';
  nftAddress: string;
  oldState: AccountState;
  newState: AccountState;
}

/**
 * Merchant Payment Event
 * Emitted by: MerchantPaymentHub.tact (Issue #8)
 * Event: MerchantPayment
 */
export interface MerchantPaymentEvent extends BaseEvent {
  eventType: 'MerchantPayment';
  payerNft: string; // Address as string
  merchantNft: string; // Address as string
  amountTbc: bigint; // Amount in nanocoins
  payloadHash: string; // Hash of payment metadata
}

/**
 * NFT Ownership Change Event
 * Derived from: NFT Transfer events on TON
 */
export interface NFTOwnershipChangeEvent extends BaseEvent {
  eventType: 'NFTOwnershipChange';
  nftAddress: string;
  oldOwner: string | null; // null for minting
  newOwner: string;
  collectionAddress: string;
}

/**
 * Union type of all indexable events
 */
export type IndexedEvent =
  | InternalTransferEvent
  | AccountStateChangedEvent
  | MerchantPaymentEvent
  | NFTOwnershipChangeEvent;

/**
 * Account States
 * Matches: AccountState.tact
 */
export enum AccountState {
  ACTIVE = 0,
  FROZEN = 1,
  COLLATERAL_LOCKED = 2,
  CLOSED = 3,
}

/**
 * Account state helper functions
 */
export function accountStateToString(state: AccountState): string {
  switch (state) {
    case AccountState.ACTIVE:
      return 'ACTIVE';
    case AccountState.FROZEN:
      return 'FROZEN';
    case AccountState.COLLATERAL_LOCKED:
      return 'COLLATERAL_LOCKED';
    case AccountState.CLOSED:
      return 'CLOSED';
    default:
      return 'UNKNOWN';
  }
}

export function accountStateFromNumber(state: number): AccountState {
  if (state >= 0 && state <= 3) {
    return state as AccountState;
  }
  throw new Error(`Invalid account state: ${state}`);
}
