/** Redirects followed for one request; catalogues use one at most (an edition, a cover file). */
const MAX_REDIRECTS = 3;
const FIRST_REDIRECT = 300;
const AFTER_REDIRECTS = 400;

export type HostCheck = (hostname: string) => boolean;

/**
 * `fetch` that follows redirects itself, and only over HTTPS to hosts `allowed` accepts: a
 * catalogue's answer must not send our server anywhere else (another site, or an address inside
 * our own network). `init.redirect` is always `manual`.
 */
export async function fetchWithin(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  allowed: HostCheck
): Promise<Response> {
  let current = new URL(url);
  for (let redirects = 0; ; redirects += 1) {
    const response = await fetchImpl(current.toString(), { ...init, redirect: 'manual' });
    const location = response.headers.get('location');
    const redirected =
      response.status >= FIRST_REDIRECT && response.status < AFTER_REDIRECTS && location;
    if (!redirected) return response;
    await response.body?.cancel();
    const next = new URL(location, current);
    if (next.protocol !== 'https:' || !allowed(next.hostname)) {
      throw new Error(`${current.hostname} redirected outside the catalogue`);
    }
    if (redirects === MAX_REDIRECTS) throw new Error(`${current.hostname} redirected too often`);
    current = next;
  }
}

/** The body, or `null` once it is (or says it will be) longer than `maxBytes`. */
export async function readCapped(response: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
