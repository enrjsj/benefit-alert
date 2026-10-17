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
 @Test void searchAndHistoryAreScopedLiteralAndPaginated() {
  try(var db=new TestDatabase()) {
   var owner=new Principal(UUID.randomUUID(),"");var other=new Principal(UUID.randomUUID(),"");var admin=new Principal(UUID.randomUUID(),"");
   db.seed("history-benefit","서울","주거",3);
   var service=new CorrectionService(db.jdbc,new DataSourceTransactionManager(db.dataSource),admin.id().toString(),"");
   var entry=service.create(owner.id(),new CorrectionService.Input(UUID.randomUUID(),"history-benefit","other","100%_확인 요청"));
   assertEquals(1,service.list(owner,false,"all",0,"%_").items().size());
   assertTrue(service.list(other,false,"all",0,"%_").items().isEmpty());
   assertTrue(service.list(owner,false,"all",0,"' OR 1=1 --").items().isEmpty());
   assertEquals(400,assertThrows(ResponseStatusException.class,()->service.list(owner,false,"all",0,"a".repeat(101))).getStatusCode().value());
   assertTrue(service.history(owner,entry.id(),0).items().isEmpty());
   for(int i=0;i<23;i++)service.update(admin,entry.id(),new CorrectionService.Update(i,"reviewing","검토 답변 "+i));
   assertEquals(1,service.list(owner,false,"reviewing",0,"답변 22").items().size());
   var first=service.history(owner,entry.id(),0);assertEquals(20,first.items().size());assertEquals(23,first.items().get(0).revision());
   var last=service.history(admin,entry.id(),first.nextCursor());assertEquals(3,last.items().size());assertEquals(1,last.items().get(2).revision());assertNull(last.nextCursor());
   assertEquals(404,assertThrows(ResponseStatusException.class,()->service.history(other,entry.id(),0)).getStatusCode().value());
   assertEquals(404,assertThrows(ResponseStatusException.class,()->service.history(owner,999999,0)).getStatusCode().value());
   assertEquals(400,assertThrows(ResponseStatusException.class,()->service.history(owner,entry.id(),-1)).getStatusCode().value());
  }
 }
 @Test void queueSearchPaginationNeverSkipsOrRepeatsMatches() {
  try(var db=new TestDatabase()) {
   var admin=new Principal(UUID.randomUUID(),"");db.seed("queue","서울","주거",3);
   var service=new CorrectionService(db.jdbc,new DataSourceTransactionManager(db.dataSource),admin.id().toString(),"");
   for(int i=0;i<23;i++)service.create(UUID.randomUUID(),new CorrectionService.Input(UUID.randomUUID(),"queue","other","검색 대상 "+i));
   service.create(UUID.randomUUID(),new CorrectionService.Input(UUID.randomUUID(),"queue","other","제외"));
   var first=service.list(admin,true,"pending",0,"검색 대상");assertEquals(20,first.items().size());assertNotNull(first.nextCursor());
   var second=service.list(admin,true,"pending",first.nextCursor(),"검색 대상");assertEquals(3,second.items().size());assertNull(second.nextCursor());
   var ids=new java.util.HashSet<Long>();first.items().forEach(e->ids.add(e.id()));second.items().forEach(e->assertTrue(ids.add(e.id())));
   assertTrue(service.list(admin,false,"pending",0,"검색 대상").items().isEmpty());
  }
 }
}
