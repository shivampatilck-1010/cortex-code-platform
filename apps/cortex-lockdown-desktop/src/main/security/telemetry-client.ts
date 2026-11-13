/**
 * Cortex Lockdown Browser — Desktop Telemetry Client
 * Asynchronous security event dispatcher mirroring the C# TelemetryDispatcher.
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { SecurityEventType, TelemetryEvent, TelemetryPayload } from '../../shared/types';
import { DEFAULT_TELEMETRY_ENDPOINT } from '../../shared/constants';

export class TelemetryClient {
  private telemetryUrl: string;
  private sessionId: string;
  private examId: string;
  private launchGrant: string;
  private queue: TelemetryEvent[] = [];
  private isFlushing = false;

  constructor(options: {
    telemetryUrl?: string;
    sessionId?: string;
    examId?: string;
    launchGrant?: string;
  } = {}) {
    this.sessionId = options.sessionId || `sess_desktop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.examId = options.examId || '';
    this.launchGrant = options.launchGrant || '';

    // Derive telemetry URL
    if (options.telemetryUrl) {
      this.telemetryUrl = options.telemetryUrl;
    } else {
      this.telemetryUrl = `https://cortex-code-platform.cortexbuild1.workers.dev${DEFAULT_TELEMETRY_ENDPOINT}`;
    }
  }

  public setExamContext(examId: string, launchGrant?: string, baseUrl?: string): void {
    if (examId) this.examId = examId;
    if (launchGrant) this.launchGrant = launchGrant;
    if (baseUrl) {
      try {
        const parsed = new URL(baseUrl);
        this.telemetryUrl = `${parsed.origin}${DEFAULT_TELEMETRY_ENDPOINT}`;
      } catch {
        // Keep current telemetry URL
      }
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public dispatchEvent(eventType: SecurityEventType, details: Record<string, unknown> = {}): void {
    const event: TelemetryEvent = {
      eventType,
      timestamp: Date.now(),
      details
    };

    this.queue.push(event);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;

    setImmediate(() => {
      this.flushQueue().finally(() => {
        this.isFlushing = false;
        if (this.queue.length > 0) {
          this.scheduleFlush();
        }
      });
    });
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    const payload: TelemetryPayload = {
      sessionId: this.sessionId,
      examId: this.examId,
      events: eventsToSend
    };

    const payloadJson = JSON.stringify(payload);

    try {
      await this.postJson(this.telemetryUrl, payloadJson, this.launchGrant);
    } catch {
      // Non-blocking telemetry drop on network failure, or re-enqueue up to a limit
      if (this.queue.length < 50) {
        this.queue.unshift(...eventsToSend);
      }
    }
  }

  private postJson(targetUrl: string, body: string, grant?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(targetUrl);
        const isHttps = parsed.protocol === 'https:';
        const client = isHttps ? https : http;

        const headers: Record<string, string | number> = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        };

        if (grant) {
          headers['x-cortex-lockdown-grant'] = grant;
        }

        const req = client.request(
          parsed,
          {
            method: 'POST',
            headers,
            timeout: 5000
          },
          (res) => {
            res.resume(); // Discard response data
            resolve();
          }
        );

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy(new Error('Telemetry request timed out'));
          reject(new Error('Timeout'));
        });

        req.write(body);
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
