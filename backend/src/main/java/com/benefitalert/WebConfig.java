package com.benefitalert;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
/** 프런트 배포 도메인만 허용합니다. 로컬 동일 출처 프록시는 CORS가 필요 없습니다. */
@Configuration
public class WebConfig implements WebMvcConfigurer {
 private final String[] origins;
 public WebConfig(@Value("${app.cors-origins:}") String configured) {
  origins=Arrays.stream(configured.split(",")).map(String::trim).filter(s->!s.isEmpty()).toArray(String[]::new);
 }
 @Override public void addCorsMappings(CorsRegistry registry) {
  if(origins.length>0) registry.addMapping("/api/**").allowedOrigins(origins).allowedMethods("GET").maxAge(3600);
 }
}
