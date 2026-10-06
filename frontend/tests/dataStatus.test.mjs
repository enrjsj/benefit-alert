import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataStatusMessage } from '../src/dataStatus.ts';
const base={configured:true,latest:null,lastSuccessAt:'2026-10-06T00:00:00Z'};
test('freshness and interrupted notices retain last successful snapshot',()=>{
 assert.match(dataStatusMessage({...base,freshness:'STALE'}),/마지막 전체 업데이트.*12시간/);
 assert.match(dataStatusMessage({...base,stalled:true}),/중단되어 복구/);
 assert.match(dataStatusMessage({...base,collecting:true,latest:{status:'RUNNING',finishedAt:null,fetchedCount:1234}}),/1,234건 처리/);
});
test('failures show retry and preserve existing listings',()=>{
 const message=dataStatusMessage({...base,latest:{status:'FAILED',finishedAt:null},nextAttemptAt:'2026-10-06T01:00:00Z'});
 assert.match(message,/다음 시도 예정/);assert.match(message,/기존 공고는 유지/);
 assert.doesNotMatch(dataStatusMessage({...base,lastSuccessAt:'invalid'}),/Invalid Date/);
 assert.match(dataStatusMessage({configured:false,latest:null}),/연동을 준비/);
 assert.match(dataStatusMessage({configured:true,latest:null}),/첫 공식/);
});
