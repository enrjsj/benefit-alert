export type Coverage = { total: number; nationwide: number; regionKnown: number; districtKnown: number; regionUnknown: number; deadlineKnown: number };
export type DataReport = {
  demo: boolean; generatedAt: string; coverage: Coverage;
  history: { status: string; startedAt: string; finishedAt: string | null; fetchedCount: number; rejectedCount: number }[];
};
export const historyLabels: Record<string, string> = { SUCCESS: '완료', RUNNING: '진행 중', INTERRUPTED: '중단 · 복구 대기', PARTIAL: '일부 처리', FAILED: '실패', UNKNOWN: '확인 필요' };
export function dataTime(value?: string | null): string {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '확인 필요';
}
export function parseDataReport(value: unknown): DataReport {
  const d = value as DataReport;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  if (!d || typeof d.demo !== 'boolean' || typeof d.generatedAt !== 'string' || !Number.isFinite(Date.parse(d.generatedAt)) || !d.coverage || !Array.isArray(d.history) || d.history.length > 10) throw Error('invalid_data_report');
  const c = d.coverage;
  if (![c.total,c.nationwide,c.regionKnown,c.districtKnown,c.regionUnknown,c.deadlineKnown].every(count)
    || c.nationwide+c.regionKnown+c.regionUnknown !== c.total || c.districtKnown>c.regionKnown || c.deadlineKnown>c.total) throw Error('invalid_data_report');
  if (d.history.some(r=> !r || !Object.hasOwn(historyLabels,r.status) || !Number.isFinite(Date.parse(r.startedAt)) || (r.finishedAt!==null && !Number.isFinite(Date.parse(r.finishedAt))) || !count(r.fetchedCount) || !count(r.rejectedCount))) throw Error('invalid_data_report');
  return d;
}
