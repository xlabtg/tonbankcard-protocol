/**
 * Catchable SDK error hierarchy.
 */

export class TonbankcardSDKError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TonbankcardValidationError extends TonbankcardSDKError {}

export class TonbankcardConfigurationError extends TonbankcardSDKError {}

export class TonbankcardApiError extends TonbankcardSDKError {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export class TonbankcardInvoiceNotFoundError extends TonbankcardApiError {
  constructor(message = 'Invoice not found') {
    super(message, 404);
  }
}

export class TonbankcardBlockchainError extends TonbankcardSDKError {}
