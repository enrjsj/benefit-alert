package com.benefitalert.collection;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.regex.Pattern;

/** Frozen rules used by Flyway V5. Add a new version for future parsing changes. */
public final class AbsoluteDeadlineV1 {
 private AbsoluteDeadlineV1() {}
 private static final Pattern NUMERIC=Pattern.compile("(\\d{4})\\s*([./-])\\s*(\\d{1,2})\\s*\\2\\s*(\\d{1,2})(\\.)?");
 private static final Pattern KOREAN=Pattern.compile("(\\d{4})\\s*년\\s*(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일");
 public static LocalDate parse(String period) {
  if(period==null || period.length()>200) return null;
  String[] dates=period.strip().split("[~∼]",-1);
  if(dates.length<1 || dates.length>2) return null;
  LocalDate start=date(dates[0].strip());
  if(start==null) return null;
  if(dates.length==1) return start;
  LocalDate end=date(dates[1].strip());
  return end!=null && !end.isBefore(start)?end:null;
 }
 private static LocalDate date(String text) {
  var numeric=NUMERIC.matcher(text);var korean=KOREAN.matcher(text);
  try {
   int year,month,day;
   if(numeric.matches()) {
    if(numeric.group(5)!=null && !numeric.group(2).equals(".")) return null;
    year=Integer.parseInt(numeric.group(1));month=Integer.parseInt(numeric.group(3));day=Integer.parseInt(numeric.group(4));
   } else if(korean.matches()) {
    year=Integer.parseInt(korean.group(1));month=Integer.parseInt(korean.group(2));day=Integer.parseInt(korean.group(3));
   } else return null;
   return year>=1900?LocalDate.of(year,month,day):null;
  } catch(DateTimeException | NumberFormatException e) {return null;}
 }
}
