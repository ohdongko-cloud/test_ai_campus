# PRD: 1,800명 공개 오픈 대비 보안·로깅·회원/로그인 개편

- 작성일: 2026-05-26
- 작성자: Claude (요청자: ohdongko)
- 배포 일정: 1주일 뒤 전 직원(1,800명) 공개 오픈
- 범위: P0 보안 보강 + 접속·인증 로그 + 회원가입 이메일 인증 + 회원 필드 변경 + 간편 비번 + 자동로그인

---

## 1. 배경 / 문제

전면 DB 이관 + 임포트 도구까지 완료된 상태에서 1,800명 공개 오픈을 앞두고 보안·로깅·인증 흐름을 정비해야 한다.

### 현재 진단된 문제
**A. 보안 (P0~P1)**
- 관리자 비번이 `admin2026` 기본값 그대로 코드에 노출, 평문 헤더로 매 요청 전송, 레이트리밋 0.
- `/api/users/exists` 이메일 enumeration 자유 — 1,800명 이메일 추측 가능.
- 회원 로그인이 세션 토큰 없음 → 클라이언트 표시만으로 "로그인 상태" 처리.
- 댓글 in-memory 레이트리밋이 Vercel serverless에서 작동 안 함 → 봇 분당 수천 댓글 가능.
- 회원 비번 unsalted SHA-256.

**B. 로그 (현재 거의 없음)**
- 로그인 시도/실패/성공 로그 없음 → 무차별 대입 공격 감지 불가.
- 접속 로그 없음 → 누가 언제 사이트를 사용했는지 모름.
- 관리자 작업(영상 추가/삭제, 예약 승인 등) 감사 로그 없음.
- 에러 발생 시 추적 수단 없음 (`String(e)` 그대로 노출).

**C. 회원/로그인 흐름 (운영 요구사항)**
- 현재 회원가입은 **이름·법인·조직·직무·이메일·비번**으로 끝, 이메일 인증 없음.
- 외부인이 임의 이메일로 가입 가능 → 사내 서비스 전제 위반.
- 사번을 입력받지만 활용처 부족하고 PII 부담.
- 비번 1회 입력 → 오타 시 본인도 모름.
- "로그인 유지" 옵션 없음 → 매번 재로그인 부담.

## 2. 목표 / 비목표

### 목표
- G1. **보안 P0**: 관리자 비번 가드 + 서명된 JWT 쿠키 인증 + 레이트리밋 도입.
- G2. **로그·감사**: `auth_logs`, `admin_audit_logs`, `access_logs` 3 테이블로 인증 시도·관리자 작업·접속 추적.
- G3. **이메일 인증 회원가입**: `@eland.co.kr` 도메인만 허용, 6자리 OTP 코드 메일 발송 → 코드 입력 통과 시 가입 완료.
- G4. **회원 필드 변경**: 이름 → 닉네임, 사번 삭제, 법인/부서/직무 유지.
- G5. **간편 비번 + 2회 입력**: 4~8자리 숫자(OTP 스타일) 또는 6자 이상 영숫자. 가입/변경 시 두 번 입력해 일치 확인.
- G6. **자동로그인 (Remember me)**: 체크박스 활성 시 30일 유효 쿠키 발급. 미체크 시 세션 쿠키(브라우저 닫으면 만료).
- G7. 관리자 대시보드에서 인증 로그/감사 로그 조회 가능.

### 비목표
- 회원 비번 reset (비번 분실 시 재가입으로 처리, 다음 PR).
- SSO/OAuth (Google·Microsoft Workspace 등).
- 2FA.
- 권한 분리(편집자/뷰어 등). 어드민 단일 권한 유지.
- 실시간 알림(WebSocket).

## 3. 사용자 시나리오

### S1. 회원가입 (신규 흐름)
1. 사용자 → 환영팝업 또는 별도 가입 페이지에서 **`@eland.co.kr` 이메일** 입력 → "인증 코드 받기".
2. 서버: 이메일 형식·도메인 검증 → 6자리 OTP 발급 → DB(`email_verifications`)에 hash+만료시각 저장 → Resend로 메일 발송.
3. 사용자 메일함 → "[이랜드 AI 캠퍼스] 인증 코드: **123456** (10분 유효)"
4. 가입 페이지로 돌아와 **인증 코드 입력** → 통과하면 다음 단계.
5. 추가 정보 입력: **닉네임 / 법인 / 부서(팀) / 직무 / 간편 비번 / 비번 확인**.
6. "가입하기" → 회원 생성 → 자동 로그인 → 홈 진입.

### S2. 로그인
1. 이메일 + 간편 비번 입력. **"로그인 유지" 체크박스** 노출.
2. "로그인" → 서버 검증 → 성공 시:
   - 체크박스 ON: 30일 유효 httpOnly 쿠키 (`SameSite=Lax`)
   - 체크박스 OFF: 세션 쿠키 (브라우저 닫으면 만료)
