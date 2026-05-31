# PRD: 이랜드리테일 AI 캠퍼스 — 현재 시스템 상태 스냅샷

- 최초 작성: 2026-05-30
- 최종 갱신: 2026-05-30
- 현재 버전: **v1.0-rc** (시연 직전)
- 운영 URL: https://retail-ai-campus.vercel.app
- 작성자/소유자: ohdongko + Claude

> **이 문서의 목적**
> 새 작업 세션을 시작할 때 "지금 라이브는 어떤 상태인가"를 1분 안에 파악할 수 있게 한다.
> 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)에서 관리.

---

## 1. 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 15 (App Router, SSR) + TypeScript |
| DB | Neon Postgres (HTTP serverless driver, `lib/db.ts`) |
| 호스팅 | Vercel (Edge Network + Functions) |
| 인증 | JWT (jose, httpOnly 쿠키) + bcrypt(legacy SHA-256 마이그레이션) |
| 레이트리밋 | Upstash Redis (sliding window) + 메모리 fallback |
| 이메일 | Resend (회원가입 OTP 6자리) |
| 모니터링 | Sentry (client/server/edge/instrumentation 4종 config) |
| 스케줄러 | Vercel Cron (`vercel.json`) |
| 안드로이드 | Capacitor 7.x + WebView ([android-app.md](./android-app.md)) |

---

## 2. 페이지/탭 구조 (`app/page.tsx` SPA)

해시 라우팅(`#home`, `#video`, `#meeting`, `#guide`, `#share`, `#board`, `#admin`)으로 브라우저 뒤로가기 지원.

| 탭 | 컴포넌트 | 주요 기능 |
|---|---|---|
| 홈 | `MainPage.tsx` | 환영 카드 2장 + AI 활용 4열 그리드 + 강의 레벨 구분선 |
| 영상 | `VideoPage.tsx` | 썸네일/좋아요/댓글 + YouTube 보호 모달(워터마크/우클릭 차단) |
| 미팅요청 | `MeetingPage.tsx` | 예약/차단시간 (PII 보호) |
| 가이드 | `GuidePage.tsx` | 그룹/항목 (아이콘 + Figma 링크) |
| 공유 | `SharePage.tsx` | 로그인만 하면 회원 누구나 등록 가능 |
| 게시판 | `BoardPage.tsx` | 자유 글/댓글/좋아요 |
| 관리자 | `Admin*` 9종 | 영상·미팅·서비스·가이드·통계·로그·임포트·사용자·채팅방 |

### 공통 UI
- **푸터 4링크**: 개인정보처리방침(`LegalModal` + `policy/PrivacyContent`), 이용약관(`TermsContent`), 관리자 문의(mailto), 관리자 모드
- **플로팅 액션 (FAB 3단)**: 미팅요청 → 안드로이드 앱 → 소통방 입장 (`FloatingActions.tsx`)
- **헤더**: 로그인 상태 표시 + 로그아웃 버튼 (관리자 버튼은 푸터로 이동됨)

---

## 3. API 엔드포인트 (47개)

### 공개
- `POST /api/users/signup-request` — 이메일 OTP 발송
- `POST /api/users/signup-verify` — OTP 검증 → `signup_token` 발급
- `POST /api/users` — 가입 완료 (signup_token 필수)
- `POST /api/users/login` / `POST /api/users/logout`
- `GET /api/users/me` / `GET /api/users/exists`
- `GET /api/videos` / `GET /api/video-levels` / `GET /api/services` / `GET /api/guide` / `GET /api/settings`
- `GET /api/reservations` / `POST /api/reservations` / `GET /api/blocked-slots`
- `POST /api/videos/[id]/view` / `POST /api/videos/[id]/like` / CRUD `comments`
- `GET/POST /api/posts` / `POST /api/posts/[id]/like` / CRUD `comments`
- `GET /api/stats`, `GET /api/videos/stats`

### 관리자 (admin 쿠키 또는 master/admin role 필요)
- `POST /api/admin/login` / `/logout` / `/ping`
- CRUD: `videos`, `videos/reorder`, `video-levels`, `reservations`, `blocked-slots`, `services`, `guide`, `users`, `settings`, `logs`
- `POST /api/admin/import` — localStorage 일괄 임포트
- `GET /api/admin/sentry-test`

### Cron (Vercel)
- `GET /api/cron/cleanup-test-account` — 매일 00:00 UTC, 만료된 test user row 삭제

---

## 4. DB 스키마 (Neon Postgres)

| 테이블 | 용도 | 주요 컬럼 |
|---|---|---|
| `users` | 회원 | id, email, password_hash, name(nickname), corporation_name, organization_name, position, role(master/admin/user), permissions(JSONB) |
| `email_verifications` | OTP 발급 기록 | email, code_hash, expires_at, ip |
| `auth_logs` | 인증 감사로그 | type, email, success, ip, ua, detail, created_at |
| `videos` | 강의 영상 | id, title, url, thumbnail_url, level_id, stages(JSONB), sort_order |
| `video_levels` | 강의 레벨/단계 | id, name, sort_order |
| `video_likes` / `video_comments` | 영상 좋아요/댓글 | user_id, video_id, content |
| `posts` / `comments` / `*_likes` | 게시판 | content, like_count |
| `reservations` | 미팅 예약 | user_id, datetime, status(pending/approved/rejected/cancelled) |
| `blocked_slots` | 예약 차단시간 | start_at, end_at |
| `shared_services` | 회원 공유 서비스 | user_id, name, url, icon |
| `guide_groups` / `guide_items` | 가이드 분류/항목 | name, icon, figma_url, description |
| `app_settings` | 전역 설정 (NOA, 카톡 링크 등) | key, value(JSONB) |

