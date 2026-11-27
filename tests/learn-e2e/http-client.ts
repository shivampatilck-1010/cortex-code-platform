export interface ServerProbeResult {
  baseUrl: string;
  reachable: boolean;
  status: number | null;
  latencyMs: number;
  error?: string;
}

export interface RouteFetchResult {
  url: string;
  ok: boolean;
  status: number;
  html: string;
  crashMarkers: string[];
  latencyMs: number;
  error?: string;
}

export function getCortexBaseUrl(): string {
  const raw = process.env.CORTEX_BASE_URL?.trim() || 'http://127.0.0.1:3000';
  return raw.replace(/\/+$/, '');
}

export function isValidHttpUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectNextJsCrashMarkers(html: string): string[] {
  const markers: string[] = [];
  if (!html) return markers;

  if (/Application error:\s*a\s+(?:client|server)-side exception/i.test(html) || /Application error:/i.test(html)) {
    markers.push('Application error:');
  }
  if (/<html[^>]*id=["']__next_error__["']/i.test(html) || /__next_error__/.test(html)) {
    markers.push('__next_error__');
  }
  if (/Unhandled Runtime Error/i.test(html)) {
    markers.push('Unhandled Runtime Error');
  }

  return markers;
}

export async function probeServerReachable(baseUrl: string, timeoutMs = 4000): Promise<ServerProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(baseUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    return {
      baseUrl,
      reachable: true,
      status: res.status,
      latencyMs: Date.now() - started,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      baseUrl,
      reachable: false,
      status: null,
      latencyMs: Date.now() - started,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRouteHtml(url: string, timeoutMs = 10000): Promise<RouteFetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    const html = await res.text();
    const crashMarkers = detectNextJsCrashMarkers(html);

    return {
      url,
      ok: res.status === 200 && crashMarkers.length === 0,
      status: res.status,
      html,
      crashMarkers,
      latencyMs: Date.now() - started,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url,
      ok: false,
      status: 0,
      html: '',
      crashMarkers: [],
      latencyMs: Date.now() - started,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
