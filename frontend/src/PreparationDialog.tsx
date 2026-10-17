import type { DraftRecovery } from "./useImportDraft";
import { PlanningImportPanel, type ImportDraft } from "./PlanningImportPanel";
import { exportPlanning, matchesPlanningSearch } from "./planningExport";
import { ApplicationRecordEditor } from "./ApplicationRecordEditor";
import { useBenefitLookup } from "./useBenefitLookup";
import { useEffect, useRef, useState } from "react";
import type { PlanningState } from "./PlanningPanel";
import { checklistSteps, trackedIds, applicationStatuses } from "./planning";
import { deadlineDays, deadlineLabel, matchesDeadline, seoulToday, type DeadlineFilter } from "./deadline";
import { DeadlineCalendarButton } from "./DeadlineCalendarButton";

export function PreparationDialog({ planning, onClose, onDetail, importDraft, importRecovery, onImportDraftChange }: {
  importRecovery: DraftRecovery; importDraft: ImportDraft | null; onImportDraftChange: (draft: ImportDraft | null) => void;
  planning: PlanningState; onClose: () => void; onDetail: (id: string) => void;
}) {
  const [availability, setAvailability] = useState("all");
  const [query, setQuery] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const mayLeave = () => !dirty || window.confirm("저장하지 않은 신청 기록을 버릴까요?");
  const [importPending, setImportPending] = useState(false);
  const mayClose = () => !importPending && mayLeave() && (!importDraft || window.confirm("가져오기 미리보기를 보관하고 창을 닫을까요? 이 탭에서 다시 열면 선택을 이어갈 수 있어요."));
  const close = () => { if (mayClose()) onClose(); };
  const dialog = useRef<HTMLDialogElement>(null);
  const [filter, setFilter] = useState("all");
  const [applicationFilter, setApplicationFilter] = useState("all");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [sort, setSort] = useState("record");
  const [today, setToday] = useState(seoulToday);
  const ids = trackedIds(planning.data);
  const { items, checked, loading, error, reload } = useBenefitLookup(ids);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const update = () => setToday(seoulToday());
    const timer = setInterval(update, 60000);
    addEventListener("focus", update);
    return () => { clearInterval(timer); removeEventListener("focus", update); };
  }, []);
  function download(format: "json" | "csv") {
    setExportMessage("");
    try {
      const content = exportPlanning(planning.data, items, format);
      const url = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `benefit-records-${seoulToday()}.${format}`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMessage("저장된 전체 기록 파일의 다운로드를 요청했어요. 브라우저 다운로드 목록을 확인해 주세요.");
    } catch { setExportMessage("파일을 만들지 못했어요. 기록은 유지돼요. 다시 시도해 주세요."); }
  }
  const completed = ids.filter((id) => planning.data.checklists[id]?.length === checklistSteps.length);
  const byId = new Map(items.map(item => [item.id, item]));
  const shown = ids.filter(id => (filter === "all" || (filter === "done" ? completed.includes(id) : !completed.includes(id)))
    && (availability === "all" || (availability === "missing" ? checked.has(id) && !byId.has(id) : availability === "unknown" ? !checked.has(id) : byId.has(id)))
    && matchesPlanningSearch(id, planning.data, byId.get(id), query)
    && (deadlineFilter === "all" || (checked.has(id) && matchesDeadline(byId.get(id), deadlineFilter, today)))
    && (applicationFilter === "all" || planning.data.applications[id]?.status === applicationFilter));
  if (sort === "deadline") shown.sort((a, b) =>
    (deadlineDays(byId.get(a)?.deadline, today) ?? Infinity) - (deadlineDays(byId.get(b)?.deadline, today) ?? Infinity));
  return <dialog ref={dialog} className="preparation-dialog" aria-labelledby="preparation-title" onCancel={event => { event.preventDefault(); close(); }} onClose={onClose}>
    <div className="dialog-top"><span className="section-kicker">MY APPLICATIONS</span><button className="close-button" aria-label="신청 준비 닫기" onClick={close}>×</button></div>
    <h2 id="preparation-title">내 신청 준비</h2>
    <p className="planning-help">직접 기록한 준비 과정을 모아 보세요. 선정 결과와 실제 접수 상태는 해당 기관에서 확인해 주세요.</p>
    {editing ? <><p>공고 번호: {editing}</p><ApplicationRecordEditor key={editing} id={editing} planning={planning} onDirtyChange={setDirty} /><button className="secondary-button" onClick={() => { if (mayLeave()) setEditing(null); }}>신청 준비 목록으로</button></> : <>
    <section aria-label="신청 기록 내보내기">
      <div className="preparation-actions">
        <button className="secondary-button" disabled={!planning.ready || planning.busy} onClick={() => download("json")}>전체 기록 JSON 다운로드</button>
        <button className="secondary-button" disabled={!planning.ready || planning.busy || loading} onClick={() => download("csv")}>전체 기록 CSV 다운로드</button>
      </div>
      <p className="planning-help">검색 조건과 관계없이 저장된 전체 기록을 내려받아요. JSON에는 비교 목록도 포함돼요. 파일에는 개인 메모가 포함돼요. JSON 파일은 아래 가져오기에서 다시 합칠 수 있어요. 확인하지 못한 공고는 CSV 제목·마감일이 비어 있을 수 있어요.</p>
      {exportMessage && <p role="status">{exportMessage}</p>}
    </section>
    <PlanningImportPanel planning={planning} items={items} draft={importDraft} recovery={importRecovery} onDraftChange={onImportDraftChange} onPendingChange={setImportPending} />
    {importPending && <p role="status">가져오기 작업이 끝나면 창을 닫을 수 있어요.</p>}
    <label className="preparation-search">신청 기록 검색<input type="search" value={query} maxLength={200} placeholder="공고 제목, 기관, 번호, 내 메모" onChange={event => setQuery(event.target.value)} /></label>
    <div className="preparation-sync">
      <p>{planning.account ? "계정에 저장되어 다른 기기에서도 이어갈 수 있어요." : "이 브라우저에 저장돼요. 로그인 후 이 기기의 기록을 가져올 수 있어요."}</p>
      {planning.account && <div className="preparation-actions">
        <button className="secondary-button" disabled={planning.busy} onClick={planning.refresh}>계정 기록 새로고침</button>

      </div>}
      {planning.busy && <p role="status">계정 기록을 동기화하고 있어요…</p>}
      {planning.message && <p role="status" className="planning-message">{planning.message}</p>}
    </div>
    {planning.ready && <section className="preparation-summary" aria-label="신청 준비 현황">
      <p>전체 {ids.length}개 · 준비 확인 완료 {completed.length}개 · 신청 완료 {ids.filter(id => planning.data.applications[id]?.status === "submitted").length}개 · 선정 {ids.filter(id => planning.data.applications[id]?.status === "approved").length}개</p>
      {!loading && !error && <p>7일 이내 마감 {ids.filter(id => matchesDeadline(byId.get(id), "week", today)).length}개 · 조회 중단 {ids.filter(id => !byId.has(id)).length}개</p>}
      <p className="planning-help">직접 저장한 기록 기준이에요. 조회 중단은 기관의 선정 결과를 의미하지 않아요.</p>
    </section>}
    <div className="preparation-deadlines">
      <label>공고 제공 상태<select aria-label="신청 준비 공고 제공 상태" value={availability} onChange={event => setAvailability(event.target.value)}><option value="all">모든 공고</option><option value="available">조회 가능한 공고</option><option value="missing">조회 중단 공고</option><option value="unknown">확인 대기 공고</option></select></label>
      <label>신청 상태<select aria-label="신청 준비 신청 상태" value={applicationFilter} onChange={event => setApplicationFilter(event.target.value)}>
        <option value="all">모든 신청 상태</option>
        {Object.entries(applicationStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>마감 조건<select aria-label="신청 준비 마감 조건" value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}>
        <option value="all">모든 기간</option><option value="week">7일 이내 마감</option><option value="month">30일 이내 마감</option>
        <option value="expired">마감된 공고</option><option value="unknown">마감일 미정 전체</option><option value="ongoing">상시 신청</option><option value="guidance">별도 안내</option>
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
    {loading && <p role="status">공고 정보를 확인하고 있어요. 저장한 기록은 지금 편집할 수 있어요.</p>}
    {error && <div role="alert"><p>공고 정보를 일부 확인하지 못했어요. 준비 기록은 계속 확인하고 편집할 수 있어요. 확인 대기는 제공 중단을 의미하지 않아요.</p><button disabled={loading} className="secondary-button" onClick={reload}>다시 불러오기</button></div>}
    {!planning.ready && !planning.busy && planning.message ? <p>위의 ‘계정 기록 새로고침’을 눌러 다시 불러와 주세요.</p>
      : !planning.ready ? <p role="status">신청 준비 정보를 불러오고 있어요…</p>
      : shown.length === 0 ? <div className="planning-empty"><h3>{ids.length ? "선택한 조건에 맞는 기록이 없어요" : "신청 준비를 시작해 보세요"}</h3><p>{ids.length ? "검색어를 지우거나 다른 마감 조건·신청 상태를 선택해 보세요." : "공고 상세에서 체크리스트나 신청 상태·메모를 저장하면 여기에 모여요."}</p>{ids.length > 0 && <button className="secondary-button" onClick={() => { setFilter("all"); setDeadlineFilter("all"); setApplicationFilter("all"); setQuery(""); setAvailability("all"); }}>모든 준비 기록 보기</button>}<button className="primary-button" onClick={close}>혜택 둘러보기</button></div>
      : <ul className="preparation-list">{shown.map((id) => {
        const benefit = byId.get(id);
        const count = planning.data.checklists[id]?.length || 0;
        const application = planning.data.applications[id];
        return <li key={id}>
          <span className="tag">{count === checklistSteps.length ? "확인 완료" : "진행 중"} · {count}/{checklistSteps.length}</span>
          <h3>{benefit?.title || (checked.has(id) ? "더 이상 제공되지 않는 공고" : "공고 정보 확인 대기")}</h3>
          {application && <p className="application-status">신청 상태: {applicationStatuses[application.status]}</p>}
          {application?.note && <p className="application-note">{application.note}</p>}
          {!benefit && <p>공고 번호: {id}. 준비 기록은 보관되어 있어요.</p>}
          {benefit && <p>{benefit.organization} · {benefit.deadline ? `${benefit.deadline} · ${deadlineLabel(benefit.deadline, today)}` : benefit.periodLabel}</p>}
          <progress value={count} max={checklistSteps.length} aria-label={`${benefit?.title || id} 준비 진행률`} />
          <div className="preparation-actions">
            <button className="secondary-button" disabled={!planning.ready || planning.busy} onClick={() => setEditing(id)}>신청 기록 편집</button>
            {benefit && <button className="primary-button" onClick={() => { if (mayClose()) onDetail(id); }}>준비 이어가기</button>}
            {benefit && <DeadlineCalendarButton benefit={benefit} today={today} />}
            <button className="text-button" disabled={planning.busy || !planning.ready} onClick={() => {
              if (window.confirm("이 공고의 체크리스트·신청 상태·메모를 모두 삭제할까요?")) planning.removeChecklist(id);
            }}>기록 삭제</button>
          </div>
        </li>;
      })}</ul>}
    </>}
  </dialog>;
}
