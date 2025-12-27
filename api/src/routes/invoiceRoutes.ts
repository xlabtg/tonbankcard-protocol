/**
 * Invoice API Routes
 *
 * Express.js route handlers for the Merchant API endpoints.
 * This is a reference implementation demonstrating the API specification.
 *
 * In production, this would be integrated with:
 * - Express.js or similar web framework
 * - Authentication middleware
 * - Rate limiting middleware
 * - Logging and monitoring
 *
 * @see docs/merchant-api-spec.md
 */

import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/InvoiceService';
import { ValidationError } from '../utils/validation';
import { ErrorCode, ErrorResponse } from '../types/invoice';

/**
 * Error response helper
 */
function sendErrorResponse(res: Response, error: ValidationError | Error): Response {
  if (error instanceof ValidationError) {
    const statusCode = getHttpStatusForErrorCode(error.code);
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
    return res.status(statusCode).json(errorResponse);
  }

  // Unexpected error
  console.error('Unexpected error:', error);
  const errorResponse: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? { error: error.message } : undefined,
    },
  };
  return res.status(500).json(errorResponse);
}

/**
 * Map error code to HTTP status code
 */
function getHttpStatusForErrorCode(code: ErrorCode): number {
  const statusMap: Record<ErrorCode, number> = {
    [ErrorCode.INVALID_API_KEY]: 401,
    [ErrorCode.UNAUTHORIZED_MERCHANT]: 403,
    [ErrorCode.INVALID_NFT_ADDRESS]: 400,
    [ErrorCode.NFT_NOT_WHITELISTED]: 403,
    [ErrorCode.INVALID_AMOUNT]: 400,
    [ErrorCode.INVALID_METADATA]: 400,
    [ErrorCode.INVOICE_NOT_FOUND]: 404,
    [ErrorCode.INVOICE_EXPIRED]: 410,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
    [ErrorCode.INTERNAL_ERROR]: 500,
    [ErrorCode.BLOCKCHAIN_UNAVAILABLE]: 503,
  };

  return statusMap[code] || 500;
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new ValidationError(ErrorCode.INVALID_API_KEY, 'Authorization header is required');
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new ValidationError(
      ErrorCode.INVALID_API_KEY,
      'Authorization header must be in format: Bearer <API_KEY>'
    );
  }

  return parts[1];
}

/**
 * POST /invoice/create
 *
 * Create a new invoice
 */
export async function createInvoice(req: Request, res: Response): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const invoice = await invoiceService.createInvoice(req.body, apiKey);
    return res.status(201).json(invoice);
  } catch (error) {
    return sendErrorResponse(res, error as Error);
  }
}

/**
 * GET /invoice/:invoice_id
 *
 * Get invoice details
 * Public endpoint (no authentication required)
 */
export async function getInvoice(req: Request, res: Response): Promise<Response> {
  try {
    const { invoice_id } = req.params;
    const invoice = await invoiceService.getInvoice(invoice_id);
    return res.status(200).json(invoice);
  } catch (error) {
    return sendErrorResponse(res, error as Error);
  }
}

/**
 * GET /invoice/:invoice_id/status
 *
 * Get invoice status
 * Requires authentication
 */
export async function getInvoiceStatus(req: Request, res: Response): Promise<Response> {
  try {
    const apiKey = extractApiKey(req);
    const { invoice_id } = req.params;
    const status = await invoiceService.getInvoiceStatus(invoice_id, apiKey);
    return res.status(200).json(status);
  } catch (error) {
    return sendErrorResponse(res, error as Error);
  }
}

/**
 * Authentication middleware (stub)
 *
 * In production, this would validate API keys against a database
 */
export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  try {
    const apiKey = extractApiKey(req);

    // TODO: Validate API key against database
    // const isValid = await apiKeyService.validateKey(apiKey);
    // if (!isValid) {
    //   throw new ValidationError(ErrorCode.INVALID_API_KEY, 'Invalid API key');
    // }

    // Store merchant info in request for later use
    // req.merchant = await merchantService.getMerchantByApiKey(apiKey);

    next();
  } catch (error) {
    sendErrorResponse(res, error as Error);
  }
}

/**
 * Rate limiting middleware (stub)
 *
 * In production, use express-rate-limit or similar
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  // TODO: Implement rate limiting
  // Example:
  // const key = req.ip + ':' + req.path;
  // const limit = await rateLimiter.checkLimit(key, limits[req.path]);
  //
  // if (limit.exceeded) {
  //   const errorResponse: ErrorResponse = {
  //     error: {
  //       code: ErrorCode.RATE_LIMIT_EXCEEDED,
  //       message: 'Too many requests',
  //       details: {
  //         retryAfter: limit.retryAfter,
  //       },
  //     },
  //   };
  //   return res.status(429)
  //     .header('Retry-After', limit.retryAfter.toString())
  //     .json(errorResponse);
  // }

  next();
}

/**
 * CORS middleware configuration
 */
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

/**
 * Example Express.js app setup
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import cors from 'cors';
 * import { setupInvoiceRoutes, corsOptions } from './routes/invoiceRoutes';
 *
 * const app = express();
 * app.use(cors(corsOptions));
 * app.use(express.json());
 *
 * setupInvoiceRoutes(app);
 *
 * app.listen(3000, () => {
 *   console.log('Merchant API listening on port 3000');
 * });
 * ```
 */
export function setupInvoiceRoutes(app: any): void {
  // Public endpoint (no auth required)
  app.get('/v1/invoice/:invoice_id', rateLimitMiddleware, getInvoice);

  // Protected endpoints (auth required)
  app.post('/v1/invoice/create', rateLimitMiddleware, authenticateApiKey, createInvoice);

  app.get(
    '/v1/invoice/:invoice_id/status',
    rateLimitMiddleware,
    authenticateApiKey,
    getInvoiceStatus
  );

  // Health check endpoint
  app.get('/v1/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });
}
