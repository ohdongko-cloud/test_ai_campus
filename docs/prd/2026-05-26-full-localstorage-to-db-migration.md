# PRD: localStorage → Neon DB 전면 이관

- 작성일: 2026-05-26
- 작성자: Claude (요청자: <오너>)
- 범위: 클라이언트 데이터 9 도메인 전부 + 어드민 인증 강화 + 일회성 임포트 도구
- 관련 파일: 거의 모든 컴포넌트 + `lib/utils.ts` + 신규 API 라우트 다수 + `supabase/schema.sql`

---

## 1. 배경 / 문제

현재 앱 데이터는 두 저장소에 분리되어 있다:
- **DB(Neon)**: 게시판 / 회원 / 영상 좋아요·댓글 / 통계
- **localStorage**: **영상 목록 자체** / 영상 레벨 / 예약 / 차단시간 / 공유 서비스 / 가이드 / 채팅방 설정 / NOA URL / 클릭 로그

→ **PC에서 관리자가 추가/편집한 데이터가 모바일·다른 사용자에게 안 보임**. 운영 자체가 불가능. 사용자 측 UX 신뢰도가 떨어진다.

## 2. 목표 / 비목표

### 목표
- G1. 위 9 도메인 데이터를 모두 Neon DB로 이관한다.
- G2. 모든 사용자 / 모든 기기에서 동일한 데이터를 본다.
- G3. 어드민 동작(영상 추가/예약 승인/공유 서비스 등록 등)을 **서버 측 비밀번호 검증**으로 강화한다. 기존 클라이언트 상수 체크는 폐기 단계로 진입.
- G4. 기존 PC에 쌓인 localStorage 데이터를 한 번에 DB로 올릴 수 있는 **"로컬 데이터 서버로 올리기"** 어드민 도구를 제공한다.
- G5. 단계적(Phased) 롤아웃 — 한 도메인 마이그레이션이 다른 도메인에 영향 주지 않도록 격리.

### 비목표
- 회원 인증 시스템 강화 (현재 employee-id 로그인 그대로).
- 권한 분리(편집자/뷰어 등). 어드민 단일 권한 유지.
- 실시간 동기화 (WebSocket). 새로고침 / 페이지 진입 시 fetch.
- 영상 좋아요/댓글 데이터 재구성 (이미 DB이고 `video_id` 그대로 사용).
- 어드민 비번 변경 UI. `.env`로만 설정.

## 3. 사용자 시나리오

### S1. (관리자) 일회성 임포트
1. PC 브라우저(=기존 데이터가 쌓여있는 곳)에서 어드민 로그인.
2. 관리자 대시보드 우측 상단의 "🔄 로컬 데이터 서버로 올리기" 버튼 클릭.
3. 확인 모달 → "현재 PC localStorage 의 모든 도메인 데이터를 서버에 업로드합니다. 기존 서버 데이터는 덮어쓰입니다." → 확인.
4. 각 도메인별로 순차 POST → 진행률 토스트("영상 7개 업로드 완료...").
5. 완료 후 새로고침 시 모든 데이터가 서버에서 로드되어 모든 기기에서 동일하게 표시.

### S2. (관리자) 영상 추가 - DB 모드
1. 어드민 → 영상 관리.
2. 영상 추가 폼 작성 → "추가" 클릭.
3. `POST /api/admin/videos` 호출 (헤더에 admin password). 응답 200이면 목록 즉시 갱신.
4. 다른 PC / 모바일에서 동일하게 보임.

### S3. (사용자) 모바일 시청
1. 모바일 브라우저로 접속.
2. 영상 목록은 `GET /api/videos`로 서버에서 로드. PC와 동일.
3. 좋아요/댓글도 DB라 PC와 동기화됨.

### S4. (사용자) 예약 신청
1. 미팅 페이지에서 예약 정보 입력 → "예약하기".
2. `POST /api/reservations` (auth 불필요, 누구나 신청 가능).
3. 어드민 측에서 즉시 보이고 승인/취소 처리.