3. 클라이언트는 쿠키만 들고 다님 (sessionStorage에서 평문 비번 보관 안 함).

### S3. 관리자가 로그인 로그 조회
1. 어드민 대시보드 → 신규 탭 "**로그**".
2. 필터: 시작/종료 시간, 종류(login_attempt, login_success, login_failure, signup, email_verify, admin_action).
3. 표 형태로 시간/IP/이메일/결과 표시.

## 4. 기능 요구사항

### F0. 환경변수
- `ADMIN_PASSWORD` — 강한 비번 (런타임에 기본값 `admin2026`이면 console.error + 운영에선 startup throw).
- `JWT_SECRET` — 32 바이트 hex 이상.
- `RESEND_API_KEY` — Resend API 토큰.
- `EMAIL_FROM` — 발신 표시 (예: `AI 캠퍼스 <onboarding@resend.dev>`).
- (선택) `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — 레이트리밋.

### F1. 관리자 인증 강화 (P0)
- `/api/admin/login` 신규: body `{ password }` → 검증 → JWT 쿠키 `admin_session` 발급 (24h).
- `/api/admin/logout` 신규: 쿠키 삭제.
- `requireAdmin(req)` 변경: 쿠키 JWT 검증 우선, 헤더 fallback은 임시 유지.
- 시작 가드: `process.env.NODE_ENV === 'production'` 이고 `ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD` 면 라우트에서 503 반환.
- `crypto.timingSafeEqual` 사용으로 timing leak 차단.

### F2. 회원 로그인 세션 (P0)
- `/api/users/login` 변경: 성공 시 JWT 쿠키 `user_session` 발급.
  - 기본 만료: 6h (세션 쿠키)
  - body에 `rememberMe: true` 면 30d (영구 쿠키)
- `/api/users/logout` 신규: 쿠키 삭제.
- 신규 헬퍼 `lib/session.ts`: `getCurrentUser(req)` → JWT 검증 후 user 객체.
- 클라이언트: 로그인 후 sessionStorage 평문 비번 저장 안 함.

### F3. 레이트리밋 (P0)
- `lib/ratelimit.ts` 신규 — Upstash Ratelimit 또는 in-memory fallback (개발).
- 적용 대상:
  - `/api/admin/login`: IP당 5분에 5회
  - `/api/users/login`: IP당 5분에 5회
  - `/api/users/exists`: IP당 1분에 10회
  - `/api/users/signup-request` (이메일 인증 발송): IP당 10분에 3회, 이메일당 10분에 3회
  - `/api/videos/[id]/comments` POST: 세션당 10초에 1회
  - `/api/posts` POST: 세션당 30초에 1회
  - `/api/comments` POST: 세션당 10초에 1회
  - `/api/reservations` POST: 세션당 1분에 1회
  - `/api/videos/[id]/like` POST: 세션당 1초에 1회

### F4. 로그·감사 (P1)
- 신규 테이블:
  - `auth_logs (id BIGSERIAL PK, type TEXT, email TEXT, ip TEXT, user_agent TEXT, success BOOLEAN, detail TEXT, created_at TIMESTAMPTZ DEFAULT now())`
    - type: `login_attempt | login_success | login_failure | signup_request | signup_complete | email_verify | admin_login_success | admin_login_failure | logout`
  - `admin_audit_logs (id BIGSERIAL PK, action TEXT, target_type TEXT, target_id TEXT, ip TEXT, detail JSONB, created_at)`
    - action 예: `video.create`, `video.delete`, `reservation.confirm`, `import.run`
  - `access_logs (id BIGSERIAL PK, session_id TEXT, user_id UUID NULL, path TEXT, ip TEXT, user_agent TEXT, created_at)` — 페이지별 접속 (게이트해서 SPA 메인 진입 시 1회만 기록).
- 신규 헬퍼 `lib/audit.ts`:
  - `logAuth(type, email, success, req, detail?)` — UA·IP·시각 자동 채움.
  - `logAdminAction(action, target, detail, req)`.
- 관리자 대시보드 신규 탭 "로그" — `AdminLogs.tsx` (인증/감사/접속 3개 서브탭, 페이지네이션).

### F5. 회원가입 이메일 인증 (P1, 핵심)
- 신규 테이블 `email_verifications`:
  - `id UUID PK, email TEXT, code_hash TEXT, expires_at TIMESTAMPTZ, consumed BOOLEAN DEFAULT false, ip TEXT, attempts INTEGER DEFAULT 0, created_at`
  - 인덱스 `(email, created_at)`.
- 신규 API:
  - `POST /api/users/signup-request` body `{ email }` →
    - 형식 + `@eland.co.kr` 도메인 검증.
    - 이미 가입된 이메일이면 200 + `{ alreadyMember: true }` (enumeration 방지 위해 항상 200).
    - 6자리 숫자 OTP 생성, sha256(code+salt) 저장, 10분 만료, Resend로 발송.
    - rate limit: IP 10분 3회 / 이메일 10분 3회.
  - `POST /api/users/signup-verify` body `{ email, code }` →
    - 가장 최근 미사용 verification 조회 → 만료 확인 → attempts++ → 5회 초과 시 무효화.
    - code hash 일치 시 consumed=true + 응답 200 + 임시 `signup_token` (15분 유효 JWT) 반환.
  - `POST /api/users` (가입 완료) 변경:
    - body에 `signup_token` 필수.
    - 검증 OK 시 회원 INSERT.
    - 가입 후 `user_session` 쿠키 자동 발급 (S2 자동 로그인).
- Resend 헬퍼 `lib/email.ts` — `sendVerificationEmail(to, code)`. 환경변수 누락 시 콘솔 로그(개발).

### F6. 회원 필드 변경 (P1)
- 스키마 변경 (`users`):
  - 컬럼명 변경: `name` → 의미상 닉네임으로 사용 (코드/타입에서 `nickname`으로 명명, DB는 `name` 유지하면 무중단).
  - 또는 DB도 ALTER (선택). **결정**: DB 컬럼 그대로 유지(`name`), 클라이언트만 "닉네임"으로 표기.
  - `employee_id` 컬럼 사용 안 함 → 신규 가입 시 NULL 허용 + UI에서 입력 제거. (기존 데이터는 유지)
  - `corporation_name`, `organization_name`, `position` 유지.
- `UserInfo` 인터페이스에서 `employeeId` deprecate (선택적 유지).
- UI: 회원가입 폼에서 "이름" 라벨 → "닉네임", 사번 입력 필드 제거.

### F7. 간편 비번 + 2회 입력 (P1)
- 정책: 최소 4자, 최대 12자, 영문/숫자 허용(특수문자 불필요 — "간편"이 목적).
- 가입/변경 시 input 2개 (`password`, `passwordConfirm`) → 일치하지 않으면 클라이언트 즉시 에러 + 서버에서도 재확인.
- 서버: **bcrypt(cost 10)** 로 변경 (기존 SHA-256 사용자는 다음 로그인 시 자동 재해시 — `users.password_hash`에 `$2b$` 접두사로 bcrypt 식별).

### F8. 자동로그인 (Remember me)
- 로그인 폼에 체크박스 "로그인 유지" (디폴트 OFF). PRD §F2와 통합.

### F9. P1 마무리
- 예약 공개 GET에서 `maskedName` 제거. `{date, startTime, endTime, status}`만 반환.
- GET 캐시 헤더 추가 (`/api/stats`, `/api/services`, `/api/guide`, `/api/video-levels`, `/api/videos`, `/api/blocked-slots`): `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- catch 블록의 `String(e)` → `{ error: '서버 오류가 발생했습니다.' }` + console.error.

