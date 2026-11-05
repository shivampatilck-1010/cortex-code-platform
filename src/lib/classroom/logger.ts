/**
 * Cortex Online Examination System — Structured Observability Logger
 *
 * Implements structured JSON logging with correlation IDs, execution latency tracking,
 * and comprehensive redaction of sensitive credentials, authentication tokens,
 * passwords, and examination answer keys.
 *
 * Strictly zero emojis.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  eventType?: string;
  resourceId?: string;
  userId?: string;
  classroomId?: string;
  examId?: string;
  sessionId?: string;
  latencyMs?: number;
  outcome?: 'success' | 'failure' | 'rejected' | 'pending';
  [key: string]: any;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'token',
  'session',
  'cortex_session',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'sebquitpassword',
  'sebquitpasswordhash',
  'sebbrowserexamkey',
  'sebconfigkey',
  'correctanswer',
  'correct_answer_json',
  'testcases',
  'test_cases_json',
  'rawcode',
  'subjectivetext',
  'studentresponse',
  'student_response',
  'studentanswer',
  'student_answer',
  'answertext',
  'answer_text',
  'selectedoptionid',
  'selected_option_id',
  'apikey',
  'api_key',
]);

/**
 * Deeply sanitizes objects by masking sensitive credentials and examination keys.
 */
export function redactSensitiveData(obj: any, depth = 0): any {
  if (depth > 8) return '[MAX_DEPTH_REACHED]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    let result = obj;
    // Redact Bearer tokens
    if (result.toLowerCase().includes('bearer ')) {
      result = result.replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
    }
    // Redact URL query parameters with sensitive names
    if (result.includes('?') || result.includes('&')) {
      result = result.replace(/([?&])(token|key|secret|password|auth|code|api_key|apikey)=([^&\s]+)/gi, '$1$2=[REDACTED]');
    }
    // Redact cookie assignments in strings
    if (result.includes('=') && (result.toLowerCase().includes('cortex_session=') || result.toLowerCase().includes('session='))) {
      result = result.replace(/(cortex_session|session|jwt|auth)=([^;\s]+)/gi, '$1=[REDACTED]');
    }
    return result;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = redactSensitiveData(val, depth + 1);
    } else if (typeof val === 'string') {
      sanitized[key] = redactSensitiveData(val, depth + 1);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export class CortexLogger {
  private correlationId: string;
  private defaultContext: LogContext;

  constructor(correlationId?: string, defaultContext: LogContext = {}) {
    this.correlationId = correlationId || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.defaultContext = defaultContext;
  }

  public getCorrelationId(): string {
    return this.correlationId;
  }

  private write(level: LogLevel, message: string, context?: LogContext): void {
    const now = Date.now();
    const mergedContext = {
      ...this.defaultContext,
      ...(context || {}),
      correlationId: context?.correlationId || this.correlationId,
    };

    const redacted = redactSensitiveData(mergedContext);

    const logEntry = {
      timestamp: now,
      isoTime: new Date(now).toISOString(),
      level,
      message,
      ...redacted,
    };

    const output = JSON.stringify(logEntry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(output);
        }
        break;
      default:
        console.log(output);
        break;
    }
  }

  public info(message: string, context?: LogContext): void {
    this.write('info', message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.write('warn', message, context);
  }

  public error(message: string, context?: LogContext): void {
    this.write('error', message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.write('debug', message, context);
  }

  /**
   * Helper to measure async execution time and log completion with latency.
   */
  public async track<T>(
    operationName: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const latencyMs = Date.now() - startTime;
      this.info(`${operationName} completed`, {
        ...context,
        eventType: operationName,
        outcome: 'success',
        latencyMs,
      });
      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      this.error(`${operationName} failed: ${err.message}`, {
        ...context,
        eventType: operationName,
        outcome: 'failure',
        latencyMs,
        error: err.message,
      });
      throw err;
    }
  }
}

/**
 * Singleton / factory for request-scoped logger.
 */
export function createLogger(correlationId?: string, context?: LogContext): CortexLogger {
  return new CortexLogger(correlationId, context);
}
