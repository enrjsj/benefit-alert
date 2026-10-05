package com.benefitalert.collection;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
@RestController @Profile("prod")
public class DataStatusController {
 private final JdbcClient jdbc;private final Gov24Collector collector;
 public DataStatusController(JdbcClient jdbc,Gov24Collector collector){this.jdbc=jdbc;this.collector=collector;}
 @GetMapping("/api/data-status") public Map<String,Object> status(){
  Map<String,Object> result=new LinkedHashMap<>();result.put("configured",collector.enabled());
  result.put("latest",jdbc.sql("SELECT status,started_at,finished_at,fetched_count FROM collection_run ORDER BY started_at DESC LIMIT 1").query((r,n)->{Map<String,Object> m=new LinkedHashMap<>();m.put("status",r.getString(1));m.put("startedAt",r.getString(2));m.put("finishedAt",r.getString(3));m.put("fetchedCount",r.getInt(4));return m;}).optional().orElse(null));
  return result;
 }
}
