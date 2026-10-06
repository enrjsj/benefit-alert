const CACHE_AGE = 24 * 60 * 60 * 1000;
type CacheStorage = Pick<Storage, "getItem" | "setItem">;
export function mergeDistrictOptions(bundled: string[], latest: string[]): string[] {
  return [...new Set([...bundled, ...latest])].sort((a, b) => a.localeCompare(b, "ko"));
}
const parseItems = (value: unknown): string[] => {
  if (!Array.isArray(value) || value.length > 300 || !value.every(item =>
    typeof item === "string" && item.length <= 50 && /^[가-힣]+[시군구](?: [가-힣]+구)?$/.test(item))) throw Error("invalid_districts");
  return [...new Set(value)];
};
export function createDistrictCache(storage: CacheStorage | null) {
  const memory = new Map<string, {savedAt: number; items: string[]}>();
  return {
    get(region: string, now = Date.now()): string[] | null {
      let entry = memory.get(region);
      if (!entry) {
        try { entry = JSON.parse(storage?.getItem(`benefit-districts:v1:${region}`) || "null"); }
        catch { return null; }
      }
      if (!entry || !Number.isFinite(entry.savedAt) || entry.savedAt > now || now - entry.savedAt >= CACHE_AGE) return null;
      try { return parseItems(entry.items); } catch { return null; }
    },
    save(region: string, items: string[], now = Date.now()) {
      const entry = {savedAt: now, items: parseItems(items)};
      memory.set(region, entry);
      if (memory.size > 20) memory.delete(memory.keys().next().value!);
      try { storage?.setItem(`benefit-districts:v1:${region}`, JSON.stringify(entry)); } catch { /* Memory cache still works. */ }
    },
  };
}
export async function requestDistricts(url: string, signal: AbortSignal, fetcher: typeof fetch = fetch, timeoutMs = 20000): Promise<string[]> {
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const request = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => { reject(new DOMException("Cancelled", "AbortError")); request.abort(); };
    signal.addEventListener("abort", cancel, {once: true});
    timer = setTimeout(() => { reject(Error("district_timeout")); request.abort(); }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, {signal: request.signal, cache: "no-store"});
        if (!response.ok) throw Error("district_unavailable");
        return parseItems(await response.json());
      })(), interrupted,
    ]);
  } finally {
    clearTimeout(timer);
    if (cancel) signal.removeEventListener("abort", cancel);
  }
}
