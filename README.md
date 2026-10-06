# benefit-alert · 혜택온

React 19 + Vite + TypeScript / Java 21 + Spring Boot / PostgreSQL 지원금 탐색 서비스.

- 운영: https://benefit-alert.vercel.app
- API: https://benefit-alert.onrender.com
- 저장소: `enrjsj/benefit-alert`
- Render: `srv-db1kt90u01pc73euhpsg`, Vercel: `1-4156/benefit-alert`
- Supabase: `efmomntlstanyejcrjdl`, 전용 DB 스키마 `benefit_alert`

## 제공 기능

- 서버 검색·지역·분야·마감 필터, 정렬, 페이지네이션, URL 검색 조건 유지
- 지역·모든 지원 분야·검색어를 한 검색 영역에서 선택, 모바일 지역·분야 나란히 배치
- 상세 직접 링크와 공유, 한국 시간 기준 D-day, 로딩·오류·빈 상태
- 비회원 관심목록(브라우저 최대 100개), 회원 관심목록(계정 최대 500개)
- 최대 3개 혜택 비교: 지원 대상·내용·기간·방법·제공 기관·신청 준비 진행률
- 공고별 신청 체크리스트: 자격 확인, 서류 준비, 기간·접수 방법 확인, 직접 신청 후 접수 확인
- 회원 비교·체크리스트 계정 동기화, 이 기기 기록 가져오기, 신청 준비 목록·진행 상태 필터
- Supabase 이메일 가입·인증·로그인·비밀번호 재설정, 계정별 관심 지역·분야
- 선택한 조건의 최근 7일 새 공고와 저장한 공고의 7일 이내 마감을 사이트 알림함에서 확인
- 정부24 공공서비스 목록 수집, 원본 JSON 보관, 중복 갱신, 실행 기록

맞춤 조건은 지역·분야 기반 탐색이며 지원 자격을 판정하지 않습니다. 알림은 방문 시 생성하는 사이트 알림함이며 이메일·푸시를 발송하지 않습니다. 비회원 저장 내용은 사용자가 가져오기를 누를 때 계정에 합쳐집니다.

## 비교와 신청 체크리스트

공고 카드의 **비교 담기**로 최대 3개를 고른 뒤 하단 **비교하기**를 누릅니다. 검색 조건과 페이지를 바꿔도 선택을 유지하며, 비교할 때 API에서 최신 공고를 다시 조회합니다. 더 이상 제공되지 않는 공고는 안내 후 개별 제거할 수 있습니다. 비교표의 **상세·신청 준비**를 누르면 공고별 체크리스트로 이어집니다.

체크리스트는 사용자가 직접 확인한 사항을 표시하는 메모입니다. 자동 신청, 접수 확인 또는 자격 판정이 아닙니다. **회원 비교 선택·체크리스트는 계정에 저장**하여 다른 기기에서도 이어갈 수 있고, 비회원 기록은 현재 브라우저에 저장합니다. 로그아웃하면 비회원 기록으로 돌아갑니다. 비회원 기록은 브라우저 데이터 삭제 시 사라지며, 저장소 사용이 차단되면 이번 방문에만 기억된다고 안내합니다. 최대 200개 공고의 체크 상태를 보관합니다.

상단 **신청 준비**에서 진행 중·확인 완료 공고를 모아 보고 준비를 이어가거나 기록을 삭제합니다. 더 이상 제공되지 않는 공고의 기록도 보관하며 개별 삭제할 수 있습니다. 확인 완료는 체크 항목을 모두 기록했다는 뜻입니다.

로그인 후 신청 준비 화면에서 **이 기기 기록 가져오기**를 누르면 비회원 기록과 이전 버전에서 이 계정으로 브라우저에 저장한 기록을 서버 기록에 합칩니다. 기존 체크 항목을 유지하고 중복을 제거합니다. 가져오기 후 브라우저 원본은 유지합니다. 합쳐서 비교 3개·체크리스트 200개를 초과하면 저장하지 않고 정리 후 다시 시도하도록 안내합니다. 여러 기기가 동시에 수정하면 서버의 최신 기록을 불러오고 변경을 다시 선택하도록 안내하여 덮어쓰기를 막습니다. 저장 실패 시 확인된 기록을 유지하고 오류를 알립니다.

## 나중에 키를 연결하는 방법

키 없이도 서버·검색·상세·브라우저 관심목록은 동작합니다. 회원 기능과 수집은 비활성화됩니다. 다음 값은 **해당 benefit-alert Render 서비스**의 Environment에 저장한 뒤 재배포합니다. 프런트 재빌드는 필요 없습니다.

