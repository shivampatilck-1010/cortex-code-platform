import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export interface FeedbackDiagnostics {
  language?: string;
  activeFile?: string;
  executionStatus?: string;
  exitCode?: number;
  stderr?: string;
  diagnosticsList?: any[];
  systemInfo?: {
    userAgent?: string;
    platform?: string;
    screenResolution?: string;
    url?: string;
  };
  codeSnippet?: string;
}

export interface FeedbackRecord {
  id: string;
  type: 'bug' | 'error' | 'feature' | 'general';
  category?: string;
  title: string;
  description: string;
  email?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  diagnostics?: FeedbackDiagnostics;
  createdAt: string;
  status: 'new' | 'investigating' | 'resolved';
  emailDelivery?: {
    attempted: boolean;
    sent: boolean;
    recipient?: string;
    error?: string;
    sentAt?: string;
  };
}

import os from 'os';

function ensureDbFile(): string {
  const customPath = process.env.FEEDBACK_DB_PATH;
  if (customPath) {
    const dir = path.dirname(customPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(customPath)) fs.writeFileSync(customPath, JSON.stringify([], null, 2), 'utf-8');
    return customPath;
  }

  const defaultDir = path.join(process.cwd(), 'data');
  const defaultFile = path.join(defaultDir, 'feedback.json');

  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    if (!fs.existsSync(defaultFile)) {
      fs.writeFileSync(defaultFile, JSON.stringify([], null, 2), 'utf-8');
    }
    return defaultFile;
  } catch (err) {
    // Fallback to os.tmpdir() for serverless platforms with read-only filesystems (Vercel / AWS Lambda)
    const tmpFile = path.join(os.tmpdir(), 'cortex-feedback.json');
    try {
      if (!fs.existsSync(tmpFile)) {
        fs.writeFileSync(tmpFile, JSON.stringify([], null, 2), 'utf-8');
      }
    } catch {}
    return tmpFile;
  }
}

export function getAllFeedback(): FeedbackRecord[] {
  const filePath = ensureDbFile();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as FeedbackRecord[];
  } catch (err) {
    console.error('Error reading feedback database:', err);
    return [];
  }
}


