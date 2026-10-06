package com.benefitalert;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record BenefitSearch(String q, String region, String category, boolean openOnly,
                            int page, int size, String sort, List<String> ids, UUID savedBy, String district) {
 public BenefitSearch(String q,String region,String category,boolean openOnly,int page,int size,String sort,List<String> ids,UUID savedBy) {
  this(q,region,category,openOnly,page,size,sort,ids,savedBy,"");
 }
 public BenefitSearch {
  q = q == null ? "" : q.strip();
  region = region == null ? "전체" : region;
  category = category == null ? "전체" : category;
  district = district == null || district.equals("전체") ? "" : district.strip();
  sort = sort == null ? "default" : sort;
  if ((!district.isEmpty() && (!RegionScope.REGIONS.contains(region) || !district.matches("[가-힣]+[시군구](?: [가-힣]+구)?"))) || district.length()>50 || q.length() > 200 || region.length() > 100 || category.length() > 50
      || page < 1 || page > 10000 || size < 1 || size > 100
      || !List.of("default", "deadline", "title").contains(sort)
      || (ids != null && (ids.size() > 100 || ids.stream().anyMatch(id -> id == null || id.isBlank() || id.length() > 100)))) {
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "검색 조건을 확인해 주세요.");
  }
  if (ids != null) ids = List.copyOf(ids);
 }
 public int offset() { return (page - 1) * size; }
 public LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Seoul")); }
}
