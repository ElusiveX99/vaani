/**
 * Bounded JSON request parsing for API routes.
 * Enforces a streaming byte limit; Content-Length is only an early check.
 */
export type JsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 413 | 415 };

export async function readJsonBody<T>(request: Request, maxBytes = 16 * 1024): Promise<JsonBodyResult<T>> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") return { ok: false, status: 415 };
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) return { ok: false, status: 400 };
    if (Number(contentLength) > maxBytes) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, status: 400 };
    return { ok: true, data: parsed as T };
  } catch {
    return { ok: false, status: 400 };
  }
}
