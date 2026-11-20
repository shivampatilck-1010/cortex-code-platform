/**
 * Typed Application Errors with HTTP Status Codes
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_SERVER_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code: string = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', code: string = 'UNAUTHORIZED', details?: unknown) {
    super(message, 401, code, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', code: string = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code: string = 'NOT_FOUND', details?: unknown) {
    super(message, 404, code, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', code: string = 'CONFLICT', details?: unknown) {
    super(message, 409, code, details);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_FAILED', details);
    this.name = 'ValidationError';
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'An unexpected internal error occurred', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
    this.name = 'InternalServerError';
  }
}
