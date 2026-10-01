package com.benefitalert;
import java.time.LocalDate;
/** 날짜가 없는 공고는 상시 또는 별도 확인 대상으로 표시합니다. */
public record Benefit(String id,String title,String organization,String region,String category,
 String summary,String eligibility,String support,String applicationMethod,
 LocalDate deadline,String periodLabel,String sourceUrl) {}
