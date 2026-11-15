/**
 * Cortex Classroom Storage Abstraction Layer
 *
 * Provides a unified interface to Cloudflare R2 object storage (ASSETS_BUCKET)
 * with an automatic, resilient in-memory fallback for local development,
 * testing harnesses, and environments where R2 credentials/bindings are not present.
 *
 * Strictly zero emojis.
 */

export interface StorageObject {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata: (headers: Headers) => void;
}

export interface StorageBucket {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | Blob | string,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<{ key: string; etag: string; size: number }>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  isFallback?: boolean;
}

interface StoredEntry {
  data: Uint8Array;
  contentType: string;
  etag: string;
  size: number;
}

function getFallbackStore(): Map<string, StoredEntry> {
  const g = globalThis as any;
  if (!g.__cortex_assets_fallback_storage) {
    g.__cortex_assets_fallback_storage = new Map<string, StoredEntry>();
  }
  return g.__cortex_assets_fallback_storage;
}

async function readStreamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      chunks.push(chunk);
      totalLength += chunk.length;
    }
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function getAssetsBucket(): StorageBucket {
  const boundBucket =
    (typeof process !== 'undefined' && process.env && (process.env as any).ASSETS_BUCKET) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).env && (globalThis as any).env.ASSETS_BUCKET);

  if (boundBucket && typeof boundBucket.put === 'function' && typeof boundBucket.get === 'function') {
    return boundBucket;
  }

  const store = getFallbackStore();

  return {
    isFallback: true,

    async put(key: string, value: any, options?: { httpMetadata?: { contentType?: string } }) {
      let data: Uint8Array;

      if (value instanceof Uint8Array) {
        data = value;
      } else if (value instanceof ArrayBuffer) {
        data = new Uint8Array(value);
      } else if (ArrayBuffer.isView(value)) {
        data = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      } else if (typeof (value as any)?.arrayBuffer === 'function') {
        data = new Uint8Array(await (value as any).arrayBuffer());
      } else if (value && typeof (value as any).getReader === 'function') {
        data = await readStreamToUint8Array(value);
      } else {
        data = new TextEncoder().encode(String(value));
      }

      const contentType = options?.httpMetadata?.contentType || 'application/octet-stream';
      const etag = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      store.set(key, { data, contentType, etag, size: data.byteLength });

      return { key, etag, size: data.byteLength };
    },

    async get(key: string): Promise<StorageObject | null> {
      const entry = store.get(key);
      if (!entry) return null;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(entry.data);
          controller.close();
        },
      });

      return {
        body: stream,
        httpEtag: entry.etag,
        httpMetadata: { contentType: entry.contentType },
        writeHttpMetadata(headers: Headers) {
          if (entry.contentType) {
            headers.set('content-type', entry.contentType);
          }
          headers.set('content-length', String(entry.size));
        },
      };
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },
  };
}
