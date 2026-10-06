import { emptyPlanning, parsePlanning, type Planning } from "./planning.ts";

export type RemoteSnapshot = {
  data: Planning;
  revision: number;
  ready: boolean;
  busy: boolean;
  message: string;
  applicationsSupported: boolean;
};
type Request = (method: string, body: unknown, signal: AbortSignal, importing?: boolean) => Promise<Response>;
// A store belongs to one account/session. Stopping it aborts requests and makes
// late responses harmless, including after logout or React StrictMode cleanup.
export function createRemotePlanningStore(request: Request) {
  let snapshot: RemoteSnapshot = { data: emptyPlanning(), revision: 0, ready: false, busy: false, message: "", applicationsSupported: false };
  let active = false, epoch = 0;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  const set = (patch: Partial<RemoteSnapshot>) => { snapshot = { ...snapshot, ...patch }; emit(); };
  async function run(method: string, body?: unknown, importing = false) {
    if (!active || snapshot.busy) return;
    const generation = epoch;
    controller = new AbortController();
    const signal = controller.signal;
    const current = () => active && generation === epoch && !signal.aborted;
    set({ busy: true, message: "" });
    try {
      const response = await request(method, body, signal, importing);
      if (!current()) return;
      if (response.status === 409) {
        const latest = await request("GET", undefined, signal);
        if (!latest.ok) throw Error("최신 기록을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.");
        const value = await latest.json();
        if (!current()) return;
        accept(value);
        set({ message: "다른 기기에서 기록이 변경됐어요. 최신 기록을 불러왔으니 변경할 항목을 다시 선택해 주세요." });
        return;
      }
      if (!response.ok) throw Error(response.status === 401
        ? "로그인 상태를 다시 확인해 주세요."
        : response.status === 422
          ? "같은 공고의 신청 상태나 메모가 달라요. 두 기록을 확인해 정리한 뒤 다시 가져와 주세요."
        : response.status === 400
          ? "비교 3개·신청 준비 200개·메모 1,000자 한도를 확인한 뒤 다시 시도해 주세요."
          : "계정 기록을 저장하거나 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
      const value = await response.json();
      if (!current()) return;
      accept(value);
      if (importing) set({ message: "이 기기의 신청 준비 기록을 계정에 가져왔어요. 기존 기록은 유지돼요." });
    } catch (error) {
      if (current()) set({ message: (error as Error).message });
    } finally {
      if (current()) set({ busy: false });
    }
  }
  function accept(value: { revision: number; data: Planning }) {
    if (!Number.isSafeInteger(value.revision) || value.revision < 0 || value.data?.version !== 1 || !Array.isArray(value.data.compareIds) || !value.data.checklists)
      throw Error("기록 응답을 확인하지 못했어요. 다시 불러와 주세요.");
    set({ data: parsePlanning(JSON.stringify(value.data)), revision: value.revision, ready: true, applicationsSupported: !!value.data.applications });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    start() { active = true; set({ busy: false }); void run("GET"); },
    stop() { active = false; epoch++; controller?.abort(); },
    reload() { return run("GET"); },
    update(change: (data: Planning) => Planning) {
      if (!snapshot.ready || snapshot.busy || !active) return;
      try { return run("PUT", { revision: snapshot.revision, data: change(snapshot.data) }); }
      catch (error) { set({ message: (error as Error).message }); }
    },
    importData(data: Planning) {
      if (!snapshot.ready || snapshot.busy || !active) return;
      if (!snapshot.applicationsSupported && Object.keys(data.applications || {}).length) {
        set({ message: "계정 기록을 새로고침한 뒤 다시 가져와 주세요. 이 기기의 상태와 메모는 유지돼요." }); return;
      }
      return run("POST", data, true);
    },
    report(message: string) { set({ message }); },
  };
}
