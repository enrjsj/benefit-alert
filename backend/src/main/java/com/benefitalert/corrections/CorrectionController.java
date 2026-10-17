package com.benefitalert.corrections;
import com.benefitalert.account.SupabaseIdentity;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/account/corrections") @Profile("prod")
public class CorrectionController {
 private final SupabaseIdentity identity;private final CorrectionService service;
 public CorrectionController(SupabaseIdentity identity,CorrectionService service){this.identity=identity;this.service=service;}
 @GetMapping("/access") public Map<String,Boolean> access(@RequestHeader(value="Authorization",required=false) String token){var user=identity.requirePrincipal(token);return Map.of("enabled",service.enabled(),"admin",service.admin(user));}
 @GetMapping public CorrectionService.Page list(@RequestHeader(value="Authorization",required=false) String token,@RequestParam(defaultValue="false") boolean all,@RequestParam(defaultValue="all") String status,@RequestParam(defaultValue="0") long before){return service.list(identity.requirePrincipal(token),all,status,before);}
 @PostMapping public CorrectionService.Entry create(@RequestHeader(value="Authorization",required=false) String token,@RequestBody CorrectionService.Input input){return service.create(identity.requireUser(token),input);}
 @PutMapping("/{id}") public CorrectionService.Entry update(@RequestHeader(value="Authorization",required=false) String token,@PathVariable long id,@RequestBody CorrectionService.Update input){return service.update(identity.requirePrincipal(token),id,input);}
}
