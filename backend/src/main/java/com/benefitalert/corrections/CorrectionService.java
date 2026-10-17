package com.benefitalert.corrections;

import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service @Profile("prod")
public class CorrectionService {
 public record Input(UUID clientId,String benefitId,String category,String message) {}
 public record Update(long revision,String status,String reply) {}
 public record Entry(long id,String benefitId,String title,String category,String message,String status,String reply,long revision,String createdAt) {}
 public record Page(List<Entry> items,Long nextCursor) {}
 private final JdbcClient jdbc; private final TransactionTemplate tx; private final Set<UUID> admins; private final Set<String> adminEmails;
 private static final Set<String> CATEGORIES=Set.of("deadline","eligibility","region","link","other"), STATES=Set.of("pending","reviewing","resolved","rejected");
 private static final String SELECT="SELECT c.*,b.title FROM correction_request c JOIN benefit b ON b.id=c.benefit_id ";
 public CorrectionService(JdbcClient jdbc,PlatformTransactionManager manager,@Value("${ADMIN_USER_IDS:}") String ids,@Value("${ADMIN_EMAILS:}") String emails) {
  this.jdbc=jdbc;tx=new TransactionTemplate(manager);
  var values=new HashSet<UUID>();for(String value:ids.split(","))if(!value.isBlank()) values.add(UUID.fromString(value.trim()));admins=Set.copyOf(values);adminEmails=new HashSet<>();for(String email:emails.split(","))if(!email.isBlank())adminEmails.add(email.trim().toLowerCase(Locale.ROOT));
 }
 public boolean enabled(){return !admins.isEmpty()||!adminEmails.isEmpty();}
 public boolean admin(com.benefitalert.account.SupabaseIdentity.Principal user){return admins.contains(user.id())||(!user.email().isBlank()&&adminEmails.contains(user.email()));}
 private void requireAdmin(com.benefitalert.account.SupabaseIdentity.Principal user){if(!admin(user))throw new ResponseStatusException(HttpStatus.FORBIDDEN);}
 private static void valid(boolean ok){if(!ok)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);}
 private static Entry map(java.sql.ResultSet r,int row) throws java.sql.SQLException {
  return new Entry(r.getLong("id"),r.getString("benefit_id"),r.getString("title"),r.getString("category"),r.getString("message"),r.getString("status"),r.getString("reply"),r.getLong("revision"),r.getObject("created_at",java.time.OffsetDateTime.class).toString());
 }
 public Entry create(UUID user,Input input) {
  if(!enabled())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
  valid(input!=null && input.clientId()!=null && input.benefitId()!=null && input.benefitId().length()<=100 && input.category()!=null && CATEGORIES.contains(input.category()) && input.message()!=null && !input.message().isBlank() && input.message().length()<=1000);
  return tx.execute(t->{
   // Serialize submissions by owner, including quota and duplicate checks.
   jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended(:owner,0))").param("owner",user.toString()).query((r,n)->0).single();
   var prior=jdbc.sql(SELECT+"WHERE c.user_id=:u AND c.client_id=:client").param("u",user).param("client",input.clientId()).query(CorrectionService::map).optional();
   if(prior.isPresent())return prior.get();
   if(jdbc.sql("SELECT count(*) FROM correction_request WHERE user_id=:u AND created_at>now()-interval '24 hours'").param("u",user).query(Long.class).single()>=10)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
   if(jdbc.sql("SELECT count(*) FROM correction_request WHERE user_id=:u AND benefit_id=:b AND status IN ('pending','reviewing')").param("u",user).param("b",input.benefitId()).query(Long.class).single()>0)throw new ResponseStatusException(HttpStatus.CONFLICT);
   if(jdbc.sql("SELECT count(*) FROM benefit WHERE id=:b AND active").param("b",input.benefitId()).query(Long.class).single()==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND);
   long id=jdbc.sql("INSERT INTO correction_request(user_id,client_id,benefit_id,category,message) VALUES(:u,:client,:b,:c,:m) RETURNING id").param("u",user).param("client",input.clientId()).param("b",input.benefitId()).param("c",input.category()).param("m",input.message().trim()).query(Long.class).single();
   return get(id);
  });
 }
 private Entry get(long id){return jdbc.sql(SELECT+"WHERE c.id=:id").param("id",id).query(CorrectionService::map).single();}
 public Page list(com.benefitalert.account.SupabaseIdentity.Principal user,boolean all,String status,long before) {
  if(all)requireAdmin(user);valid((status.equals("all")||STATES.contains(status))&&before>=0);
  var rows=jdbc.sql(SELECT+"WHERE (:all OR c.user_id=:u) AND (:state='all' OR c.status=:state) AND (:before=0 OR c.id<:before) ORDER BY c.id DESC LIMIT 21").param("all",all).param("u",user.id()).param("state",status).param("before",before).query(CorrectionService::map).list();
  return new Page(rows.stream().limit(20).toList(),rows.size()>20?rows.get(19).id():null);
 }
 public Entry update(com.benefitalert.account.SupabaseIdentity.Principal user,long id,Update input) {
  requireAdmin(user);valid(input!=null&&input.revision()>=0&&input.status()!=null&&STATES.contains(input.status())&&input.reply()!=null&&input.reply().length()<=1000);
  valid(!(input.status().equals("resolved")||input.status().equals("rejected"))||!input.reply().isBlank());
  return tx.execute(t->{
   int changed=jdbc.sql("UPDATE correction_request SET status=:s,reply=:r,revision=revision+1,updated_at=now() WHERE id=:id AND revision=:v").param("s",input.status()).param("r",input.reply().trim()).param("id",id).param("v",input.revision()).update();
   if(changed==0)throw new ResponseStatusException(HttpStatus.CONFLICT);
   var result=get(id);
   jdbc.sql("INSERT INTO correction_review(request_id,reviewer_id,status,reply,revision) VALUES(:id,:u,:s,:r,:v)").param("id",id).param("u",user.id()).param("s",result.status()).param("r",result.reply()).param("v",result.revision()).update();
   return result;
  });
 }
}
