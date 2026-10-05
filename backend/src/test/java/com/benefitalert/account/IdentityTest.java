package com.benefitalert.account;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class IdentityTest {
 @Test void noKeyDisablesAuthAndSecretKeysAreRejected(){
  assertFalse(new SupabaseIdentity("https://example.com","").enabled());assertFalse(SupabaseIdentity.publicKey("sb_secret_do_not_publish_12345"));
  String secret="e30."+java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"role\":\"service_role\"}".getBytes())+".signature";
  assertFalse(SupabaseIdentity.publicKey(secret));
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->new SupabaseIdentity("https://example.com","").requireUser(null));
 }
 @Test void verifiesTokenWithUpstreamAndRejectsUnconfirmedUsers() throws Exception {
  var server=com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1",0),0);var user=java.util.UUID.randomUUID();
  server.createContext("/auth/v1/user",e->{String token=e.getRequestHeaders().getFirst("Authorization");String body=token.equals("Bearer confirmed-test-token")?"{\"id\":\""+user+"\",\"email_confirmed_at\":\"2026-01-01\"}":"{\"id\":\""+user+"\",\"email_confirmed_at\":null}";byte[] bytes=body.getBytes();e.getResponseHeaders().set("Content-Type","application/json");e.sendResponseHeaders(200,bytes.length);e.getResponseBody().write(bytes);e.close();});server.start();
  try {var identity=new SupabaseIdentity("http://127.0.0.1:"+server.getAddress().getPort(),"sb_publishable_test_only_key");assertEquals(user,identity.requireUser("Bearer confirmed-test-token"));assertThrows(org.springframework.web.server.ResponseStatusException.class,()->identity.requireUser("Bearer unconfirmed-test-token"));} finally {server.stop(0);}
 }
}
