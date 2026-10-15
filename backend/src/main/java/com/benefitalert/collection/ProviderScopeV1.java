package com.benefitalert.collection;
import java.util.Map;
/** Exact, reviewed provider names. Frozen because Flyway V6 uses this mapping. */
public final class ProviderScopeV1 {
 private ProviderScopeV1() {}
 public record Scope(String region,String district) {}
 public static final Map<String,Scope> SCOPES=Map.ofEntries(
  Map.entry("용산구시설관리공단",new Scope("서울","용산구")),
  Map.entry("광진구시설관리공단",new Scope("서울","광진구")),
  Map.entry("동대문구시설관리공단",new Scope("서울","동대문구")),
  Map.entry("강북구도시관리공단",new Scope("서울","강북구")),
  Map.entry("재단법인영등포구미래교육재단",new Scope("서울","영등포구")),
  Map.entry("재단법인영등포문화재단",new Scope("서울","영등포구")),
  Map.entry("고양산업진흥원",new Scope("경기","고양시")),
  Map.entry("고양도시관리공사",new Scope("경기","고양시")),
  Map.entry("고양문화재단",new Scope("경기","고양시")),
  Map.entry("시흥도시공사",new Scope("경기","시흥시")),
  Map.entry("재단법인안산인재육성재단",new Scope("경기","안산시")),
  Map.entry("오산시시설관리공단",new Scope("경기","오산시")),
  Map.entry("안성시시설관리공단",new Scope("경기","안성시")),
  Map.entry("남양주시복지재단",new Scope("경기","남양주시")),
  Map.entry("여주도시공사",new Scope("경기","여주시")),
  Map.entry("포천도시공사",new Scope("경기","포천시")),
  Map.entry("(재)부천시여성청소년재단",new Scope("경기","부천시")),
  Map.entry("달성군시설관리공단",new Scope("대구","달성군")),
  Map.entry("(재)달성교육재단",new Scope("대구","달성군")),
  Map.entry("기장군도시관리공단",new Scope("부산","기장군")),
  Map.entry("울주군시설관리공단",new Scope("울산","울주군")),
  Map.entry("청주도시공사",new Scope("충북","청주시")),
  Map.entry("천안도시공사",new Scope("충남","천안시")),
  Map.entry("아산시시설관리공단",new Scope("충남","아산시")),
  Map.entry("보령시시설관리공단",new Scope("충남","보령시")),
  Map.entry("동해시시설관리공단",new Scope("강원","동해시")),
  Map.entry("평창군시설관리공단",new Scope("강원","평창군")),
  Map.entry("재단법인목포인재육성재단",new Scope("전남","목포시")),
  Map.entry("재단법인전북특별자치도평생교육장학진흥원",new Scope("전북","")),
  Map.entry("재단법인전북특별자치도콘텐츠융합진흥원",new Scope("전북","")),
  Map.entry("(재)충북문화재단",new Scope("충북","")),
  Map.entry("전남신용보증재단",new Scope("전남","")),
  Map.entry("재단법인경기도시장상권진흥원",new Scope("경기","")),
  Map.entry("재단법인세종특별자치시인재육성평생교육진흥원",new Scope("세종","")),
  Map.entry("재단법인전남인재평생교육진흥원",new Scope("전남","")),
  Map.entry("(재)인천인재평생교육진흥원",new Scope("인천","")),
  Map.entry("재단법인경상북도인재평생교육재단",new Scope("경북","")),
  Map.entry("재단법인충남경제진흥원",new Scope("충남","")));
 public static Scope find(String organization) { return SCOPES.get(organization.strip().replaceAll("\\s+"," ")); }
 public static String districtSql(String expression) {
  StringBuilder sql=new StringBuilder("CASE ").append(expression);
  SCOPES.entrySet().stream().sorted(Map.Entry.comparingByKey()).filter(e->!e.getValue().district().isEmpty()).forEach(e->
   sql.append(" WHEN '").append(e.getKey().replace("'","''")).append("' THEN '").append(e.getValue().district()).append("'"));
  return sql.append(" ELSE NULL END").toString();
 }
}
