package com.benefitalert;

import com.benefitalert.collection.Gov24Mapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

class ProviderRegionTest {
 private static final Map<String,List<String>> LOCALS=Map.of(
  "광주",List.of("광산구","남구","동구","북구","서구"),
  "전남",List.of("강진군","고흥군","곡성군","광양시","구례군","나주시","담양군","목포시","무안군","보성군","순천시","신안군","여수시","영광군","영암군","완도군","장성군","장흥군","진도군","함평군","해남군","화순군"));
 private ObjectNode row(String id,String org) {
  return new ObjectMapper().createObjectNode().put("서비스ID",id).put("서비스명","지역 지원")
   .put("소관기관명",org).put("소관기관유형","시군구");
 }
 @Test void mergedLocalProvidersKeepGeographicFiltersAndOriginalNames() {
  LOCALS.forEach((region,locals)->locals.forEach(local->{
   String org="전남광주통합특별시 "+local;
   var benefit=Gov24Mapper.map(row(local,org));
   assertEquals(region,benefit.region());assertEquals(local,benefit.district());assertEquals(org,benefit.organization());
  }));
  var spaced=Gov24Mapper.map(row("space","  전남광주통합특별시\t 영암군  "));
  assertEquals("전남",spaced.region());assertEquals("영암군",spaced.district());
 }
 @Test void ambiguousAndUnrelatedProvidersAreNotAssignedToEitherArea() {
  for(String org:List.of("전남광주통합특별시","전남광주통합특별시교육청","전남광주통합특별시광산구시설관리공단","전남광주통합특별시 없는구","전남광주통합특별시 광산구시설관리공단","전남광주통합특별시민지원센터 동구"))
   assertEquals("지역확인",Gov24Mapper.map(row("unknown",org)).region(),org);
  assertEquals("전국",Gov24Mapper.map(row("central","전남광주통합특별시 동구").put("소관기관유형","중앙행정기관")).region());
  assertEquals("경기",Gov24Mapper.map(row("gyeonggi","경기도 광주시")).region());
  assertEquals("부산",Gov24Mapper.map(row("busan","부산광역시 동구")).region());
 }
 @Test @EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
 void migrationRecoversExistingRowsAndDistrictSearchWithoutChangingSourceOrDates() {
  try(var db=new TestDatabase("3")) {
   LOCALS.forEach((region,locals)->locals.forEach(local->seed(db,local,"전남광주통합특별시 "+local,"gov24","지역확인","시군구")));
   seed(db,"space"," 전남광주통합특별시\t 영암군 ","gov24","지역확인","시군구");
   seed(db,"common","전남광주통합특별시","gov24","지역확인","광역자치단체");
   seed(db,"agency","전남광주통합특별시광산구시설관리공단","gov24","지역확인","공공기관");
   seed(db,"unknown","전남광주통합특별시 없는구","gov24","지역확인","시군구");
   seed(db,"manual","전남광주통합특별시 동구","manual","지역확인","시군구");
   seed(db,"central","전남광주통합특별시 동구","gov24","지역확인","중앙행정기관");
   seed(db,"classified","전남광주통합특별시 동구","gov24","전국","시군구");
   db.jdbc.sql("UPDATE benefit SET active=false WHERE id='space'").update();
   var before=db.jdbc.sql("SELECT id,organization,updated_at,source_payload,active FROM benefit ORDER BY id").query((r,n)->List.of(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getBoolean(5))).list();
   db.migrate();
   assertEquals(before,db.jdbc.sql("SELECT id,organization,updated_at,source_payload,active FROM benefit ORDER BY id").query((r,n)->List.of(r.getString(1),r.getString(2),r.getString(3),r.getString(4),r.getBoolean(5))).list());
   LOCALS.forEach((region,locals)->locals.forEach(local->assertEquals(region,db.jdbc.sql("SELECT region FROM benefit WHERE id=:id").param("id",local).query(String.class).single())));
   for(String id:List.of("common","agency","unknown","manual","central"))
    assertEquals("지역확인",db.jdbc.sql("SELECT region FROM benefit WHERE id=:id").param("id",id).query(String.class).single());
   assertEquals("전국",db.jdbc.sql("SELECT region FROM benefit WHERE id='classified'").query(String.class).single());
   assertEquals("전남",db.jdbc.sql("SELECT region FROM benefit WHERE id='space'").query(String.class).single());
   var repo=new PostgresBenefitRepository(db.jdbc);
   assertEquals(LOCALS.get("광주"),repo.districts("광주"));assertEquals(LOCALS.get("전남"),repo.districts("전남"));
   for(String[] filter:List.of(new String[]{"광주","동구"},new String[]{"전남","영암군"})) {
    var page=repo.search(new BenefitSearch("",filter[0],"전체",false,1,100,"default",null,null,filter[1]));
    assertEquals(1,page.total());assertEquals(filter[1],page.items().getFirst().district());
   }
   db.migrate(); // Repeat startup keeps the recovered data intact.
   assertEquals(5,repo.search(new BenefitSearch("","광주","전체",false,1,100,"default",null,null,"")).total());
  }
 }
 private void seed(TestDatabase db,String id,String org,String kind,String region,String type) {
  db.seed(id,region,"생활",20);
  db.jdbc.sql("UPDATE benefit SET organization=:org,source_kind=:kind,source_payload=CAST(:payload AS jsonb) WHERE id=:id")
   .param("org",org).param("kind",kind).param("payload",row(id,org).put("소관기관유형",type).toString()).param("id",id).update();
 }
}
