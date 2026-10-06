import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyPlanning, setApplication, trackedIds, setChecklistStep, mergePlanning, parsePlanning, createPlanningStore, planningKey} from '../src/planning.ts';
import {createRemotePlanningStore} from '../src/remotePlanning.ts';

test('notes alone are tracked, survive reload, and use separate storage from old clients',()=>{
 const entries=new Map([['benefit-planning:v1:guest',JSON.stringify({version:1,compareIds:['old'],checklists:{old:['documents']}})]]);
 const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
 const store=createPlanningStore(storage,planningKey('guest'));
 assert.deepEqual(store.getSnapshot().data.compareIds,['old']);
 store.update(s=>setApplication(s,'new',{status:'submitted',note:'문의 내용\n서류 준비'}));
 entries.set('benefit-planning:v1:guest',JSON.stringify(emptyPlanning()));
 const data=createPlanningStore(storage,planningKey('guest')).getSnapshot().data;
 assert.deepEqual(trackedIds(data),['old','new']);
 assert.equal(data.applications.new.note,'문의 내용\n서류 준비');
 assert.deepEqual(createPlanningStore(storage,planningKey('other')).getSnapshot().data,emptyPlanning());
});
test('stale edits and conflicting imports never replace saved notes',()=>{
 const entry={status:'submitted',note:'기존 기록'};
 const state=setApplication(emptyPlanning(),'a',entry);
 assert.throws(()=>setApplication(state,'a',{status:'approved',note:'새 기록'}),/다른 화면/);
 const updated=setApplication(state,'a',{status:'approved',note:'새 기록'},entry);
 assert.equal(updated.applications.a.status,'approved');
 assert.throws(()=>mergePlanning(state,updated),/메모가 달라/);
 assert.deepEqual(mergePlanning(state,state),state);
 assert.equal(state.applications.a.note,'기존 기록');
 const entries=new Map();const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
 storage.setItem('test',JSON.stringify(state));const tab=createPlanningStore(storage,'test');
 storage.setItem('test',JSON.stringify(updated));
 tab.update(s=>setApplication(s,'a',{status:'rejected',note:'오래된 화면의 수정'},entry));
 assert.equal(tab.getSnapshot().data.applications.a.note,'새 기록');
 assert.match(tab.getSnapshot().message,/다른 화면/);
 assert.equal(JSON.parse(storage.getItem('test')).applications.a.status,'approved');
});
test('combined 200-record and 1000-character limits apply to notes and checklists',()=>{
 let state=emptyPlanning();
 for(let i=0;i<200;i++) state=setApplication(state,String(i),{status:'preparing',note:''});
 state=setChecklistStep(state,'0','documents',true);
 assert.throws(()=>setChecklistStep(state,'extra','documents',true),/200개/);
 assert.throws(()=>setApplication(state,'extra',{status:'submitted',note:''}),/200개/);
 assert.throws(()=>setApplication(emptyPlanning(),'a',{status:'submitted',note:'x'.repeat(1001)}),/1,000자/);
 const parsed=parsePlanning('{"version":1,"compareIds":[],"checklists":{},"applications":{"__proto__":{"status":"submitted","note":"bad"},"a":{"status":"unknown","note":"bad"}}}');
 assert.deepEqual(parsed.applications,{});
});
test('failed remote note saves retain confirmed data and retries can succeed',async()=>{
 let fail=true;const tick=()=>new Promise(r=>setImmediate(r));
 const store=createRemotePlanningStore(async(method,body)=>method==='GET'?new Response(JSON.stringify({revision:0,data:emptyPlanning()})):
  fail?new Response('',{status:503}):new Response(JSON.stringify({revision:1,data:body.data})));
 store.start();await tick();
 assert.equal(store.getSnapshot().applicationsSupported,true);
 await store.update(s=>setApplication(s,'a',{status:'submitted',note:'재시도 메모'}));
 assert.deepEqual(store.getSnapshot().data.applications,{});
 fail=false;await store.update(s=>setApplication(s,'a',{status:'submitted',note:'재시도 메모'}));
 assert.equal(store.getSnapshot().data.applications.a.note,'재시도 메모');
});
test('new notes cannot be imported into a server without note support',async()=>{
 let writes=0;const store=createRemotePlanningStore(async method=>{if(method!=='GET')writes++;return new Response(JSON.stringify({revision:0,data:{version:1,compareIds:[],checklists:{}}}));});
 store.start();await new Promise(r=>setImmediate(r));
 await store.importData(setApplication(emptyPlanning(),'a',{status:'submitted',note:'보존'}));
 assert.equal(writes,0);assert.match(store.getSnapshot().message,/유지/);
});
