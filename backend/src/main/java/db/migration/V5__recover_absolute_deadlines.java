package db.migration;

import com.benefitalert.collection.AbsoluteDeadlineV1;
import java.time.LocalDate;
import java.util.ArrayList;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Only fill missing derived dates; preserve original periods, payloads and timestamps. */
public class V5__recover_absolute_deadlines extends BaseJavaMigration {
 @Override public Integer getChecksum(){return 1;}
 private record Update(String id,String period,LocalDate deadline) {}
 @Override public void migrate(Context context) throws Exception {
  var updates=new ArrayList<Update>();
  try(var query=context.getConnection().prepareStatement("SELECT id,period_label FROM benefit WHERE source_kind='gov24' AND deadline IS NULL");var rows=query.executeQuery()) {
   while(rows.next()) {
    String period=rows.getString(2);LocalDate deadline=AbsoluteDeadlineV1.parse(period);
    if(deadline!=null) updates.add(new Update(rows.getString(1),period,deadline));
   }
  }
  try(var write=context.getConnection().prepareStatement("UPDATE benefit SET deadline=? WHERE id=? AND period_label=? AND source_kind='gov24' AND deadline IS NULL")) {
   int pending=0;
   for(var update:updates) {
    write.setObject(1,update.deadline());write.setString(2,update.id());write.setString(3,update.period());write.addBatch();
    if(++pending%200==0) write.executeBatch();
   }
   if(pending%200!=0) write.executeBatch();
  }
 }
}