## 4. 기능 요구사항

### F0. 공통 인프라
- F0.1. 환경변수 `ADMIN_PASSWORD` 도입. `.env.local`(개발) / Vercel(운영). 기본값은 기존 `<기본-비밀번호>`로 시드.
- F0.2. 서버 헬퍼 `lib/admin-auth.ts`: `requireAdmin(req: Request)` 함수. 요청 헤더 `X-Admin-Password`가 환경변수와 일치하면 통과, 아니면 401.
- F0.3. 클라이언트 헬퍼 `lib/admin-client.ts`: 로그인 시 password를 `sessionStorage`에 저장(휘발), `adminFetch()`가 자동으로 `X-Admin-Password` 헤더 부착. 페이지 새로고침해도 같은 탭에서는 유지, 탭 닫으면 재로그인.
- F0.4. 기존 `app/page.tsx`의 `ADMIN_PASSWORD` 상수 → `sessionStorage` 저장 시점만 변경, 서버 검증은 첫 API 호출 시 확인.

### F1. 영상 + 레벨 (Phase 1)
- F1.1. DB 테이블:
  - `videos (id TEXT PK, title TEXT, level TEXT, description TEXT, youtube_url TEXT, view_count INTEGER, stages JSONB DEFAULT '[]', order_idx INTEGER, created_at, updated_at)`
  - `video_levels (id TEXT PK, name TEXT UNIQUE, description TEXT, order_idx INTEGER)`
- F1.2. API:
  - `GET /api/videos` → 정렬된 영상 배열.
  - `GET /api/video-levels` → 레벨 배열.
  - `POST /api/admin/videos` (auth), body = Video 전체.
  - `PATCH /api/admin/videos/[id]` (auth) — 부분 업데이트(제목/URL/level/stages/order_idx 등).
  - `DELETE /api/admin/videos/[id]` (auth).
  - `POST /api/admin/videos/reorder` (auth) body `{ ids: string[] }` — order_idx 일괄 갱신.
  - `POST /api/admin/video-levels`, `PATCH /api/admin/video-levels/[id]`, `DELETE /api/admin/video-levels/[id]` (auth).
  - `POST /api/videos/[id]/view` (auth 불필요) — view_count++.
- F1.3. 컴포넌트 변경:
  - `VideoPage.tsx`: `getVideos()` localStorage → `fetch('/api/videos')` + state. 시청 시 `POST /api/videos/[id]/view`.
  - `AdminVideos.tsx`: 모든 mutation 함수를 `adminFetch`로 교체. storage 이벤트 리스너 → 새로고침 시점 fetch.
- F1.4. `lib/utils.ts`의 `getVideos/setVideos/getVideoLevels/setVideoLevels`는 deprecated 처리, 한동안 localStorage 캐시도 함께 유지(빈 응답 시 fallback) — 다음 PR에서 완전 제거.

### F2. 예약 + 차단시간 (Phase 2)
- F2.1. DB:
  - `reservations (id UUID PK, name, role, task_summary, inquiry, email, phone, date DATE, start_time TEXT, end_time TEXT, status TEXT DEFAULT 'pending' CHECK ('pending','confirmed','cancelled'), registered_at TIMESTAMPTZ)`
  - `blocked_slots (id UUID PK, date DATE NULL, day_of_week INTEGER NULL CHECK (1..5), start_time TEXT, end_time TEXT, reason TEXT, recurring BOOLEAN)`
- F2.2. API:
  - `GET /api/reservations` (사용자 측 — 자기 시간대 가용성 확인용. PII 노출 방지를 위해 date/start_time/end_time만 반환).
  - `GET /api/admin/reservations` (auth, 전체 필드).
  - `POST /api/reservations` (auth 불필요, 사용자가 예약 신청).
  - `PATCH /api/admin/reservations/[id]` (auth) — status 변경.
  - `DELETE /api/admin/reservations/[id]` (auth).
  - `GET /api/blocked-slots` (공개).
  - `POST /api/admin/blocked-slots`, `DELETE /api/admin/blocked-slots/[id]` (auth).