| 환경변수 | 값 |
| --- | --- |
| `SUPABASE_PUBLISHABLE_KEY` | 위 Supabase 프로젝트의 `sb_publishable_...` 키 또는 기존 공개 anon 키 |
| `GOV24_API_KEY` | 공공데이터포털 정부24 공공서비스(혜택) API 활용 신청 후 승인된 인증키 |

`SUPABASE_PUBLISHABLE_KEY`는 브라우저 인증을 위해 공개됩니다. **secret 또는 service_role 키를 넣지 않습니다.** 서버는 해당 형식의 키를 차단합니다. DB 비밀번호와 정부 API 키는 공개하지 않습니다.

Supabase Authentication → URL Configuration에서 Site URL을 `https://benefit-alert.vercel.app`로, Redirect URLs에 `https://benefit-alert.vercel.app/`를 설정합니다. 이메일 가입/인증 기능을 활성화하고 서비스 규모에 맞게 인증 메일 발송 설정을 구성합니다. 비밀번호는 8자 이상을 사용합니다.

백엔드는 Supabase `/auth/v1/user`에서 토큰과 이메일 인증 여부를 확인한 사용자 ID만 사용합니다. `member_profile`, `member_saved`, `member_notification`, `member_planning`에는 RLS가 활성화되어 있으며 브라우저가 DB에 직접 접근하지 않습니다. 계정 API는 `Cache-Control: no-store`입니다.

**실제 키를 넣은 후 해야 할 확인:** 정부 API 승인·응답 필드와 첫 수집 성공, 회원 인증 메일 도착·가입·로그인·비밀번호 재설정. 키 없이 실행하는 테스트는 실제 외부 서비스의 승인을 검증하지 않습니다.

## 수집 정책

