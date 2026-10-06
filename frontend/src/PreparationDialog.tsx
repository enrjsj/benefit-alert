import { useEffect, useRef, useState } from "react";
import type { Benefit } from "./benefit";
import type { PlanningState } from "./PlanningPanel";
import { checklistSteps } from "./planning";
import { deadlineDays, deadlineLabel, matchesDeadline, seoulToday, type DeadlineFilter } from "./deadline";
import { DeadlineCalendarButton } from "./DeadlineCalendarButton";
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function PreparationDialog({ planning, onClose, onDetail }: {
  planning: PlanningState; onClose: () => void; onDetail: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [sort, setSort] = useState("record");
  const [today, setToday] = useState(seoulToday);
  const ids = Object.keys(planning.data.checklists);
  const joined = JSON.stringify(ids);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const update = () => setToday(seoulToday());
    const timer = setInterval(update, 60000);
    addEventListener("focus", update);
    return () => { clearInterval(timer); removeEventListener("focus", update); };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError(false); setItems([]);
    void (async () => {
      try {
        const result: Benefit[] = [];
        for (let offset = 0; offset < ids.length; offset += 100) {
          const params = new URLSearchParams({ size: "100" });
          ids.slice(offset, offset + 100).forEach((id) => params.append("ids", id));
          const response = await fetch(`${base}/api/benefits?${params}`, { signal: abort.signal });
          if (!response.ok) throw Error();
          const data = await response.json();
          if (!Array.isArray(data.items)) throw Error();
          result.push(...data.items);
        }
        if (!abort.signal.aborted) setItems(result);
      } catch { if (!abort.signal.aborted) setError(true); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => abort.abort();
  }, [joined, retry]);
  const completed = ids.filter((id) => planning.data.checklists[id].length === checklistSteps.length);
  const byId = new Map(items.map(item => [item.id, item]));
  const shown = ids.filter(id => (filter === "all" || (filter === "done" ? completed.includes(id) : !completed.includes(id)))
    && matchesDeadline(byId.get(id), deadlineFilter, today));
  if (sort === "deadline") shown.sort((a, b) =>
    (deadlineDays(byId.get(a)?.deadline, today) ?? Infinity) - (deadlineDays(byId.get(b)?.deadline, today) ?? Infinity));
  return <dialog ref={dialog} className="preparation-dialog" aria-labelledby="preparation-title" onCancel={onClose} onClose={onClose}>
    <div className="dialog-top"><span className="section-kicker">MY APPLICATIONS</span><button className="close-button" aria-label="신청 준비 닫기" onClick={onClose}>×</button></div>
    <h2 id="preparation-title">내 신청 준비</h2>
    <p className="planning-help">직접 기록한 준비 과정을 모아 보세요. 선정 결과와 실제 접수 상태는 해당 기관에서 확인해 주세요.</p>
    <div className="preparation-sync">
      <p>{planning.account ? "계정에 저장되어 다른 기기에서도 이어갈 수 있어요." : "이 브라우저에 저장돼요. 로그인 후 이 기기의 기록을 가져올 수 있어요."}</p>
      {planning.account && <div className="preparation-actions">
        <button className="secondary-button" disabled={planning.busy} onClick={planning.refresh}>계정 기록 새로고침</button>
        <button className="secondary-button" disabled={planning.busy || !planning.ready} onClick={planning.importLocal}>이 기기 기록 가져오기</button>
      </div>}
      {planning.busy && <p role="status">계정 기록을 동기화하고 있어요…</p>}
      {planning.message && <p role="status" className="planning-message">{planning.message}</p>}
    </div>
    <div className="preparation-deadlines">
      <label>마감 조건<select aria-label="신청 준비 마감 조건" value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}>
        <option value="all">모든 기간</option><option value="week">7일 이내 마감</option><option value="month">30일 이내 마감</option>
        <option value="expired">마감된 공고</option><option value="unknown">마감일 미정</option>
      </select></label>
      <label>정렬<select aria-label="신청 준비 정렬" value={sort} onChange={event => setSort(event.target.value)}>
        <option value="record">기록순</option><option value="deadline">마감 가까운 순</option>
      </select></label>
    </div>
    <p className="planning-help">마감 조건은 한국 날짜 기준이며 오늘 마감도 포함해요. 상시·기관별 상이 등은 ‘마감일 미정’에서 확인해 주세요.</p>
    <div className="preparation-filters" aria-label="신청 준비 상태 필터">
      {[["all", `전체 ${ids.length}`], ["progress", `진행 중 ${ids.length - completed.length}`], ["done", `확인 완료 ${completed.length}`]].map(([value, label]) =>
        <button key={value} className="secondary-button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {!planning.ready && !planning.busy && planning.message ? <p>위의 ‘계정 기록 새로고침’을 눌러 다시 불러와 주세요.</p>
      : !planning.ready || loading ? <p role="status">신청 준비 정보를 불러오고 있어요…</p>
      : error ? <div role="alert"><p>공고 정보를 불러오지 못했어요. 준비 기록은 유지돼요.</p><button className="secondary-button" onClick={() => setRetry((n) => n + 1)}>다시 불러오기</button></div>
      : shown.length === 0 ? <div className="planning-empty"><h3>{ids.length ? "선택한 조건에 맞는 기록이 없어요" : "신청 준비를 시작해 보세요"}</h3><p>{ids.length ? "다른 마감 조건이나 준비 상태를 선택해 보세요." : "공고 상세에서 확인한 항목을 체크하면 여기에 모여요."}</p>{ids.length > 0 && <button className="secondary-button" onClick={() => { setFilter("all"); setDeadlineFilter("all"); }}>모든 준비 기록 보기</button>}<button className="primary-button" onClick={onClose}>혜택 둘러보기</button></div>
      : <ul className="preparation-list">{shown.map((id) => {
        const benefit = byId.get(id);
        const count = planning.data.checklists[id].length;
        return <li key={id}>
          <span className="tag">{count === checklistSteps.length ? "확인 완료" : "진행 중"} · {count}/{checklistSteps.length}</span>
          <h3>{benefit?.title || "더 이상 제공되지 않는 공고"}</h3>
          {!benefit && <p>공고 번호: {id}. 준비 기록은 보관되어 있어요.</p>}
          {benefit && <p>{benefit.organization} · {benefit.deadline ? `${benefit.deadline} · ${deadlineLabel(benefit.deadline, today)}` : benefit.periodLabel}</p>}
          <progress value={count} max={checklistSteps.length} aria-label={`${benefit?.title || id} 준비 진행률`} />
          <div className="preparation-actions">
            {benefit && <button className="primary-button" onClick={() => onDetail(id)}>준비 이어가기</button>}
            {benefit && <DeadlineCalendarButton benefit={benefit} today={today} />}
            <button className="text-button" disabled={planning.busy || !planning.ready} onClick={() => {
              if (window.confirm("이 공고의 체크리스트 기록을 삭제할까요?")) planning.removeChecklist(id);
            }}>기록 삭제</button>
          </div>
        </li>;
      })}</ul>}
  </dialog>;
}
