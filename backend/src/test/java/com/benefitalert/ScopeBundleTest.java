package com.benefitalert;

import com.benefitalert.account.AccountService;
import com.benefitalert.collection.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

class ScopeBundleTest {
 @Test void reviewedProvidersRetainSourceAndNeverGuessUnknownInstitutions() {
  var mapper=new ObjectMapper();
  ProviderScopeV1.SCOPES.forEach((name,scope)->{
   var row=mapper.createObjectNode().put("서비스ID","test").put("서비스명","공고").put("소관기관명",name).put("소관기관유형","지방공기업");
   var b=Gov24Mapper.map(row);assertEquals(scope.region(),b.region());assertEquals(scope.district(),b.district());assertEquals(name,b.organization());
   assertEquals("전국",Gov24Mapper.map(row.put("소관기관유형","중앙행정기관")).region());
  });
  for(String org:List.of("한국장학재단","전남광주통합특별시","용산구시설관리공단 다른기관","알수없는재단")) {
   var row=mapper.createObjectNode().put("서비스ID","test").put("서비스명","공고").put("소관기관명",org);
   assertEquals("지역확인",Gov24Mapper.map(row).region());assertEquals("",RegionScope.district(org));
  }
 }
 @Test void conditionalPeriodsAreNotPromisedAsAlwaysOpen() {
  for(String period:List.of("상시신청","상시 신청","연중","연중\u00a0접수"," \t상시 신청\n")) assertEquals("ongoing",ApplicationPeriod.classify(null,period));
  for(String period:List.of("상시신청(예산 소진 시 종료)","상시신청 아님","접수기관 별 상이","신청불필요","매년 1월","","2027.1.1~")) assertEquals("guidance",ApplicationPeriod.classify(null,period));
  assertEquals("dated",ApplicationPeriod.classify(LocalDate.of(2020,1,1),"상시신청"));
 }
 @Test void bundledDistrictCatalogSupportsRegionValidation() throws Exception {
  var mapper=new ObjectMapper();
  var catalog=mapper.readTree(DistrictCatalog.class.getResourceAsStream("/district-options.json"));
  assertEquals(17,catalog.size());
  assertTrue(DistrictCatalog.contains("서울","강남구"));
  assertTrue(DistrictCatalog.contains("전남","영암군"));
  assertFalse(DistrictCatalog.contains("경기","강남구"));
  assertFalse(DistrictCatalog.contains("전체","강남구"));
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void migrationAndSqlDistrictAgreeAndPreserveOriginalRows() {
  try(var db=new TestDatabase("5")) {
   int index=0;
   for(var entry:ProviderScopeV1.SCOPES.entrySet()) {
    String id="r"+(index++);db.seed(id,"지역확인","생활",20);
    db.jdbc.sql("UPDATE benefit SET organization=:org,source_kind='gov24',source_payload='{\"소관기관유형\":\"지방공기업\"}' WHERE id=:id").param("org",entry.getKey()).param("id",id).update();
   }
   db.seed("manual","지역확인","생활",10);db.seed("central","지역확인","생활",10);db.seed("classified","전국","생활",10);
   db.jdbc.sql("UPDATE benefit SET organization='용산구시설관리공단' WHERE id IN ('manual','central','classified')").update();
   db.jdbc.sql("UPDATE benefit SET source_kind='gov24',source_payload='{\"소관기관유형\":\"중앙행정기관\"}' WHERE id='central'").update();
   db.jdbc.sql("UPDATE benefit SET source_kind='gov24' WHERE id='classified'").update();
   var before=db.jdbc.sql("SELECT id,organization,period_label,updated_at,active FROM benefit ORDER BY id").query((r,n)->List.of(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getBoolean(5))).list();
   UUID user=UUID.randomUUID();db.jdbc.sql("INSERT INTO member_profile(user_id,region) VALUES(:u,'서울')").param("u",user).update();
   db.migrate();
   assertEquals(before,db.jdbc.sql("SELECT id,organization,period_label,updated_at,active FROM benefit ORDER BY id").query((r,n)->List.of(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getBoolean(5))).list());
   var repo=new PostgresBenefitRepository(db.jdbc);
   for(var entry:ProviderScopeV1.SCOPES.entrySet()) {
    var b=db.jdbc.sql("SELECT * FROM benefit WHERE organization=:org AND id LIKE 'r%'").param("org",entry.getKey()).query(PostgresBenefitRepository.MAPPER).single();
    assertEquals(entry.getValue().region(),b.region());assertEquals(entry.getValue().district(),b.district());
    String sqlDistrict=db.jdbc.sql("SELECT coalesce("+RegionScope.SQL_DISTRICT+",'') FROM benefit b WHERE b.id=:id").param("id",b.id()).query(String.class).single();assertEquals(b.district(),sqlDistrict);
    assertTrue(repo.search(new BenefitSearch("",b.region(),"전체",false,1,100,"default",null,null,b.district())).items().stream().anyMatch(x->x.id().equals(b.id())));
   }
   assertEquals(2,db.jdbc.sql("SELECT count(*) FROM benefit WHERE region='지역확인'").query(Integer.class).single());
   assertEquals("",new AccountService(db.jdbc).preferences(user).district());
  }
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void periodSearchPartitionsDataAndCombinesWithStrictDistrictAndOpenFilter() {
  try(var db=new TestDatabase()) {
   for(String id:List.of("dated","expired","ongoing","guidance","conditional")) db.seed(id,"서울","생활",id.equals("expired")?-1:10);
   db.jdbc.sql("UPDATE benefit SET organization='서울특별시 은평구'").update();
   db.jdbc.sql("UPDATE benefit SET deadline=NULL,period_label=CASE id WHEN 'ongoing' THEN ' 상시 신청 ' WHEN 'conditional' THEN '상시(예산 소진까지)' ELSE '기관별 상이' END WHERE id NOT IN ('dated','expired')").update();
   var repo=new PostgresBenefitRepository(db.jdbc);
   for(var pair:Map.of("dated",2L,"ongoing",1L,"guidance",2L).entrySet()) {
    var page=repo.search(new BenefitSearch("","서울","전체",false,1,100,"default",null,null,"은평구",pair.getKey()));
    assertEquals(pair.getValue(),page.total());assertTrue(page.items().stream().allMatch(b->b.periodType().equals(pair.getKey())));
   }
   assertEquals(1,repo.search(new BenefitSearch("","서울","전체",true,1,100,"default",null,null,"은평구","dated")).total());
   assertEquals(0,repo.search(new BenefitSearch("","서울","전체",false,1,100,"default",null,null,"강남구","ongoing")).total());
  }
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void districtPreferencesIsolateAccountsPreserveLegacyAndFilterOldNotifications() {
  try(var db=new TestDatabase()) {
   for(String id:List.of("eunpyeong","gangnam","common","national","child","parent")) db.seed(id,id.equals("national")?"전국":List.of("child","parent").contains(id)?"경기":"서울","주거",3);
   db.jdbc.sql("UPDATE benefit SET organization=CASE id WHEN 'eunpyeong' THEN '서울특별시 은평구' WHEN 'gangnam' THEN '서울특별시 강남구' WHEN 'child' THEN '경기도 성남시 분당구' WHEN 'parent' THEN '경기도 성남시' ELSE '기관' END").update();
   var service=new AccountService(db.jdbc);UUID a=UUID.randomUUID(),b=UUID.randomUUID();
   service.update(a,new AccountService.Preferences("전체","전체",true,""));service.notifications(a);
   service.update(a,new AccountService.Preferences("서울","주거",true,"은평구"));
   assertEquals(List.of("eunpyeong"),service.notifications(a).stream().map(AccountService.Alert::benefitId).toList());
   service.update(a,new AccountService.Preferences("서울","생활",true));assertEquals("은평구",service.preferences(a).district());
   assertEquals("",service.preferences(b).district());
   assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.update(a,new AccountService.Preferences("서울","전체",true,"수원시")));
   assertThrows(org.springframework.web.server.ResponseStatusException.class,()->service.update(a,new AccountService.Preferences("전체","전체",true,"은평구")));
   service.update(a,new AccountService.Preferences("경기","전체",true));assertEquals("",service.preferences(a).district());
   service.update(a,new AccountService.Preferences("경기","전체",true,"성남시"));
   assertEquals(Set.of("child","parent"),new HashSet<>(service.notifications(a).stream().map(AccountService.Alert::benefitId).toList()));
   service.addSaved(a,List.of("gangnam"));assertTrue(service.notifications(a).stream().anyMatch(n->n.kind().equals("closing")&&n.benefitId().equals("gangnam")));
   service.update(a,new AccountService.Preferences("서울","전체",true,""));
   assertEquals(Set.of("eunpyeong","gangnam","common"),new HashSet<>(service.notifications(a).stream().filter(n->n.kind().equals("new")).map(AccountService.Alert::benefitId).toList()));
  }
 }
}
