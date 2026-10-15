package com.benefitalert.collection;

import java.time.*;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

@RestController @Profile("prod")
public class DataStatusController {
 public record Run(String status,Instant startedAt,Instant finishedAt,int fetchedCount,int rejectedCount,String errorCode,boolean leaseActive) {}
 private final JdbcClient jdbc;private final Gov24Collector collector;
 public DataStatusController(JdbcClient jdbc,Gov24Collector collector){this.jdbc=jdbc;this.collector=collector;}
 @org.springframework.transaction.annotation.Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
 @GetMapping("/api/data-status") public ResponseEntity<Map<String,Object>> status(){
  Instant now=Instant.now();boolean configured=collector.enabled();
  Run latest=jdbc.sql("SELECT r.*,EXISTS(SELECT 1 FROM collection_lock l WHERE l.owner_id=r.id AND l.lease_until>now()) AS lease_active FROM collection_run r ORDER BY r.started_at DESC,r.id DESC LIMIT 1")
   .query((r,n)->new Run(r.getString("status"),r.getObject("started_at",OffsetDateTime.class).toInstant(),r.getObject("finished_at",OffsetDateTime.class)==null?null:r.getObject("finished_at",OffsetDateTime.class).toInstant(),r.getInt("fetched_count"),r.getInt("rejected_count"),safeError(r.getString("error_code")),r.getBoolean("lease_active"))).optional().orElse(null);
  Instant success=jdbc.sql("SELECT finished_at FROM collection_run WHERE status='SUCCESS' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1").query((r,n)->r.getObject(1,OffsetDateTime.class).toInstant()).optional().orElse(null);
  boolean stalled=latest!=null && "RUNNING".equals(latest.status()) && !latest.leaseActive();
  boolean collecting=latest!=null && "RUNNING".equals(latest.status()) && latest.leaseActive();
  Instant next=!configured?null:stalled?now:CollectionPolicy.nextAttempt(latest==null?null:latest.status(),latest==null?null:latest.finishedAt(),latest==null?null:latest.errorCode(),now);
  long failures=jdbc.sql("""
   WITH attempts AS (
    SELECT status,sum(CASE WHEN status='SUCCESS' THEN 1 ELSE 0 END)
     OVER(ORDER BY started_at DESC,id DESC) AS successes FROM collection_run
   ) SELECT count(*) FROM attempts WHERE successes=0 AND status IN ('FAILED','PARTIAL')
   """).query(Long.class).single();
  String attention=!configured?"DISABLED":stalled?"STALLED":
   latest!=null && "credential_rejected".equals(latest.errorCode())?"CREDENTIAL_REJECTED":
   failures>=3?"REPEATED_FAILURE":success==null?"WAITING":CollectionPolicy.stale(success,now)?"STALE":"NONE";
  var result=new LinkedHashMap<String,Object>();
  result.put("configured",configured);result.put("latest",latest);result.put("lastSuccessAt",success);
  result.put("collecting",collecting);result.put("stalled",stalled);
  result.put("freshness",!configured?"DISABLED":success==null?"WAITING":CollectionPolicy.stale(success,now)?"STALE":"CURRENT");
  result.put("consecutiveFailures",failures);result.put("attentionReason",attention);
  result.put("needsAttention",!List.of("DISABLED","NONE").contains(attention));
  result.put("nextAttemptAt",next);
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
 }
 private static String safeError(String code){
  if(code==null)return null;
  return Set.of("interrupted","credential_rejected","rate_limited","upstream_unavailable","invalid_response","unstable_snapshot","incomplete_snapshot","repeated_record","lease_lost","collection_timeout","page_limit","collection_failed").contains(code)?code:"collection_failed";
 }
}
