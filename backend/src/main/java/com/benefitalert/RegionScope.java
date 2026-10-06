package com.benefitalert;

import java.util.*;
import java.util.regex.Pattern;

/** Infer administrative scope from the provider name, never from eligibility text. */
public final class RegionScope {
 private RegionScope() {}
 public static final Set<String> REGIONS=Set.of("서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주");
 private static final String PROVINCES="서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도";
 private static final String DISTRICT="[가-힣]+[시군구](?: [가-힣]+구)?";
 private static final Pattern PROVIDER=Pattern.compile("^(?:"+PROVINCES+") ("+DISTRICT+")(?: |$)");
 public static final String SQL_DISTRICT="substring(regexp_replace(btrim(b.organization),'[[:space:]]+',' ','g') from '^(?:"+PROVINCES+") ("+DISTRICT+")(?: |$)')";
 public static String district(String organization) {
  var match=PROVIDER.matcher(organization.strip().replaceAll("\\s+"," "));
  return match.find()?match.group(1):"";
 }
 public static boolean matches(Benefit b,String district) {
  if(district.isEmpty()) return true;
  if(b.region().equals("전국")) return false;
  String provider=district(b.organization());
  return provider.isEmpty() || provider.equals(district) || provider.startsWith(district+" ") || district.startsWith(provider+" ");
 }
 public static List<String> options(Collection<String> districts) {
  var options=new TreeSet<String>();
  for(String district:districts) if(district!=null && !district.isBlank()) {
   options.add(district);options.add(district.split(" ",2)[0]);
  }
  return List.copyOf(options);
 }
}
