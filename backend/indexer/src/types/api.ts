// API response types for the Payment Status Indexer


/**
 * Payment status response
 * GET /payments/{invoice_id}
 */
export interface PaymentStatusResponse {
  invoiceId: string;
  status: PaymentStatus;
  payerNft: string | null;
  merchantNft: string | null;
  amountTbc: string; // String representation of bigint
  createdAt: number | null; // Unix timestamp
  confirmedAt: number | null; // Unix timestamp
  blockNumber: number | null;
  transactionHash: string | null;
  confirmationBlocks: number; // Number of blocks since transaction
  metadata: {
    payloadHash: string | null;
  };
}

/**
 * Payment event history
 * GET /payments/{invoice_id}/events
 */
export interface PaymentEventsResponse {
  invoiceId: string;
  events: PaymentEventItem[];
  totalCount: number;
}

export interface PaymentEventItem {
  eventType: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  details: Record<string, unknown>;
}

/**
 * Account history response
 * GET /accounts/{nft_id}/history
 */
export interface AccountHistoryResponse {
  nftAddress: string;
  currentState: string;
  currentBalance: string;
  owner: string | null;
  events: AccountEventItem[];
  totalCount: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AccountEventItem {
  eventType: 'transfer' | 'state_change' | 'payment';
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  details: Record<string, unknown>;
}

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  NOT_FOUND = 'not_found',
}

/**
 * Generic error response
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  indexer: {
    latestBlockIndexed: number;
    chainLatestBlock: number;
    blocksBehind: number;
    lastUpdateTime: number;
  };
  database: {
    connected: boolean;
    eventCount: number;
  };
}

/**
 * Block info response
 */
export interface BlockInfoResponse {
  blockNumber: number;
  blockHash: string;
  timestamp: number;
  transactionCount: number;
  indexed: boolean;
}