마이그레이션 스크립트는 `scripts/apply-*.mjs` 8개.

---

## 5. 환경변수 (Vercel Production·Preview)

| 변수 | 용도 | 비고 |
|---|---|---|
| `DATABASE_URL` | Neon 연결 문자열 (Pooled) | 필수 |
| `ADMIN_PASSWORD` | 관리자 로그인 (master 권한) | 필수, 운영에서 `admin2026` 사용 시 503 |
| `MASTER_ADMIN_EMAILS` | 마스터 관리자 이메일 화이트리스트 | `ohdongko@gmail.com` |
| `JWT_SECRET` | 세션 토큰 서명 | 32바이트+ hex |
| `RESEND_API_KEY` / `EMAIL_FROM` | 이메일 발송 | Resend 무료 한도 주의 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 레이트리밋 | 미설정 시 in-memory fallback |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry 클라이언트 키 | |
| `NEXT_PUBLIC_EMAIL_DOMAIN_EXCEPTIONS` | 도메인 화이트리스트 예외 | 한시적 |
| **`TEST_ACCOUNT_EMAIL`** | 시연용 테스트 이메일 | `test@eland.co.kr` |
| **`TEST_ACCOUNT_CODE`** | 시연용 고정 OTP | `000000` |
| **`TEST_ACCOUNT_EXPIRES_AT`** | 자동 만료 시각 | `2026-06-02T23:59:59Z` |
| `CRON_SECRET` | Vercel Cron 인증 | 자동 부착 |

전체 예시: [.env.local.example](../../.env.local.example)

---

## 6. 보안 정책 (현재 적용)

- **회원가입 도메인 제한**: `@eland.co.kr` only (`isAllowedSignupEmail`) + 예외 화이트리스트
- **이메일 인증 필수**: OTP 6자리, SHA-256(email:code) 해시 저장, 10분 TTL
- **레이트리밋**: signup-request(IP 5/10m, email 3/10m), users-signup(IP 5/10m), admin-login 등
- **비밀번호**: bcrypt(legacy SHA-256은 로그인 시 자동 마이그레이션), `isValidSimplePassword`
- **세션**: JWT(jose) httpOnly 쿠키, rememberMe 옵션
- **관리자 권한**: master(env) > admin(DB role + permissions JSONB) > user > legacy admin 쿠키
- **PII 보호**: 예약 사용자명 마스킹, 캐시 헤더 `private, no-store` 적용 라우트 분리
- **에러 메시지**: catch 블록은 모두 `"서버 오류가 발생했습니다."`로 통일 (raw 노출 금지)
- **한글 인코딩 가드**: `containsReplacementChar` (U+FFFD) 6개 라우트에서 차단
- **영상 보호**: 워터마크 + 우클릭 차단 + 투명 오버레이 + "외부 공유 금지" 고지
- **감사 로그**: `auth_logs` 테이블에 signup_request/verify/login/logout/admin_login 등 기록
- **Sentry**: 모든 catch 블록에서 `reportError(e, { route, detail })` 호출

---

## 7. 시연용 테스트 계정 (Phase 6)

- **이메일**: `test@eland.co.kr` / **OTP**: `000000`
- **활성 조건**: 환경변수 3종(`TEST_ACCOUNT_EMAIL`, `_CODE`, `_EXPIRES_AT`) 모두 설정 + 현재 시각 < `_EXPIRES_AT`
- **동작**:
  1. `signup-request` — Resend 호출 X, alreadyMember 무시 → 항상 검증 화면 진행
  2. `signup-verify` — `000000` 입력 시 즉시 통과
  3. `POST /users` — 기존 test user row 자동 DELETE 후 새로 INSERT (반복 시연 가능)
- **자동 정리**: Vercel Cron(`/api/cron/cleanup-test-account`) 매일 00:00 UTC, 만료 시 user + shared_services 삭제
- **만료일**: 2026-06-02T23:59:59Z (만료 후 env 제거 권장)

---

## 8. 배포 & 운영

| 항목 | 상태 |
|---|---|
| 프로덕션 | Vercel main 자동 배포, https://retail-ai-campus.vercel.app |
| 모니터링 | Sentry — 운영 이슈 자동 수집 + Slack 미설정 |
| 부하 검증 | `scripts/load-test.mjs` (Node 18+ 내장 fetch) |
| 안드로이드 | Capacitor .aab 빌드 완료 (versionCode 1), Play Console 업로드 대기 |
| 마스터 관리자 | `ohdongko@gmail.com` (회원 로그인만으로 자동 부여) |

---

## 9. 사용자 리서치 산출물

- `public/research/personas-raw.md` — 15 페르소나 인터뷰 (정육/캐셔/CS/MD/온라인/OPR/CU/지점장/매니저/IMC/SO/HO/재무/SCM/생산)
- `public/research/insights-summary.md` — 4 페인포인트 패턴, 5 세그먼트 처방, P0/P1/P2 액션, 3트랙×3레벨 커리큘럼, 90일 KPI

---

## 10. 관련 문서

- [CHANGELOG.md](./CHANGELOG.md) — 전체 변경 이력 (시간순)
- [android-app.md](./android-app.md) — 안드로이드 앱 별도 PRD
- 기능별 PRD 16건은 [CHANGELOG.md §2](./CHANGELOG.md#2-작성된-prd-목록-16건) 참조
