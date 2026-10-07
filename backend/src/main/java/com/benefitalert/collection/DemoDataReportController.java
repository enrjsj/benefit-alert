package com.benefitalert.collection;

import com.benefitalert.BenefitRepository;
import com.benefitalert.RegionScope;
import java.time.Instant;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @Profile("demo")
public class DemoDataReportController {
 private final BenefitRepository repository;
 public DemoDataReportController(BenefitRepository repository){this.repository=repository;}
 @GetMapping("/api/data-report") public ResponseEntity<DataReportController.Report> report(){
  var items=repository.findAll();
  long nationwide=items.stream().filter(b->b.region().equals("전국")).count();
  long regions=items.stream().filter(b->RegionScope.REGIONS.contains(b.region())).count();
  long districts=items.stream().filter(b->RegionScope.REGIONS.contains(b.region()) && !b.district().isEmpty()).count();
  long deadlines=items.stream().filter(b->b.deadline()!=null).count();
  var coverage=new DataReportController.Coverage(items.size(),nationwide,regions,districts,items.size()-nationwide-regions,deadlines);
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new DataReportController.Report(true,Instant.now(),coverage,List.of()));
 }
}
