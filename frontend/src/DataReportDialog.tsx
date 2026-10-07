import { useEffect, useRef, useState } from 'react';
import { fetchJsonResponse } from './request';
import { dataTime, historyLabels, parseDataReport, type DataReport } from './dataReport';
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export function DataReportDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [report, setReport] = useState<DataReport | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const abort = new AbortController();
    setBusy(true); setError(false);
    void (async () => {
      try {
        const response = await fetchJsonResponse(`${base}/api/data-report`, { signal: abort.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const value = parseDataReport(await response.json());
        if (!abort.signal.aborted) setReport(value);
      } catch { if (!abort.signal.aborted) setError(true); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    })();
    return () => abort.abort();
  }, [retry]);
  const c = report?.coverage;
  return <dialog ref={dialog} className="data-report-dialog" aria-labelledby="data-report-title" onCancel={onClose} onClose={onClose}>
    <div className="dialog-top"><span className="section-kicker">DATA UPDATES</span><button className="close-button" aria-label="데이터 현황 닫기" onClick={onClose}>×</button></div>
    <h2 id="data-report-title">데이터 현황과 업데이트</h2>
    <p className="planning-help">현재 검색 조건과 관계없이 서비스에서 제공 중인 전체 공고를 집계해요. 기한이 지난 공고도 포함될 수 있어요.</p>
    <button className="secondary-button" disabled={busy} onClick={() => setRetry(n => n + 1)}>{busy ? '현황 불러오는 중…' : '현황 새로고침'}</button>
    {busy && <p role="status">최신 현황을 확인하고 있어요…</p>}
    {error && <p role="alert">현황을 불러오지 못했어요. {report ? '아래는 마지막으로 확인한 현황이에요. ' : ''}잠시 후 새로고침해 주세요.</p>}
    {report && c && <>
      {report.demo && <p className="demo-banner">가상 예시 공고의 현황입니다. 실제 정부24 수집 결과가 아니에요.</p>}
      <p className="planning-help">집계 시각 · {dataTime(report.generatedAt)} (한국 시간)</p>
      <section aria-labelledby="coverage-title">
        <h3 id="coverage-title">공고 정보 확인 현황</h3>
        <dl className="coverage-grid">
          {([['전체 공고',c.total],['전국 공고',c.nationwide],['시·도 확인',c.regionKnown],['시·군·구 확인',c.districtKnown],['지역 확인 필요',c.regionUnknown],['마감일 확인',c.deadlineKnown]] as const).map(([label,value])=>
            <div key={label}><dt>{label}</dt><dd>{value.toLocaleString('ko-KR')}<small>건</small></dd></div>)}
        </dl>
        <p className="planning-help">시·군·구 확인 건수는 시·도 확인 건수에 포함돼요. 지역은 제공기관 기준이며 실제 지원 대상과 다를 수 있어요.</p>
        <p className="planning-help">마감일을 날짜로 확인하지 못한 { (c.total-c.deadlineKnown).toLocaleString('ko-KR') }건에는 상시 신청·기간 별도 안내 등이 포함돼요. 날짜 누락만으로 신청 불가를 뜻하지는 않아요.</p>
      </section>
      <section aria-labelledby="history-title">
        <h3 id="history-title">최근 공고 업데이트</h3>
        <p className="planning-help">최근 10회까지 표시해요. 처리 건수에는 기존 공고 갱신도 포함되며, 새로 추가된 공고 수는 아니에요.</p>
        {report.history.length === 0 ? <p>아직 업데이트 이력이 없어요.</p> : <ol className="collection-history">
          {report.history.map((run,index)=><li key={`${run.startedAt}-${index}`}>
            <strong>{historyLabels[run.status]}</strong>
            <p>시작 · {dataTime(run.startedAt)}</p>
            <p>{run.finishedAt ? `종료 · ${dataTime(run.finishedAt)}` : run.status === 'RUNNING' ? '업데이트 진행 중' : '종료 시각 미확인'}</p>
            <p>처리 {run.fetchedCount.toLocaleString('ko-KR')}건 · 처리 제외 {run.rejectedCount.toLocaleString('ko-KR')}건</p>
          </li>)}
        </ol>}
        <p className="planning-help">실패하거나 중단된 업데이트가 있어도 기존 공고는 보존돼요. 신청 전 공식 안내에서 최신 내용을 확인해 주세요.</p>
      </section>
    </>}
  </dialog>;
}
