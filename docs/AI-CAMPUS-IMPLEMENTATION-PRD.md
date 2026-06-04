# 이랜드리테일 AI 캠퍼스 — 서비스 구현 종합 PRD (직원 실습 가이드용)

- 문서 버전: **v1.0** (2026-06-04 기준 운영 반영본)
- 운영 URL: https://retail-ai-campus.vercel.app
- 대상 독자: **AI 코딩(바이브 코딩)으로 이 서비스를 직접 따라 만들어 볼 직원**
- 결과물: 사내 AI 학습 포털 (회원제 + 강의영상 + 게시판 + 미팅예약 + 관리자)

> **이 문서를 어떻게 쓰나?**
> 위에서부터 읽으며 §9 "단계별 구현 로드맵"의 Phase 순서대로 따라 만들면 됩니다.
> 각 기능은 "무엇을(요구사항)"과 "어떻게(핵심 구현 포인트)"로 적혀 있어, AI 코딩 도구에 그대로 옮겨 지시할 수 있습니다.

---

## 1. 무엇을 만드나 (제품 정의)

**한 줄 정의:** 이랜드리테일 임직원이 사내 메일로 가입해, AI 교육 영상을 시청하고 · 질문/공유하고 · 1:1 미팅을 예약하는 **사내 전용 AI 학습 포털**.

**핵심 가치**
1. **학습** — 레벨별 강의영상 + 단계별(스테이지) 실습 가이드 + 학습자료 첨부
2. **참여** — 영상/게시판 좋아요·댓글, 듣고 싶은 강의 요청
3. **연결** — 멘토링 미팅 예약, 카카오 오픈채팅방
4. **공유** — 직원들이 직접 발견한 AI 서비스 공유
5. **운영** — 관리자가 콘텐츠·회원·통계를 한 화면에서 관리

---

## 2. 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | **Next.js 15** (App Router) + **TypeScript** + React 18 |
| 스타일 | Tailwind CSS + 인라인 스타일(디자인 토큰) |
| DB | **Neon** (Serverless Postgres, HTTP 드라이버) |
| 호스팅/배포 | **Vercel** (main 푸시 시 자동 배포) |
| 인증 | **JWT**(jose, httpOnly 쿠키) + **bcrypt** 비밀번호 해시 |
| 이메일 | **Gmail SMTP** (nodemailer) — 회원가입/비번재설정 OTP |
| 파일 저장 | **Vercel Blob** (강의 첨부파일·스테이지 이미지) |
| 레이트리밋 | Upstash Redis (+ 메모리 폴백) |
| 모니터링 | Sentry |
| 차트 | Recharts (관리자 통계) |
| 엑셀 | xlsx (예약 목록 내보내기) |
| 외부 연동 | **Kakao JavaScript SDK** (공유), YouTube IFrame API |
| 모바일 | Capacitor (안드로이드 WebView 앱) |

---

## 3. 전체 구조

### 페이지/탭 (`app/page.tsx` 단일 SPA + 해시 라우팅)
브라우저 뒤로가기 지원을 위해 `#home`, `#videos`, `#meeting`, `#board`, `#share`, `#guide` 해시 사용.

| 탭 | 컴포넌트 | 한 줄 설명 |
|---|---|---|
| 홈 | `MainPage` | 환영 카드 + AI 활용 그리드 + 강의 진입 |
| 강의 | `VideoPage` | 영상 목록(그리드/리스트) + 시청 모달 |
| 미팅 | `MeetingPage` | 멘토링 예약 신청 |
| 게시판 | `BoardPage` | 자유 글/댓글/좋아요 |
| 공유 | `SharePage` | 회원이 AI 서비스 공유 등록 |
| 서비스 가이드 | `GuidePage` | 추천 AI 서비스 가입 가이드 |
| 관리자 | `AdminDashboard` + `Admin*` | 콘텐츠·회원·통계 관리 |

### 데이터 흐름
```
[브라우저/React]  ──fetch──▶  [Next.js API Routes (/app/api/**)]  ──SQL──▶  [Neon Postgres]
        │                              │
        │                              ├── 인증: JWT httpOnly 쿠키 검증 (lib/session, lib/admin-auth)
        │                              ├── 파일: Vercel Blob (put/del)
        │                              └── 메일: Gmail SMTP (nodemailer)
        └── 클라이언트 상태/표시용: localStorage (lib/utils)
```

---

## 4. 데이터 모델 (Neon Postgres)

