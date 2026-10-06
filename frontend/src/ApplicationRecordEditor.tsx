import { useEffect, useState } from "react";
import type { PlanningState } from "./PlanningPanel";
import { applicationStatuses, sameApplication, type ApplicationRecord, type ApplicationStatus } from "./planning";

const blank: ApplicationRecord = { status: "preparing", note: "" };
export function ApplicationRecordEditor({ id, planning, onDirtyChange }: {
  id: string; planning: PlanningState; onDirtyChange: (dirty: boolean) => void;
}) {
  const stored = planning.data.applications[id];
  const [baseline, setBaseline] = useState(stored);
  const [draft, setDraft] = useState(stored || blank);
  const dirty = !sameApplication(draft, baseline || blank);
  useEffect(() => {
    if (!dirty || sameApplication(stored, draft)) { setDraft(stored || blank); setBaseline(stored); }
  }, [stored, dirty]);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);
  return <section className="application-record" aria-labelledby="application-record-title">
    <h3 id="application-record-title">신청 상태와 메모</h3>
    <p className="planning-help">직접 확인한 신청 상태와 필요한 내용을 기록해 두세요. 기관의 접수·선정 결과와 자동 연동되지 않아요.</p>
    <fieldset disabled={planning.busy || !planning.ready || !planning.applicationsSupported}>
      <legend className="sr-only">개인 신청 기록</legend>
      <label>신청 상태<select aria-label="신청 상태" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value as ApplicationStatus })}>
        {Object.entries(applicationStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>내 메모<textarea aria-label="내 메모" rows={4} maxLength={1000} value={draft.note} placeholder="준비할 서류, 문의 내용 등을 적어 두세요."
        onChange={event => setDraft({ ...draft, note: event.target.value })} /></label>
      <p className="planning-help">{draft.note.length}/1,000자 · {planning.account ? "내 계정에 저장돼요." : "이 브라우저에 저장돼요."}</p>
      <div className="preparation-actions">
        <button className="primary-button" disabled={!dirty && !!stored} onClick={() => planning.saveApplication(id, draft, baseline)}>신청 기록 저장</button>
        {(dirty || !sameApplication(stored, baseline)) && <button className="secondary-button" onClick={() => {
          if (!dirty || window.confirm("작성 중인 내용을 버리고 저장된 기록을 불러올까요?")) { setDraft(stored || blank); setBaseline(stored); }
        }}>저장된 기록 불러오기</button>}
      </div>
    </fieldset>
    <p role="status" className="planning-help">{!planning.applicationsSupported ? "계정 기록을 새로고침한 뒤 다시 시도해 주세요." : dirty ? "아직 저장하지 않은 변경이 있어요." : stored ? "저장된 신청 기록을 보고 있어요." : "저장하면 신청 준비 목록에서도 확인할 수 있어요."}</p>
    {planning.message && <p role="status" className="planning-message">{planning.message}</p>}
  </section>;
}
