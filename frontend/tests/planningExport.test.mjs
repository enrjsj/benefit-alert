import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportPlanning,matchesPlanningSearch} from '../src/planningExport.ts';
const planning={version:1,compareIds:['comparison'],checklists:{a:['documents']},applications:{missing:{status:'approved',note:'=HYPERLINK("unsafe")\n개인 메모'}}};
test('JSON exports all records including unavailable benefits without authentication data',()=>{
 const result=JSON.parse(exportPlanning(planning,[],'json',new Date('2026-10-11T00:00:00Z')));
 assert.equal(result.format,'benefit-alert-planning');assert.equal(result.exportedAt,'2026-10-11T00:00:00.000Z');
 assert.deepEqual(result.planning,planning);assert.equal(result.planning.applications.missing.note,planning.applications.missing.note);
 assert.deepEqual(Object.keys(result).sort(),['exportedAt','format','planning','version']);
});
test('CSV preserves Korean, multiline notes and quotes while neutralizing spreadsheet formulas',()=>{
 const csv=exportPlanning(planning,[{id:'a',title:'@SUM(1,2)'}],'csv');
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'@SUM(1,2)"'));assert.ok(csv.includes('"\'=HYPERLINK(""unsafe"")\n개인 메모"'));
 assert.ok(csv.includes('필요한 서류 준비'));assert.ok(csv.includes('공고 정보 없음'));assert.ok(csv.includes('선정'));
});
test('record search finds unavailable notes and normalizes titles without mutating data',()=>{
 assert.equal(matchesPlanningSearch('missing',planning,undefined,'개인 메모'),true);
 assert.equal(matchesPlanningSearch('missing',planning,undefined,' MISSING '),true);
 assert.equal(matchesPlanningSearch('a',planning,{title:'ＡＢＣ 지원',organization:'서울시'},'abc'),true);
 assert.equal(matchesPlanningSearch('a',planning,{title:'지원',organization:'서울시'},'서울'),true);
 assert.equal(matchesPlanningSearch('a',planning,undefined,'no-match'),false);
 assert.equal(matchesPlanningSearch('a',planning,undefined,'  '),true);
});
