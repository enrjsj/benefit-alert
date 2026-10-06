package com.benefitalert;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class RegionScopeTest {
 @Test void scopesAreAnchoredToAdministrativeProviders(){
  assertEquals("강남구",RegionScope.district("서울특별시 강남구"));
  assertEquals("수원시 영통구",RegionScope.district(" 경기도  수원시 영통구 "));
  assertEquals("고양시",RegionScope.district("경기도 고양시 상하수도사업소"));
  assertEquals("진안군",RegionScope.district("전북특별자치도 진안군"));
  assertEquals("",RegionScope.district("광주시 지원센터"));
  assertEquals("",RegionScope.district("경기도교육청"));
 }
 @Test void missingProvinceAndUnsafeDistrictAreRejected(){
  assertThrows(ResponseStatusException.class,()->search("전체","강남구"));
  assertThrows(ResponseStatusException.class,()->search("없는지역","강남구"));
  assertThrows(ResponseStatusException.class,()->search("서울","강남%"));
  assertThrows(ResponseStatusException.class,()->search("서울","강남구 OR 1=1"));
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void postgresDistrictSearchIncludesCommonScopesAndExcludesOtherDistricts() throws Exception {try(var db=new TestDatabase()){
  seed(db,"national","전국","중앙기관");seed(db,"province","서울","서울특별시");
  seed(db,"gangnam","서울","서울특별시 강남구");seed(db,"songpa","서울","서울특별시 송파구");
  seed(db,"school","서울","서울특별시교육청");
  seed(db,"suwon","경기","경기도 수원시");seed(db,"yeongtong","경기","경기도 수원시 영통구");seed(db,"paldal","경기","경기도 수원시 팔달구");
  var repo=new PostgresBenefitRepository(db.jdbc);
  assertEquals(8,repo.search(search("전체","")).total());
  assertEquals(Set.of("province","school","gangnam","songpa"),ids(repo.search(search("서울",""))));
  assertEquals(Set.of("province","school","gangnam"),ids(repo.search(search("서울","강남구"))));
  assertEquals(List.of("강남구","송파구"),repo.districts("서울"));
  assertEquals(List.of("수원시","수원시 영통구","수원시 팔달구"),repo.districts("경기"));
  assertEquals(Set.of("suwon","yeongtong"),ids(repo.search(search("경기","수원시 영통구"))));
  assertEquals(Set.of("suwon","yeongtong","paldal"),ids(repo.search(search("경기","수원시"))));
  var rows=repo.findAll();BenefitRepository memory=()->rows;
  assertEquals(ids(repo.search(search("경기","수원시 영통구"))),ids(memory.search(search("경기","수원시 영통구"))));
  assertEquals(0,repo.search(new BenefitSearch("","서울","전체",false,1,12,"default",List.of("songpa"),null,"강남구")).total());
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new BenefitController(repo,new MockEnvironment())).build();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/benefits").param("region","서울").param("district","강남구"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.total").value(3));
  assertTrue(new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(repo.findById("gangnam").get()).contains("\"district\":\"강남구\""));
 }}
 private BenefitSearch search(String region,String district){return new BenefitSearch("",region,"전체",false,1,100,"default",null,null,district);}
 private Set<String> ids(BenefitPage page){return new HashSet<>(page.items().stream().map(Benefit::id).toList());}
 private void seed(TestDatabase db,String id,String region,String provider){db.seed(id,region,"생활",20);db.jdbc.sql("UPDATE benefit SET organization=:provider WHERE id=:id").param("provider",provider).param("id",id).update();}
}
