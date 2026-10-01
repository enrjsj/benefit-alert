# benefit-alert · 혜택온

React + Vite + TypeScript / Java 21 + Spring Boot / PostgreSQL 지원금 탐색 서비스.

## 구현된 범위

- 지원금 목록, 키워드·지역·분야·마감 여부 필터, 상세 모달
- 관심목록(현재 브라우저 localStorage), 반응형, 로딩·오류·빈 상태
- Spring 조회 API, demo/prod 프로필 분리, Flyway PostgreSQL 스키마
- Docker 로컬 구성 및 GitHub Actions 빌드·테스트(자동 배포 없음)

**현재 demo 데이터는 가상 공고입니다. 실제 정책 정보가 아니며 신청할 수 없습니다.**
실제 정부 API 수집, 회원 인증, 맞춤 자격 매칭, 이메일·푸시 발송은 미구현입니다.

## 로컬 실행

필수: Node.js 22, Java 21, Maven 3.9 이상. 두 터미널에서 각각 실행합니다.

```bash
cd backend
mvn spring-boot:run
```

```bash
cd frontend
npm ci
npm run dev
```

http://localhost:5173 에서 확인합니다. `/api` 요청은 Vite 개발 프록시가 8080으로 전달합니다.
API 자체 점검: http://localhost:8080/api/health

## PostgreSQL 모드

```bash
cp .env.example .env
# .env의 LOCAL_DB_PASSWORD를 로컬 전용 값으로 변경
 docker compose up --build
```

prod는 예시 데이터를 넣지 않으므로 최초 조회 결과는 빈 목록입니다. 프런트는 위 명령으로 별도 실행합니다.
Supabase 연결 시 DB_URL(JDBC URL 및 SSL 설정), DB_USERNAME, DB_PASSWORD를 실행 환경에 주입하고 SPRING_PROFILES_ACTIVE=prod를 지정합니다.
비밀번호·API 키는 Git에 커밋하지 않습니다. 원격 운영 배포는 별도 요청 후 진행합니다.

## API

- `GET /api/benefits?q=&region=전체&category=전체&openOnly=false`: items, demo 반환
- `GET /api/benefits/{id}`: 상세, 없으면 404
- `GET /api/health`: 프로세스 생존 확인(DB 연결 상태를 의미하지 않음)

지역 필터는 선택 지역과 전국을 포함합니다. 기간 미정 공고는 마감 제외 필터에서도 유지합니다.
관심목록은 계정 동기화가 아니며 브라우저 저장소 삭제 시 사라집니다.
현재 소규모 초기 구조는 전체 조회 후 필터링합니다. 실데이터 수집 전 SQL 검색·페이지네이션으로 전환해야 합니다.

## 검증

```bash
cd frontend
npm run build
```

```bash
cd backend
mvn verify
```

## 다음 단계

1. 공공데이터포털 행정안전부 공공서비스(혜택) 정보 API 활용 신청 및 실제 응답 검증
2. 원본 보관, 지역·대상 정규화, 페이지별 수집, 중복 upsert, 실행 이력과 재시도
3. DB 페이지네이션·검색 및 PostgreSQL 통합 테스트
4. 회원·권한, 맞춤 조건과 판정 근거, 서버 관심목록
5. 수신 동의·해제, 알림 outbox와 중복 방지·발송 재처리
6. 운영 호스팅 결정, 공개 페이지 SEO, 접근성 및 브라우저 자동화 검증

이메일 발송, 운영 배포 및 자동 배포 설정은 포함하지 않습니다.

## 공개 데모 배포

1. Render 계정에서 루트 `render.yaml` Blueprint를 연결하거나 `backend/Dockerfile`로 웹 서비스를 만듭니다. 무료 플랜 예시이며 중지 후 첫 요청은 지연될 수 있습니다.
2. Vercel에서 이 저장소를 가져오고 Root Directory를 `frontend`로 지정합니다.
3. Vercel 환경변수 `VITE_API_BASE_URL`에 실제 Spring HTTPS 주소를 설정한 뒤 빌드합니다. 이 값은 공개 주소이며 비밀 키를 넣으면 안 됩니다.
4. Spring 환경변수 `CORS_ALLOWED_ORIGINS`에 실제 Vercel Origin을 설정합니다(끝 슬래시 없이, 여러 개면 쉼표 구분).
5. `/api/health`, 공고 조회, 브라우저 관심목록을 확인합니다. 현재 배포 대상은 demo 프로필입니다.

Render 자동 배포는 꺼두었습니다. Vercel Git 연결 시 자동 배포 설정은 프로젝트에서 따로 확인해야 합니다.
