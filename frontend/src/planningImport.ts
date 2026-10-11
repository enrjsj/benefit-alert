import { applicationStatuses, checklistSteps, MAX_CHECKLISTS, MAX_COMPARE, mergePlanning, parsePlanning, sameApplication, trackedIds, type Planning } from './planning.ts';
export const MAX_IMPORT_BYTES = 1024 * 1024;
export type ImportChoices = Record<string, 'existing' | 'incoming'>;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validId = (id: unknown): id is string => typeof id === 'string' && !!id.trim() && id.length <= 100 && !['__proto__', 'constructor', 'prototype'].includes(id);
const fail = (): never => { throw Error('혜택온에서 내보낸 올바른 JSON 기록 파일인지 확인해 주세요. 손상된 항목은 가져오지 않아요.'); };
export function parseImport(text: string): Planning {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw Error('파일은 1MB 이하만 가져올 수 있어요.');
  let root: unknown;
  try { root = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { return fail(); }
  if (!object(root) || root.format !== 'benefit-alert-planning' || root.version !== 1 || !object(root.planning)) return fail();
  const p = root.planning;
  if (p.version !== 1 || Object.keys(p).some(key => !['version','compareIds','checklists','applications'].includes(key))
    || !Array.isArray(p.compareIds) || !object(p.checklists) || !object(p.applications)) return fail();
  if (p.compareIds.length > MAX_COMPARE || p.compareIds.some(id => !validId(id)) || new Set(p.compareIds).size !== p.compareIds.length) return fail();
  const stepIds = new Set<string>(checklistSteps.map(step => step.id));
  for (const [id, steps] of Object.entries(p.checklists)) {
    if (!validId(id) || !Array.isArray(steps) || !steps.length || steps.some(step => typeof step !== 'string' || !stepIds.has(step)) || new Set(steps).size !== steps.length) return fail();
  }
  for (const [id, entry] of Object.entries(p.applications)) {
    if (!validId(id) || !object(entry) || typeof entry.status !== 'string' || !Object.hasOwn(applicationStatuses, entry.status)
      || typeof entry.note !== 'string' || entry.note.length > 1000 || Object.keys(entry).some(key => !['status','note'].includes(key))) return fail();
  }
  if (new Set([...Object.keys(p.checklists), ...Object.keys(p.applications)]).size > MAX_CHECKLISTS) return fail();
  return parsePlanning(JSON.stringify(p));
}
export function importConflicts(existing: Planning, incoming: Planning): string[] {
  return Object.keys(incoming.applications).filter(id => existing.applications[id] && !sameApplication(existing.applications[id], incoming.applications[id]));
}
export function resolveImport(existing: Planning, incoming: Planning, choices: ImportChoices, includeCompare = true): Planning {
  const applications = { ...existing.applications };
  const imported = { ...incoming.applications };
  for (const id of importConflicts(existing, incoming)) {
    if (!Object.hasOwn(choices, id)) throw Error('겹치는 모든 신청 기록에서 유지할 내용을 선택해 주세요.');
    if (choices[id] === 'existing') delete imported[id];
    else if (choices[id] === 'incoming') delete applications[id];
    else throw Error('유지할 기록을 다시 선택해 주세요.');
  }
  return mergePlanning({ ...existing, applications }, { ...incoming, applications: imported, compareIds: includeCompare ? incoming.compareIds : [] });
}
export function planningFingerprint(data: Planning): string {
  return JSON.stringify({compareIds:data.compareIds, checklists:Object.entries(data.checklists).sort(([a],[b])=>a.localeCompare(b)).map(([id,steps])=>[id,[...steps].sort()]), applications:Object.entries(data.applications).sort(([a],[b])=>a.localeCompare(b)).map(([id,entry])=>[id,entry.status,entry.note])});
}
export function applyReviewedImport(current: Planning, baseline: Planning, incoming: Planning, choices: ImportChoices, includeCompare: boolean): Planning {
  if (planningFingerprint(current) !== planningFingerprint(baseline)) throw Error('미리보기 이후 기록이 변경됐어요. 최신 기록으로 미리보기를 갱신하고 다시 선택해 주세요.');
  return resolveImport(current, incoming, choices, includeCompare);
}
export function importCounts(existing: Planning, incoming: Planning) {
  const ids = new Set(trackedIds(existing));
  return { incoming: trackedIds(incoming).length, added: trackedIds(incoming).filter(id => !ids.has(id)).length, conflicts: importConflicts(existing, incoming).length };
}
