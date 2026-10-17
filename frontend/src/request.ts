export class RequestTimeoutError extends Error {}
// First-party JSON endpoints are small. Buffer the body inside the deadline too,
// so headers followed by a stalled response cannot leave the UI loading forever.
export async function fetchJsonResponse(input: RequestInfo | URL, init: RequestInit = {}, fetcher: typeof fetch = fetch, timeoutMs = 20000): Promise<Response> {
  const parent = init.signal;
  if (parent?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => { reject(new DOMException('Cancelled', 'AbortError')); controller.abort(); };
    parent?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => { reject(new RequestTimeoutError('응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.')); controller.abort(); }, timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetcher(input, { ...init, signal: controller.signal });
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status, statusText: response.statusText, headers: response.headers,
      });
    })(), interrupted]);
  } finally {
    clearTimeout(timer);
    if (cancel) parent?.removeEventListener('abort', cancel);
  }
}

// Only opt-in public GETs tolerate a sleeping backend. Writes and account requests
// retain the original timeout and are never automatically replayed.
export async function fetchStartupJson(input: string, init: RequestInit = {}, onWait: (attempt: number) => void = () => {}, fetcher: typeof fetch = fetch, timeoutMs = 20000): Promise<Response> {
  const publicRead = (!init.method || init.method === "GET") && !new Headers(init.headers).has("Authorization");
  for (let attempt = 1; ; attempt++) {
    try { return await fetchJsonResponse(input, init, fetcher, timeoutMs); }
    catch (error) {
      if (!publicRead || !(error instanceof RequestTimeoutError) || init.signal?.aborted || attempt >= 4) throw error;
      onWait(attempt + 1);
    }
  }
}
