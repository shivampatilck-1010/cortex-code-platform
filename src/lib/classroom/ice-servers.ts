import crypto from 'crypto';

export interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServerResult {
  iceServers: RTCIceServerConfig[];
  isTurnConfigured: boolean;
  mode: 'stun-only' | 'stun-and-turn';
  ttlSeconds: number;
  expiresAt: number;
}

const PUBLIC_STUN_SERVERS: RTCIceServerConfig[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/**
 * Returns authoritative ICE servers (STUN and dynamically generated ephemeral TURN credentials).
 * Never exposes the shared TURN secret to clients.
 *
 * Supports both standard RFC 5766 dynamic HMAC signing (Coturn) and static TURN credentials:
 * - Dynamic: CORTEX_TURN_URLS (or LIVE_CLASS_TURN_URL) + CORTEX_TURN_SECRET (or LIVE_CLASS_TURN_SECRET)
 * - Static: LIVE_CLASS_TURN_URL + LIVE_CLASS_TURN_USERNAME + LIVE_CLASS_TURN_CREDENTIAL
 * - Managed JSON: CORTEX_ICE_SERVERS_JSON
 * - Fallback: STUN-only development mode (Google public STUN)
 */
export function getAuthoritativeIceServers(userId: string = 'cortex-participant'): IceServerResult {
  const turnUrlsEnv = process.env.CORTEX_TURN_URLS || process.env.LIVE_CLASS_TURN_URL;
  const turnSecretEnv = process.env.CORTEX_TURN_SECRET || process.env.LIVE_CLASS_TURN_SECRET;
  const staticUsername = process.env.LIVE_CLASS_TURN_USERNAME || process.env.CORTEX_TURN_USERNAME;
  const staticCredential = process.env.LIVE_CLASS_TURN_CREDENTIAL || process.env.CORTEX_TURN_CREDENTIAL;
  const customIceServersJson = process.env.CORTEX_ICE_SERVERS_JSON;
  const ttlSeconds = Number(process.env.CORTEX_TURN_TTL_SECONDS) || 7200; // 2h default
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // 1. Managed custom ICE servers JSON (e.g. from Cloudflare Calls, Twilio, Metered)
  if (customIceServersJson) {
    try {
      const parsed = JSON.parse(customIceServersJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          iceServers: [...PUBLIC_STUN_SERVERS, ...parsed],
          isTurnConfigured: true,
          mode: 'stun-and-turn',
          ttlSeconds,
          expiresAt,
        };
      }
    } catch (e) {
      console.warn('[WebRTC] Malformed CORTEX_ICE_SERVERS_JSON, ignoring', e);
    }
  }

  // 2. Standard RFC 5766 TURN with dynamic HMAC-SHA1 ephemeral credentials (e.g., Coturn)
  if (turnUrlsEnv && turnSecretEnv && turnSecretEnv.trim().length >= 8) {
    const urls = turnUrlsEnv.split(',').map((u) => u.trim()).filter(Boolean);
    const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const username = `${timestamp}:${cleanUserId || 'user'}`;
    const hmac = crypto.createHmac('sha1', turnSecretEnv.trim());
    hmac.update(username);
    const credential = hmac.digest('base64');

    return {
      iceServers: [
        ...PUBLIC_STUN_SERVERS,
        {
          urls,
          username,
          credential,
        },
      ],
      isTurnConfigured: true,
      mode: 'stun-and-turn',
      ttlSeconds,
      expiresAt,
    };
  }

  // 3. Static TURN credentials (e.g. LIVE_CLASS_TURN_URL with USERNAME and CREDENTIAL)
  if (turnUrlsEnv && staticUsername && staticCredential) {
    const urls = turnUrlsEnv.split(',').map((u) => u.trim()).filter(Boolean);
    return {
      iceServers: [
        ...PUBLIC_STUN_SERVERS,
        {
          urls,
          username: staticUsername.trim(),
          credential: staticCredential.trim(),
        },
      ],
      isTurnConfigured: true,
      mode: 'stun-and-turn',
      ttlSeconds,
      expiresAt,
    };
  }

  // 4. Graceful fallback: STUN-only development mode
  return {
    iceServers: PUBLIC_STUN_SERVERS,
    isTurnConfigured: false,
    mode: 'stun-only',
    ttlSeconds,
    expiresAt,
  };
}
