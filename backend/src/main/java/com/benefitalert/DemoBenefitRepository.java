package com.benefitalert;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
/** UI 검증 전용 가상 데이터이며 실제 지원사업이 아닙니다. */
@Repository @Profile("demo")
public class DemoBenefitRepository implements BenefitRepository {
 public List<Benefit> findAll() { return List.of(
  sample("demo-1","청년의 첫 출발을 위한 주거비 지원","서울","주거","월세 부담을 덜고 독립을 준비하세요.","거주지·나이·소득 기준 확인 필요","지원 금액은 실제 공고 연동 후 제공"),
  sample("demo-2","새로운 도전을 응원하는 직무 교육","전국","취업","관심 직무의 교육과 취업 준비를 함께 시작하세요.","구직 상태 및 과정별 조건 확인 필요","교육 프로그램 지원"),
  sample("demo-3","가족의 일상을 위한 돌봄 서비스","경기","가족","우리 가족에게 필요한 돌봄 혜택을 찾아보세요.","가구 구성·자녀 연령 확인 필요","돌봄 서비스 지원"),
  sample("demo-4","생활에 보탬이 되는 에너지 지원","전국","생활","생활비 부담을 줄일 수 있는 혜택을 확인하세요.","가구 소득 및 세대 특성 확인 필요","에너지 비용 지원")
 ); }
 private Benefit sample(String id,String title,String region,String category,String summary,String eligibility,String support) {
  return new Benefit(id,title,"예시 제공기관",region,category,summary,eligibility,support,"실제 연동 후 공식 신청 방법 안내",null,"기간 확인 필요","https://www.gov.kr/");
 }
}
