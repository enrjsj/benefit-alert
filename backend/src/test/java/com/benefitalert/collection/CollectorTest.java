package com.benefitalert.collection;
import com.benefitalert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.junit.jupiter.api.Assertions.*;
class CollectorTest {
 @Test void preservesAmbiguousPeriodsAndSafeLinks() throws Exception {
  var row=new ObjectMapper().readTree("""
   {"서비스ID":"123","서비스명":"예시","소관기관명":"서울특별시","서비스분야":"주거·자립","신청기한":"매년 1월~12월 (예산 소진 시)","상세조회URL":"javascript:alert(1)"}
   """);var b=Gov24Mapper.map(row);assertNull(b.deadline());assertEquals("서울",b.region());assertTrue(b.sourceUrl().startsWith("https://www.gov.kr/"));
  ((com.fasterxml.jackson.databind.node.ObjectNode)row).put("신청기한","2026-01-01 ~ 2026-12-31");assertEquals("2026-12-31",Gov24Mapper.map(row).deadline().toString());
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void successfulSnapshotUpsertsAndFailedSnapshotPreservesExisting(){try(var db=new TestDatabase()){
  db.seed("manual","전국","생활",20);db.seed("gov24-old","전국","생활",20);db.jdbc.sql("UPDATE benefit SET source_kind='gov24' WHERE id='gov24-old'").update();
  var builder=RestClient.builder().baseUrl("https://api.odcloud.kr/api/gov24/v3");var server=MockRestServiceServer.bindTo(builder).build();
  server.expect(requestTo("https://api.odcloud.kr/api/gov24/v3/serviceList?page=1&perPage=100&returnType=JSON")).andExpect(header("Authorization","Infuser dummy")).andRespond(withSuccess("""
   {"totalCount":1,"data":[{"서비스ID":"new","서비스명":"신규 공고","소관기관유형":"중앙행정기관","신청기한":"상시"}]}
   """,MediaType.APPLICATION_JSON));
  var collector=new Gov24Collector(db.jdbc,"dummy",builder.build());collector.collect();server.verify();
  assertEquals(2,db.jdbc.sql("SELECT count(*) FROM benefit WHERE active").query(Integer.class).single());assertEquals("SUCCESS",db.jdbc.sql("SELECT status FROM collection_run").query(String.class).single());
  server.reset();server.expect(anything()).andRespond(withServerError());collector.collect();server.verify();
  assertEquals(2,db.jdbc.sql("SELECT count(*) FROM benefit WHERE active").query(Integer.class).single());
  assertEquals(1,db.jdbc.sql("SELECT count(*) FROM collection_run WHERE status='FAILED'").query(Integer.class).single());
 }}

 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void batchPagesPreserveDatesPayloadAndUnchangedTimestamp() throws Exception {try(var db=new TestDatabase()){
  var builder=RestClient.builder().baseUrl("https://api.odcloud.kr/api/gov24/v3");var server=MockRestServiceServer.bindTo(builder).build();
  var collector=new Gov24Collector(db.jdbc,"dummy",builder.build());
  String first="""
   {"totalCount":3,"data":[{"서비스ID":"a","서비스명":"첫 공고","신청기한":"2026-12-31"},{"서비스ID":"b","서비스명":"둘째 공고","신청기한":"상시"}]}
   """;
  String second="""
   {"totalCount":3,"data":[{"서비스ID":"c","서비스명":"셋째 공고","신청기한":"기관 문의"}]}
   """;
  for(int attempt=0;attempt<2;attempt++) {
   server.reset();server.expect(anything()).andRespond(withSuccess(first,MediaType.APPLICATION_JSON));server.expect(anything()).andRespond(withSuccess(second,MediaType.APPLICATION_JSON));
   var before=db.jdbc.sql("SELECT updated_at::text FROM benefit WHERE id='gov24-a'").query(String.class).optional();
   collector.collect();server.verify();
   assertEquals(3,db.jdbc.sql("SELECT count(*) FROM benefit WHERE active").query(Integer.class).single());
   assertEquals("2026-12-31",db.jdbc.sql("SELECT deadline::text FROM benefit WHERE id='gov24-a'").query(String.class).single());
   assertEquals("상시",db.jdbc.sql("SELECT source_payload->>'신청기한' FROM benefit WHERE id='gov24-b'").query(String.class).single());
   assertEquals(1,db.jdbc.sql("SELECT count(DISTINCT last_seen_run) FROM benefit").query(Integer.class).single());
   if(before.isPresent()) assertEquals(before.get(),db.jdbc.sql("SELECT updated_at::text FROM benefit WHERE id='gov24-a'").query(String.class).single());
  }
  var expired=java.util.UUID.randomUUID();
  db.jdbc.sql("UPDATE collection_lock SET owner_id=:id,lease_until=now()-interval '1 second'").param("id",expired).update();
  assertThrows(IllegalStateException.class,()->collector.upsertPage(new ObjectMapper().readTree("[{\"id\":\"unexpected\"}]"),expired));
  assertEquals(3,db.jdbc.sql("SELECT count(*) FROM benefit").query(Integer.class).single());
 }}
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void totalTimeBudgetStopsBeforeSavingAnOverduePage(){try(var db=new TestDatabase()){
  db.seed("manual","전국","생활",20);
  var ticker=new java.util.concurrent.atomic.AtomicLong();
  var builder=RestClient.builder().baseUrl("https://api.odcloud.kr/api/gov24/v3");var server=MockRestServiceServer.bindTo(builder).build();
  server.expect(anything()).andRespond(request->{ticker.set(java.time.Duration.ofMinutes(40).toNanos());return withSuccess("{\"totalCount\":1,\"data\":[{\"서비스ID\":\"new\",\"서비스명\":\"새 공고\"}]}",MediaType.APPLICATION_JSON).createResponse(request);});
  new Gov24Collector(db.jdbc,"dummy",builder.build(),ticker::get).collect();server.verify();
  assertEquals("collection_timeout",db.jdbc.sql("SELECT error_code FROM collection_run").query(String.class).single());
  assertEquals(1,db.jdbc.sql("SELECT count(*) FROM benefit WHERE active").query(Integer.class).single());
  assertEquals(0,db.jdbc.sql("SELECT count(*) FROM collection_lock WHERE owner_id IS NOT NULL").query(Integer.class).single());
 }}
}
