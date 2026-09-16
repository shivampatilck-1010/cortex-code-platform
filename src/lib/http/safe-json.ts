export class RequestBodyError extends Error {
  constructor(
    public readonly status: 400 | 413,
    message: string,
  ) {
    super(message);
    this.name = 'RequestBodyError';
  }
}

/**
 * Reads an untrusted JSON request body with a hard byte limit.  Content-Length
 * is a fast rejection path; streamed reads keep chunked requests bounded too.
 */
export async function readJsonBody<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength) {
    const length = Number(declaredLength);
    if (!Number.isFinite(length)) throw new RequestBodyError(400, 'Invalid Content-Length header');
    if (length > maxBytes) throw new RequestBodyError(413, `Request payload too large (max ${maxBytes} bytes)`);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400, 'Request body is required');

  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413, `Request payload too large (max ${maxBytes} bytes)`);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400, 'Unable to read request body');
  }

  const payload = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(payload)) as T;
  } catch {
    throw new RequestBodyError(400, 'Malformed JSON request body');
  }
}
