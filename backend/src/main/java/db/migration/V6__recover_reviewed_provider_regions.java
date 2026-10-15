package db.migration;
import com.benefitalert.collection.ProviderScopeV1;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
/** Only derived region changes; source text, timestamps, activity and member references survive. */
public class V6__recover_reviewed_provider_regions extends BaseJavaMigration {
 @Override public Integer getChecksum(){return 1;}
 @Override public void migrate(Context context) throws Exception {
  try(var write=context.getConnection().prepareStatement("UPDATE benefit SET region=? WHERE source_kind='gov24' AND region='지역확인' AND source_payload->>'소관기관유형' IS DISTINCT FROM '중앙행정기관' AND regexp_replace(btrim(organization),'[[:space:]]+',' ','g')=?")) {
   for(var entry:ProviderScopeV1.SCOPES.entrySet()) {
    write.setString(1,entry.getValue().region());write.setString(2,entry.getKey());write.addBatch();
   }
   write.executeBatch();
  }
 }
}
