package com.benefitalert.collection;

import com.benefitalert.Benefit;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component @Profile("prod")
public class Gov24Collector {
 private final JdbcClient jdbc; private final String key; private final RestClient client;
 @org.springframework.beans.factory.annotation.Autowired
 public Gov24Collector(JdbcClient jdbc,@Value("${GOV24_API_KEY:}") String key) {
  this.jdbc=jdbc;this.key=key.strip();
  var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
  factory.setReadTimeout(Duration.ofSeconds(30));
  client=RestClient.builder().baseUrl("https://api.odcloud.kr/api/gov24/v3").requestFactory(factory).build();
 }
 Gov24Collector(JdbcClient jdbc,String key,RestClient client){this.jdbc=jdbc;this.key=key;this.client=client;}
 public boolean enabled(){return !key.isBlank();}
 @Scheduled(initialDelay=45000,fixedDelay=60000)
 public void collectIfDue() { run(true); }
 public void collect() {
  run(false);
 }
 private void run(boolean scheduled) {
  if(!enabled()) return;
  UUID run=UUID.randomUUID();int fetched=0,rejected=0;String status="FAILED",error="upstream_unavailable";
  boolean created=false;
  if(jdbc.sql("UPDATE collection_lock SET owner_id=:id,lease_until=now()+interval '15 minutes' WHERE id=1 AND lease_until<now()") .param("id",run).update()==0) return;
  try {
   // Owning an expired lease proves previous RUNNING attempts have stopped.
   jdbc.sql("UPDATE collection_run SET status='FAILED',finished_at=now(),error_code='interrupted' WHERE status='RUNNING'").update();
   if(scheduled) {
    var next=jdbc.sql("SELECT status,finished_at,error_code FROM collection_run ORDER BY started_at DESC,id DESC LIMIT 1")
     .query((r,n)->CollectionPolicy.nextAttempt(r.getString(1),r.getObject(2,OffsetDateTime.class)==null?null:r.getObject(2,OffsetDateTime.class).toInstant(),r.getString(3),Instant.now())).optional();
    if(next.isPresent() && next.get().isAfter(Instant.now())) return;
   }
   jdbc.sql("INSERT INTO collection_run(id,status) VALUES(:id,'RUNNING')").param("id",run).update();
   created=true;
   Set<String> seen=new HashSet<>();long expected=-1;
   for(int page=1;page<=200;page++) {
    renew(run);
    final int current=page;
    // Infuser header keeps the key out of request URLs and logs.
    String decoded=key.contains("%")?java.net.URLDecoder.decode(key,java.nio.charset.StandardCharsets.UTF_8):key;
    JsonNode root=client.get().uri(b->b.path("/serviceList").queryParam("page",current).queryParam("perPage",100).queryParam("returnType","JSON").build())
      .header("Authorization","Infuser "+decoded).retrieve().body(JsonNode.class);
    if(root==null || !root.path("data").isArray() || !root.path("totalCount").canConvertToLong()) throw new IllegalStateException("invalid_response");
    long total=root.path("totalCount").asLong();
    if(expected<0) expected=total;
    if(expected!=total || total<=0) throw new IllegalStateException("unstable_snapshot");
    JsonNode rows=root.path("data");
    if(rows.isEmpty()) throw new IllegalStateException("incomplete_snapshot");
    for(JsonNode row:rows) {
     Benefit b;
     try {b=Gov24Mapper.map(row);} catch(IllegalArgumentException e) {rejected++;fetched++;continue;}
     if(!seen.add(b.id())) throw new IllegalStateException("repeated_record");
     upsert(b,row.toString(),run);fetched++;
    }
    renew(run);
    jdbc.sql("UPDATE collection_run SET fetched_count=:f,rejected_count=:r WHERE id=:id AND status='RUNNING'").param("f",fetched).param("r",rejected).param("id",run).update();
    if(fetched>=expected) {
     status=fetched==expected && rejected==0?"SUCCESS":"PARTIAL";error=null;
     if(status.equals("SUCCESS")) {
      // Fence snapshot cleanup with a lease-row update in the same statement.
      // A worker that lost ownership must never deactivate a newer snapshot.
      renew(run);
      int owned=jdbc.sql("WITH owned AS (UPDATE collection_lock SET lease_until=now()+interval '15 minutes' WHERE id=1 AND owner_id=:id AND lease_until>now() RETURNING id), cleaned AS (UPDATE benefit SET active=false,updated_at=now() WHERE source_kind='gov24' AND active AND last_seen_run IS DISTINCT FROM :id AND EXISTS (SELECT 1 FROM owned) RETURNING id) SELECT count(*) FROM owned").param("id",run).query(Integer.class).single();
      if(owned==0) throw new IllegalStateException("lease_lost");
     }
     break;
    }
    if(page==200) {status="PARTIAL";error="page_limit";}
   }
  } catch(Exception e) { // Only allowlisted codes; exception text may contain credentials.
   status="FAILED";
   if(e instanceof RestClientResponseException upstream) error=switch(upstream.getStatusCode().value()){case 401,403->"credential_rejected";case 429->"rate_limited";default->"upstream_unavailable";};
   else if(e instanceof IllegalStateException && e.getMessage()!=null && Set.of("invalid_response","unstable_snapshot","incomplete_snapshot","repeated_record","lease_lost").contains(e.getMessage())) error=e.getMessage();
   else error="collection_failed";
  } finally {
   if(created) jdbc.sql("UPDATE collection_run SET status=:s,finished_at=now(),fetched_count=:f,rejected_count=:r,error_code=:e WHERE id=:id AND status='RUNNING'")
    .param("id",run).param("s",status).param("f",fetched).param("r",rejected).param("e",error,java.sql.Types.VARCHAR).update();
   jdbc.sql("UPDATE collection_lock SET lease_until=now(),owner_id=NULL WHERE id=1 AND owner_id=:id").param("id",run).update();
  }
 }
 private void renew(UUID run){
  if(jdbc.sql("UPDATE collection_lock SET lease_until=now()+interval '15 minutes' WHERE id=1 AND owner_id=:id AND lease_until>now()").param("id",run).update()==0) throw new IllegalStateException("lease_lost");
 }
 void upsert(Benefit b,String raw,UUID run) {
  jdbc.sql("""
   INSERT INTO benefit(id,title,organization,region,category,summary,eligibility,support,application_method,deadline,period_label,source_url,source_kind,source_payload,last_seen_run)
   VALUES(:id,:title,:org,:region,:category,:summary,:eligibility,:support,:method,:deadline,:period,:url,'gov24',CAST(:raw AS jsonb),:run)
   ON CONFLICT(id) DO UPDATE SET title=excluded.title,organization=excluded.organization,region=excluded.region,category=excluded.category,
   summary=excluded.summary,eligibility=excluded.eligibility,support=excluded.support,application_method=excluded.application_method,
   deadline=excluded.deadline,period_label=excluded.period_label,source_url=excluded.source_url,source_payload=excluded.source_payload,
   last_seen_run=excluded.last_seen_run,active=true,
   updated_at=CASE WHEN benefit.source_payload IS DISTINCT FROM excluded.source_payload OR NOT benefit.active THEN now() ELSE benefit.updated_at END
   """).param("id",b.id()).param("title",b.title()).param("org",b.organization()).param("region",b.region()).param("category",b.category())
   .param("summary",b.summary()).param("eligibility",b.eligibility()).param("support",b.support()).param("method",b.applicationMethod())
   .param("deadline",b.deadline(),java.sql.Types.DATE).param("period",b.periodLabel()).param("url",b.sourceUrl()).param("raw",raw).param("run",run).update();
 }
}