## 5. UX / 디자인

### 회원가입 흐름 (3단계 모달)
```
Step 1: 이메일 입력
┌────────────────────────────────┐
│ 이랜드 사내 메일 주소 (@eland.co.kr) │
│ [────────────────────────]     │
│ [ 인증 코드 받기 ]              │
└────────────────────────────────┘

Step 2: 코드 입력
┌────────────────────────────────┐
│ {email}로 전송된 6자리 코드      │
│ [_][_][_][_][_][_]              │
│ 코드가 안 오면 [재발송]          │
└────────────────────────────────┘

Step 3: 정보 입력
┌────────────────────────────────┐
│ 닉네임:    [───────────]        │
│ 법인:      [▼]                 │
│ 부서(팀):  [───────────]        │
│ 직무:      [───────────]        │
│ 간편 비번: [─────] (4~12자)      │
│ 비번 확인: [─────]              │
│ [ 가입 완료 ]                   │
└────────────────────────────────┘
```

### 로그인 폼
```
이메일:   [────────]
간편 비번: [────────]
☐ 로그인 유지         [로그인]
```

## 6. 데이터 / 스키마 변경

```sql
-- ───────────────────────────────────────────────
-- 인증 로그
CREATE TABLE IF NOT EXISTS auth_logs (
  id          BIGSERIAL PRIMARY KEY,
  type        TEXT NOT NULL,
  email       TEXT,
  ip          TEXT,
  user_agent  TEXT,
  success     BOOLEAN NOT NULL DEFAULT false,
  detail      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_logs_type_idx ON auth_logs (type, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_logs_email_idx ON auth_logs (email, created_at DESC);

-- 관리자 감사
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  ip          TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON admin_audit_logs (action, created_at DESC);

-- 접속 로그
CREATE TABLE IF NOT EXISTS access_logs (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT,
  user_id     UUID,
  path        TEXT,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_logs_created_idx ON access_logs (created_at DESC);

-- 이메일 인증
CREATE TABLE IF NOT EXISTS email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed    BOOLEAN NOT NULL DEFAULT false,
  ip          TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_email_idx ON email_verifications (email, created_at DESC);

-- users.employee_id 컬럼 NULL 허용 (기존 NOT NULL이면)
-- 컬럼 사용 안 함, 신규 가입 시 NULL.
ALTER TABLE users ALTER COLUMN employee_id DROP NOT NULL;
-- (이미 NULL 허용이면 에러 발생 — 이미 적용으로 간주)
```

