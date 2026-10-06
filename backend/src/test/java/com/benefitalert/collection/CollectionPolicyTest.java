package com.benefitalert.collection;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class CollectionPolicyTest {
 @Test void successAndCredentialFailuresWaitWhileTransientFailuresRetry(){
  Instant now=Instant.parse("2026-10-06T00:00:00Z");
  assertEquals(now.plusSeconds(21600),CollectionPolicy.nextAttempt("SUCCESS",now,null,now));
  assertEquals(now.plusSeconds(600),CollectionPolicy.nextAttempt("FAILED",now,"rate_limited",now));
  assertEquals(now.plusSeconds(21600),CollectionPolicy.nextAttempt("FAILED",now,"credential_rejected",now));
  assertEquals(now,CollectionPolicy.nextAttempt("FAILED",now,"interrupted",now));
  assertNull(CollectionPolicy.nextAttempt("RUNNING",null,null,now));
  assertFalse(CollectionPolicy.stale(now.minusSeconds(43199),now));
  assertTrue(CollectionPolicy.stale(now.minusSeconds(43200),now));
 }
 @Test @org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void scheduledRecoveryRespectsActiveLeaseAndRetryDelay(){try(var db=new com.benefitalert.TestDatabase()){
  var builder=org.springframework.web.client.RestClient.builder().baseUrl("https://api.odcloud.kr/api/gov24/v3");
  var server=org.springframework.test.web.client.MockRestServiceServer.bindTo(builder).build();
  var collector=new Gov24Collector(db.jdbc,"dummy",builder.build());
  var id=java.util.UUID.randomUUID();
  db.jdbc.sql("INSERT INTO collection_run(id,status) VALUES(:id,'RUNNING')").param("id",id).update();
  db.jdbc.sql("UPDATE collection_lock SET owner_id=:id,lease_until=now()+interval '15 minutes'").param("id",id).update();
  collector.collectIfDue();
  assertEquals("RUNNING",db.jdbc.sql("SELECT status FROM collection_run").query(String.class).single());
  db.jdbc.sql("UPDATE collection_lock SET lease_until=now()-interval '1 minute'").update();
  server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.anything()).andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withServerError());
  collector.collectIfDue();server.verify();
  assertEquals("interrupted",db.jdbc.sql("SELECT error_code FROM collection_run WHERE id=:id").param("id",id).query(String.class).single());
  assertEquals(2,db.jdbc.sql("SELECT count(*) FROM collection_run").query(Integer.class).single());
  collector.collectIfDue();
  assertEquals(2,db.jdbc.sql("SELECT count(*) FROM collection_run").query(Integer.class).single());
  var response=new DataStatusController(db.jdbc,collector).status();
  assertEquals("no-store",response.getHeaders().getCacheControl());
  assertEquals("WAITING",response.getBody().get("freshness"));
  db.jdbc.sql("INSERT INTO collection_run(id,status,finished_at,started_at) VALUES(:id,'SUCCESS',now()-interval '13 hours',now()-interval '14 hours')").param("id",java.util.UUID.randomUUID()).update();
  assertEquals("STALE",new DataStatusController(db.jdbc,collector).status().getBody().get("freshness"));
  db.jdbc.sql("UPDATE collection_run SET finished_at=now() WHERE status='SUCCESS'").update();
  assertEquals("CURRENT",new DataStatusController(db.jdbc,collector).status().getBody().get("freshness"));
 }}
}
