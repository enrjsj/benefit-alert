package com.benefitalert.collection;

import com.benefitalert.TestDatabase;
import com.benefitalert.PostgresBenefitRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
class DataReportTest {
 @Test void coverageCountsOnlyActiveBenefitsAndKeepsDistrictsASubset() throws Exception {try(var db=new TestDatabase()){
  db.seed("national","전국","생활",5);db.seed("local","서울","생활",5);db.seed("province","서울","생활",-1);db.seed("unknown","지역확인","기타",5);db.seed("inactive","경기","생활",5);
  db.jdbc.sql("UPDATE benefit SET organization='서울특별시 강남구',source_kind='gov24',source_payload='{\"private_marker\":\"not-public\"}'::jsonb WHERE id='local'").update();
  db.jdbc.sql("UPDATE benefit SET active=false WHERE id='inactive'").update();
  db.jdbc.sql("UPDATE benefit SET deadline=null WHERE id='unknown'").update();
  var report=new DataReportController(db.jdbc).report().getBody();
  assertEquals(17,report.regions().size());
  assertEquals(new DataReportController.RegionCount("서울",2,1),report.regions().getFirst());
  assertEquals(0,report.regions().stream().filter(r->r.region().equals("경기")).findFirst().orElseThrow().total());
  assertEquals(new DataReportController.PeriodCount(3,0,1),report.periods());
  assertNotNull(report);assertFalse(report.demo());assertEquals(new DataReportController.Coverage(4,1,2,1,1,3),report.coverage());assertTrue(report.history().isEmpty());
  var local=new PostgresBenefitRepository(db.jdbc).findById("local").orElseThrow();
  assertEquals("gov24",local.sourceKind());assertNotNull(local.updatedAt());assertFalse(local.updatedAt().isAfter(Instant.now()));
  assertEquals("manual",new PostgresBenefitRepository(db.jdbc).findById("province").orElseThrow().sourceKind());
  var mvc=MockMvcBuilders.standaloneSetup(new DataReportController(db.jdbc)).build();
  var json=mvc.perform(get("/api/data-report")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.coverage.total").value(4)).andReturn().getResponse().getContentAsString();
  assertFalse(json.contains("source_payload"));assertFalse(json.contains("private_marker"));
 }}
 @Test void historyIsBoundedOrderedAndDoesNotPublishInternalFailureText() throws Exception {try(var db=new TestDatabase()){
  UUID live=UUID.randomUUID();
  for(int i=0;i<12;i++) db.jdbc.sql("INSERT INTO collection_run(id,started_at,status,fetched_count,error_code) VALUES(:id,now()-(:n * interval '1 minute'),:status,:n,'credential-or-internal-detail')")
   .param("id",i==1?live:UUID.randomUUID()).param("n",i).param("status",i<2?"RUNNING":i==2?"INTERNAL_ONLY":"SUCCESS").update();
  db.jdbc.sql("UPDATE collection_lock SET owner_id=:id,lease_until=now()+interval '5 minutes' WHERE id=1").param("id",live).update();
  var controller=new DataReportController(db.jdbc);var history=controller.report().getBody().history();
  assertEquals(10,history.size());assertEquals("INTERRUPTED",history.get(0).status());assertEquals("RUNNING",history.get(1).status());assertEquals("UNKNOWN",history.get(2).status());
  assertEquals(9,history.getLast().fetchedCount());assertTrue(history.getFirst().startedAt().isAfter(history.getLast().startedAt()));
  var mapper=new ObjectMapper().findAndRegisterModules();String json=mapper.writeValueAsString(controller.report().getBody());
  assertFalse(json.contains("credential-or-internal-detail"));assertFalse(json.contains("INTERNAL_ONLY"));assertFalse(json.contains("errorCode"));
 }}
 @Test void periodBreakdownMatchesSearchAndEmptyDataHasZeroTotals() {try(var db=new TestDatabase()){
  var controller=new DataReportController(db.jdbc);
  var empty=controller.report().getBody();
  assertEquals(new DataReportController.PeriodCount(0,0,0),empty.periods());
  assertEquals(0,empty.regions().stream().mapToLong(DataReportController.RegionCount::total).sum());
  for(String id:java.util.List.of("dated","ongoing","conditional","unknown")) db.seed(id,"전국","생활",-1);
  db.jdbc.sql("UPDATE benefit SET deadline=null,period_label=CASE id WHEN 'ongoing' THEN '연중 접수' WHEN 'conditional' THEN '상시(예산 소진 시)' ELSE '' END WHERE id<>'dated'").update();
  var report=controller.report().getBody();
  assertEquals(new DataReportController.PeriodCount(1,1,2),report.periods());
  for(String period:java.util.List.of("dated","ongoing","guidance")) {
   long expected=switch(period){case "dated"->report.periods().dated();case "ongoing"->report.periods().ongoing();default->report.periods().guidance();};
   var search=new com.benefitalert.BenefitSearch("","전체","전체",false,1,100,"default",null,null,"",period);
   assertEquals(expected,new PostgresBenefitRepository(db.jdbc).search(search).total());
  }
 }}

}
