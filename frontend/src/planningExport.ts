import type { Benefit } from './benefit';
import { applicationStatuses, checklistSteps, trackedIds, type Planning } from './planning.ts';

export function matchesPlanningSearch(id: string, planning: Planning, benefit: Benefit | undefined, query: string): boolean {
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase('ko');
  return !needle || [id, benefit?.title, benefit?.organization, planning.applications[id]?.note]
    .some(value => value?.normalize('NFKC').toLocaleLowerCase('ko').includes(needle));
}
const csvCell = (value: string) => {
  // Spreadsheet programs must treat public titles and private notes as text.
  const text = /^[\s]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + text.replaceAll('"', '""') + '"';
};
export function exportPlanning(planning: Planning, benefits: Benefit[], format: 'json' | 'csv', now = new Date()): string {
  if (format === 'json') return JSON.stringify({ format: 'benefit-alert-planning', version: 1, exportedAt: now.toISOString(), planning }, null, 2);
  const byId = new Map(benefits.map(benefit => [benefit.id, benefit]));
  const rows = [['공고 번호', '공고 제목', '신청 상태', '내 메모', '확인한 준비 항목']];
  for (const id of trackedIds(planning)) {
    const record = planning.applications[id];
    rows.push([id, byId.get(id)?.title || '공고 정보 없음', record ? applicationStatuses[record.status] : '미기록', record?.note || '',
      checklistSteps.filter(step => planning.checklists[id]?.includes(step.id)).map(step => step.title).join(' / ')]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