| 테이블 | 용도 | 핵심 컬럼 |
|---|---|---|
| `users` | 회원 | id(UUID), email, password_hash(bcrypt), name(닉네임), corporation_name, organization_name, position, role(`master`/`admin`/`user`), permissions(JSONB) |
| `email_verifications` | 인증 OTP 기록 | email, code_hash(SHA-256), expires_at, ip, consumed, attempts, **purpose**(`signup`/`reset`) |
| `auth_logs` | 인증 감사로그 | type, email, success, ip, user_agent, detail, created_at |
| `videos` | 강의 영상 | id, title, level, description, youtube_url, view_count, stages(JSONB), order_idx, is_required, **duration** |
| `video_levels` | 강의 레벨 | id, name, description |
| `video_stats` | 영상 좋아요/댓글 수 캐시 | video_id, likes_count, comments_count |
| `video_likes` / `video_comments` | 영상 좋아요·댓글 | video_id, session_id / content, password_hash |
| `video_attachments` | 강의 학습자료 | video_id, filename, blob_url, size, content_type |
| `lecture_requests` | 강의 요청 | title, content, requester_name, requester_email, status(`pending`/`reviewed`) |
| `posts` / `comments` / `*_likes` | 게시판 | content, password_hash, likes_count, comments_count |
| `reservations` | 미팅 예약 | name, role, task_summary, inquiry, email, phone, date, start_time, end_time, status |
| `blocked_slots` | 예약 차단시간 | date/day_of_week, start_time, end_time, recurring |
| `shared_services` | 회원 공유 서비스 | service_name, url, test_account, description |
| `guide_groups` / `guide_items` | 가이드 분류·항목 | name, description, cost, url, recommended |
| `app_settings` | 전역 설정 | key, value (카톡 링크, 안드로이드 앱 URL 등) |

> **스테이지(stages) 구조** (videos.stages JSONB): `[{ id, title, description, images?: string[] }]`
> — 영상별 단계별 실습 가이드. `images`는 Vercel Blob URL 배열(스테이지당 최대 10장).

> **마이그레이션:** `POST /api/admin/migrate`(마스터 전용, 멱등)로 컬럼/테이블 추가. 현재 M001(videos.duration), M002(lecture_requests), M003(email_verifications.purpose).

---

## 5. 기능 명세 (모듈별)

### 5.1 인증 · 회원
| 기능 | 요구사항 | 구현 포인트 |
|---|---|---|
| 회원가입 | 사내 메일(`@eland.co.kr`)만 허용 → OTP 6자리 메일 인증 → 닉네임·소속·비번 입력 | `signup-request`→`signup-verify`→`POST /users`. OTP는 SHA-256 해시 저장, 10분 만료. enumeration 방지 |
| 로그인 | 이메일+비번, 로그인 유지(30일) 옵션 | bcrypt 검증, JWT 쿠키 발급. 비밀번호 입력 maxLength 16 |
| 비밀번호 재설정 | 로그인 화면 "비밀번호를 잊으셨나요?" → 이메일 OTP → 새 비번 | `reset-request`/`reset-verify`/`reset-password`. purpose=`reset`로 가입 OTP와 분리 |
| 마이페이지 | 사용자 칩 클릭 → 프로필 + 비번 변경 + 회원 탈퇴 | `MyPageModal`. 데스크탑·모바일(`m/profile`) 공통 |
| 비밀번호 변경 | 현재 비번 검증 후 변경 | `POST /users/change-password` |
| 회원 탈퇴 | 비번 재확인 → users·reservations·email_verifications 삭제 → 로그아웃 | `DELETE /users/me` |

### 5.2 강의 영상 (핵심 모듈)
| 기능 | 요구사항 | 구현 포인트 |
|---|---|---|
| 목록 | 레벨별 섹션 + **그리드/리스트 토글**(기본 리스트), 세션 번호(SESSION 01…), 검색, 레벨 필터 | `VideoPage`. 썸네일은 YouTube `mqdefault`(16:9 통일) |
| 카드 | 썸네일·제목(2줄)·핵심요약(설명 첫 줄)·재생시간·필수배지·조회/좋아요/댓글 | 재생시간(duration), 필수시청(is_required) 뱃지 |
| 시청 모달 | YouTube 임베드 + 창크기(컴팩트/표준/와이드)·**전체화면** + 우상단 고정 닫기 | HD 기본화질(IFrame API), 보호 레이어(워터마크·우클릭/복사 차단·"외부공유 금지") |
| 사이드바 | **[학습 단계 \| 댓글] 2탭** + 상단 stats(레벨·조회·좋아요·댓글) | 학습 단계 아코디언(설명 전체복사) + 인라인 이미지 라이트박스 |
| 좋아요/댓글 | 세션 기반 좋아요, 비번 기반 익명 댓글 | `video_likes`/`video_comments` |
| 학습자료 첨부 | 관리자가 PPTX/PDF 등 업로드 → 사용자 다운로드 | Vercel Blob, `video_attachments` |
| 강의 요청 | 사이드바 "강의 요청" 버튼 → 제목·내용 작성 → 관리자 확인 | `POST /lecture-requests`(레이트리밋) → 관리자 탭 |

