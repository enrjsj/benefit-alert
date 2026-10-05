package com.benefitalert.account;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Base64;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

/** User identity is verified with Supabase, never trusted from decoded JWT claims. */
@Component
public class SupabaseIdentity {
 private final String url, key;
 private final RestClient client;
 public SupabaseIdentity(@Value("${app.supabase.url:https://efmomntlstanyejcrjdl.supabase.co}") String url,
                         @Value("${SUPABASE_PUBLISHABLE_KEY:}") String key) {
  this.url=url.replaceAll("/+$", ""); this.key=publicKey(key) ? key : "";
  var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build());
  factory.setReadTimeout(Duration.ofSeconds(8));
  client=RestClient.builder().baseUrl(this.url+"/auth/v1").requestFactory(factory).build();
 }
 static boolean publicKey(String key) {
  if(key.startsWith("sb_publishable_") && key.length()>20) return true;
  try {
   String[] parts=key.split("\\.");
   return parts.length==3 && "anon".equals(new ObjectMapper().readTree(Base64.getUrlDecoder().decode(parts[1])).path("role").asText());
  } catch(Exception ignored) { return false; }
 }
 public boolean enabled() { return !key.isBlank(); }
 public String url() { return url; }
 public String publishableKey() { return key; }
 public UUID requireUser(String authorization) {
  if(authorization==null || !authorization.startsWith("Bearer ") || authorization.length()<20 || authorization.length()>8192)
   throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
  if(!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "회원 기능을 준비하고 있습니다.");
  try {
   JsonNode user=client.get().uri("/user").header("apikey",key).header("Authorization",authorization).retrieve().body(JsonNode.class);
   if(user==null || user.path("email_confirmed_at").isNull() || user.path("email_confirmed_at").isMissingNode())
    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "이메일 인증이 필요합니다.");
   return UUID.fromString(user.path("id").asText());
  } catch(RestClientResponseException e) {
   if(e.getStatusCode().value()==401 || e.getStatusCode().value()==403)
    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요.");
   throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "인증 서버 연결이 지연되고 있습니다.");
  } catch(ResponseStatusException e) { throw e; }
  catch(Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "인증 서버 연결이 지연되고 있습니다."); }
 }
}
