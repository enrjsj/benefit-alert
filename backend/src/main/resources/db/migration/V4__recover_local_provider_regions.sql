-- Recover only identifiable local government providers. Preserve source text,
-- timestamps, activity and member references; this is not a new collection.
WITH scopes AS (
 SELECT id, substring(regexp_replace(btrim(organization),'[[:space:]]+',' ','g')
   from '^전남광주통합특별시 ([가-힣]+[시군구])(?: |$)') AS district
 FROM benefit
 WHERE source_kind='gov24' AND region='지역확인'
   AND source_payload->>'소관기관유형' IS DISTINCT FROM '중앙행정기관'
), mapped AS (
 SELECT id, CASE
  WHEN district IN ('광산구','남구','동구','북구','서구') THEN '광주'
  WHEN district IN ('강진군','고흥군','곡성군','광양시','구례군','나주시','담양군','목포시','무안군','보성군','순천시','신안군','여수시','영광군','영암군','완도군','장성군','장흥군','진도군','함평군','해남군','화순군') THEN '전남'
 END AS region FROM scopes
)
UPDATE benefit b SET region=m.region FROM mapped m
WHERE b.id=m.id AND m.region IS NOT NULL;
