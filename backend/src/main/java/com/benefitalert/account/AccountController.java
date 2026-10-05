package com.benefitalert.account;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/account") @Profile("prod")
public class AccountController {
 private final SupabaseIdentity identity; private final AccountService accounts;
 public AccountController(SupabaseIdentity identity,AccountService accounts) {this.identity=identity;this.accounts=accounts;}
 public record SavedInput(List<String> ids) {}
 private <T> ResponseEntity<T> privateResponse(T value) { return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value); }
 @GetMapping("/profile") public ResponseEntity<AccountService.Preferences> profile(@RequestHeader(value="Authorization",required=false) String token) { return privateResponse(accounts.preferences(identity.requireUser(token))); }
 @PutMapping("/profile") public ResponseEntity<AccountService.Preferences> profile(@RequestHeader(value="Authorization",required=false) String token,@RequestBody AccountService.Preferences p) { return privateResponse(accounts.update(identity.requireUser(token),p)); }
 @GetMapping("/saved") public ResponseEntity<List<String>> saved(@RequestHeader(value="Authorization",required=false) String token) {return privateResponse(accounts.saved(identity.requireUser(token)));}
 @PostMapping("/saved") public ResponseEntity<List<String>> save(@RequestHeader(value="Authorization",required=false) String token,@RequestBody SavedInput input) {return privateResponse(accounts.addSaved(identity.requireUser(token),input.ids()));}
 @DeleteMapping("/saved/{id}") public ResponseEntity<List<String>> remove(@RequestHeader(value="Authorization",required=false) String token,@PathVariable String id) {return privateResponse(accounts.removeSaved(identity.requireUser(token),id));}
 @GetMapping("/notifications") public ResponseEntity<List<AccountService.Alert>> notifications(@RequestHeader(value="Authorization",required=false) String token) {return privateResponse(accounts.notifications(identity.requireUser(token)));}
 @PutMapping("/notifications/{id}/read") public ResponseEntity<Void> read(@RequestHeader(value="Authorization",required=false) String token,@PathVariable long id) {accounts.read(identity.requireUser(token),id);return ResponseEntity.noContent().header("Cache-Control","no-store").build();}
}
