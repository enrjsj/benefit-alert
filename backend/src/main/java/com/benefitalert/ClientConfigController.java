package com.benefitalert;
import com.benefitalert.account.SupabaseIdentity;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController
public class ClientConfigController {
 private final SupabaseIdentity identity; private final Environment env;
 public ClientConfigController(SupabaseIdentity identity,Environment env) {this.identity=identity;this.env=env;}
 @GetMapping("/api/client-config") public ResponseEntity<?> config() {
  boolean enabled=identity.enabled() && env.acceptsProfiles(Profiles.of("prod"));
  return ResponseEntity.ok().header("Cache-Control","no-store").body(Map.of("authEnabled",enabled,"supabaseUrl",enabled?identity.url():"","publishableKey",enabled?identity.publishableKey():""));
 }
}
