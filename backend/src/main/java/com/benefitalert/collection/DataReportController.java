package com.benefitalert.collection;

import com.benefitalert.RegionScope;
import com.benefitalert.ApplicationPeriod;
import java.time.*;
import java.util.*;
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
 public record RegionCount(String region,long total,long districtKnown) {}
 public record PeriodCount(long dated,long ongoing,long guidance) {}
 public record Report(boolean demo,Instant generatedAt,Coverage coverage,List<History> history,List<RegionCount> regions,PeriodCount periods) {}
 private record Bucket(String region,String period,long total,long districts) {}
 public static final List<String> REGION_ORDER=List.of("서울","경기","인천","부산","대구","대전","광주","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주");
 private final JdbcClient jdbc;
 public DataReportController(JdbcClient jdbc){this.jdbc=jdbc;}
 @GetMapping("/api/data-report") public ResponseEntity<Report> report(){
  // One aggregate statement keeps all totals consistent during page-by-page collection.
  var buckets=jdbc.sql("""
   SELECT b.region,%s AS period_type,count(*) AS total,
    count(*) FILTER(WHERE b.region IN (:regions) AND %s IS NOT NULL) AS districts
   FROM benefit b WHERE b.active GROUP BY b.region,period_type
   """.formatted(ApplicationPeriod.SQL,RegionScope.SQL_DISTRICT)).param("regions",RegionScope.REGIONS)
   .query((r,n)->new Bucket(r.getString("region"),r.getString("period_type"),r.getLong("total"),r.getLong("districts"))).list();
  long total=buckets.stream().mapToLong(Bucket::total).sum();
  long nationwide=buckets.stream().filter(b->b.region().equals("전국")).mapToLong(Bucket::total).sum();
  var regions=REGION_ORDER.stream().map(region->new RegionCount(region,
   buckets.stream().filter(b->b.region().equals(region)).mapToLong(Bucket::total).sum(),
   buckets.stream().filter(b->b.region().equals(region)).mapToLong(Bucket::districts).sum())).toList();
  var periods=new PeriodCount(periodTotal(buckets,"dated"),periodTotal(buckets,"ongoing"),periodTotal(buckets,"guidance"));
  long known=regions.stream().mapToLong(RegionCount::total).sum();
  var coverage=new Coverage(total,nationwide,known,regions.stream().mapToLong(RegionCount::districtKnown).sum(),total-nationwide-known,periods.dated());
  var history=jdbc.sql("""
   SELECT CASE WHEN r.status='RUNNING' AND NOT EXISTS
    (SELECT 1 FROM collection_lock l WHERE l.owner_id=r.id AND l.lease_until>now())
    THEN 'INTERRUPTED' ELSE r.status END AS public_status,
    r.started_at,r.finished_at,r.fetched_count,r.rejected_count
   FROM collection_run r ORDER BY r.started_at DESC,r.id DESC LIMIT 10
   """).query((r,n)->new History(safeStatus(r.getString("public_status")),instant(r.getObject("started_at",OffsetDateTime.class)),instant(r.getObject("finished_at",OffsetDateTime.class)),r.getInt("fetched_count"),r.getInt("rejected_count"))).list();
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Report(false,Instant.now(),coverage,history,regions,periods));
 }
 private static long periodTotal(List<Bucket> buckets,String period){return buckets.stream().filter(b->b.period().equals(period)).mapToLong(Bucket::total).sum();}
 private static Instant instant(OffsetDateTime date){return date==null?null:date.toInstant();}
 private static String safeStatus(String status){return List.of("RUNNING","INTERRUPTED","SUCCESS","PARTIAL","FAILED").contains(status)?status:"UNKNOWN";}
}