- F2.3. 컴포넌트:
  - `MeetingPage.tsx`: 가용 시간 계산 시 두 API GET. 예약 신청은 POST.
  - `AdminMeetings.tsx`: 전체 예약 fetch + status PATCH + 차단시간 CRUD.

### F3. 공유 서비스 + 가이드 + 설정 (Phase 3)
- F3.1. DB:
  - `shared_services (id UUID PK, service_name, description, url, test_account, registered_at)`
  - `guide_groups (id TEXT PK, name, description, order_idx)`
  - `guide_items (id TEXT PK, group_id TEXT FK ON DELETE CASCADE, name, description, cost, url, recommended BOOLEAN, order_idx)`
  - `app_settings (key TEXT PK, value JSONB, updated_at)` — 단일값 설정: `chatroom_url`, `chatroom_password`, `chatroom_rules`, `noa_url`.
- F3.2. API:
  - `GET /api/services` (공개), `POST/PATCH/DELETE /api/admin/services` (auth).
  - `GET /api/guide` (공개) → groups + items 트리. 어드민 CRUD `/api/admin/guide-groups`, `/api/admin/guide-items`.
  - `GET /api/settings?keys=chatroom_url,noa_url` (공개, 화이트리스트 키만).
  - `PATCH /api/admin/settings` (auth) body `{ key, value }`.
- F3.3. 컴포넌트:
  - `SharePage.tsx`, `AdminServices.tsx`: fetch + adminFetch.
  - `GuidePage.tsx`, `AdminGuide.tsx`: fetch + adminFetch.
  - 채팅방 설정·NOA URL을 쓰는 곳(`ChatroomPopup.tsx`, `MainPage.tsx`, `AdminChatroom.tsx`): `getChatroomUrl()` 류 헬퍼를 `useSettings()` 훅으로 전환.

### F4. 클릭 로그 + 임포트 도구 (Phase 4)
- F4.1. DB: `click_log (id BIGSERIAL PK, button TEXT, session_id TEXT, created_at TIMESTAMPTZ)`. 인덱스 `(button, created_at)`.
- F4.2. API: `POST /api/click` (공개, 큐잉 없이 즉시 INSERT). `GET /api/admin/click-stats?from=&to=&groupBy=button` (auth) → 어드민 통계용.
- F4.3. `AdminBoardStats.tsx` / `AdminStats.tsx`: 클릭 통계 fetch.
- F4.4. **임포트 도구**:
  - 어드민 우측 상단에 "🔄 로컬→서버 업로드" 버튼.
  - 클릭 → 모달: 도메인별 체크박스(영상/레벨/예약/차단시간/공유서비스/가이드/설정/클릭로그) + "덮어쓰기 확인" 체크.
  - 실행 시: 각 도메인 데이터를 localStorage에서 읽어 새 API `POST /api/admin/import` 로 전송. 서버는 트랜잭션으로 각 테이블 DELETE+INSERT(또는 UPSERT).
  - 진행률 표시(도메인당 한 줄). 실패 시 어느 단계에서 멈췄는지 표시.
  - 완료 후 새로고침 유도.

## 5. UX/디자인

- 임포트 모달은 단순 체크박스 리스트 + 빨간 "덮어쓰기" 확인 → "업로드" 버튼.
- 어드민 페이지 전반: 데이터 fetch 중에는 기존 "로딩 중..." 회색 박스 또는 스켈레톤(기존 패턴 유지).
- 사용자 페이지: 첫 진입 시 200~300ms 지연 가능 — 로딩 표시 추가(빈 카드 회색 스켈레톤 4개).
- 에러: 토스트("서버 연결 실패. 잠시 후 다시 시도해주세요.").

## 6. 데이터 / 스키마 변경

