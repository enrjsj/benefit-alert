import { fetchJsonResponse } from "./request";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Benefit } from "./benefit";
import { createRemotePlanningStore } from "./remotePlanning";
import {
  checklistSteps,
  createPlanningStore,
  planningKey,
  setChecklistStep,
  toggleCompare,
  readPlanning,
  mergePlanning,
  setApplication,
  type ApplicationRecord,
  type Planning,
  type StepId,
} from "./planning";
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
type PlannerStore = {
  getSnapshot: () => { data: Planning; message: string; busy?: boolean; ready?: boolean; applicationsSupported?: boolean };
  subscribe: (fn: () => void) => () => void;
  reload: () => void | Promise<void>;
  update: (change: (data: Planning) => Planning) => void | Promise<void>;
  start?: () => void;
  stop?: () => void;
  importData?: (data: Planning) => void | Promise<void>;
  report?: (message: string) => void;
};
export function usePlanning(owner: string, token?: string) {
  const key = planningKey(owner);
  const store = useMemo<PlannerStore>(() => {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Private/restricted browsers still get in-memory planning. */
    }
    if (!token) return createPlanningStore(storage, key);
    return createRemotePlanningStore((method, body, signal, importing) =>
      fetchJsonResponse(`${base}/api/account/planning${importing ? "/import" : ""}`, {
        method, signal, cache: "no-store",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }));
  }, [key, token]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.start?.();
    const sync = (event: StorageEvent) => {
      if (event.key === key || event.key === null) store.reload();
    };
    addEventListener("storage", sync);
    const focus = () => { if (store.start) void store.reload(); };
    addEventListener("focus", focus);
    return () => {
      removeEventListener("storage", sync);
      removeEventListener("focus", focus);
      store.stop?.();
    };
  }, [store, key]);
  return {
    ...snapshot,
    account: !!token,
    busy: snapshot.busy ?? false,
    ready: snapshot.ready ?? true,
    applicationsSupported: !token || snapshot.applicationsSupported === true,
    refresh: () => store.reload(),
    importLocal: () => {
      if (!store.importData) return;
      try {
        const guest = readPlanning(localStorage, planningKey("guest"));
        const legacy = readPlanning(localStorage, key);
        void store.importData(mergePlanning(legacy, guest));
      } catch (error) { store.report?.((error as Error).message); }
    },
    removeChecklist: (id: string) => store.update((s: Planning) => {
      const checklists = { ...s.checklists };
      const applications = { ...s.applications };
      delete checklists[id];
      delete applications[id];
      return { ...s, checklists, applications };
    }),
    saveApplication: (id: string, entry: ApplicationRecord, expected?: ApplicationRecord) =>
      store.update(s => setApplication(s, id, entry, expected)),
    toggle: (id: string) => store.update((s) => toggleCompare(s, id)),
    clearCompare: () => store.update((s) => ({ ...s, compareIds: [] })),
    check: (id: string, step: StepId, checked: boolean) =>
      store.update((s) => setChecklistStep(s, id, step, checked)),
  };
}
export type PlanningState = ReturnType<typeof usePlanning>;
export function ApplicationChecklist({
  benefit,
  planning,
}: {
  benefit: Benefit;
  planning: PlanningState;
}) {
  const checked = planning.data.checklists[benefit.id] || [];
  return (
    <section className="application-checklist" aria-label="신청 체크리스트">
      <div className="checklist-heading">
        <div>
          <span className="section-kicker">MY NEXT STEP</span>
          <h3>신청 체크리스트</h3>
        </div>
        <span className="checklist-count">
          {checked.length} / {checklistSteps.length}
        </span>
      </div>
      <p className="planning-help">
        직접 확인한 항목에 체크해 주세요. {planning.account ? "계정에 저장되어 다른 기기에서도 확인할 수 있어요." : "이 브라우저에만 저장돼요."}
        실제 신청·접수 상태와 자동 연동되지 않아요.
      </p>
      <progress
        value={checked.length}
        max={checklistSteps.length}
        aria-label="신청 체크리스트 진행률"
      />
      <fieldset disabled={planning.busy || !planning.ready}>
        <legend className="sr-only">공고별 신청 준비 항목</legend>
        {checklistSteps.map((step) => (
          <label
            key={step.id}
            className={checked.includes(step.id) ? "step-done" : ""}
          >
            <input
              type="checkbox"
              checked={checked.includes(step.id)}
              onChange={(e) =>
                planning.check(benefit.id, step.id, e.target.checked)
              }
            />
            <span>
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {checked.length === checklistSteps.length && (
        <p className="checklist-complete" role="status">
          모든 확인 항목을 기록했어요. 선정 결과는 해당 기관에서 확인해 주세요.
        </p>
      )}
      {planning.message && (
        <p className="planning-message" role="status">
          {planning.message}
        </p>
      )}
    </section>
  );
}
export function ComparisonDialog({
  ids,
  planning,
  onClose,
  onDetail,
}: {
  ids: string[];
  planning: PlanningState;
  onClose: () => void;
  onDetail: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Benefit[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [demo, setDemo] = useState(false),
    [retry, setRetry] = useState(0);
  const joined = JSON.stringify(ids);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(false);
    setItems([]);
    if (!ids.length) {
      setLoading(false);
      return () => abort.abort();
    }
    const params = new URLSearchParams({ size: "3" });
    ids.forEach((id) => params.append("ids", id));
    fetchJsonResponse(`${base}/api/benefits?${params}`, { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (abort.signal.aborted) return;
        if (!Array.isArray(data.items)) throw Error();
        setItems(data.items);
        setDemo(data.demo === true);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [joined, retry]);
  const missing = ids.filter((id) => !items.some((b) => b.id === id));
  const ordered = ids.flatMap((id) => {
    const b = items.find((b) => b.id === id);
    return b ? [b] : [];
  });
  const rows: { title: string; value: (b: Benefit) => string }[] = [
    { title: "지원 대상", value: (b) => b.eligibility },
    { title: "지원 내용", value: (b) => b.support },
    {
      title: "신청 기간",
      value: (b) =>
        b.deadline
          ? `${b.deadline}까지\n${b.periodLabel || ""}`
          : b.periodLabel || "공식 안내 확인",
    },
    { title: "신청 방법", value: (b) => b.applicationMethod },
    { title: "제공 기관", value: (b) => b.organization },
    {
      title: "신청 준비",
      value: (b) =>
        `${planning.data.checklists[b.id]?.length || 0} / ${checklistSteps.length} 항목 확인`,
    },
  ];
  return (
    <dialog
      ref={dialog}
      className="comparison-dialog"
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="comparison-title"
    >
      <div className="dialog-top">
        <span className="section-kicker">SIDE BY SIDE</span>
        <button
          className="close-button"
          onClick={onClose}
          aria-label="혜택 비교 닫기"
        >
          ×
        </button>
      </div>
      <h2 id="comparison-title">나에게 더 필요한 혜택은?</h2>
      <p className="planning-help">
        최대 3개 공고의 조건을 나란히 살펴보세요. 중복 수혜 가능 여부와 최종
        자격은 각 기관에 확인해 주세요.
      </p>
      {demo && (
        <p className="demo-banner">
          가상 예시 공고입니다. 실제 신청할 수 없습니다.
        </p>
      )}
      {loading ? (
        <p role="status">최신 공고 정보를 불러오고 있어요…</p>
      ) : error ? (
        <div role="alert" className="planning-message">
          <p>비교 정보를 불러오지 못했어요. 선택한 공고는 유지돼요.</p>
          <button
            className="secondary-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          {missing.length > 0 && (
            <div className="planning-message">
              <p>
                선택한 공고 중 {missing.length}개는 더 이상 조회할 수 없어요.
              </p>
              {missing.map((id, n) => (
                <button
                  key={id}
                  className="text-button"
                  disabled={planning.busy || !planning.ready}
                  onClick={() => planning.toggle(id)}
                >
                  조회할 수 없는 공고 {n + 1} 빼기
                </button>
              ))}
            </div>
          )}
          {ordered.length > 0 ? (
            <>
              <p className="comparison-scroll-hint">
                좌우로 넘기며 같은 항목을 비교해 보세요.
              </p>
              <div
                className="comparison-scroll"
                tabIndex={0}
                role="region"
                aria-label="혜택 비교표, 가로 스크롤 가능"
              >
                <table className="comparison-table">
                  <caption className="sr-only">
                    선택한 {ordered.length}개 혜택 비교
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">비교 항목</th>
                      {ordered.map((b) => (
                        <th scope="col" key={b.id}>
                          <span className="tag">
                            {b.category} · {b.region}
                          </span>
                          <h3>{b.title}</h3>
                          <button
                            className="text-button"
                            disabled={planning.busy || !planning.ready}
                            onClick={() => planning.toggle(b.id)}
                            aria-label={`${b.title} 비교에서 빼기`}
                          >
                            비교에서 빼기
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.title}>
                        <th scope="row">{row.title}</th>
                        {ordered.map((b) => (
                          <td key={b.id}>{row.value(b) || "공식 안내 확인"}</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row">다음 단계</th>
                      {ordered.map((b) => (
                        <td key={b.id}>
                          <button
                            className="primary-button"
                            onClick={() => onDetail(b.id)}
                          >
                            상세·신청 준비
                          </button>
                          {!demo && /^https?:\/\//.test(b.sourceUrl) && (
                            <a
                              className="comparison-source"
                              href={b.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              공식 안내 ↗
                            </a>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="planning-empty">
              <h3>함께 살펴볼 혜택을 담아보세요</h3>
              <p>공고의 ‘비교 담기’를 누르면 여기에 모여요.</p>
              <button className="primary-button" onClick={onClose}>
                혜택 둘러보기
              </button>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
