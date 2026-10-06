package com.benefitalert.account;

import com.benefitalert.PrivateResponseFilter;
import com.benefitalert.TestDatabase;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP identity verification + MVC serialization + isolated PostgreSQL persistence. */
@EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
class AccountFlowIntegrationTest {
 @Test void authenticatedAccountJourneyPreservesOwnershipAndRevision() throws Exception {
  UUID alice=UUID.randomUUID(),bob=UUID.randomUUID();
  var upstream=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
  upstream.createContext("/auth/v1/user",e->{
   String token=e.getRequestHeaders().getFirst("Authorization");
   UUID user="Bearer alice-integration-token".equals(token)?alice:"Bearer bob-integration-token".equals(token)?bob:null;
   byte[] bytes=(user==null?"{}":"{\"id\":\""+user+"\",\"email_confirmed_at\":\"2026-01-01\"}").getBytes(StandardCharsets.UTF_8);
   e.getResponseHeaders().set("Content-Type","application/json");e.sendResponseHeaders(user==null?401:200,bytes.length);e.getResponseBody().write(bytes);e.close();
  });upstream.start();
  try(var db=new TestDatabase()) {
   db.seed("flow-benefit","서울","주거",3);
   var identity=new SupabaseIdentity("http://127.0.0.1:"+upstream.getAddress().getPort(),"sb_publishable_integration_test");
   var mvc=MockMvcBuilders.standaloneSetup(new AccountController(identity,new AccountService(db.jdbc)),new PlanningController(identity,new PlanningService(db.jdbc,new ObjectMapper())))
     .addFilters(new PrivateResponseFilter()).build();
   String a="Bearer alice-integration-token",b="Bearer bob-integration-token";
   mvc.perform(put("/api/account/profile").header("Authorization",a).contentType("application/json")
    .content("{\"region\":\"서울\",\"category\":\"주거\",\"notificationsEnabled\":true}"))
    .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
   mvc.perform(post("/api/account/saved").header("Authorization",a).contentType("application/json").content("{\"ids\":[\"flow-benefit\"]}"))
    .andExpect(status().isOk()).andExpect(jsonPath("$[0]").value("flow-benefit"));
   mvc.perform(get("/api/account/saved").header("Authorization",b)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
   mvc.perform(delete("/api/account/saved/flow-benefit").header("Authorization",b)).andExpect(status().isOk());
   mvc.perform(get("/api/account/saved").header("Authorization",a)).andExpect(jsonPath("$.length()").value(1));
   mvc.perform(get("/api/account/notifications").header("Authorization",a)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
   String data="{\"version\":1,\"compareIds\":[\"flow-benefit\"],\"checklists\":{},\"applications\":{\"flow-benefit\":{\"status\":\"submitted\",\"note\":\"개인 메모\"}}}";
   mvc.perform(put("/api/account/planning").header("Authorization",a).contentType("application/json").content("{\"revision\":0,\"data\":"+data+"}"))
    .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
   mvc.perform(get("/api/account/planning").header("Authorization",a)).andExpect(jsonPath("$.data.applications.flow-benefit.note").value("개인 메모"));
   mvc.perform(get("/api/account/planning").header("Authorization",b)).andExpect(jsonPath("$.data.applications").isEmpty());
   mvc.perform(put("/api/account/planning").header("Authorization",a).contentType("application/json").content("{\"revision\":0,\"data\":"+data+"}"))
    .andExpect(status().isConflict()).andExpect(header().string("Cache-Control","no-store"));
   mvc.perform(post("/api/account/planning/import").header("Authorization",a).contentType("application/json").content(data.replace("개인 메모","충돌 메모")))
    .andExpect(status().isUnprocessableEntity());
   mvc.perform(get("/api/account/planning").header("Authorization",a)).andExpect(jsonPath("$.revision").value(1)).andExpect(jsonPath("$.data.applications.flow-benefit.note").value("개인 메모"));
   mvc.perform(get("/api/account/planning").header("Authorization","Bearer invalid-integration-token")).andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control","no-store"));
   mvc.perform(get("/api/account/planning")).andExpect(status().isUnauthorized());
  } finally {upstream.stop(0);}
 }
}
