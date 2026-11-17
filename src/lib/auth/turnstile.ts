/**
 * Cloudflare Turnstile Human Verification Helper
 * Verifies cryptographic bot/human challenge tokens against Cloudflare's siteverify API.
 */

export interface TurnstileVerificationResult {
  success: boolean;
  challengeTs?: string;
  hostname?: string;
  errorCodes?: string[];
  message?: string;
}

// Official Cloudflare Turnstile test secret key (always passes)
export const CLOUDFLARE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

export async function verifyTurnstileToken(
  token: string | null | undefined,
  clientIp?: string
): Promise<TurnstileVerificationResult> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return {
      success: false,
      message: 'Cloudflare Turnstile verification token is missing.',
      errorCodes: ['missing-input-response'],
    };
  }

  const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
  const secretKey =
    env.TURNSTILE_SECRET_KEY ||
    process.env.TURNSTILE_SECRET_KEY ||
    CLOUDFLARE_TEST_SECRET_KEY;

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== 'unknown') {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      return {
        success: false,
        message: `Cloudflare Turnstile API returned HTTP status ${res.status}`,
        errorCodes: ['api-request-failed'],
      };
    }

    const data = (await res.json()) as any;
    if (data.success) {
      return {
        success: true,
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
      };
    }

    return {
      success: false,
      message: 'Cloudflare human verification challenge failed or expired.',
      errorCodes: data['error-codes'] || ['verification-failed'],
    };
  } catch (err: any) {
    console.error('[Turnstile] Verification request exception:', err);
    return {
      success: false,
      message: 'Network error communicating with Cloudflare verification service.',
      errorCodes: ['network-error'],
    };
  }
}
