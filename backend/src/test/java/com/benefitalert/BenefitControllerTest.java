package com.benefitalert;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
/** 지역 공통 공고·미정 기간·마감 경계의 누락을 방지합니다. */
class BenefitControllerTest {
 private final BenefitController controller=new BenefitController(new DemoBenefitRepository(),new MockEnvironment().withProperty("spring.profiles.active","demo"));
 @Test void regionExcludesNationwide(){assertThat(controller.list("","서울","전체",false).items()).extracting(Benefit::region).containsExactly("서울");}
 @Test void allRegionsIncludeNationwide(){assertThat(controller.list("","전체","전체",false).items()).extracting(Benefit::region).contains("전국");}
 @Test void unknownDeadlineIsRetained(){assertThat(controller.list("","전체","전체",true).items()).hasSize(4);}
 @Test void combinesFilters(){assertThat(controller.list("돌봄","경기","가족",false).items()).hasSize(1);assertThat(controller.list("돌봄","서울","가족",false).items()).isEmpty();}
 @Test void notFoundReturns404(){assertThatThrownBy(()->controller.detail("missing")).isInstanceOf(ResponseStatusException.class).satisfies(e->assertThat(((ResponseStatusException)e).getStatusCode().value()).isEqualTo(404));}
 @Test void todayIsNotExpired(){LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));BenefitRepository repo=()->List.of(dated("expired",today.minusDays(1)),dated("today",today),dated("future",today.plusDays(1)));assertThat(new BenefitController(repo,new MockEnvironment()).list("","전체","전체",true).items()).extracting(Benefit::id).containsExactly("today","future");}
 private Benefit dated(String id,LocalDate date){return new Benefit(id,"test","test","전국","생활","","","","",date,"","");}
}
