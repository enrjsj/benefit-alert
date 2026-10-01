# 개발 상태 · 2026-10-01

## 이번 작업
- React + Vite + TypeScript 화면과 Spring Boot API 기본 구성
- 공고 목록·검색·지역/분야/마감 필터·상세 모달
- 브라우저 관심목록, 반응형 스타일, 오류·로딩·빈 상태
- PostgreSQL prod 저장소, Flyway 마이그레이션, Docker 구성
- 실제 데이터와 구분한 가상 공고 demo 프로필

## 검증 환경
- 프런트 TypeScript 검사 및 Vite 프로덕션 빌드 통과
- 백엔드: 실행 환경에 Java 17만 있어 `-Djava.version=17`로 호환 빌드 검증
- 프로젝트·Docker·CI 기준은 Java 21이며 해당 버전 실행 검증은 별도로 필요
- Mockito는 실행 환경에서 JVM 동적 attach를 요구하지 않는 subclass 모드 사용
- 브라우저 자동 검증은 Chromium 배포 파일 다운로드 실패로 미실행
- PostgreSQL 실제 연결·마이그레이션은 미검증

## 미구현
실제 공공 API 수집, 회원 인증, 맞춤 판정, 이메일 발송. 목록 화면 알림 영역은 준비 중으로 표시.

## Git·운영
사용자 요청으로 커밋·푸시와 배포 준비 진행. 실제 공개 배포는 호스팅 계정 연결 후 진행.
현재 README의 실행 명령으로 로컬 확인 가능.
