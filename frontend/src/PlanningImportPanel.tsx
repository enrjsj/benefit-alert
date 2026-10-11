import { useEffect, useRef, useState } from 'react';
import type { PlanningState } from './PlanningPanel';
import type { Benefit } from './benefit';
import { applicationStatuses, trackedIds, type Planning } from './planning';
import { importConflicts, importCounts, MAX_IMPORT_BYTES, parseImport, planningFingerprint, resolveImport, type ImportChoices } from './planningImport';

export function PlanningImportPanel({ planning, items }: { planning: PlanningState; items: Benefit[] }) {
  const [incoming, setIncoming] = useState<Planning | null>(null);
  const [baseline, setBaseline] = useState(planning.data);
  const [choices, setChoices] = useState<ImportChoices>({});
  const [includeCompare, setIncludeCompare] = useState(true);
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  function preview(data: Planning, label: string) {
    setIncoming(data); setBaseline(planning.data); setChoices({}); setIncludeCompare(true); setSource(label); setMessage('');
  }
  async function readFile(file: File | undefined) {
    const generation = ++sequence.current;
    setIncoming(null); setMessage('');
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw Error('파일은 1MB 이하만 가져올 수 있어요.');
      const text = await file.text();
      if (sequence.current === generation) preview(parseImport(text), file.name);
    } catch (error) { if (sequence.current === generation) setMessage((error as Error).message); }
    finally { if (sequence.current === generation) setReading(false); }
  }
  const conflicts = incoming ? importConflicts(baseline, incoming) : [];
  const counts = incoming ? importCounts(baseline, incoming) : null;
  const stale = incoming && planningFingerprint(baseline) !== planningFingerprint(planning.data);
  let issue = '', merged: Planning | undefined;
  if (incoming) {
    try { merged = resolveImport(baseline, incoming, choices, includeCompare); }
    catch (error) { issue = (error as Error).message; }
  }
  const locked = reading || saving || planning.busy || !planning.ready;
  const titles = new Map(items.map(item => [item.id, item.title]));
  return <details className="planning-import">
    <summary>파일·기기 기록 가져오기</summary>
    <p className="planning-help">혜택온 JSON 파일(1MB 이하)을 선택한 뒤 미리보기를 확인해 주세요. 기존 기록은 유지하고 체크리스트는 합쳐요. 상태·메모가 다르면 공고별로 선택하며, CSV는 가져올 수 없어요.</p>
    <label>JSON 기록 파일<input type="file" accept=".json,application/json" disabled={locked} onChange={event => { void readFile(event.target.files?.[0]); event.target.value = ''; }} /></label>
    {planning.account && <div className="preparation-actions">{['비회원', '이전 계정'].map((label, index) => <button key={label} className="secondary-button" disabled={locked} onClick={() => {
      try { const entry = planning.localSources()[index]; sequence.current++; preview(entry.data, entry.label); }
      catch { setIncoming(null); setMessage('이 브라우저의 기록을 읽지 못했어요. 저장 공간 접근을 확인해 주세요.'); }
    }}>{label} 기기 기록 미리보기</button>)}</div>}
    {reading && <p role="status">파일을 확인하고 있어요…</p>}
    {message && <p role="status">{message}</p>}
    {incoming && counts && <section aria-label="가져오기 미리보기">
      <h3>가져오기 미리보기</h3><p className="import-source">{source}</p>
      <p>가져올 신청 기록 {counts.incoming}개 · 새 기록 {counts.added}개 · 선택 필요 {counts.conflicts}개</p>
      <label className="check"><input type="checkbox" checked={includeCompare} disabled={locked} onChange={event => setIncludeCompare(event.target.checked)} />비교 목록 {incoming.compareIds.length}개도 합치기</label>
      <details><summary>가져올 내용 확인</summary><ul className="preparation-list">{trackedIds(incoming).map(id => <li key={id}>
        <strong>{titles.get(id) || id}</strong><p>체크 항목 {incoming.checklists[id]?.length || 0}개</p>
        {incoming.applications[id] && <><p>{applicationStatuses[incoming.applications[id].status]}</p><p className="application-note">{incoming.applications[id].note || '(메모 없음)'}</p></>}
      </li>)}</ul>{incoming.compareIds.length > 0 && <p>비교 공고 번호: {incoming.compareIds.join(', ')}</p>}</details>
      {conflicts.map(id => <fieldset key={id} disabled={locked} className="import-conflict">
        <legend>{titles.get(id) || id} · 유지할 신청 기록</legend>
        {(['existing','incoming'] as const).map(choice => {
          const record = (choice === 'existing' ? baseline : incoming).applications[id];
          return <label key={choice}><input type="radio" name={`import-${id}`} checked={choices[id] === choice} onChange={() => setChoices(current => ({ ...current, [id]: choice }))} />
            {choice === 'existing' ? '현재 기록 유지' : '가져온 기록 사용'}<strong>{applicationStatuses[record.status]}</strong><span className="application-note">{record.note || '(메모 없음)'}</span></label>;
        })}
      </fieldset>)}
      {stale && <p role="alert">미리보기 이후 기록이 변경됐어요. 최신 기록으로 다시 확인해 주세요.</p>}
      {issue && <p role="status">{issue}</p>}
      {merged && <p>합친 후 신청 기록 {trackedIds(merged).length}/200개 · 비교 {merged.compareIds.length}/3개</p>}
      <div className="preparation-actions">
        <button className="primary-button" disabled={locked || !!stale || !!issue || !merged || !planning.applicationsSupported} onClick={async () => {
          if (!window.confirm('선택한 내용으로 기록을 합칠까요? 선택한 상태·메모가 저장됩니다.')) return;
          setSaving(true); setMessage('');
          try {
            const success = await planning.importReviewed(incoming, baseline, choices, includeCompare);
            if (success) { setIncoming(null); setMessage('선택한 기록을 반영했어요. 아래 저장 안내도 확인해 주세요.'); }
            else setMessage('가져오기를 완료하지 못했어요. 아래 안내를 확인하고 다시 시도해 주세요.');
          } catch { setMessage('가져오기를 완료하지 못했어요. 미리보기는 유지돼요.'); }
          finally { setSaving(false); }
        }}>{saving ? '가져오는 중…' : '선택한 내용 가져오기'}</button>
        <button className="secondary-button" disabled={locked} onClick={() => { setBaseline(planning.data); setChoices({}); setMessage('최신 기록으로 미리보기를 갱신했어요. 겹치는 기록을 다시 선택해 주세요.'); }}>최신 기록으로 미리보기 갱신</button>
        <button className="text-button" disabled={saving} onClick={() => { sequence.current++; setIncoming(null); setMessage('가져오기를 취소했어요. 기존 기록은 유지돼요.'); }}>가져오기 취소</button>
      </div>
    </section>}
    {planning.message && <p role="status">{planning.message}</p>}
  </details>;
}