## 7. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 동일 이메일로 인증 요청 반복 | rate limit 10분 3회 + DB 누적, 최신 코드만 유효 |
| 이미 가입된 이메일 | 200 + `alreadyMember: true` 반환 (enumeration 방지) — 실제 메일 발송 X |
| 코드 5회 오입력 | 해당 verification 무효화 + 새로 요청해야 함 |
| Resend 실패 (API 키 누락/할당량) | 콘솔 에러 + 사용자에게 "메일 발송 실패. 잠시 후 다시 시도" |
| 만료된 코드 | 검증 시 410 Gone, 재발송 안내 |
| JWT 만료/위조 | 401 + 쿠키 삭제 + 로그인 페이지 유도 |
| Upstash 미연동 | in-memory fallback 사용 (서버 인스턴스 단위, 완벽한 보호는 못 됨, 경고 로그) |
| 도메인 검증: 대문자 메일 | 항상 lowercase + trim |
| 봇이 `@eland.co.kr` 위조 | 인증 코드 메일은 실제 사서함에만 도달 → 코드 받지 못해 차단됨 |
| 회원 비번 SHA-256 → bcrypt 마이그레이션 중 로그인 | 해시 prefix로 분기, SHA-256 매치 시 즉시 bcrypt로 재저장 |

## 8. 보안 / 권한

- JWT는 HS256, secret은 32바이트 이상 환경변수.
- 쿠키: `HttpOnly`, `Secure`, `SameSite=Lax`.
- IP 기록은 `x-forwarded-for` 첫 번째 항목.
- email_verifications에 코드 평문 저장 X (SHA-256 hash + 솔트는 server-side 환경변수 또는 secret).
- bcrypt cost 10 (서버리스 적정).
- 관리자 작업 로그는 페이지 진입 권한 동일.
- access_logs는 PII가 아닌 path만, IP는 운영 7일 후 자동 삭제 cron(추후).

## 9. 성공 기준 / 테스트

- [ ] `@eland.co.kr` 외 도메인은 400 "허용된 도메인이 아닙니다."
- [ ] 코드 메일 수신 → 입력 → 가입 완료까지 정상 흐름.
- [ ] 만료된 코드 → 410.
- [ ] 5회 오입력 → 무효화 메시지.
- [ ] 로그인 후 쿠키 발급 확인 (Application 탭).
- [ ] "로그인 유지" 체크 시 30일 만료. 미체크는 브라우저 종료 시 만료.
- [ ] 관리자 비번 가드: NODE_ENV=production + 기본값이면 503 응답.
- [ ] 5회 연속 잘못된 admin 로그인 시도 → 5분 차단.
- [ ] 어드민 "로그" 탭에서 인증/감사 로그 표시.
- [ ] 빌드 통과.

## 10. 롤아웃

### 배포 순서 (이번 PR)
1. SQL 마이그레이션 적용 (Neon SQL Editor 또는 스크립트).
2. Vercel env 4종 추가 (ADMIN_PASSWORD, JWT_SECRET, RESEND_API_KEY, EMAIL_FROM) → Redeploy.
3. (선택) Upstash 환경변수 2개 추가 → Redeploy.
4. 코드 push.
5. 새 회원가입 흐름으로 시범 가입 (본인 이랜드 메일).
6. 관리자 로그 탭에서 로그 확인.
7. 기존 회원은 로그인 시 자동 마이그레이션(bcrypt).

### 롤백
- 신규 라우트 제거 + JWT 쿠키 발급 제거. DB 테이블은 남겨도 무방.

## 11. 미해결 질문

- Resend 발송 도메인: `onboarding@resend.dev` 사용 vs `@eland.co.kr` 커스텀 도메인. **결정**: 시작은 resend.dev, 추후 IT팀 협조로 커스텀 도메인 전환.
- 가입 시 법인 선택 옵션: 드롭다운 리스트 제공 vs 자유 입력. **결정**: 자유 입력 유지 (이랜드 그룹사 다양).
- 기존 employee_id 입력 사용자 처리: 그대로 NULL로 남겨두고 UI에서 노출 안 함. **결정**: 그대로.
