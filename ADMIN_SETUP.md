# 관리자 검토와 Google 로그인 설정

## 구현 및 권한
- 정정 요청: 공고 상세 → 공고 정보 정정 요청.
- 운영자 검토: 로그인 → 내 계정 → 내 정정 요청과 검토 → 검토 범위 `관리자 전체 요청`.
- 서버 `ADMIN_USER_IDS`(UUID, 쉼표 구분) 또는 `ADMIN_EMAILS`(검증된 이메일, 쉼표 구분)로 지정합니다. 실제 운영자 주소는 Render에만 설정하며 저장소에 기록하지 않습니다.
- 매 요청마다 Supabase `/auth/v1/user`에서 토큰·이메일 인증 여부를 검증합니다. 브라우저의 이메일 입력, user_metadata, UI 표시 여부는 권한 근거가 아닙니다.
- 관리자 설정이 없으면 접수를 중지합니다. 일반 사용자는 자신의 요청만 읽으며 관리자 전체 조회·답변 API는 403으로 차단합니다.
- 답변과 상태 변경은 revision으로 충돌을 차단하고 별도 감사 기록을 남깁니다. 처리 완료·반려는 답변 필수입니다. 공고 원문은 자동 변경하지 않으므로 원본 정정 후 처리 완료하세요.
- 사용자당 24시간 10건, 같은 공고의 진행 중 요청 중복 방지, 재시도 clientId 중복 방지, 20건씩 페이지 조회를 적용합니다.
- V8은 기존 Flyway 체계로 benefit_alert 전용 스키마에 적용됩니다. 두 테이블은 RLS 활성화, 브라우저용 정책·권한 미부여입니다.

## Google OAuth 제공자 설정 (최초 1회)
2026-10-17 점검 당시 Google 제공자는 비활성화 상태입니다. 애플리케이션 구현과 별도로 아래 설정이 필요합니다. 비밀번호·client secret을 채팅 또는 Git에 넣지 마세요.

1. Google Cloud Console → Google Auth Platform에서 동의 화면을 설정하고 웹 애플리케이션 OAuth 클라이언트를 만듭니다. 테스트 상태라면 로그인할 계정을 테스트 사용자로 등록합니다.
2. 승인된 JavaScript 원본: `https://benefit-alert.vercel.app`
3. 승인된 리디렉션 URI: `https://efmomntlstanyejcrjdl.supabase.co/auth/v1/callback`
4. Supabase benefit-alert 프로젝트 → Authentication → Sign In / Providers → Google에서 해당 Client ID와 Client Secret을 입력하고 활성화합니다.
5. Authentication → URL Configuration의 Site URL을 `https://benefit-alert.vercel.app`로, Redirect URLs에 `https://benefit-alert.vercel.app/`를 등록합니다. 기존 비밀번호 복구용 URL은 유지합니다.
6. 사이트를 새로고침하고 Google로 로그인합니다. 지정한 관리자 이메일로 로그인한 뒤 관리자 전체 요청 선택지가 보이는지 확인합니다. 다른 계정에는 보이면 안 됩니다.

앱은 공개 인증 설정에서 Google 제공자가 활성화됐을 때만 버튼을 사용할 수 있게 합니다. OAuth 비밀값은 프런트엔드/Render에 필요 없습니다. 실제 Google 인증·관리자 로그인을 완료한 것으로 간주하려면 위 수동 로그인까지 확인해야 합니다.

## 운영 확인
일반 계정으로 공고 오류를 접수 → 관리자 계정으로 검토 중/답변 저장 → 일반 계정에서 결과 확인. 두 관리자 창에서 동일 요청을 열어 한쪽을 저장한 뒤 다른 쪽 저장은 충돌 안내가 나오는지 확인합니다. 테스트 종료 후 테스트 요청은 반려 사유를 남겨 종료합니다.
