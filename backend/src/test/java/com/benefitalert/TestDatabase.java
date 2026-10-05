package com.benefitalert;
import org.flywaydb.core.Flyway;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.core.simple.JdbcClient;
public class TestDatabase implements AutoCloseable {
 public final JdbcClient jdbc;private final DriverManagerDataSource admin;private final String schema="test_"+java.util.UUID.randomUUID().toString().replace("-","");
 public TestDatabase(){
  String url=System.getenv("TEST_DATABASE_URL");admin=new DriverManagerDataSource(url,"postgres","benefit-local-test");
  Flyway.configure().dataSource(admin).schemas(schema).defaultSchema(schema).load().migrate();
  jdbc=JdbcClient.create(new DriverManagerDataSource(url+(url.contains("?")?"&":"?")+"currentSchema="+schema,"postgres","benefit-local-test"));
 }
 public void close(){JdbcClient.create(admin).sql("DROP SCHEMA "+schema+" CASCADE").update();}
 public void seed(String id,String region,String category,int days){jdbc.sql("INSERT INTO benefit(id,title,organization,region,category,summary,eligibility,support,application_method,deadline,period_label,source_url) VALUES(:id,:id,'기관',:r,:c,'설명','대상','지원','신청',CURRENT_DATE + :days,'기간','https://www.gov.kr')").param("id",id).param("r",region).param("c",category).param("days",days).update();}
}
