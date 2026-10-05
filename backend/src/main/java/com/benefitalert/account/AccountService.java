package com.benefitalert.account;

import com.benefitalert.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Profile("prod")
public class AccountService {
 public record Preferences(String region, String category, boolean notificationsEnabled) {}
 public record Alert(long id,String benefitId,String title,String kind,String createdAt,boolean read) {}
 public static final List<String> REGIONS=List.of("전체","서울","경기","인천","부산","대구","대전","광주","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주");
 public static final List<String> CATEGORIES=List.of("전체","주거","취업","생활","가족","교육","건강","문화","기타");
 private final JdbcClient jdbc;
 public AccountService(JdbcClient jdbc) { this.jdbc=jdbc; }
 private void ensure(UUID user) { jdbc.sql("INSERT INTO member_profile(user_id) VALUES(:u) ON CONFLICT DO NOTHING").param("u",user).update(); }
 public Preferences preferences(UUID user) {
  ensure(user);
  return jdbc.sql("SELECT * FROM member_profile WHERE user_id=:u").param("u",user).query((r,n)->new Preferences(r.getString("region"),r.getString("category"),r.getBoolean("notifications_enabled"))).single();
 }
 public Preferences update(UUID user,Preferences p) {
  if(p==null || p.region()==null || p.category()==null || !REGIONS.contains(p.region()) || !CATEGORIES.contains(p.category())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  ensure(user);
  jdbc.sql("UPDATE member_profile SET region=:r,category=:c,notifications_enabled=:n,updated_at=now() WHERE user_id=:u")
   .param("u",user).param("r",p.region()).param("c",p.category()).param("n",p.notificationsEnabled()).update();
  return p;
 }
 public List<String> saved(UUID user) {
  return jdbc.sql("SELECT benefit_id FROM member_saved WHERE user_id=:u ORDER BY created_at DESC,benefit_id").param("u",user).query(String.class).list();
 }
 @Transactional
 public List<String> addSaved(UUID user,List<String> ids) {
  if(ids==null || ids.size()>100 || ids.stream().anyMatch(id->id==null || id.isBlank() || id.length()>100)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  ensure(user);
  jdbc.sql("SELECT user_id FROM member_profile WHERE user_id=:u FOR UPDATE").param("u",user).query(UUID.class).single();
  Set<String> existing=new HashSet<>(saved(user));
  Set<String> valid=ids.isEmpty()?new HashSet<>():new HashSet<>(jdbc.sql("SELECT id FROM benefit WHERE active AND id IN (:ids)").param("ids",ids).query(String.class).list());
  valid.removeAll(existing);
  if(existing.size()+valid.size()>500) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"최대 500개의 관심 혜택을 저장할 수 있습니다.");
  for(String id:valid) jdbc.sql("INSERT INTO member_saved(user_id,benefit_id) VALUES(:u,:id) ON CONFLICT DO NOTHING").param("u",user).param("id",id).update();
  return saved(user);
 }
 public List<String> removeSaved(UUID user,String id) {
  jdbc.sql("DELETE FROM member_saved WHERE user_id=:u AND benefit_id=:id").param("u",user).param("id",id).update(); return saved(user);
 }
 @Transactional
 public List<Alert> notifications(UUID user) {
  Preferences p=preferences(user);
  LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
  if(p.notificationsEnabled()) {
   jdbc.sql("""
    INSERT INTO member_notification(user_id,benefit_id,kind)
    SELECT :u,b.id,'closing' FROM benefit b JOIN member_saved s ON s.benefit_id=b.id AND s.user_id=:u
    WHERE b.active AND b.deadline BETWEEN :today AND :soon
    ON CONFLICT(user_id,benefit_id,kind) DO NOTHING
    """).param("u",user).param("today",today).param("soon",today.plusDays(7)).update();
   jdbc.sql("""
    INSERT INTO member_notification(user_id,benefit_id,kind)
    SELECT :u,b.id,'new' FROM benefit b
    WHERE b.active AND b.created_at>=now()-interval '7 days'
    AND (b.deadline IS NULL OR b.deadline>=:today)
    AND (:region='전체' OR b.region IN ('전국',:region)) AND (:category='전체' OR b.category=:category)
    ORDER BY b.created_at DESC,b.id LIMIT 30
    ON CONFLICT(user_id,benefit_id,kind) DO NOTHING
    """).param("u",user).param("today",today).param("region",p.region()).param("category",p.category()).update();
  }
  // Expired or no-longer-active notices are not shown as actionable alerts.
  return jdbc.sql("""
   SELECT n.*,b.title FROM member_notification n JOIN benefit b ON b.id=n.benefit_id
   WHERE n.user_id=:u AND b.active AND (b.deadline IS NULL OR b.deadline>=:today)
   ORDER BY n.created_at DESC,n.id DESC LIMIT 100
   """).param("u",user).param("today",today).query((r,n)->new Alert(r.getLong("id"),r.getString("benefit_id"),r.getString("title"),r.getString("kind"),r.getString("created_at"),r.getObject("read_at")!=null)).list();
 }
 public void read(UUID user,long id) { jdbc.sql("UPDATE member_notification SET read_at=now() WHERE user_id=:u AND id=:id").param("u",user).param("id",id).update(); }
}
