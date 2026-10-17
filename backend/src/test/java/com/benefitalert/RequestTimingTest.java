package com.benefitalert;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc
class RequestTimingTest {
 @Autowired MockMvc mvc;
 @Test void timingPreservesJsonAndGeneratesUntrustedInputIndependentIds() throws Exception {
  var r=mvc.perform(get("/api/health").header("X-Request-ID","untrusted")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP")).andReturn().getResponse();
  assertNotNull(java.util.UUID.fromString(r.getHeader("X-Request-ID")));
  assertTrue(r.getHeader("Server-Timing").matches("app;dur=[0-9]+\\.[0-9]+"));
 }
 @Test void errorsRetainPrivateCachePolicyAndTiming() throws Exception {
  mvc.perform(get("/api/benefits").param("savedOnly","true")).andExpect(status().isServiceUnavailable()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().exists("Server-Timing"));
  assertEquals("account",RequestTimingFilter.route("/api/account/saved/private-user-id"));
  assertEquals("benefit_detail",RequestTimingFilter.route("/api/benefits/private-query-text"));
 }
}
