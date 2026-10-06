package com.benefitalert;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public interface BenefitRepository {
 List<Benefit> findAll();
 default Optional<Benefit> findById(String id) {
  return findAll().stream().filter(b -> b.id().equals(id)).findFirst();
 }
 default List<String> districts(String region) {
  return RegionScope.options(findAll().stream().filter(b->b.region().equals(region)).map(b->RegionScope.district(b.organization())).toList());
 }
 default BenefitPage search(BenefitSearch s) {
  var filtered = findAll().stream()
   .filter(b -> s.q().isEmpty() || (b.title()+" "+b.summary()+" "+b.organization()+" "+b.eligibility()).toLowerCase(Locale.ROOT).contains(s.q().toLowerCase(Locale.ROOT)))
   .filter(b -> s.region().equals("전체") || b.region().equals("전국") || b.region().equals(s.region()))
   .filter(b -> RegionScope.matches(b,s.district()))
   .filter(b -> s.category().equals("전체") || b.category().equals(s.category()))
   .filter(b -> !s.openOnly() || b.deadline() == null || !b.deadline().isBefore(s.today()))
   .filter(b -> s.ids() == null || s.ids().contains(b.id()));
  if (s.sort().equals("deadline")) filtered = filtered.sorted(Comparator.comparing(Benefit::deadline, Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(Benefit::id));
  if (s.sort().equals("title")) filtered = filtered.sorted(Comparator.comparing(Benefit::title).thenComparing(Benefit::id));
  var all = filtered.toList();
  return new BenefitPage(all.stream().skip(s.offset()).limit(s.size()).toList(), all.size());
 }
}
