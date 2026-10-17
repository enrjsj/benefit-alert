import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDraft,encodeDraft,DRAFT_TTL,MAX_DRAFT_BYTES } from '../src/importDraft.ts';
import { emptyPlanning } from '../src/planning.ts';
const draft={incoming:{...emptyPlanning(),applications:{a:{status:'approved',note:'가져온 메모'}}},baseline:emptyPlanning(),choices:{a:'incoming'},includeCompare:false,source:'기록.json'};
test('draft recovery round trips explicit choices and expires without crossing owners',()=>{
 const raw=encodeDraft(draft,'member-a',1000);assert.deepEqual(decodeDraft(raw,'member-a',1001),draft);
 assert.equal(decodeDraft(raw,'guest',1001),null);assert.equal(decodeDraft(raw,'member-a',1000+DRAFT_TTL),null);assert.equal(decodeDraft(raw,'member-a',999),null);
});
test('malformed recovery data cannot silently replace or truncate records',()=>{
 const root=JSON.parse(encodeDraft(draft,'guest',1000));
 for(const bad of ['{',JSON.stringify({...root,version:2}),JSON.stringify({...root,draft:{...draft,includeCompare:'true'}}),JSON.stringify({...root,draft:{...draft,incoming:{...draft.incoming,applications:{a:{status:'broken',note:'x'}}}}}),JSON.stringify({...root,draft:{...draft,choices:JSON.parse('{"__proto__":"incoming"}')}}),'x'.repeat(MAX_DRAFT_BYTES+1)])assert.equal(decodeDraft(bad,'guest',1000),null);
});
