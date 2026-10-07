package com.benefitalert.collection;

import com.benefitalert.RegionScope;
import java.time.*;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

/** Public aggregate counts only. No raw payloads, error text or account data. */
@RestController @Profile("prod")
public class DataReportController {
 public record Coverage(long total,long nationwide,long regionKnown,long districtKnown,long regionUnknown,long deadlineKnown) {}
 public record History(String status,Instant startedAt,Instant finishedAt,int fetchedCount,int rejectedCount) {}
 public record Report(boolean demo,Instant generatedAt,Coverage coverage,List<History> history) {}
 private final JdbcClient jdbc;
 public DataReportController(JdbcClient jdbc){this.jdbc=jdbc;}
 @GetMapping("/api/data-report") public ResponseEntity<Report> report(){
  var coverage=jdbc.sql("""
   SELECT count(*) AS total,
    count(*) FILTER(WHERE b.region='전국') AS nationwide,
    count(*) FILTER(WHERE b.region IN (:regions)) AS region_known,
    count(*) FILTER(WHERE b.region IN (:regions) AND %s IS NOT NULL) AS district_known,
    count(*) FILTER(WHERE b.region<>'전국' AND b.region NOT IN (:regions)) AS region_unknown,
    count(*) FILTER(WHERE b.deadline IS NOT NULL) AS deadline_known
   FROM benefit b WHERE b.active
   """.formatted(RegionScope.SQL_DISTRICT)).param("regions",RegionScope.REGIONS)
   .query((r,n)->new Coverage(r.getLong("total"),r.getLong("nationwide"),r.getLong("region_known"),r.getLong("district_known"),r.getLong("region_unknown"),r.getLong("deadline_known"))).single();
  var history=jdbc.sql("""
   SELECT CASE WHEN r.status='RUNNING' AND NOT EXISTS
    (SELECT 1 FROM collection_lock l WHERE l.owner_id=r.id AND l.lease_until>now())
    THEN 'INTERRUPTED' ELSE r.status END AS public_status,
    r.started_at,r.finished_at,r.fetched_count,r.rejected_count
   FROM collection_run r ORDER BY r.started_at DESC,r.id DESC LIMIT 10
   """).query((r,n)->new History(safeStatus(r.getString("public_status")),instant(r.getObject("started_at",OffsetDateTime.class)),instant(r.getObject("finished_at",OffsetDateTime.class)),r.getInt("fetched_count"),r.getInt("rejected_count"))).list();
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Report(false,Instant.now(),coverage,history));
 }
 private static Instant instant(OffsetDateTime date){return date==null?null:date.toInstant();}
 private static String safeStatus(String status){return List.of("RUNNING","INTERRUPTED","SUCCESS","PARTIAL","FAILED").contains(status)?status:"UNKNOWN";}
}
