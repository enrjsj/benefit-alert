import {test} from 'node:test';
import assert from 'node:assert/strict';
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
