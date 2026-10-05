package com.benefitalert;
import java.time.LocalDate;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository @Profile("prod")
public class PostgresBenefitRepository implements BenefitRepository {
 public static final RowMapper<Benefit> MAPPER = (rs, n) -> new Benefit(
  rs.getString("id"), rs.getString("title"), rs.getString("organization"), rs.getString("region"), rs.getString("category"),
  rs.getString("summary"), rs.getString("eligibility"), rs.getString("support"), rs.getString("application_method"),
  rs.getObject("deadline", LocalDate.class), rs.getString("period_label"), rs.getString("source_url"));
 private final JdbcClient jdbc;
 public PostgresBenefitRepository(JdbcClient jdbc) { this.jdbc = jdbc; }
 public List<Benefit> findAll() { return jdbc.sql("SELECT * FROM benefit WHERE active ORDER BY updated_at DESC, id LIMIT 100").query(MAPPER).list(); }
 public Optional<Benefit> findById(String id) { return jdbc.sql("SELECT * FROM benefit WHERE active AND id=:id").param("id", id).query(MAPPER).optional(); }
 public BenefitPage search(BenefitSearch s) {
  StringBuilder where = new StringBuilder(" WHERE b.active");
  Map<String,Object> p = new HashMap<>();
  if (!s.q().isEmpty()) { where.append(" AND position(:q in lower(concat_ws(' ', b.title, b.summary, b.organization, b.eligibility))) > 0"); p.put("q", s.q().toLowerCase(Locale.ROOT)); }
  if (!s.region().equals("전체")) { where.append(" AND b.region IN ('전국', :region)"); p.put("region", s.region()); }
  if (!s.category().equals("전체")) { where.append(" AND b.category=:category"); p.put("category", s.category()); }
  if (s.openOnly()) { where.append(" AND (b.deadline IS NULL OR b.deadline >= :today)"); p.put("today", s.today()); }
  if (s.ids()!=null) {
   if(s.ids().isEmpty()) where.append(" AND false");
   else { where.append(" AND b.id IN (:ids)"); p.put("ids",s.ids()); }
  }
  if (s.savedBy()!=null) { where.append(" AND EXISTS (SELECT 1 FROM member_saved ms WHERE ms.user_id=:user AND ms.benefit_id=b.id)"); p.put("user",s.savedBy()); }
  String order = switch(s.sort()) { case "deadline" -> "b.deadline ASC NULLS LAST, b.id"; case "title" -> "b.title ASC, b.id"; default -> "b.updated_at DESC, b.id"; };
  long total = jdbc.sql("SELECT count(*) FROM benefit b"+where).params(p).query(Long.class).single();
  p.put("limit",s.size()); p.put("offset",s.offset());
  var items=jdbc.sql("SELECT b.* FROM benefit b"+where+" ORDER BY "+order+" LIMIT :limit OFFSET :offset").params(p).query(MAPPER).list();
  return new BenefitPage(items,total);
 }
}
