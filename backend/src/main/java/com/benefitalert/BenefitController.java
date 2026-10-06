package com.benefitalert;
import com.benefitalert.account.SupabaseIdentity;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api")
public class BenefitController {
 private final BenefitRepository repository;
 private final Environment environment;
 private final SupabaseIdentity identity;
 @Autowired public BenefitController(BenefitRepository repository,Environment environment,SupabaseIdentity identity) {this.repository=repository;this.environment=environment;this.identity=identity;}
 BenefitController(BenefitRepository repository,Environment environment) {this(repository,environment,null);}
 public record Result(List<Benefit> items,boolean demo,long total,int page,int size,long totalPages) {}
 public Result list(String q,String region,String category,boolean openOnly) {return list(q,region,category,openOnly,1,12,"default",null,false,null);}
 public Result list(String q,String region,String category,boolean openOnly,int page,int size,String sort,List<String> ids,boolean savedOnly,String token) {
  return list(q,region,category,openOnly,page,size,sort,ids,savedOnly,token,"");
 }
 @GetMapping("/regions/districts") public List<String> districts(@RequestParam String region) {
  if(region.length()>100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  return repository.districts(region);
 }
 @GetMapping("/benefits")
 public Result list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="전체") String region,
  @RequestParam(defaultValue="전체") String category,@RequestParam(defaultValue="false") boolean openOnly,
  @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="12") int size,@RequestParam(defaultValue="default") String sort,
  @RequestParam(required=false) List<String> ids,@RequestParam(defaultValue="false") boolean savedOnly,
  @RequestHeader(value="Authorization",required=false) String token,@RequestParam(defaultValue="") String district) {
  if(savedOnly && !environment.acceptsProfiles(Profiles.of("prod"))) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
  var user=savedOnly?identity.requireUser(token):null;
  var result=repository.search(new BenefitSearch(q,region,category,openOnly,page,size,sort,ids,user,district));
  return new Result(result.items(),environment.acceptsProfiles(Profiles.of("demo")),result.total(),page,size,(result.total()+size-1)/size);
 }
 @GetMapping("/benefits/{id}") public Benefit detail(@PathVariable String id) {return repository.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
 @GetMapping("/health") public java.util.Map<String,String> health() {return java.util.Map.of("status","UP");}
}
