package com.benefitalert.collection;
import com.benefitalert.TestDatabase;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
class DataStatusTest {
 private DataStatusController controller(TestDatabase db,String key){return new DataStatusController(db.jdbc,new Gov24Collector(db.jdbc,key,org.springframework.web.client.RestClient.create()));}
 private UUID run(TestDatabase db,String status,int minutes,String error){
  UUID id=UUID.randomUUID();
  db.jdbc.sql("INSERT INTO collection_run(id,status,started_at,finished_at,error_code) VALUES(:id,:s,now()-(:m * interval '1 minute'),CASE WHEN :s='RUNNING' THEN NULL ELSE now()-(:m * interval '1 minute') END,:e)")
   .param("id",id).param("s",status).param("m",minutes).param("e",error,java.sql.Types.VARCHAR).update();return id;
 }
 @Test void failuresSinceSuccessSurviveRetryAndResetOnRecovery(){try(var db=new TestDatabase()){
  run(db,"FAILED",60,null);run(db,"SUCCESS",50,null);
  run(db,"FAILED",40,"upstream_unavailable");run(db,"PARTIAL",30,null);run(db,"FAILED",20,"rate_limited");
  var c=controller(db,"test");var status=c.status().getBody();
  assertEquals(3L,status.get("consecutiveFailures"));assertEquals("REPEATED_FAILURE",status.get("attentionReason"));assertEquals(true,status.get("needsAttention"));assertEquals("CURRENT",status.get("freshness"));
  var active=run(db,"RUNNING",10,null);db.jdbc.sql("UPDATE collection_lock SET owner_id=:id,lease_until=now()+interval '5 minutes' WHERE id=1").param("id",active).update();
  assertEquals(true,c.status().getBody().get("collecting"));assertEquals(3L,c.status().getBody().get("consecutiveFailures"));
  db.jdbc.sql("UPDATE collection_run SET status='SUCCESS',finished_at=now() WHERE id=:id").param("id",active).update();
  var recovered=c.status().getBody();assertEquals(0L,recovered.get("consecutiveFailures"));assertEquals("NONE",recovered.get("attentionReason"));assertEquals(false,recovered.get("needsAttention"));
 }}
 @Test void authenticationStallsAndUnknownErrorsHaveSafeDiagnostics() throws Exception {try(var db=new TestDatabase()){
  var c=controller(db,"test");assertEquals("WAITING",c.status().getBody().get("attentionReason"));
  run(db,"SUCCESS",90,null);run(db,"FAILED",60,"credential_rejected");
  assertEquals("CREDENTIAL_REJECTED",c.status().getBody().get("attentionReason"));assertNotNull(c.status().getBody().get("nextAttemptAt"));
  run(db,"FAILED",40,"internal-secret-marker");
  assertFalse(new ObjectMapper().findAndRegisterModules().writeValueAsString(c.status().getBody()).contains("internal-secret-marker"));
  run(db,"RUNNING",20,null);assertEquals("STALLED",c.status().getBody().get("attentionReason"));
  var disabled=controller(db,"").status();assertEquals("DISABLED",disabled.getBody().get("attentionReason"));assertEquals(false,disabled.getBody().get("needsAttention"));assertEquals("no-store",disabled.getHeaders().getCacheControl());
 }}
}
