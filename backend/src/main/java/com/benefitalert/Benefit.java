package com.benefitalert;
import java.time.LocalDate;
/** 날짜가 없는 공고는 상시 또는 별도 확인 대상으로 표시합니다. */
public record Benefit(String id,String title,String organization,String region,String category,
 String summary,String eligibility,String support,String applicationMethod,
 LocalDate deadline,String periodLabel,String sourceUrl,String sourceKind,java.time.Instant updatedAt) {
 public Benefit(String id,String title,String organization,String region,String category,String summary,String eligibility,String support,String applicationMethod,LocalDate deadline,String periodLabel,String sourceUrl) {
  this(id,title,organization,region,category,summary,eligibility,support,applicationMethod,deadline,periodLabel,sourceUrl,null,null);
 }
 @com.fasterxml.jackson.annotation.JsonProperty public String district(){return RegionScope.district(organization);}
}
