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

/**
 * Transparency metrics response (E4, Issue #135).
 *
 * Mirrors the JSON shape documented in
 * docs/governance/TRANSPARENCY_REPORTING.md §4.1.
 *
 * All numbers are aggregated cohort counters anchored by an on-chain
 * checksum. No addresses, no per-account state.
 */
export interface TransparencyMetricsResponse {
  disclaimer: string;
  snapshot: {
    indexedAt: number;
    latestBlockIndexed: number;
  };
  protocolMetrics: {
    latest: TransparencyProtocolMetricsRow | null;
    history: TransparencyProtocolMetricsRow[];
    periodCount: number;
  };
  lockActivity: {
    latest: TransparencyLockActivityRow | null;
    history: TransparencyLockActivityRow[];
    periodCount: number;
  };
  parameterChanges: {
    total: number;
    history: TransparencyParameterChangeRow[];
  };
}

export interface TransparencyProtocolMetricsRow {
  periodStart: number;
  periodEnd: number;
  activeAccounts: number;
  tbcVolumeTransferred: string;
  transferCount: number;
  blockNumber: number;
  transactionHash: string;
}

export interface TransparencyLockActivityRow {
  periodStart: number;
  periodEnd: number;
  locksSet: number;
  locksCleared: number;
  locksActive: number;
  appealsFiled: number;
  appealsOverturned: number;
  appealsUpheld: number;
  blockNumber: number;
  transactionHash: string;
}

export interface TransparencyParameterChangeRow {
  parameterId: string;
  oldValueHash: string;
  newValueHash: string;
  effectiveBlock: number;
  governanceProposalId: number | null;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}
