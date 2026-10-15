package com.benefitalert;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
/** Snapshot shared with the frontend; live provider districts augment it. */
public final class DistrictCatalog {
 private DistrictCatalog() {}
 private static final Map<String,List<String>> OPTIONS=load();
 private static Map<String,List<String>> load() {
  try(var input=DistrictCatalog.class.getResourceAsStream("/district-options.json")) {
   return new ObjectMapper().readValue(input,new TypeReference<Map<String,List<String>>>(){});
  } catch(Exception e){throw new IllegalStateException("district_catalog_unavailable",e);}
 }
 public static boolean contains(String region,String district){return OPTIONS.getOrDefault(region,List.of()).contains(district);}
}