### 신규 테이블 SQL (supabase/schema.sql append)
```sql
-- videos: 영상 자체 (localStorage 이관)
CREATE TABLE IF NOT EXISTS videos (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  level         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  youtube_url   TEXT NOT NULL,
  view_count    INTEGER NOT NULL DEFAULT 0,
  stages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  order_idx     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videos_order_idx ON videos (order_idx);

-- video_levels
CREATE TABLE IF NOT EXISTS video_levels (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  order_idx    INTEGER NOT NULL DEFAULT 0
);

-- reservations
CREATE TABLE IF NOT EXISTS reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  task_summary  TEXT NOT NULL,
  inquiry       TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT NOT NULL,
  date          DATE NOT NULL,
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','cancelled')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations (date);

-- blocked_slots
CREATE TABLE IF NOT EXISTS blocked_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 5),
  start_time  TEXT NOT NULL,
  end_time    TEXT,
  reason      TEXT,
  recurring   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- shared_services
CREATE TABLE IF NOT EXISTS shared_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name  TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  url           TEXT NOT NULL,
  test_account  TEXT NOT NULL DEFAULT '',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- guide_groups / guide_items
CREATE TABLE IF NOT EXISTS guide_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  order_idx   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS guide_items (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES guide_groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost        TEXT NOT NULL DEFAULT '',
  url         TEXT NOT NULL DEFAULT '',
  recommended BOOLEAN NOT NULL DEFAULT false,
  order_idx   INTEGER NOT NULL DEFAULT 0
);

-- app_settings: 단일값 config (chatroom_url, chatroom_password, chatroom_rules, noa_url)
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- click_log: 버튼 클릭 통계
CREATE TABLE IF NOT EXISTS click_log (
  id         BIGSERIAL PRIMARY KEY,
  button     TEXT NOT NULL,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS click_log_button_idx ON click_log (button, created_at);
```

### 트리거
`set_updated_at` 함수 재사용. 신규 트리거: `videos_updated_at`, `app_settings_updated_at`. 다른 테이블은 updated_at 없음.

### 기본 데이터 시드
- `video_levels`: 기존 DEFAULT_VIDEO_LEVELS (기초/중급/고급/응용) 자동 시드.
- `videos`: 기존 INITIAL_VIDEOS 7개 자동 시드 (id 1~7 보존, 그래야 좋아요/댓글 카운트 살아남).
- `guide_groups/items`: 기존 DEFAULT_GUIDE_GROUPS 시드.
- `app_settings`: chatroom_rules 기본값 시드.

→ 시드는 `INSERT ... ON CONFLICT DO NOTHING` 으로 멱등.

## 7. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| API 호출 실패 (네트워크/5xx) | 토스트 + 빈 상태(빈 카드 / "로드 실패. 새로고침해주세요"). |
| 어드민 비번 틀림 | 첫 API 401 시 sessionStorage 비번 삭제 + 어드민 로그아웃 + 비번 모달 재표시. |
| 동시 편집 (어드민 두 명 동시 수정) | last-write-wins. 충돌 감지 안 함(현재 단일 어드민 가정). |
| 임포트 중 일부 도메인 실패 | 트랜잭션 단위는 도메인별. 한 도메인 실패해도 다른 도메인은 이미 반영됨. 어디서 멈췄는지 모달에 명시. |
| 임포트 시 기존 DB 데이터 | 동일 ID는 UPSERT, 신규는 INSERT. 임포트 후 localStorage에 있던 ID가 DB에 없으면 DB에서 삭제(미러링 옵션)는 **하지 않음**. 안전을 위해 ADD/UPDATE만. |
| 기존 클라이언트가 localStorage 캐시를 신뢰 | 첫 fetch 성공 시 localStorage를 무시하고 서버 값 사용. 향후 PR에서 localStorage 키 완전 제거. |
| 빈 DB(예: 신규 환경) | 시드 데이터로 초기화. 시드는 `apply-schema` 스크립트에서 옵션 `--seed`로 트리거. |
| 채팅방 비번 노출 | `app_settings`의 chatroom_password는 공개 GET 화이트리스트에 포함(현재 클라이언트가 표시함 — 디자인 의도). 향후 hash 처리 권장. |
| 예약 등록 시 동일 시간대 중복 | 클라이언트 측 가용성 체크 + 서버 측 unique 제약 없음(현재 디자인 유지). 향후 unique index 추가 가능. |
| 클릭 로그 폭주 | 인덱스만 있고 retention 없음. 한 달 후 cleanup cron 권장(범위 외). |

