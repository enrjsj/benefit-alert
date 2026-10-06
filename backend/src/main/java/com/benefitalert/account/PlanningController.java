package com.benefitalert.account;

import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/account/planning") @Profile("prod")
public class PlanningController {
 private final SupabaseIdentity identity;
 private final PlanningService planning;
 public PlanningController(SupabaseIdentity identity,PlanningService planning){this.identity=identity;this.planning=planning;}
 private ResponseEntity<PlanningService.Snapshot> response(PlanningService.Snapshot data){return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(data);}
 @GetMapping public ResponseEntity<PlanningService.Snapshot> get(@RequestHeader(value="Authorization",required=false) String token){return response(planning.get(identity.requireUser(token)));}
 @PutMapping public ResponseEntity<PlanningService.Snapshot> save(@RequestHeader(value="Authorization",required=false) String token,@RequestBody PlanningService.Update input){return response(planning.save(identity.requireUser(token),input));}
 @PostMapping("/import") public ResponseEntity<PlanningService.Snapshot> importData(@RequestHeader(value="Authorization",required=false) String token,@RequestBody PlanningService.Data data){return response(planning.importData(identity.requireUser(token),data));}
}
