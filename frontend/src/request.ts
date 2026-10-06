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
    timer = setTimeout(() => { reject(Error('응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.')); controller.abort(); }, timeoutMs);
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
