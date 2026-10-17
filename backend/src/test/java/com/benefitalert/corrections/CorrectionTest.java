package com.benefitalert.corrections;
import com.benefitalert.TestDatabase;
import com.benefitalert.account.SupabaseIdentity.Principal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
class CorrectionTest {
 @Test void ownershipIdempotencyReviewAndConflict() {
  try(var db=new TestDatabase()) {
   UUID user=UUID.randomUUID(),other=UUID.randomUUID(),admin=UUID.randomUUID();db.seed("b","서울","주거",3);
   var service=new CorrectionService(db.jdbc,new DataSourceTransactionManager(db.dataSource),admin.toString(),"");
   var input=new CorrectionService.Input(UUID.randomUUID(),"b","deadline","마감일 확인 요청");
   var entry=service.create(user,input);assertEquals(entry.id(),service.create(user,input).id());
   assertEquals(1,service.list(new Principal(user,""),false,"all",0).items().size());
   assertTrue(service.list(new Principal(other,""),false,"all",0).items().isEmpty());
   assertEquals(403,assertThrows(ResponseStatusException.class,()->service.list(new Principal(other,""),true,"all",0)).getStatusCode().value());
   assertEquals(403,assertThrows(ResponseStatusException.class,()->service.update(new Principal(user,""),entry.id(),new CorrectionService.Update(0,"resolved","답변"))).getStatusCode().value());
   assertEquals(400,assertThrows(ResponseStatusException.class,()->service.update(new Principal(admin,""),entry.id(),new CorrectionService.Update(0,"resolved"," "))).getStatusCode().value());
   var updated=service.update(new Principal(admin,""),entry.id(),new CorrectionService.Update(0,"resolved","기관 안내 확인 완료"));assertEquals(1,updated.revision());
   assertEquals(409,assertThrows(ResponseStatusException.class,()->service.update(new Principal(admin,""),entry.id(),new CorrectionService.Update(0,"rejected","과거 화면"))).getStatusCode().value());
   assertEquals("기관 안내 확인 완료",service.list(new Principal(user,""),false,"resolved",0).items().get(0).reply());
   assertEquals(1,db.jdbc.sql("SELECT count(*) FROM correction_review").query(Integer.class).single());
   assertEquals(admin,db.jdbc.sql("SELECT reviewer_id FROM correction_review").query(UUID.class).single());
   assertTrue(db.jdbc.sql("SELECT relrowsecurity FROM pg_class WHERE oid='correction_request'::regclass").query(Boolean.class).single());
  }
 }
 @Test void defaultDenyQuotaAndDuplicateProtection() {
  try(var db=new TestDatabase()) {
   var manager=new DataSourceTransactionManager(db.dataSource);UUID user=UUID.randomUUID();db.seed("b","서울","주거",3);
   var disabled=new CorrectionService(db.jdbc,manager,"","");assertFalse(disabled.enabled());
   assertEquals(503,assertThrows(ResponseStatusException.class,()->disabled.create(user,new CorrectionService.Input(UUID.randomUUID(),"b","other","내용"))).getStatusCode().value());
   var service=new CorrectionService(db.jdbc,manager,"","operator@example.test");assertFalse(service.admin(new Principal(user,"other@example.test")));assertTrue(service.admin(new Principal(user,"operator@example.test")));
   service.create(user,new CorrectionService.Input(UUID.randomUUID(),"b","other","내용"));
   assertEquals(409,assertThrows(ResponseStatusException.class,()->service.create(user,new CorrectionService.Input(UUID.randomUUID(),"b","other","중복"))).getStatusCode().value());
   for(int i=0;i<9;i++){db.seed("b"+i,"서울","주거",3);service.create(user,new CorrectionService.Input(UUID.randomUUID(),"b"+i,"other","내용"));}
   assertEquals(429,assertThrows(ResponseStatusException.class,()->service.create(user,new CorrectionService.Input(UUID.randomUUID(),"missing","other","초과"))).getStatusCode().value());
  }
 }
}
