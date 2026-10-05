package com.benefitalert.account;
import com.benefitalert.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="TEST_DATABASE_URL",matches=".+")
class AccountDatabaseTest {
 @Test void usersAreIsolatedAndNotificationsAreIdempotent(){try(var db=new TestDatabase()){
  db.seed("seoul","서울","주거",3);db.seed("busan","부산","취업",10);db.seed("national","전국","주거",20);db.seed("expired","서울","주거",-1);
  var a=new AccountService(db.jdbc);UUID alice=UUID.randomUUID(),bob=UUID.randomUUID();
  a.update(alice,new AccountService.Preferences("서울","주거",true));a.addSaved(alice,List.of("seoul","missing"));a.addSaved(bob,List.of("busan"));
  assertEquals(List.of("seoul"),a.saved(alice));assertEquals(List.of("busan"),a.removeSaved(bob,"seoul"));assertEquals(List.of("seoul"),a.addSaved(alice,List.of()));
  var alerts=a.notifications(alice);assertEquals(3,alerts.size());assertEquals(3,a.notifications(alice).size());assertTrue(a.notifications(bob).isEmpty());
  long id=alerts.getFirst().id();a.read(bob,id);assertFalse(a.notifications(alice).stream().filter(n->n.id()==id).findFirst().orElseThrow().read());a.read(alice,id);assertTrue(a.notifications(alice).stream().filter(n->n.id()==id).findFirst().orElseThrow().read());
  var repo=new PostgresBenefitRepository(db.jdbc);
  var page=repo.search(new BenefitSearch("","서울","주거",true,1,1,"deadline",null,null));assertEquals(2,page.total());assertEquals("seoul",page.items().getFirst().id());
  assertEquals("national",repo.search(new BenefitSearch("","서울","주거",true,2,1,"deadline",null,null)).items().getFirst().id());
  assertEquals(0,repo.search(new BenefitSearch("%","전체","전체",false,1,12,"default",null,null)).total());
  assertEquals("seoul",repo.search(new BenefitSearch("","전체","전체",false,1,12,"default",null,alice)).items().getFirst().id());
  assertThrows(org.springframework.web.server.ResponseStatusException.class,()->a.update(alice,new AccountService.Preferences(null,"전체",false)));
 }}
}
