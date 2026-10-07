package com.benefitalert;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
/** 실제 Spring 컨텍스트에서 직렬화·프로필·HTTP 매핑을 검증합니다. */
@SpringBootTest @AutoConfigureMockMvc
class BenefitApiTest {
 @Autowired MockMvc mvc;
 @Test void demoList() throws Exception {mvc.perform(get("/api/benefits")).andExpect(status().isOk()).andExpect(jsonPath("$.demo").value(true)).andExpect(jsonPath("$.items.length()").value(4));}
 @Test void regionFilter() throws Exception {mvc.perform(get("/api/benefits").param("region","서울")).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));}
 @Test void invalidSearchAndPrivateConfiguration() throws Exception {
  mvc.perform(get("/api/benefits").param("page","0")).andExpect(status().isBadRequest());
  mvc.perform(get("/api/benefits").param("sort","id;drop table benefit")).andExpect(status().isBadRequest());
  mvc.perform(get("/api/client-config")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(jsonPath("$.authEnabled").value(false)).andExpect(jsonPath("$.publishableKey").value(""));
 }
 @Test void demoReportNeverLooksLikeLiveCollection() throws Exception {
  mvc.perform(get("/api/data-report")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
   .andExpect(jsonPath("$.demo").value(true)).andExpect(jsonPath("$.coverage.total").value(4)).andExpect(jsonPath("$.history.length()").value(0));
 }
 @Test void missingDetail() throws Exception {mvc.perform(get("/api/benefits/no-such-id")).andExpect(status().isNotFound());}
 @Test void personalListErrorsAreNeverCacheable() throws Exception {
  mvc.perform(get("/api/benefits").param("savedOnly","true"))
   .andExpect(status().isServiceUnavailable()).andExpect(header().string("Cache-Control","no-store")).andExpect(header().string("Vary","Authorization"));
  mvc.perform(get("/api/benefits").param("savedOnly","invalid"))
   .andExpect(status().isBadRequest()).andExpect(header().string("Cache-Control","no-store"));
 }
}
