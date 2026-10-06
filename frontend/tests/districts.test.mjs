import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDistrictCache, requestDistricts} from '../src/districts.ts';
test('a hanging request and hanging JSON body both time out',async()=>{
 for(const fetcher of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})])
  await assert.rejects(requestDistricts('/districts',new AbortController().signal,fetcher,10),/district_timeout/);
});
test('caller cancellation cancels the old region independently of timeout',async()=>{
 const abort=new AbortController();
 const promise=requestDistricts('/districts',abort.signal,()=>new Promise(()=>{}),1000);
 abort.abort();await assert.rejects(promise,{name:'AbortError'});
});
test('valid responses deduplicate; failed or malformed responses reject',async()=>{
 assert.deepEqual(await requestDistricts('/districts',new AbortController().signal,async()=>new Response(JSON.stringify(['수원시','수원시']))),['수원시']);
 await assert.rejects(requestDistricts('/districts',new AbortController().signal,async()=>new Response('{}')));
 await assert.rejects(requestDistricts('/districts',new AbortController().signal,async()=>new Response('error',{status:503})));
});
test('cache survives reload, isolates provinces, and expires',()=>{
 const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const cache=createDistrictCache(storage);cache.save('경기',['수원시'],100);cache.save('서울',['강남구'],100);
 const reloaded=createDistrictCache(storage);
 assert.deepEqual(reloaded.get('경기',101),['수원시']);assert.deepEqual(reloaded.get('서울',101),['강남구']);
 assert.equal(reloaded.get('경기',100+86400000),null);
 values.set('benefit-districts:v1:경기','broken');assert.equal(createDistrictCache(storage).get('경기',101),null);
});
test('storage denial preserves an in-memory cache',()=>{
 const cache=createDistrictCache({getItem:()=>{throw Error()},setItem:()=>{throw Error()}});
 cache.save('경기',['수원시'],100);assert.deepEqual(cache.get('경기',101),['수원시']);
});
