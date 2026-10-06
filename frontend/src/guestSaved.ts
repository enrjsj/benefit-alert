export const savedKey = 'benefit-saved';
export function parseSaved(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? [...new Set<string>(value.filter(v => typeof v === 'string' && v.trim().length > 0 && v.length <= 100))].slice(0, 100) : [];
  } catch { return []; }
}
export function createGuestSavedStore(storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
  let memoryOnly = false;
  let snapshot = { ids: [] as string[], message: '' };
  const read = () => {
    if (!storage || memoryOnly) return snapshot.ids;
    try { return parseSaved(storage.getItem(savedKey)); }
    catch { memoryOnly = true; return snapshot.ids; }
  };
  snapshot.ids = read();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    reload() { snapshot = { ...snapshot, ids: read() }; emit(); },
    toggle(id: string) {
      if (!id.trim() || id.length > 100) return;
      const current = read();
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      if (next.length > 100) snapshot = { ids: current, message: '이 브라우저에는 최대 100개까지 저장할 수 있어요.' };
      else {
        let message = '';
        try { if (!storage) throw Error(); storage.setItem(savedKey, JSON.stringify(next)); memoryOnly = false; }
        catch { memoryOnly = true; message = '브라우저 저장 공간을 사용할 수 없어 이번 방문에만 기억해요.'; }
        snapshot = { ids: next, message };
      }
      emit();
    },
  };
}
