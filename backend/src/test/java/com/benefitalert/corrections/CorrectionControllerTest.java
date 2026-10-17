package com.benefitalert.corrections;
import com.benefitalert.account.SupabaseIdentity;
import com.benefitalert.PrivateResponseFilter;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class CorrectionControllerTest {
 @Test void anonymousAccessNeverReachesCorrectionData() throws Exception {
  var service=mock(CorrectionService.class);
  var mvc=MockMvcBuilders.standaloneSetup(new CorrectionController(new SupabaseIdentity("http://localhost",""),service)).addFilters(new PrivateResponseFilter()).build();
  mvc.perform(get("/api/account/corrections/access")).andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control","no-store"));
  mvc.perform(get("/api/account/corrections?all=true")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/account/corrections").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
  mvc.perform(put("/api/account/corrections/1").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/account/corrections/1/history")).andExpect(status().isUnauthorized()).andExpect(header().string("Cache-Control","no-store"));
  verifyNoInteractions(service);
 }
}
