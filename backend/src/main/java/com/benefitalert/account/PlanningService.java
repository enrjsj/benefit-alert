package com.benefitalert.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @Profile("prod")
public class PlanningService {
 public record Data(int version, List<String> compareIds, Map<String,List<String>> checklists) {}
 public record Snapshot(long revision, Data data) {}
 public record Update(long revision, Data data) {}
 private static final Set<String> STEPS=Set.of("eligibility","documents","schedule","submitted");
 private final JdbcClient jdbc;
 private final ObjectMapper mapper;
 public PlanningService(JdbcClient jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
 public static Data empty(){return new Data(1,List.of(),Map.of());}
 private static boolean validId(String id){return id!=null && !id.isBlank() && id.length()<=100 && !Set.of("__proto__","constructor","prototype").contains(id);}
 public static Data validate(Data data){
  if(data==null || data.version()!=1 || data.compareIds()==null || data.checklists()==null || data.compareIds().size()>3 || data.checklists().size()>200)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"비교는 3개, 체크리스트는 200개까지 저장할 수 있어요.");
  if(data.compareIds().stream().anyMatch(id->!validId(id))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  var checks=new LinkedHashMap<String,List<String>>();
  data.checklists().forEach((id,steps)->{
   if(!validId(id) || steps==null || steps.size()>4 || steps.stream().anyMatch(step->step==null || !STEPS.contains(step))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
   if(!steps.isEmpty()) checks.put(id,List.copyOf(new LinkedHashSet<>(steps)));
  });
  return new Data(1,List.copyOf(new LinkedHashSet<>(data.compareIds())),Collections.unmodifiableMap(checks));
 }
 public static Data merge(Data existing,Data incoming){
  existing=validate(existing);incoming=validate(incoming);
  var ids=new LinkedHashSet<>(existing.compareIds());ids.addAll(incoming.compareIds());
  var checks=new LinkedHashMap<>(existing.checklists());
  incoming.checklists().forEach((id,steps)->{var union=new LinkedHashSet<>(checks.getOrDefault(id,List.of()));union.addAll(steps);checks.put(id,List.copyOf(union));});
  return validate(new Data(1,List.copyOf(ids),checks));
 }
 private void ensure(UUID user){
  jdbc.sql("INSERT INTO member_profile(user_id) VALUES(:u) ON CONFLICT DO NOTHING").param("u",user).update();
  jdbc.sql("INSERT INTO member_planning(user_id) VALUES(:u) ON CONFLICT DO NOTHING").param("u",user).update();
 }
 private Snapshot read(UUID user,boolean lock){
  return jdbc.sql("SELECT revision,data FROM member_planning WHERE user_id=:u"+(lock?" FOR UPDATE":"")).param("u",user)
   .query((r,n)->new Snapshot(r.getLong("revision"),decode(r.getString("data")))).single();
 }
 private Data decode(String raw){try{return mapper.readValue(raw,Data.class);}catch(Exception e){throw new IllegalStateException("planning_deserialization_failed",e);}}
 public Snapshot get(UUID user){ensure(user);return read(user,false);}
 private String json(Data data){try{return mapper.writeValueAsString(data);}catch(Exception e){throw new IllegalStateException("planning_serialization_failed",e);}}
 public Snapshot save(UUID user,Update input){
  if(input==null || input.revision()<0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  Data data=validate(input.data());ensure(user);
  int updated=jdbc.sql("UPDATE member_planning SET data=CAST(:data AS jsonb),revision=revision+1,updated_at=now() WHERE user_id=:u AND revision=:revision")
   .param("data",json(data)).param("u",user).param("revision",input.revision()).update();
  if(updated==0) throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 기기에서 기록이 변경됐어요. 최신 기록을 확인한 뒤 다시 시도해 주세요.");
  return new Snapshot(input.revision()+1,data);
 }
 @Transactional public Snapshot importData(UUID user,Data incoming){
  incoming=validate(incoming);ensure(user);
  Snapshot current=read(user,true);
  return save(user,new Update(current.revision(),merge(current.data(),incoming)));
 }
}
