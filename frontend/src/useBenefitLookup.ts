import { useEffect, useState } from "react";
import type { Benefit } from "./benefit";
import { fetchJsonResponse } from "./request";
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// A failed batch is unknown, never evidence that its notices were removed.
export function useBenefitLookup(ids: string[]) {
  const key = JSON.stringify(ids);
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState({ key: "", items: [] as Benefit[], checked: [] as string[], loading: true, error: false });
  useEffect(() => {
    const abort = new AbortController();
    const requested: string[] = JSON.parse(key);
    const items: Benefit[] = [], checked: string[] = [];
    let error = false;
    setSnapshot({ key, items: [], checked: [], loading: !!requested.length, error });
    void (async () => {
      for (let offset = 0; offset < requested.length; offset += 100) {
        const batch = requested.slice(offset, offset + 100);
        try {
          const params = new URLSearchParams({ size: "100" });
          batch.forEach(id => params.append("ids", id));
          const response = await fetchJsonResponse(`${base}/api/benefits?${params}`, { signal: abort.signal });
          if (!response.ok) throw Error();
          const data = await response.json();
          if (!Array.isArray(data.items) || data.items.some((item: Benefit) => !item || !batch.includes(item.id) || typeof item.title !== "string")) throw Error();
          items.push(...data.items);
          checked.push(...batch);
        } catch { error = true; }
        if (abort.signal.aborted) return;
        setSnapshot({ key, items: [...items], checked: [...checked], loading: offset + 100 < requested.length, error });
      }
    })();
    return () => abort.abort();
  }, [key, retry]);
  const current = snapshot.key === key ? snapshot : { items: [], checked: [], loading: !!ids.length, error: false };
  return { ...current, checked: new Set(current.checked), reload: () => setRetry(n => n + 1) };
}
