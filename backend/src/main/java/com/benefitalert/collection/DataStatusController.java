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
 @GetMapping("/api/data-status") public ResponseEntity<Map<String,Object>> status(){
  Instant now=Instant.now();boolean configured=collector.enabled();
  Run latest=jdbc.sql("SELECT r.*,EXISTS(SELECT 1 FROM collection_lock l WHERE l.owner_id=r.id AND l.lease_until>now()) AS lease_active FROM collection_run r ORDER BY r.started_at DESC,r.id DESC LIMIT 1")
   .query((r,n)->new Run(r.getString("status"),r.getObject("started_at",OffsetDateTime.class).toInstant(),r.getObject("finished_at",OffsetDateTime.class)==null?null:r.getObject("finished_at",OffsetDateTime.class).toInstant(),r.getInt("fetched_count"),r.getInt("rejected_count"),r.getString("error_code"),r.getBoolean("lease_active"))).optional().orElse(null);
  Instant success=jdbc.sql("SELECT finished_at FROM collection_run WHERE status='SUCCESS' AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1").query((r,n)->r.getObject(1,OffsetDateTime.class).toInstant()).optional().orElse(null);
  boolean stalled=latest!=null && "RUNNING".equals(latest.status()) && !latest.leaseActive();
  boolean collecting=latest!=null && "RUNNING".equals(latest.status()) && latest.leaseActive();
  Instant next=!configured?null:stalled?now:CollectionPolicy.nextAttempt(latest==null?null:latest.status(),latest==null?null:latest.finishedAt(),latest==null?null:latest.errorCode(),now);
  var result=new LinkedHashMap<String,Object>();
  result.put("configured",configured);result.put("latest",latest);result.put("lastSuccessAt",success);
  result.put("collecting",collecting);result.put("stalled",stalled);
  result.put("freshness",!configured?"DISABLED":success==null?"WAITING":CollectionPolicy.stale(success,now)?"STALE":"CURRENT");
  result.put("needsAttention",configured && (stalled || CollectionPolicy.stale(success,now)));
  result.put("nextAttemptAt",next);
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
 }
}
