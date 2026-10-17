package com.benefitalert;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

/** JSON API timing only. Never log query strings, tokens, account IDs or bodies. */
@Component
public class RequestTimingFilter extends OncePerRequestFilter {
 private static final Logger log = LoggerFactory.getLogger(RequestTimingFilter.class);
 @Override protected boolean shouldNotFilter(HttpServletRequest request) { return !request.getRequestURI().startsWith("/api/"); }
 @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
  String id = UUID.randomUUID().toString();
  var buffered = new ContentCachingResponseWrapper(response);
  buffered.setHeader("X-Request-ID", id);
  long start = System.nanoTime();
  try { chain.doFilter(request, buffered); }
  finally {
   double ms = (System.nanoTime() - start) / 1_000_000.0;
   buffered.setHeader("Server-Timing", String.format(Locale.ROOT, "app;dur=%.1f", ms));
   if (ms >= 1000 || buffered.getStatus() >= 500)
    log.info("api_timing request_id={} route={} status={} duration_ms={}", id, route(request.getRequestURI()), buffered.getStatus(), Math.round(ms));
   buffered.copyBodyToResponse();
  }
 }
 static String route(String path) {
  if (path.startsWith("/api/account/")) return "account";
  if (path.equals("/api/benefits")) return "benefits_list";
  if (path.startsWith("/api/benefits/")) return "benefit_detail";
  if (path.equals("/api/health")) return "health";
  return "public_other";
 }
}
