import { NextRequest, NextResponse } from 'next/server';
import { AppError } from './errors';
import { apiError } from './response';

export type RouteHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse | Response>;

/**
 * Higher-order wrapper for Next.js API Route Handlers.
 * Catches all uncaught exceptions, normalizes AppErrors, and ensures
 * zero unhandled promise rejections or leaked internal stack traces.
 */
export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, context?: any) => {
    try {
      return await handler(req, context);
    } catch (err: any) {
      if (err instanceof AppError) {
        return apiError(err.message, err.statusCode, err.code, err.details);
      }

      // Check for JSON parse / payload errors
      if (err instanceof SyntaxError || err.name === 'SyntaxError') {
        return apiError('Malformed JSON payload in request body', 400, 'BAD_REQUEST');
      }

      console.error(`[Unhandled API Error] ${req.method} ${req.nextUrl.pathname}:`, err);

      const isDev = process.env.NODE_ENV !== 'production';
      return apiError(
        isDev ? (err.message || 'Internal Server Error') : 'An unexpected server error occurred',
        500,
        'INTERNAL_SERVER_ERROR',
        isDev ? { stack: err.stack } : undefined
      );
    }
  };
}
