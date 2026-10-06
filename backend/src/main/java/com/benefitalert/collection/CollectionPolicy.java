package com.benefitalert.collection;

import java.time.*;

public final class CollectionPolicy {
 public static final Duration NORMAL=Duration.ofHours(6), RETRY=Duration.ofMinutes(10), STALE=Duration.ofHours(12);
 private CollectionPolicy() {}
 public static Instant nextAttempt(String status,Instant finished,String error,Instant now){
  if(status==null || "interrupted".equals(error)) return now;
  if("RUNNING".equals(status)) return null;
  if(finished==null) return now;
  return finished.plus("SUCCESS".equals(status) || "credential_rejected".equals(error)?NORMAL:RETRY);
 }
 public static boolean stale(Instant lastSuccess,Instant now){return lastSuccess==null || !lastSuccess.plus(STALE).isAfter(now);}
}
