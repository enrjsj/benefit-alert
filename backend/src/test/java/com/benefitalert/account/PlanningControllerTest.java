package com.benefitalert.account;

import com.benefitalert.PrivateResponseFilter;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PlanningControllerTest {
 @Test void unauthenticatedRequestsAreRejectedWithoutAccessingData() throws Exception {
  var service=mock(PlanningService.class);
  var identity=new SupabaseIdentity("http://localhost","");
  var mvc=MockMvcBuilders.standaloneSetup(new PlanningController(identity,service)).addFilters(new PrivateResponseFilter()).build();
  mvc.perform(get("/api/account/planning")).andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control","no-store"));
  mvc.perform(put("/api/account/planning").contentType("application/json").content("{\"revision\":0,\"data\":{\"version\":1,\"compareIds\":[],\"checklists\":{}}}"))
    .andExpect(status().isUnauthorized());
  mvc.perform(post("/api/account/planning/import").contentType("application/json").content("{\"version\":1,\"compareIds\":[],\"checklists\":{}}"))
    .andExpect(status().isUnauthorized());
  verifyNoInteractions(service);
 }
 @Test void authenticatedRoutesUseVerifiedIdentityAndReturnConflicts() throws Exception {
  var service=mock(PlanningService.class);var identity=mock(SupabaseIdentity.class);UUID owner=UUID.randomUUID();
  when(identity.requireUser("Bearer verified")).thenReturn(owner);
  when(service.get(owner)).thenReturn(new PlanningService.Snapshot(0,PlanningService.empty()));
  when(service.save(eq(owner),any())).thenThrow(new ResponseStatusException(HttpStatus.CONFLICT));
  when(service.importData(eq(owner),any())).thenReturn(new PlanningService.Snapshot(1,PlanningService.empty()));
  var mvc=MockMvcBuilders.standaloneSetup(new PlanningController(identity,service)).addFilters(new PrivateResponseFilter()).build();
  mvc.perform(get("/api/account/planning").header("Authorization","Bearer verified"))
   .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.revision").value(0));
  mvc.perform(put("/api/account/planning").header("Authorization","Bearer verified").contentType("application/json")
   .content("{\"revision\":0,\"data\":{\"version\":1,\"compareIds\":[],\"checklists\":{}}}"))
   .andExpect(status().isConflict());
  mvc.perform(post("/api/account/planning/import").header("Authorization","Bearer verified").contentType("application/json")
   .content("{\"version\":1,\"compareIds\":[],\"checklists\":{}}"))
   .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(1));
  // Preserve omission so the service can distinguish legacy requests from an explicit clear.
  verify(service).importData(owner,new PlanningService.Data(1,java.util.List.of(),java.util.Map.of(),null));
 }
}
