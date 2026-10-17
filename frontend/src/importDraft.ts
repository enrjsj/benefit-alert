import { parseImport, type ImportChoices } from './planningImport.ts';
import { validPlanningId, type Planning } from './planning.ts';
export type ImportDraft = { incoming: Planning; baseline: Planning; choices: ImportChoices; includeCompare: boolean; source: string };
export const IMPORT_DRAFT_KEY='benefit-import-preview:v1';
export const DRAFT_TTL=24*60*60*1000;
export const MAX_DRAFT_BYTES=2*1024*1024;
export function decodeDraft(raw:string,owner:string,now=Date.now()):ImportDraft|null {
 try {
  if(new TextEncoder().encode(raw).length>MAX_DRAFT_BYTES)return null;
  const value=JSON.parse(raw),d=value?.draft;
  if(value?.version!==1||value.owner!==owner||!Number.isFinite(value.savedAt)||value.savedAt>now||now-value.savedAt>=DRAFT_TTL||!d||typeof d.source!=='string'||d.source.length>255||typeof d.includeCompare!=='boolean'||!d.choices||typeof d.choices!=='object'||Array.isArray(d.choices))return null;
  const choices:ImportChoices={};
  for(const [id,choice] of Object.entries(d.choices)){
   if(!validPlanningId(id)||(choice!=='existing'&&choice!=='incoming'))return null;
   choices[id]=choice;
  }
  const parse=(planning:unknown)=>parseImport(JSON.stringify({format:'benefit-alert-planning',version:1,planning}));
  return {incoming:parse(d.incoming),baseline:parse(d.baseline),choices,includeCompare:d.includeCompare,source:d.source};
 }catch{return null;}
}
export function encodeDraft(draft:ImportDraft,owner:string,now=Date.now()):string {
 const raw=JSON.stringify({version:1,owner,savedAt:now,draft});
 if(!decodeDraft(raw,owner,now))throw Error('Invalid import preview');
 return raw;
}
