import { NextResponse } from 'next/server';
import { ApiSuccessResponse, ApiErrorResponse, ApiErrorDetail } from '@/types/api';

/**
 * Creates a standardized JSON success response
 */
export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    meta,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, { status });
}

/**
 * Creates a standardized JSON error response with backward-compatible top-level error string
 */
export function apiError(
  message: string,
  status: number = 400,
  code: string = 'ERROR',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const errorDetail: ApiErrorDetail = {
    code,
    message,
    details,
  };

  const payload: ApiErrorResponse = {
    success: false,
    error: message,
    errorDetail,
    message,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(payload, { status });
}
