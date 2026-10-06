package com.benefitalert.account;

import com.benefitalert.TestDatabase;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class PlanningTest {
 @Test void importsMergeProgressWithoutDroppingOrDuplicatingRecords(){
  var first=new PlanningService.Data(1,List.of("a"),Map.of("a",List.of("eligibility")));
  var incoming=new PlanningService.Data(1,List.of("a","b"),Map.of("a",List.of("documents")));
  var merged=PlanningService.merge(first,incoming);
  assertEquals(List.of("a","b"),merged.compareIds());
  assertEquals(List.of("eligibility","documents"),merged.checklists().get("a"));
  assertEquals(merged,PlanningService.merge(merged,incoming));
  assertThrows(ResponseStatusException.class,()->PlanningService.merge(merged,new PlanningService.Data(1,List.of("c","d"),Map.of())));
 }
 @Test void rejectsInvalidStepsPrototypeKeysAndOversizedRecords(){
  assertThrows(ResponseStatusException.class,()->PlanningService.validate(new PlanningService.Data(1,List.of("__proto__"),Map.of())));
  assertThrows(ResponseStatusException.class,()->PlanningService.validate(new PlanningService.Data(1,List.of(),Map.of("a",List.of("invented")))));
  var large=new HashMap<String,List<String>>();for(int i=0;i<201;i++)large.put("a"+i,List.of("documents"));
  assertThrows(ResponseStatusException.class,()->PlanningService.validate(new PlanningService.Data(1,List.of(),large)));
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void isolatesAccountsPersistsAcrossClientsAndRejectsStaleUpdates(){try(var db=new TestDatabase()){
  var service=new PlanningService(db.jdbc,new ObjectMapper());
  UUID alice=UUID.randomUUID(),bob=UUID.randomUUID();
  var initial=service.get(alice);assertEquals(0,initial.revision());
  var first=new PlanningService.Data(1,List.of("a"),Map.of("a",List.of("eligibility")));
  service.save(alice,new PlanningService.Update(0,first));
  assertEquals(first,new PlanningService(db.jdbc,new ObjectMapper()).get(alice).data());
  assertEquals(PlanningService.empty(),service.get(bob).data());
  var conflict=assertThrows(ResponseStatusException.class,()->service.save(alice,new PlanningService.Update(0,PlanningService.empty())));
  assertEquals(409,conflict.getStatusCode().value());
  assertEquals(first,service.get(alice).data());
  var merged=service.importData(alice,new PlanningService.Data(1,List.of("b"),Map.of("a",List.of("documents"))));
  assertEquals(List.of("eligibility","documents"),merged.data().checklists().get("a"));
  service.save(bob,new PlanningService.Update(0,PlanningService.empty()));
  assertEquals(merged,service.get(alice));
  var clean=service.save(alice,new PlanningService.Update(merged.revision(),PlanningService.empty()));
  assertEquals(PlanningService.empty(),clean.data());
  assertTrue(db.jdbc.sql("SELECT relrowsecurity FROM pg_class WHERE oid='member_planning'::regclass").query(Boolean.class).single());
 }}
}