### 5.3 미팅 예약 (`MeetingPage`)
- 주간 캘린더에서 빈 슬롯 선택 → 신청서(이름·직무·업무요약·문의·연락처) 제출
- 차단시간(`blocked_slots`)·기존 예약은 선택 불가. 사용자 측 응답은 **PII 제외**(날짜/시간/상태만)

### 5.4 게시판 (`BoardPage`)
- 비회원도 글/댓글 작성 가능(비번으로 본인 삭제), 좋아요, 한글 인코딩 가드(U+FFFD 차단)

### 5.5 서비스 공유 (`SharePage`)
- 로그인 회원이 발견한 AI 서비스(이름·URL·체험계정·설명) 등록·열람

### 5.6 서비스 가이드 (`GuidePage`)
- 추천 AI 서비스를 그룹/항목으로 안내(비용·링크·추천 여부)

### 5.7 관리자 (`AdminDashboard` — 좌측 탭)
| 탭 | 컴포넌트 | 기능 |
|---|---|---|
| 통계 현황 | `AdminStats` | 가입자·방문자·클릭·레벨별 영상수·**영상별 조회수 순위**(DB 연동) |
| 영상 관리 | `AdminVideos` | 레벨 탭 + 카드 목록 + 추가 드로어 + 스테이지/이미지/첨부 편집(**자동 토스트 피드백**) |
| 강의 요청 | `AdminLectureRequests` | 상태 탭(전체/검토중/확인완료) + 카드 목록 |
| 미팅 관리 | `AdminMeetings` | 카드형 예약목록 + 상태탭/검색/상세펼치기 + 엑셀 |
| 회원 관리 | `AdminMembers` | 검색·필터·정렬 + **회원 삭제**(마스터 전용) |
| 채팅방/서비스/가이드/로그/관리자 관리 | `AdminChatroom`/`AdminServices`/`AdminGuide`/`AdminLogs`/`AdminUsersManage` | 각 콘텐츠·권한 관리 |

**권한 모델:** `master`(env 이메일) > `admin`(DB role + permissions JSONB 키별) > `user`. 입장 시 기본 탭 = 영상 관리.

### 5.8 공통 UI
- **플로팅 액션(FAB)**: 미팅요청 / 안드로이드 앱(PC에서 누르면 **카카오톡 공유 확인 팝업** → 동의 시 공유) / 오픈채팅방
- **즐겨찾기 안내**: 최초/재방문자에게 토스트 — Chrome/Edge는 PWA 설치 프롬프트, 그 외 OS별 단축키 안내
- **푸터**: 개인정보처리방침·이용약관(모달) · 관리자 문의 · 관리자 모드
- **모바일 전용 라우트**(`app/m/*`) + **안드로이드 앱**(Capacitor)

---

## 6. 보안 정책 (반드시 구현)

1. **가입 도메인 제한** `@eland.co.kr` + 이메일 OTP 인증 필수
2. **비밀번호** bcrypt 해시(평문 저장·전송 금지), 정책 8~16자
3. **민감 작업 본인 확인**: 비번 변경(현재 비번), 회원 탈퇴(비번 재입력)
4. **세션** JWT httpOnly 쿠키 (`secure` in prod)
5. **레이트리밋** 가입·로그인·재설정·강의요청·댓글 등
6. **enumeration 방지**: 가입/재설정 요청은 회원 존재 여부와 무관하게 동일 응답
7. **PII 보호**: 예약 사용자 정보는 사용자 API에서 제외, 캐시 금지
8. **에러 통일**: catch는 `"서버 오류가 발생했습니다."` (raw 노출 금지)
9. **영상 보호**: 워터마크·우클릭/복사 차단·외부공유 고지
10. **감사 로그**(`auth_logs`) + Sentry 리포트
11. **금지 사항**: 비밀번호를 메일로 발송하지 않음(해시 단방향) → 재설정 플로우로만

---

## 7. 환경변수 & 외부 서비스 연결

