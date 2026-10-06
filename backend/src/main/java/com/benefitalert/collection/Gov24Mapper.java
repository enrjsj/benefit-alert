package com.benefitalert.collection;

import com.benefitalert.Benefit;
import com.benefitalert.RegionScope;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.LocalDate;
import java.util.Map;

/** Preserve ambiguous application periods; never invent an end date or eligibility. */
public final class Gov24Mapper {
 private Gov24Mapper() {}
 private static String value(JsonNode n,String... keys) {for(String k:keys) if(n.hasNonNull(k) && !n.get(k).asText().isBlank()) return n.get(k).asText().strip();return "";}
 public static Benefit map(JsonNode n) {
  String id=value(n,"서비스ID","SVC_ID"),title=value(n,"서비스명");
  if(id.isBlank() || id.length()>90 || title.isBlank()) throw new IllegalArgumentException("invalid_record");
  String org=value(n,"소관기관명"),period=value(n,"신청기한"),field=value(n,"서비스분야");
  String region="지역확인";
  String[][] names={{"서울","서울"},{"부산","부산"},{"대구","대구"},{"인천","인천"},{"광주","광주"},{"대전","대전"},{"울산","울산"},{"세종","세종"},{"경기","경기"},{"강원","강원"},{"충청북","충북"},{"충청남","충남"},{"전라북","전북"},{"전북","전북"},{"전라남","전남"},{"경상북","경북"},{"경상남","경남"},{"제주","제주"}};
  for(String[] pair:names) if(org.startsWith(pair[0])) {region=pair[1];break;}
  String mergedRegion=RegionScope.mergedProviderRegion(org);
  if(!mergedRegion.isEmpty()) region=mergedRegion;
  if(value(n,"소관기관유형").equals("중앙행정기관")) region="전국";
  String category="기타";
  if(field.contains("주거") || field.contains("자립")) category="주거";
  else if(field.contains("고용") || field.contains("창업") || field.contains("일자리")) category="취업";
  else if(field.contains("생활") || field.contains("안정")) category="생활";
  else if(field.contains("임신") || field.contains("출산") || field.contains("보육") || field.contains("돌봄")) category="가족";
  else if(field.contains("교육")) category="교육";
  else if(field.contains("의료") || field.contains("건강")) category="건강";
  else if(field.contains("문화")) category="문화";
  LocalDate deadline=null;
  // Only whole, absolute date ranges (or one absolute date) can establish a deadline.
  if(period.matches("\\d{4}-\\d{2}-\\d{2}(\\s*[~∼]\\s*\\d{4}-\\d{2}-\\d{2})?")) {
   try {deadline=LocalDate.parse(period.substring(period.length()-10));} catch(Exception ignored) {}
  }
  String url=value(n,"상세조회URL");
  try {var uri=URI.create(url);if(!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost()==null || uri.getUserInfo()!=null) url="";} catch(Exception e) {url="";}
  if(url.isBlank()) url="https://www.gov.kr/portal/rcvfvrSvc/dtlEx/"+java.net.URLEncoder.encode(id,java.nio.charset.StandardCharsets.UTF_8);
  return new Benefit("gov24-"+id,title,org,region,category,value(n,"서비스목적요약","서비스목적"),fallback(value(n,"지원대상")),fallback(value(n,"지원내용")),fallback(value(n,"신청방법")),deadline,fallback(period),url);
 }
 private static String fallback(String s) {return s.isBlank()?"공식 안내에서 확인해 주세요.":s;}
}
