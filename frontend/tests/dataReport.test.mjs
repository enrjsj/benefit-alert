import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchRegions} from '../src/searchState.ts';
import {parseDataReport,dataTime} from '../src/dataReport.ts';
const valid={demo:false,generatedAt:'2026-10-07T00:00:00Z',coverage:{total:4,nationwide:1,regionKnown:2,districtKnown:1,regionUnknown:1,deadlineKnown:3},history:[]};
test('report rejects impossible totals instead of rendering misleading statistics',()=>{
 assert.deepEqual(parseDataReport(valid),valid);
 for(const coverage of [{...valid.coverage,total:5},{...valid.coverage,districtKnown:3},{...valid.coverage,deadlineKnown:5},{...valid.coverage,nationwide:-1}])assert.throws(()=>parseDataReport({...valid,coverage}));
 assert.throws(()=>parseDataReport({...valid,history:Array(11).fill({})}));assert.throws(()=>parseDataReport({...valid,generatedAt:'bad'}));
});
test('history permits interrupted/unknown public statuses and timestamps use Korean time',()=>{
 const run={status:'INTERRUPTED',startedAt:'2026-10-07T00:00:00Z',finishedAt:null,fetchedCount:10,rejectedCount:1};
 assert.equal(parseDataReport({...valid,history:[run]}).history[0].status,'INTERRUPTED');
 assert.throws(()=>parseDataReport({...valid,history:[{...run,status:'raw-internal-error'}]}));
 assert.equal(dataTime(null),'확인 필요');assert.match(dataTime(run.startedAt),/9:00:00/);
});

test('new region and period breakdowns reject partial, duplicate and inconsistent snapshots',()=>{
 const regions=searchRegions.slice(1).map(region=>({region,total:region==='서울'?2:0,districtKnown:region==='서울'?1:0}));
 const full={...valid,regions,periods:{dated:3,ongoing:1,guidance:0}};
 assert.equal(parseDataReport(full).regions.length,17);
 for(const rows of [[],regions.slice(1),[...regions.slice(0,-1),regions[0]],regions.map(r=>({...r,districtKnown:2})),regions.map(r=>({...r,total:0}))]) assert.throws(()=>parseDataReport({...full,regions:rows}));
 for(const periods of [null,{dated:3,ongoing:1,guidance:1},{dated:2,ongoing:2,guidance:0},{dated:3,ongoing:-1,guidance:2}]) assert.throws(()=>parseDataReport({...full,periods}));
 assert.equal(parseDataReport(valid).periods,undefined);
});
