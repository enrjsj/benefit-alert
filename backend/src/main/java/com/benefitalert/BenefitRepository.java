package com.benefitalert;
import java.util.List;
/** 데이터 공급 방식과 화면용 조회 로직을 분리합니다. */
public interface BenefitRepository { List<Benefit> findAll(); }
