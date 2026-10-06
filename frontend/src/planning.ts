export const checklistSteps = [
  {
    id: "eligibility",
    title: "지원 대상과 자격 확인",
    description: "거주지·나이·소득 등 공식 공고의 조건을 확인했어요.",
  },
  {
    id: "documents",
    title: "필요한 서류 준비",
    description: "제출 서류와 발급 방법, 유효기간을 확인했어요.",
  },
  {
    id: "schedule",
    title: "신청 기간과 접수 방법 확인",
    description: "마감일과 온라인·방문 접수 방법을 확인했어요.",
  },
  {
    id: "submitted",
    title: "공식 사이트에서 신청·접수 확인",
    description: "직접 신청한 뒤 접수 여부를 확인했어요.",
  },
] as const;
export type StepId = (typeof checklistSteps)[number]["id"];
export type Planning = {
  version: 1;
  compareIds: string[];
  checklists: Record<string, StepId[]>;
};
export const MAX_COMPARE = 3;
export const MAX_CHECKLISTS = 200;
const validId = (id: unknown): id is string =>
  typeof id === "string" &&
  id.length > 0 &&
  id.length <= 100 &&
  !["__proto__", "constructor", "prototype"].includes(id);
const isStep = (id: unknown): id is StepId =>
  checklistSteps.some((step) => step.id === id);
export function emptyPlanning(): Planning {
  return { version: 1, compareIds: [], checklists: {} };
}
export function parsePlanning(raw: string | null): Planning {
  try {
    const input = JSON.parse(raw || "null");
    if (!input || input.version !== 1) return emptyPlanning();
    const compareIds = Array.isArray(input.compareIds)
      ? [...new Set<string>(input.compareIds.filter(validId))].slice(
          0,
          MAX_COMPARE,
        )
      : [];
    const checklists: Planning["checklists"] = {};
    if (
      input.checklists &&
      typeof input.checklists === "object" &&
      !Array.isArray(input.checklists)
    ) {
      for (const [id, steps] of Object.entries(input.checklists).slice(
        0,
        MAX_CHECKLISTS,
      )) {
        if (validId(id) && Array.isArray(steps)) {
          const checked = [...new Set(steps.filter(isStep))];
          if (checked.length) checklists[id] = checked;
        }
      }
    }
    return { version: 1, compareIds, checklists };
  } catch {
    return emptyPlanning();
  }
}
export function toggleCompare(state: Planning, id: string): Planning {
  if (!validId(id)) return state;
  if (state.compareIds.includes(id))
    return { ...state, compareIds: state.compareIds.filter((x) => x !== id) };
  if (state.compareIds.length >= MAX_COMPARE)
    throw Error("비교는 최대 3개까지 가능해요. 먼저 하나를 빼 주세요.");
  return { ...state, compareIds: [...state.compareIds, id] };
}
export function setChecklistStep(
  state: Planning,
  id: string,
  step: StepId,
  checked: boolean,
): Planning {
  if (!validId(id) || !isStep(step)) return state;
  const existing = state.checklists[id] || [];
  if (
    checked &&
    !existing.length &&
    Object.keys(state.checklists).length >= MAX_CHECKLISTS
  )
    throw Error(
      "최대 200개 공고를 기록할 수 있어요. 사용하지 않는 공고의 체크를 해제해 주세요.",
    );
  const next = checked
    ? [...new Set([...existing, step])]
    : existing.filter((x) => x !== step);
  const checklists = { ...state.checklists };
  if (next.length) checklists[id] = next;
  else delete checklists[id];
  return { ...state, checklists };
}
export function planningKey(owner: string) {
  return `benefit-planning:v1:${owner}`;
}
// Explicit imports merge checked steps without replacing existing progress.
// Refuse over-limit imports instead of dropping the user's selected records.
export function mergePlanning(existing: Planning, incoming: Planning): Planning {
  const compareIds = [...new Set([...existing.compareIds, ...incoming.compareIds])];
  const checklists = { ...existing.checklists };
  for (const [id, steps] of Object.entries(incoming.checklists)) {
    checklists[id] = [...new Set([...(checklists[id] || []), ...steps])];
  }
  if (compareIds.length > MAX_COMPARE || Object.keys(checklists).length > MAX_CHECKLISTS)
    throw Error("비교는 합쳐서 3개, 체크리스트는 200개까지 가능해요. 이 기기의 기록을 정리한 뒤 다시 시도해 주세요.");
  return { version: 1, compareIds, checklists };
}
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export function createPlanningStore(
  storage: StorageAccess | null,
  key: string,
) {
  let memoryOnly = false;
  const read = () => {
    try {
      return parsePlanning(storage?.getItem(key) || null);
    } catch {
      memoryOnly = true;
      return emptyPlanning();
    }
  };
  let snapshot = {
    data: read(),
    message:
      storage && !memoryOnly
        ? ""
        : "브라우저 저장소를 사용할 수 없어 이번 방문에만 기억해요.",
  };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((fn) => fn());
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    reload() {
      if (!memoryOnly) {
        snapshot = { data: read(), message: snapshot.message };
        emit();
      }
    },
    update(change: (state: Planning) => Planning) {
      try {
        // Read before writing so changes from another tab are retained.
        let previous = snapshot.data;
        if (!memoryOnly && storage) {
          try {
            previous = parsePlanning(storage.getItem(key));
          } catch {
            memoryOnly = true;
          }
        }
        const data = change(previous);
        let message = "";
        try {
          if (!storage) throw Error();
          storage.setItem(key, JSON.stringify(data));
          memoryOnly = false;
        } catch {
          memoryOnly = true;
          message =
            "브라우저에 저장하지 못했어요. 이번 방문에만 기억하므로 창을 닫기 전에 확인해 주세요.";
        }
        snapshot = { data, message };
      } catch (e) {
        snapshot = { ...snapshot, message: (e as Error).message };
      }
      emit();
    },
  };
}
