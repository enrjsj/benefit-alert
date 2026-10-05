package com.benefitalert;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
@Component
public class PrivateResponseFilter extends OncePerRequestFilter {
 protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
  if(request.getRequestURI().startsWith("/api/account") || request.getHeader("Authorization")!=null || request.getRequestURI().equals("/api/client-config")) {
   response.setHeader("Cache-Control","no-store");response.setHeader("Vary","Authorization");
  }
  chain.doFilter(request,response);
 }
}