[행정안전부 대한민국 공공서비스(혜택) 정보](https://www.data.go.kr/data/15113968/openapi.do)의 `/api/gov24/v3/serviceList`를 사용합니다. 키가 있으면 서버 시작 45초 후부터 1분마다 실행 필요 여부를 확인합니다. 전체 성공 후 6시간, 일시 실패·부분 수집 후 10분 뒤 재시도하며 인증 거부(401/403)는 6시간 뒤 다시 확인합니다. Render 절전 시 내부 스케줄러도 멈춥니다. `.github/workflows/collection.yml`이 매시간 17분(UTC)에 기존 API를 호출해 깨우고 수집 완료를 점검합니다. GitHub 예약 작업은 지연될 수 있어 정확한 정시 실행을 보장하지 않습니다.

페이지당 100건, 최대 200페이지를 수집하며 페이지를 한 SQL로 일괄 저장합니다. 저장과 임대 확인을 같은 SQL에서 수행해 소유권이 만료된 작업의 쓰기를 차단합니다. HTTP 연결 10초·응답 30초 제한과 페이지 사이 전체 실행 40분 제한을 적용합니다. 동시 실행은 15분 DB 임대로 제한하며 만료된 실행은 중단으로 기록하고 복구합니다. 페이지마다 진행 건수를 기록합니다. 중간 오류·빈 응답·중복 페이지·수집 상한·거부된 레코드가 있으면 기존 공고를 비활성화하지 않습니다. 온전한 0건 초과 스냅샷을 모두 받은 경우에만 이번 응답에 없는 정부24 공고를 비활성화합니다. 수동 공고는 유지합니다. 원본이 같으면 `updated_at`을 바꾸지 않습니다.

기관명에 명확한 지역 정보가 없으면 `지역확인`으로 두며 중앙행정기관만 `전국`으로 분류합니다. 모호한 신청 기간은 원문을 보존하고 날짜를 추측하지 않습니다. 출처의 공식 안내를 반드시 확인해야 합니다.

## 운영 DB 환경

기존 `DB_PASSWORD`는 Render에 비밀 값으로 보관합니다.

```text
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:postgresql://aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require
DB_USERNAME=postgres.efmomntlstanyejcrjdl
SPRING_FLYWAY_SCHEMAS=benefit_alert
SPRING_FLYWAY_DEFAULT_SCHEMA=benefit_alert
SPRING_DATASOURCE_HIKARI_SCHEMA=benefit_alert
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=3
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=1
```

Flyway V2는 공고 수집 메타데이터와 회원별 테이블, V3는 계정별 신청 준비 기록과 동시 수정 확인용 revision을 추가합니다. 기존 서버 배포 시 자동 마이그레이션합니다. prod에 예시 공고를 넣지 않습니다. 청약 프로젝트와 해당 프로젝트의 DB·배포 설정은 변경하지 않습니다.

## 로컬 실행과 검증

Node.js 22, Java 21, Maven 3.9 이상이 필요합니다.

```bash
cd backend
mvn spring-boot:run
```

```bash
cd frontend
npm ci
npm run dev
npm test
npm run build
```

http://localhost:5173 → Vite 프록시 → http://localhost:8080. 기본 demo 프로필의 공고는 가상 예시이며 실제 신청할 수 없습니다. prod 로컬 실행은 `.env.example`과 `docker compose`를 참고합니다.

```bash
cd backend
mvn verify
```

실제 PostgreSQL 통합 테스트까지 실행하려면 임시 DB를 만듭니다. 아래 비밀번호는 로컬 테스트 전용이며 운영 비밀번호가 아닙니다. 테스트는 고유한 `test_...` 스키마를 생성한 뒤 삭제합니다.

```bash
docker run --rm --name benefit-test-db -e POSTGRES_PASSWORD=benefit-local-test -e POSTGRES_DB=benefit -p 127.0.0.1:55432:5432 -d postgres:17-alpine
TEST_DATABASE_URL=jdbc:postgresql://127.0.0.1:55432/benefit mvn verify
docker stop benefit-test-db
```

GitHub Actions도 PostgreSQL 통합 테스트를 실행합니다. 테스트 항목에는 사용자별 데이터 분리, 알림 중복 방지, 마감 검색·페이지네이션, 수집 성공/실패 시 공고 보존, 인증 토큰 검증과 비밀 키 노출 차단이 포함됩니다.

## API

- `GET /api/benefits?q=&region=전체&category=전체&openOnly=false&page=1&size=12&sort=default`: items, demo, total, page, size, totalPages
- `sort`: default / deadline / title. 비회원 관심목록은 `ids=a,b`, 회원은 `savedOnly=true`와 Bearer 토큰 사용
- `GET /api/benefits/{id}`: 공고 상세
- `GET /api/client-config`: 공개 인증 설정(키 미설정이면 authEnabled=false)
- `GET /api/data-status`: 수집 설정, 마지막 전체 성공 시각, 진행 건수, 잠금 만료, 12시간 지연, 다음 시도 예정 시각(prod, no-store)
- `GET|PUT /api/account/profile`: region, category, notificationsEnabled
- `GET|POST /api/account/saved`: POST body `{"ids":["공고 ID"]}`
- `DELETE /api/account/saved/{id}`
- `GET /api/account/notifications`, `PUT /api/account/notifications/{id}/read`
- `GET /api/account/planning`: `{revision,data:{version:1,compareIds,checklists}}`
- `PUT /api/account/planning`: 위 응답 형식으로 저장. revision 충돌은 409이며 최신 기록을 다시 조회해야 함
- `POST /api/account/planning/import`: `{version:1,compareIds,checklists}`를 기존 기록과 합침
- `GET /api/health`: 프로세스 생존 확인(DB 연결 보장은 아님)

회원 API는 prod에서만 제공하며 모든 요청에 Bearer 토큰이 필요합니다. Vercel의 `frontend/vercel.json`이 `/api`를 Render로 전달합니다. GitHub 푸시는 Vercel 배포를 시작합니다. Render Git 연결 상태에 따라 수동 배포가 필요할 수 있습니다.

## 외부 수집 점검

GitHub Actions의 **Scheduled collection check**는 매시간 기존 Render API를 호출합니다. 성공 후 6시간 수집 정책은 서버에서 유지하며, 기한이 되면 내부 스케줄러가 시작합니다. 새 유료 서비스나 추가 비밀 키를 사용하지 않습니다.

점검은 최대 60분 동안 20초 간격으로 상태를 확인해 절전 복귀·임대 만료 복구·전체 수집을 기다립니다. 현재 성공 스냅샷이면 종료하고, 이번 시도의 실패·부분 수집·설정 누락·시간 초과는 작업 실패로 표시합니다. 실행 요약에 마지막 성공 시각과 처리 건수를 남깁니다. GitHub Actions 사용 중지, 예약 지연, 저장소 비활성에 따른 자동 예약 중지는 별도 운영 확인이 필요합니다. 실패 재시도는 서버가 실행 중일 때 10분이며 절전 후 복귀는 외부 작업 주기에 따라 늦어질 수 있습니다.

수동 검증: `gh workflow run collection.yml --ref main`. 로컬 점검 테스트: `python -m unittest discover -s scripts -p 'test_*.py'`.

## 시·군·구 검색

시·도를 선택하면 실제 활성 공고의 제공기관에서 확인된 시·군·구 목록을 불러옵니다. `서울 → 강남구`, `경기 → 수원시`처럼 지역과 분야·검색어를 함께 적용할 수 있습니다. 시·도를 바꾸면 세부 지역과 페이지가 초기화되며, URL의 `district` 조건은 공유·새로고침·뒤로 가기에서 유지됩니다.

`GET /api/regions/districts?region=서울`은 선택 가능한 세부 지역 목록, `GET /api/benefits?region=서울&district=강남구`는 공고 검색입니다. 지역 선택 시 전국 공고를 제외합니다. 상세 지역 선택 시 해당 시·군·구 공고만 조회하며, 시도 공통·세부 지역 미확인 공고는 상세 지역 전체 선택 시에만 포함합니다. 지역 전체 선택 시에는 전국 공고도 포함합니다. 다른 시도의 지역 공고와 같은 시도의 다른 시·군·구 공고는 제외합니다. `수원시 영통구`처럼 제공기관에 하위 구가 확인되면 시 전체 선택은 하위 구 공고를 포함하고, 특정 구 선택은 해당 구 공고만 조회합니다. 자격은 제공기관 지역과 다를 수 있으며 자동 자격 판정은 하지 않습니다. 새 DB 마이그레이션이나 전체 재수집 없이 기존 공고에 바로 적용됩니다.

### 세부 지역 조회 복구

시·군·구 조회는 응답 본문까지 최대 20초만 기다립니다. 시간 초과나 통신 실패 시 로딩을 끝내고 ‘시·군·구 목록 다시 불러오기’를 제공합니다. 이 버튼은 공고 목록이나 상세 화면을 다시 요청하지 않습니다.

같은 탭에서 받은 공개 지역 목록은 메모리와 sessionStorage에 최대 24시간 보관해 재방문·새로고침 시 바로 표시하고, 최신 목록을 뒤에서 확인합니다. 최신 조회에 실패해도 이전 목록으로 선택할 수 있으며 캐시 사용 여부를 안내합니다. 저장소 사용이 차단되면 메모리 캐시만 사용합니다. 시·도를 바꾸면 이전 요청은 취소하고, 늦게 도착한 응답이 새 지역을 덮어쓰지 않습니다.

### 기관명 변경에 따른 지역 분류 보완

정부24 원본의 `전남광주통합특별시 ○○구/○○시·군`은 식별 가능한 광주 5개 구·전남 22개 시군을 기존 지역 필터에 연결합니다. 원본 기관명은 유지하며, 광역 공통 기관·공공기관·알 수 없는 구역은 임의로 광주 또는 전남에 배정하지 않습니다. Flyway V4는 기존 정부24 공고 중 `지역확인`으로 남은 해당 지역의 분류만 복구합니다. 원본 JSON, 활동 상태, 수정 시각과 저장된 관심·신청 준비 기록은 유지됩니다. 다음 수집에도 동일한 분류 규칙을 적용합니다.

### 마감일과 신청 준비 캘린더

정부24 신청 기간 전체가 연·월·일을 갖춘 단일 날짜 또는 날짜 범위인 경우에만 마감일로 인식합니다. `2026-12-18`, `2026.12.18`, `2026/12/18`, `2026년 12월 18일`과 시작·종료 연도가 모두 있는 `~`/`∼` 범위를 지원합니다. 시작일보다 빠른 종료일, 잘못된 달력 날짜, 연도 생략, 시간·조건·설명이 붙은 표기는 추정하지 않습니다.

Flyway V5는 기존 정부24 공고에서 누락된 마감일만 채웁니다. 기간 원문, 원본 JSON, 수정 시각, 지역과 활성 상태는 보존합니다. 마감된 공고 제외·마감순 정렬은 보정된 날짜를 반영합니다.

신청 준비 목록에서 준비 상태와 함께 7일/30일 이내 마감, 마감된 공고, 마감일 미정 조건을 적용하고 마감 가까운 순으로 정렬할 수 있습니다. 한국 날짜 기준으로 오늘 마감도 포함합니다. 공고 상세와 신청 준비에서 날짜가 확인된 미마감 공고의 캘린더 파일(`.ics`)을 내려받을 수 있습니다. 캘린더 앱에 직접 가져오는 종일 일정이며, 접수 종료 시각과 변경 여부는 공식 안내를 확인해야 합니다. 자동 일정 동기화나 푸시 알림을 설정하는 기능은 아닙니다.