function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendEmailNotification(
  feedback: FeedbackRecord
): Promise<{ sent: boolean; error?: string; recipient?: string }> {
  const recipient =
    process.env.FEEDBACK_RECIPIENT_EMAIL ||
    process.env.SMTP_USER ||
    'support@cortexcode.io';

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // 1. SMTP Dispatch via Nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">
          <div style="border-bottom: 2px solid #ff9100; padding-bottom: 12px; margin-bottom: 16px;">
            <h2 style="margin: 0; color: #111827;">[Cortex] ${feedback.type.toUpperCase()}: ${escapeHtml(feedback.title)}</h2>
            <div style="margin-top: 8px; display: flex; gap: 8px;">
              <span style="display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background: ${
                feedback.type === 'bug' || feedback.type === 'error'
                  ? '#fee2e2; color: #b91c1c;'
                  : '#fef3c7; color: #b45309;'
              }">
                Severity: ${feedback.severity.toUpperCase()}
              </span>
              <span style="display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 600; border-radius: 4px; background: #f3f4f6; color: #374151;">
                ID: ${feedback.id}
              </span>
            </div>
          </div>

          <p style="font-size: 14px; color: #4b5563;">
            <strong>Submitted by:</strong> ${escapeHtml(feedback.email || 'Anonymous')}<br/>
            <strong>Date:</strong> ${feedback.createdAt}
          </p>

          <div style="margin: 20px 0; padding: 16px; background: #f9fafb; border-left: 4px solid #ff9100; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px;">User Description:</h4>
            <p style="margin: 0; white-space: pre-wrap; color: #374151; font-size: 13px; line-height: 1.6;">${escapeHtml(feedback.description)}</p>
          </div>

          ${
            feedback.diagnostics?.stderr
              ? `
            <div style="margin: 20px 0; padding: 14px; background: #0b0c0e; color: #f87171; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto;">
              <strong style="color: #ef4444;">Compiler / Runtime Error (stderr):</strong>
              <pre style="margin: 8px 0 0 0; white-space: pre-wrap;">${escapeHtml(feedback.diagnostics.stderr)}</pre>
            </div>
          `
              : ''
          }

          ${
            feedback.diagnostics?.codeSnippet
              ? `
            <div style="margin: 20px 0; padding: 14px; background: #161b22; color: #e6edf3; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto;">
              <strong style="color: #79c0ff;">Code Context (${escapeHtml(feedback.diagnostics.activeFile || 'file')}):</strong>
              <pre style="margin: 8px 0 0 0; white-space: pre-wrap;">${escapeHtml(feedback.diagnostics.codeSnippet)}</pre>
            </div>
          `
              : ''
          }

          ${
            feedback.diagnostics
              ? `
            <div style="font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                <tr><td style="padding: 4px 0; color: #9ca3af;">Language:</td><td style="padding: 4px 0; font-weight: 500; color: #374151;">${escapeHtml(feedback.diagnostics.language || 'N/A')}</td></tr>
                <tr><td style="padding: 4px 0; color: #9ca3af;">Active File:</td><td style="padding: 4px 0; font-weight: 500; color: #374151;">${escapeHtml(feedback.diagnostics.activeFile || 'N/A')}</td></tr>
                <tr><td style="padding: 4px 0; color: #9ca3af;">Exit Code:</td><td style="padding: 4px 0; font-weight: 500; color: #374151;">${feedback.diagnostics.exitCode ?? 'N/A'}</td></tr>
                <tr><td style="padding: 4px 0; color: #9ca3af;">Platform:</td><td style="padding: 4px 0; font-weight: 500; color: #374151;">${escapeHtml(feedback.diagnostics.systemInfo?.platform || 'N/A')}</td></tr>
                <tr><td style="padding: 4px 0; color: #9ca3af;">User Agent:</td><td style="padding: 4px 0; font-weight: 500; color: #374151;">${escapeHtml(feedback.diagnostics.systemInfo?.userAgent || 'N/A')}</td></tr>
              </table>
            </div>
          `
              : ''
          }
        </div>
      `;

      await transporter.sendMail({
        from: `"Cortex Feedback Telemetry" <${smtpUser}>`,
        to: recipient,
        subject: `[Cortex ${feedback.type.toUpperCase()}] ${feedback.title} (${feedback.id})`,
        html: mailHtml,
      });

      return { sent: true, recipient };
    } catch (err: any) {
      console.error('Failed to dispatch email via SMTP:', err);
      return { sent: false, error: err?.message || 'SMTP dispatch failed', recipient };
    }
  }

  // 2. Webhook Dispatch (Discord / Slack / generic webhook)
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🚨 **[Cortex ${feedback.type.toUpperCase()}]** ${feedback.title}\nID: \`${feedback.id}\` | Severity: **${feedback.severity}**\nUser: ${feedback.email || 'Anonymous'}\n\n${feedback.description}\n${
            feedback.diagnostics?.stderr ? `\`\`\`${feedback.diagnostics.stderr.slice(0, 800)}\`\`\`` : ''
          }`,
        }),
      });
      return { sent: true, recipient: 'Webhook Relay' };
    } catch (wErr: any) {
      console.error('Failed to post feedback to webhook:', wErr);
    }
  }

  return {
    sent: false,
    error: 'SMTP not configured in environment; feedback securely preserved in local database',
    recipient,
  };
}

export async function saveFeedback(
  entry: Omit<FeedbackRecord, 'id' | 'createdAt' | 'status' | 'emailDelivery'>
): Promise<FeedbackRecord> {
  ensureDbFile();

  const id = `FB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const createdAt = new Date().toISOString();

  const record: FeedbackRecord = {
    ...entry,
    id,
    createdAt,
    status: 'new',
    emailDelivery: {
      attempted: true,
      sent: false,
    },
  };

  // Attempt Email / Webhook dispatch
  const emailResult = await sendEmailNotification(record);
  record.emailDelivery = {
    attempted: true,
    sent: emailResult.sent,
    recipient: emailResult.recipient,
    error: emailResult.error,
    sentAt: emailResult.sent ? new Date().toISOString() : undefined,
  };

  // Save to persistent database
  const dbPath = ensureDbFile();
  const all = getAllFeedback();
  all.unshift(record); // newest first
  try {
    fs.writeFileSync(dbPath, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write feedback record to dbPath:', err);
  }

  return record;

}
