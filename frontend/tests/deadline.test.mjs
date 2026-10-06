import {test} from 'node:test';
import assert from 'node:assert/strict';
import {seoulToday, deadlineDays, deadlineLabel, matchesDeadline, deadlineCalendar} from '../src/deadline.ts';
const benefit=(deadline)=>({id:'gov24-123',title:'지원 공고',organization:'서울특별시 강남구',periodLabel:'2026.1.1~2026.12.31',deadline});

test('deadline boundaries follow Korea dates, including midnight and leap days',()=>{
 assert.equal(seoulToday(new Date('2026-10-05T14:59:59Z')),'2026-10-05');
 assert.equal(seoulToday(new Date('2026-10-05T15:00:00Z')),'2026-10-06');
 assert.equal(deadlineLabel('2026-10-06','2026-10-06'),'오늘 마감');
 assert.equal(deadlineLabel('2026-10-05','2026-10-06'),'마감');
 assert.equal(deadlineDays('2024-03-01','2024-02-28'),2);
 assert.equal(deadlineDays('2026-02-29','2026-02-28'),null);
});
test('preparation deadline filters never treat unspecified or expired periods as upcoming',()=>{
 const today='2026-10-06';
 for(const date of ['2026-10-06','2026-10-13']) assert.equal(matchesDeadline(benefit(date),'week',today),true);
 for(const date of ['2026-10-05','2026-10-14',null]) assert.equal(matchesDeadline(benefit(date),'week',today),false);
 assert.equal(matchesDeadline(benefit('2026-11-05'),'month',today),true);
 assert.equal(matchesDeadline(benefit('2026-11-06'),'month',today),false);
 assert.equal(matchesDeadline(benefit('2026-10-05'),'expired',today),true);
 assert.equal(matchesDeadline(benefit(null),'unknown',today),true);
 assert.equal(matchesDeadline(undefined,'all',today),true);
 assert.equal(matchesDeadline(undefined,'unknown',today),false);
});
test('calendar is a stable all-day event with an exclusive next-day end',()=>{
 const now=new Date('2026-10-06T01:00:00Z');
 const calendar=deadlineCalendar(benefit('2026-12-31'),now);
 assert.match(calendar,/DTSTAMP:20261006T010000Z\r\n/);
 assert.match(calendar,/DTSTART;VALUE=DATE:20261231\r\n/);
 assert.match(calendar,/DTEND;VALUE=DATE:20270101\r\n/);
 assert.match(calendar,/UID:benefit-gov24-123@benefit-alert.vercel.app/);
 assert.equal(deadlineCalendar(benefit(null),now),null);
 assert.equal(deadlineCalendar(benefit('2026-02-30'),now),null);
 assert.match(deadlineCalendar(benefit('2024-02-29'),now),/DTEND;VALUE=DATE:20240301/);
});
test('calendar escapes text and folds Korean Unicode without corrupting characters',()=>{
 const b={...benefit('2026-12-31'),title:'긴 제목 한글😀'.repeat(12)+';comma,slash\\\r\nBEGIN:VEVENT',organization:'기관\nEND:VEVENT'};
 const calendar=deadlineCalendar(b,new Date('2026-10-06T01:00:00Z'));
 for(const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line,'utf8')<=75);
 const unfolded=calendar.replace(/\r\n /g,'');
 assert.equal(unfolded.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,1);
 assert.equal(unfolded.split('\r\n').filter(line=>line==='END:VEVENT').length,1);
 assert.ok(unfolded.includes('긴 제목 한글😀'.repeat(12)));
 assert.ok(unfolded.includes('\\;comma\\,slash\\\\\\nBEGIN:VEVENT'));
});
