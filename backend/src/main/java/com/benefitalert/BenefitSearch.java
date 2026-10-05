package com.benefitalert;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record BenefitSearch(String q, String region, String category, boolean openOnly,
                            int page, int size, String sort, List<String> ids, UUID savedBy) {
 public BenefitSearch {
  q = q == null ? "" : q.strip();
  region = region == null ? "전체" : region;
  category = category == null ? "전체" : category;
  sort = sort == null ? "default" : sort;
  if (q.length() > 200 || region.length() > 100 || category.length() > 50
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
