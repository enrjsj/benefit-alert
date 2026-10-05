package com.benefitalert.collection;

import com.benefitalert.Benefit;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

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
 @Scheduled(initialDelay=45000,fixedDelay=21600000)
 public void collect() {
  if(!enabled()) return;
  UUID run=UUID.randomUUID();int fetched=0,rejected=0;String status="FAILED",error="upstream_unavailable";
  if(jdbc.sql("UPDATE collection_lock SET owner_id=:id,lease_until=now()+interval '15 minutes' WHERE id=1 AND lease_until<now()") .param("id",run).update()==0) return;
  try {
   jdbc.sql("INSERT INTO collection_run(id,status) VALUES(:id,'RUNNING')").param("id",run).update();
   Set<String> seen=new HashSet<>();long expected=-1;
   for(int page=1;page<=200;page++) {
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
    if(jdbc.sql("UPDATE collection_lock SET lease_until=now()+interval '15 minutes' WHERE id=1 AND owner_id=:id").param("id",run).update()==0) throw new IllegalStateException("lease_lost");
    if(fetched>=expected) {
     status=fetched==expected && rejected==0?"SUCCESS":"PARTIAL";error=null;
     if(status.equals("SUCCESS")) jdbc.sql("UPDATE benefit SET active=false,updated_at=now() WHERE source_kind='gov24' AND active AND last_seen_run IS DISTINCT FROM :id").param("id",run).update();
     break;
    }
    if(page==200) {status="PARTIAL";error="page_limit";}
   }
  } catch(Exception e) { // Never persist exception messages: upstream errors may contain credentials.
   error="collection_failed";
  } finally {
   jdbc.sql("UPDATE collection_run SET status=:s,finished_at=now(),fetched_count=:f,rejected_count=:r,error_code=:e WHERE id=:id")
    .param("id",run).param("s",status).param("f",fetched).param("r",rejected).param("e",error,java.sql.Types.VARCHAR).update();
   jdbc.sql("UPDATE collection_lock SET lease_until=now(),owner_id=NULL WHERE id=1 AND owner_id=:id").param("id",run).update();
  }
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