| 변수 | 용도 | 발급처 |
|---|---|---|
| `DATABASE_URL` | Neon 연결 문자열(Pooled) | Neon 대시보드 |
| `JWT_SECRET` | 세션 토큰 서명(32바이트+) | 직접 생성 |
| `ADMIN_PASSWORD` | 비상 관리자 로그인 | 직접 설정 |
| `MASTER_ADMIN_EMAILS` | 마스터 관리자 이메일 | 직접 설정 |
| `EMAIL_SMTP_USER` / `EMAIL_SMTP_PASS` | Gmail 발송 계정 + 앱 비밀번호 | Google 계정(2단계인증→앱 비밀번호) |
| `EMAIL_FROM` | 발신 표시명 | 직접 설정 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | Vercel Storage(스토어 Connect 시 자동 주입) |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 카카오 공유 | Kakao Developers(JavaScript 키) + 플랫폼/SDK 도메인 등록 |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 레이트리밋 | Upstash(없으면 메모리 폴백) |
| `NEXT_PUBLIC_SENTRY_DSN` | 에러 모니터링 | Sentry |

> 외부 서비스 가입 순서: **Vercel → Neon(DB) → Gmail 앱비밀번호 → Vercel Blob 스토어 → Kakao Developers**(공유 쓸 때) → (선택) Upstash·Sentry.

---

## 8. 단계별 구현 로드맵 (직원 실습 순서)

> 각 Phase는 "동작하는 작은 결과물"이 나오도록 쪼갰습니다. AI 코딩 도구에 Phase 단위로 지시하세요.

- **Phase 0 — 준비**: Next.js 15 + TypeScript + Tailwind 프로젝트 생성, Vercel 연결, Neon DB 생성, `DATABASE_URL` 연결
- **Phase 1 — 뼈대**: SPA 탭 레이아웃(`app/page.tsx`) + 해시 라우팅 + 헤더/푸터/FAB
- **Phase 2 — 인증**: 가입(이메일 OTP, Gmail SMTP) → 로그인(JWT 쿠키) → `/api/users/me`
- **Phase 3 — 강의 영상(읽기)**: `videos`/`video_levels` 테이블 + 목록(그리드/리스트) + 시청 모달 + YouTube 보호
- **Phase 4 — 참여**: 영상 좋아요·댓글, 게시판, 강의 요청
- **Phase 5 — 관리자**: 권한 모델 + 대시보드 + 영상 관리(스테이지/이미지/첨부) + 통계
- **Phase 6 — 미팅·공유·가이드**: 예약(차단시간), 서비스 공유, 가이드
- **Phase 7 — 계정 셀프서비스**: 비번 재설정/변경, 마이페이지, 회원 탈퇴
- **Phase 8 — 부가**: 카카오 공유, 즐겨찾기 안내, 첨부파일(Vercel Blob)
- **Phase 9 — 운영**: 보안 점검, Sentry, 레이트리밋, 배포·DB 마이그레이션, (선택) 안드로이드 앱

---

## 9. 배포 & 마이그레이션

1. **배포**: GitHub `main` 푸시 → Vercel 자동 배포. 환경변수는 **새 배포부터** 적용(변경 후 Redeploy 필요).
2. **DB 마이그레이션**: 신규 컬럼/테이블은 마스터 관리자로 `POST /api/admin/migrate` 1회 실행(멱등). 또는 Neon SQL Editor에서 직접 실행.
3. **첫 마스터 관리자**: `MASTER_ADMIN_EMAILS`에 본인 이메일 등록 → 그 계정으로 가입/로그인하면 자동 부여.

---

## 10. 부록 — 참고 문서 & 파일 맵

| 항목 | 위치 |
|---|---|
| 변경 이력 | `docs/prd/CHANGELOG.md` |
| 시스템 스냅샷(과거) | `docs/prd/CURRENT-STATE.md` |
| 기능별 PRD 다수 | `docs/prd/2026-*.md` |
| 안드로이드 앱 | `docs/prd/android-app.md` |
| DB 스키마(기본) | `supabase/schema.sql` |
| 마이그레이션 엔드포인트 | `app/api/admin/migrate/route.ts` |
| 인증 핵심 | `lib/admin-auth.ts`, `lib/session.ts`, `lib/jwt.ts` |
| 이메일 | `lib/email.ts` (Gmail SMTP) |
| 파일 정책 | `lib/attachments.ts` |
| 메인 SPA | `app/page.tsx` |
| 강의(사용자/관리자) | `components/VideoPage.tsx`, `components/AdminVideos.tsx` |

---

### 실습 팁 (직원용)
- 처음부터 모든 기능을 만들려 하지 말고 **Phase 0~3까지만으로도 "가입→영상시청"이 도는 MVP**가 완성됩니다. 거기서 성취감을 얻고 단계적으로 확장하세요.
- 막히면 이 문서의 해당 §5 요구사항 + §10 파일 위치를 AI 코딩 도구에 함께 제시하면 빠릅니다.
