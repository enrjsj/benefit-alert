package com.benefitalert;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
/** 전국 공고는 지역 선택 시 함께 포함하고, 기간 미정 공고는 제외하지 않습니다. */
@RestController @RequestMapping("/api")
public class BenefitController {
 private final BenefitRepository repository;
 private final Environment environment;
 public BenefitController(BenefitRepository repository,Environment environment) { this.repository=repository; this.environment=environment; }
 public record Result(List<Benefit> items,boolean demo) {}
 @GetMapping("/benefits")
 public Result list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="전체") String region,
  @RequestParam(defaultValue="전체") String category,@RequestParam(defaultValue="false") boolean openOnly) {
  String keyword=q.strip().toLowerCase(java.util.Locale.ROOT);
  LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
  return new Result(repository.findAll().stream()
   .filter(b->keyword.isEmpty()||(b.title()+" "+b.summary()).toLowerCase(java.util.Locale.ROOT).contains(keyword))
   .filter(b->region.equals("전체")||b.region().equals("전국")||b.region().equals(region))
   .filter(b->category.equals("전체")||b.category().equals(category))
   .filter(b->!openOnly||b.deadline()==null||!b.deadline().isBefore(today)).toList(),environment.acceptsProfiles(Profiles.of("demo")));
 }
 @GetMapping("/benefits/{id}") public Benefit detail(@PathVariable String id) {
  return repository.findAll().stream().filter(b->b.id().equals(id)).findFirst().orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
 }
 @GetMapping("/health") public java.util.Map<String,String> health() { return java.util.Map.of("status","UP"); }
}