## 8. 보안 / 권한

- 어드민 비번은 `ADMIN_PASSWORD` 환경변수. 기본값은 기존 `<기본-비밀번호>`로 시드(Vercel 환경변수 설정 후 임의 강력 비번으로 교체 권장).
- 모든 `/api/admin/*` 라우트는 `requireAdmin(req)` 검증 후 진행. 미인증 시 401.
- 사용자용 GET 라우트는 PII 노출 최소화. 예약은 `name/email/phone`을 사용자 GET에서 제외, 어드민 GET에서만 전체 노출.
- `app_settings`는 키 화이트리스트(`chatroom_url/chatroom_password/chatroom_rules/noa_url`)만 GET 공개.
- 임포트 도구는 어드민 인증 필수. CSRF 없음(SPA + Same-origin fetch이므로 위험 낮음).
- 클라이언트 측 admin 비번은 `sessionStorage` 저장(localStorage보다 휘발성 높음 — 탭 닫으면 사라짐).

## 9. 성공 기준 / 테스트

### 수동 테스트 (도메인별)
- [ ] 어드민 로그인 후 영상 추가 → 모바일에서 동일 표시.
- [ ] PC에서 예약 신청 → 어드민 PC에서 즉시 보임.
- [ ] 차단시간 추가 → 사용자 측 예약 화면에서 차단 표시.
- [ ] 공유 서비스 추가 → 모든 기기에서 동일.
- [ ] 가이드 그룹/아이템 편집 → 모든 기기 반영.
- [ ] 채팅방 URL 변경 → 모든 기기 반영.
- [ ] 어드민 임포트 도구 실행 → 7도메인 모두 서버 반영. 다른 PC에서 동일 데이터 확인.
- [ ] 어드민 비번 변경(env) 후 잘못된 비번으로는 진입 불가.

### 자동
- [ ] `npm run build` 성공.
- [ ] `curl` 스모크: 도메인별 GET/POST/PATCH/DELETE 200 응답.

## 10. 롤아웃 / 마이그레이션

### 배포 순서
1. 코드 푸시 (단일 PR로 phase별 4 커밋: 인프라 / 영상 / 예약 / 공유·가이드·설정 / 클릭·임포트).
2. Vercel에 `ADMIN_PASSWORD` 환경변수 설정.
3. Neon에 신규 테이블 적용 (`scripts/apply-schema.mjs` 확장 또는 SQL Editor 직접 실행).
4. 배포 후 어드민 진입 → 임포트 도구로 PC 데이터 일괄 업로드.
5. 모든 기기에서 데이터 동일 표시 확인.

### 롤백
- 신규 라우트만 제거(revert) → localStorage 폴백 코드가 살아있으므로 데이터는 그대로 보임(단, 다른 기기와는 다시 분리).
- DB 테이블은 남겨도 무방.

## 11. 미해결 질문 / 결정 사항

- **시드 데이터 정책**: 사용자가 임포트하지 않은 신규 환경의 경우, `videos` 시드는 7개 기본 영상 자동 INSERT. **결정**: yes (스키마 적용 스크립트가 함께 처리).
- **이전 localStorage 헬퍼 제거 시점**: 본 PR에서는 폴백으로 유지, 다음 PR에서 제거. **결정**: 그대로.
- **클릭 로그 보존 기간**: 무제한. retention cron은 별도 PR. **결정**: 그대로.
- **어드민 비번 변경 UI**: 본 범위 외. env로만. **결정**: 그대로.
