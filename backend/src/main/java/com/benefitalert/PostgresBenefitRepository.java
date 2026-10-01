package com.benefitalert;
import java.util.List;
import java.time.LocalDate;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
/** 운영 모드에서는 PostgreSQL에 적재된 데이터만 조회합니다. */
@Repository @Profile("prod")
public class PostgresBenefitRepository implements BenefitRepository {
 private final JdbcClient jdbc;
 public PostgresBenefitRepository(JdbcClient jdbc) { this.jdbc=jdbc; }
 public List<Benefit> findAll() {
  return jdbc.sql("SELECT * FROM benefit ORDER BY updated_at DESC, id").query((rs,n)->new Benefit(
   rs.getString("id"),rs.getString("title"),rs.getString("organization"),rs.getString("region"),rs.getString("category"),
   rs.getString("summary"),rs.getString("eligibility"),rs.getString("support"),rs.getString("application_method"),
   rs.getObject("deadline",LocalDate.class),rs.getString("period_label"),rs.getString("source_url"))).list();
 }
}
