import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodType} from '../src/applicationPeriod.ts';
import {readSearchState} from '../src/searchState.ts';
import {matchesDeadline} from '../src/deadline.ts';
test('period classification distinguishes unconditional labels from conditional and unspecified periods',()=>{
 for(const periodLabel of ['상시신청',' 상시 신청\n','연중','연중\u00a0접수']) assert.equal(periodType({deadline:null,periodLabel}),'ongoing');
 for(const periodLabel of ['상시신청(예산 소진 시 종료)','신청불필요','접수기관 별 상이','매년 1월','']) assert.equal(periodType({deadline:null,periodLabel}),'guidance');
 assert.equal(periodType({deadline:'2020-01-01',periodLabel:'상시신청'}),'dated');
});
test('period URL and preparation filters retain uncertain periods without implying eligibility',()=>{
 assert.equal(readSearchState('?periodType=ongoing&region=서울&district=은평구').periodType,'ongoing');
 assert.equal(readSearchState('?periodType=invalid').periodType,'all');
 const ongoing={deadline:null,periodLabel:'상시신청'},conditional={deadline:null,periodLabel:'상시(예산 소진까지)'};
 assert.equal(matchesDeadline(ongoing,'ongoing'),true);assert.equal(matchesDeadline(conditional,'ongoing'),false);
 assert.equal(matchesDeadline(conditional,'guidance'),true);assert.equal(matchesDeadline(ongoing,'unknown'),true);
 assert.equal(matchesDeadline(undefined,'guidance'),false);
});
