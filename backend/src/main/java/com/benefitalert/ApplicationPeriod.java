package com.benefitalert;
import java.time.LocalDate;
import java.util.Set;
/** Classifies exact unconditional labels only; conditional/relative wording stays in guidance. */
public final class ApplicationPeriod {
 private ApplicationPeriod() {}
 private static final Set<String> ONGOING=Set.of("상시","상시신청","상시접수","연중","연중신청","연중접수");
 public static String classify(LocalDate deadline,String label) {
  if(deadline!=null) return "dated";
  return label!=null && ONGOING.contains(label.replaceAll("[\\s\u00a0]+",""))?"ongoing":"guidance";
 }
 public static final String SQL="CASE WHEN b.deadline IS NOT NULL THEN 'dated' WHEN regexp_replace(b.period_label,'[[:space:] ]+','','g') IN ('상시','상시신청','상시접수','연중','연중신청','연중접수') THEN 'ongoing' ELSE 'guidance' END";
}
