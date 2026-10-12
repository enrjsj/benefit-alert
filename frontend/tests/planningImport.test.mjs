import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanning, createPlanningStore, parsePlanning, setChecklistStep, setApplication, toggleCompare } from '../src/planning.ts';
import { createRemotePlanningStore } from '../src/remotePlanning.ts';
import { exportPlanning } from '../src/planningExport.ts';
import { parseImport, resolveImport, importConflicts, applyReviewedImport, planningFingerprint, MAX_IMPORT_BYTES } from '../src/planningImport.ts';
const wrap=p=>JSON.stringify({format:'benefit-alert-planning',version:1,planning:p});
const base=()=>({...emptyPlanning(),compareIds:['a'],checklists:{a:['eligibility']},applications:{a:{status:'submitted',note:'기존 메모'}}});
const incoming=()=>({...emptyPlanning(),compareIds:['b'],checklists:{a:['documents'],missing:['schedule']},applications:{a:{status:'approved',note:'파일 메모'},missing:{status:'preparing',note:'종료 공고'}}});
test('exported JSON round trips all records and supports BOM',()=>{
 const p=incoming();assert.deepEqual(parseImport('\uFEFF'+exportPlanning(p,[],'json')),p);
});
test('invalid envelopes, unsupported versions and CSV are rejected',()=>{
 for(const text of ['id,note', '{}', wrap({...base(),version:2}), JSON.stringify({format:'other',version:1,planning:base()}),JSON.stringify({...JSON.parse(wrap(base())),version:2})]) assert.throws(()=>parseImport(text));
});
test('invalid records reject the whole file without silently truncating valid entries',()=>{
 for(const entry of [{status:'unknown',note:'text'},{status:'approved',note:'x'.repeat(1001)},{status:'approved',note:42}])assert.throws(()=>parseImport(wrap({...base(),applications:{...base().applications,b:entry}})));
 for(const steps of [[],['unknown'],['documents','documents']])assert.throws(()=>parseImport(wrap({...base(),checklists:{a:steps}})));
 assert.throws(()=>parseImport(wrap({...base(),compareIds:['a','a']})));
});
test('prototype keys and unexpected fields cannot enter stored planning',()=>{
 assert.throws(()=>parseImport('{"format":"benefit-alert-planning","version":1,"planning":{"version":1,"compareIds":[],"checklists":{},"applications":{"__proto__":{"status":"approved","note":"x"}}}}'));
 assert.throws(()=>parseImport(wrap({...base(),access_token:'never-import'})));
 assert.equal({}.status,undefined);
});
test('byte size and aggregate record limits are checked before import',()=>{
 assert.throws(()=>parseImport('가'.repeat(MAX_IMPORT_BYTES/3+1)),/1MB/);
 assert.throws(()=>parseImport(wrap({...emptyPlanning(),applications:Object.fromEntries(Array.from({length:201},(_,i)=>[String(i),{status:'preparing',note:''}]))})));
});
test('inherited object keys are rejected in every import field and cannot enter planning stores',()=>{
 for(const id of [...Object.getOwnPropertyNames(Object.prototype),'prototype','   ']) {
  const checks={...emptyPlanning(),checklists:{[id]:['documents']}};
  const applications={...emptyPlanning(),applications:{[id]:{status:'preparing',note:'invalid id'}}};
  const comparison={...emptyPlanning(),compareIds:[id]};
  for(const data of [checks,applications,comparison]) {
   assert.throws(()=>parseImport(wrap(data)),/올바른 JSON/);
   assert.deepEqual(parsePlanning(JSON.stringify(data)),emptyPlanning());
  }
  assert.deepEqual(setChecklistStep(emptyPlanning(),id,'documents',true),emptyPlanning());
  assert.deepEqual(toggleCompare(emptyPlanning(),id),emptyPlanning());
  assert.throws(()=>setApplication(emptyPlanning(),id,{status:'preparing',note:''}));
 }
});
test('conflicts require explicit choices and both keep and replace preserve unrelated progress',()=>{
 const a=base(),b=incoming();assert.deepEqual(importConflicts(a,b),['a']);assert.throws(()=>resolveImport(a,b,{}),/선택/);
 const keep=resolveImport(a,b,{a:'existing'});assert.equal(keep.applications.a.note,'기존 메모');assert.deepEqual(keep.checklists.a,['eligibility','documents']);assert.equal(keep.applications.missing.note,'종료 공고');
 const replace=resolveImport(a,b,{a:'incoming'});assert.equal(replace.applications.a.note,'파일 메모');assert.equal(a.applications.a.note,'기존 메모');assert.equal(b.applications.a.note,'파일 메모');
});
test('compare overflow can be resolved by excluding incoming comparisons; record overflow never evicts data',()=>{
 const a={...base(),compareIds:['a','c','d']};assert.throws(()=>resolveImport(a,incoming(),{a:'existing'}),/3개/);assert.deepEqual(resolveImport(a,incoming(),{a:'existing'},false).compareIds,a.compareIds);
 const full={...emptyPlanning(),applications:Object.fromEntries(Array.from({length:200},(_,i)=>[String(i),{status:'preparing',note:''}]))};assert.throws(()=>resolveImport(full,incoming(),{}),/200개/);
});
test('stale preview rejects a concurrent write even for unrelated records',()=>{
 const a=base(),changed={...a,applications:{...a.applications,z:{status:'submitted',note:'다른 탭'}}};
 assert.throws(()=>applyReviewedImport(changed,a,incoming(),{a:'incoming'},true),/미리보기 이후/);
 const entries=new Map([['test',JSON.stringify(a)]]);const storage={getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v)};
 const store=createPlanningStore(storage,'test');entries.set('test',JSON.stringify(changed));assert.equal(store.update(s=>applyReviewedImport(s,a,incoming(),{a:'incoming'},true)),false);assert.deepEqual(JSON.parse(entries.get('test')),changed);
});
test('fingerprints ignore object and checklist order, but retain note/status differences',()=>{
 const a={...base(),checklists:{a:['documents','eligibility']}};const b={...a,checklists:{a:['eligibility','documents']}};assert.equal(planningFingerprint(a),planningFingerprint(b));assert.notEqual(planningFingerprint(a),planningFingerprint({...a,applications:{a:{status:'approved',note:'기존 메모'}}}));
});
test('remote import via reviewed update reports failure without replacing confirmed state',async()=>{
 const a=base();let mode='fail';
 const store=createRemotePlanningStore(async(method,body)=>method==='GET'?Response.json({revision:1,data:a}):mode==='fail'?new Response('{}',{status:503}):Response.json({revision:2,data:body.data}));
 store.start();await new Promise(resolve=>setImmediate(resolve));assert.equal(await store.update(s=>applyReviewedImport(s,a,incoming(),{a:'incoming'},true)),false);assert.deepEqual(store.getSnapshot().data,a);
 mode='ok';assert.equal(await store.update(s=>applyReviewedImport(s,a,incoming(),{a:'incoming'},true)),true);assert.equal(store.getSnapshot().data.applications.a.note,'파일 메모');store.stop();
});
