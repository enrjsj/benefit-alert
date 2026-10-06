import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchJsonResponse} from '../src/request.ts';
import {readSearchState} from '../src/searchState.ts';
import {createGuestSavedStore,parseSaved,savedKey} from '../src/guestSaved.ts';
test('URL values become bounded API-compatible conditions',()=>{
 const s=readSearchState('?page=1.5&sort=broken&region=unknown&district=강남구&category=invalid&q='+('x'.repeat(201)));
 assert.equal(s.page,1);assert.equal(s.sort,'default');assert.equal(s.region,'전체');assert.equal(s.district,'');assert.equal(s.category,'전체');assert.equal(s.q.length,200);
 assert.equal(readSearchState('?page=Infinity').page,1);assert.equal(readSearchState('?page=99999').page,10000);
 assert.equal(readSearchState('?region=경기&district=성남시 분당구').district,'성남시 분당구');
 assert.equal(readSearchState('?region=서울&district=bad').district,'');
});
test('timeouts cover both no headers and incomplete bodies, including abort-ignoring transports',async()=>{
 const parent=new AbortController();let transport;
 await assert.rejects(fetchJsonResponse('/never',{signal:parent.signal},async(_,init)=>{transport=init.signal;return new Promise(()=>{});},10),/응답이 지연/);
 assert.equal(transport.aborted,true);assert.equal(parent.signal.aborted,false);
 await assert.rejects(fetchJsonResponse('/body',{},async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));}})),10),/응답이 지연/);
 const p=new AbortController();const request=fetchJsonResponse('/cancel',{signal:p.signal},async()=>new Promise(()=>{}),1000);p.abort();
 await assert.rejects(request,{name:'AbortError'});
 const response=await fetchJsonResponse('/normal',{},async()=>new Response('{"ok":true}',{headers:{'Cache-Control':'no-store'}}));
 assert.deepEqual(await response.json(),{ok:true});assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal((await fetchJsonResponse('/empty',{},async()=>new Response(null,{status:204}))).status,204);
});
test('guest saves read latest values, preserve in-memory fallback, and enforce the limit',()=>{
 const entries=new Map();const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
 const first=createGuestSavedStore(storage),second=createGuestSavedStore(storage);
 first.toggle('a');second.toggle('b');assert.deepEqual(second.getSnapshot().ids,['a','b']);first.reload();assert.deepEqual(first.getSnapshot().ids,['a','b']);
 second.toggle('a');first.reload();assert.deepEqual(first.getSnapshot().ids,['b']);
 entries.set(savedKey,JSON.stringify(Array.from({length:100},(_,i)=>String(i))));first.toggle('extra');assert.equal(first.getSnapshot().ids.length,100);assert.match(first.getSnapshot().message,/100개/);
 const unavailable=createGuestSavedStore({getItem(){throw Error();},setItem(){throw Error();}});unavailable.toggle('a');unavailable.toggle('b');assert.deepEqual(unavailable.getSnapshot().ids,['a','b']);
 assert.deepEqual(parseSaved('["",null,"a","a"]'),['a']);
});
