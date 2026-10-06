package com.benefitalert.collection;

import com.benefitalert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

class AbsoluteDeadlineTest {
 @Test void recognizesOnlyCompleteAbsoluteDatesAndOrderedRanges() {
  for(String period:new String[]{"2026.01.19~2026.12.18","2026-1-19 ~ 2026-12-18","2026/1/19 ∼ 2026/12/18","2026년 1월 19일 ~ 2026년 12월 18일","2026. 12. 18.","2026-12-18"})
   assertEquals(LocalDate.of(2026,12,18),AbsoluteDeadlineV1.parse(period),period);
  assertEquals(LocalDate.of(2024,2,29),AbsoluteDeadlineV1.parse("2024.2.29"));
  assertEquals(LocalDate.of(2027,1,1),AbsoluteDeadlineV1.parse("2026.12.31~2027.1.1"));
 }
 @Test void doesNotGuessConditionalRecurringPartialOrInvalidDates() {
  for(String period:new String[]{"상시신청","접수기관 별 상이","매년 1월~12월","2026.1.1~12.31","2026.1.1~2026.12.31 (예산 소진 시)","2026.12.18 18:00","2026.2.29","2026-02-30~2026-12-31","2026.12.31~2026.1.1","2026.1.1~2026.2.1~2026.3.1","2026.01/19","2026/12/18.","2026년 12월",""})
   assertNull(AbsoluteDeadlineV1.parse(period),period);
 }
 @Test void collectorKeepsOriginalPeriodAndUsesTheSameParser() {
  var row=new ObjectMapper().createObjectNode().put("서비스ID","deadline").put("서비스명","지원").put("신청기한","2026.01.19~2026.12.18");
  var b=Gov24Mapper.map(row);assertEquals(LocalDate.of(2026,12,18),b.deadline());assertEquals("2026.01.19~2026.12.18",b.periodLabel());
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void upgradesExistingPeriodsAndOpenFilterWithoutChangingSource() {
  try(var db=new TestDatabase("4")) {
   for(String id:new String[]{"past","future","conditional","manual","dated"}) db.seed(id,"서울","생활",20);
   db.jdbc.sql("UPDATE benefit SET source_kind='gov24',deadline=NULL,period_label='2026.12.18',source_payload='{}'::jsonb").update();
   db.jdbc.sql("UPDATE benefit SET period_label='2020.01.01~2020.12.31' WHERE id='past'").update();
   db.jdbc.sql("UPDATE benefit SET period_label='2099.01.01~2099.12.31' WHERE id='future'").update();
   db.jdbc.sql("UPDATE benefit SET period_label='2026.12.18 (예산 소진 시)' WHERE id='conditional'").update();
   db.jdbc.sql("UPDATE benefit SET source_kind='manual' WHERE id='manual'").update();
   db.jdbc.sql("UPDATE benefit SET deadline='2026-12-17' WHERE id='dated'").update();
   var before=db.jdbc.sql("SELECT id,period_label,source_payload,updated_at,active FROM benefit ORDER BY id").query((r,n)->r.getString(1)+r.getString(2)+r.getString(3)+r.getString(4)+r.getBoolean(5)).list();
   db.migrate();
   assertEquals(before,db.jdbc.sql("SELECT id,period_label,source_payload,updated_at,active FROM benefit ORDER BY id").query((r,n)->r.getString(1)+r.getString(2)+r.getString(3)+r.getString(4)+r.getBoolean(5)).list());
   var repo=new PostgresBenefitRepository(db.jdbc);
   assertEquals(LocalDate.of(2020,12,31),repo.findById("past").orElseThrow().deadline());
   assertEquals(LocalDate.of(2099,12,31),repo.findById("future").orElseThrow().deadline());
   assertNull(repo.findById("conditional").orElseThrow().deadline());assertNull(repo.findById("manual").orElseThrow().deadline());
   assertEquals(LocalDate.of(2026,12,17),repo.findById("dated").orElseThrow().deadline());
   assertFalse(repo.search(new BenefitSearch("","전체","전체",true,1,100,"default",null,null)).items().stream().anyMatch(b->b.id().equals("past")));
   db.migrate();assertEquals(5,repo.search(new BenefitSearch("","전체","전체",false,1,100,"default",null,null)).total());
  }
 }
}
