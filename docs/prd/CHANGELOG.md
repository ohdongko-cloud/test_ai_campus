# PRD: 이랜드리테일 AI 캠퍼스 — 마스터 변경 이력 (CHANGELOG)

- 최초 작성: 2026-05-30
- 최종 갱신: 2026-06-15
- 작성자/소유자: <오너> + Claude
- 운영 URL: https://retail-ai-campus.vercel.app
- GitHub: https://github.com/ohdongko-cloud/test_ai_campus
- 범위: 모든 PRD/기능/버전을 시간순으로 통합 관리하는 **living document**

> **운영 규칙 (필수)**
> 새 기능을 머지하거나 PRD를 추가할 때마다:
> 1. 이 문서의 §3 변경 이력에 새 항목 추가 (커밋 해시 + 한 줄 요약 + 관련 PRD 링크)
> 2. 헤더의 "최종 갱신" 날짜 업데이트
> 3. 현재 상태가 크게 바뀌었다면 [CURRENT-STATE.md](./CURRENT-STATE.md)도 함께 갱신
> 위 작업은 기능 커밋과 같은 PR/커밋에 포함한다.

---

## 1. 버전 정의

본 프로젝트는 의미 기반 **Phase 버전**(0~6)과 **Semantic Version**(v1.x)을 병행한다.

| Phase | 범위 | 대표 버전 | 완료일 |
|---|---|---|---|
| Phase 0 | 초기 구축 (Next.js + Neon DB + 회원/예약) | v0.1 | 2026-05-25 |
| Phase 1 | 영상 콘텐츠 강화 (편집/썸네일/좋아요/댓글) | v0.2 | 2026-05-26 |
| Phase 2 | localStorage → DB 전면 이관 | v0.3 | 2026-05-26 |
| Phase 3 | 보안·로깅·회원 인증 개편 | v0.4 | 2026-05-26 |
| Phase 4 | 운영 가시성 (Sentry, UX 디테일) | v0.5 | 2026-05-26 |
| Phase 5 | 홈·UI 리프레시 + 관리자 권한 시스템 | v0.6 | 2026-05-26 |
| Phase 6 | 시연 준비 (정책·페르소나·테스트 계정) | **v1.0-rc** | 2026-05-30 |
| Phase 7 | 안드로이드 앱 + 1,800명 공개 오픈 | v1.0 | 진행 중 |

**현재 버전: v1.0-rc (시연 직전)**

---

## 2. 작성된 PRD 목록 (19건)

모두 `docs/prd/` 하위에 보관.

| # | 파일명 | 주제 |
|---|---|---|
| 1 | [2026-05-26-video-edit-and-stage-copy.md](./2026-05-26-video-edit-and-stage-copy.md) | 영상 제목/URL 인라인 편집 + 스테이지 전체 복사 |
| 2 | [2026-05-26-video-thumbnail-like-comment.md](./2026-05-26-video-thumbnail-like-comment.md) | 영상 카드 썸네일·좋아요·댓글 |
| 3 | [2026-05-26-full-localstorage-to-db-migration.md](./2026-05-26-full-localstorage-to-db-migration.md) | localStorage → Neon DB 전면 이관 |
| 4 | [2026-05-26-fix-broken-comment-encoding.md](./2026-05-26-fix-broken-comment-encoding.md) | 한글 깨짐(U+FFFD) 손상 텍스트 차단 |
| 5 | [2026-05-26-import-localstorage-to-db.md](./2026-05-26-import-localstorage-to-db.md) | 어드민 일괄 임포트 도구 |
| 6 | [2026-05-26-launch-readiness-auth-logging.md](./2026-05-26-launch-readiness-auth-logging.md) | 1,800명 공개 대비 보안·로깅·회원 개편 |
| 7 | [2026-05-26-add-logout-button.md](./2026-05-26-add-logout-button.md) | 헤더 로그아웃 버튼 |
| 8 | [2026-05-26-password-visibility-toggle.md](./2026-05-26-password-visibility-toggle.md) | 비밀번호 보기 토글 |
| 9 | [2026-05-26-signup-ux-policy-improvements.md](./2026-05-26-signup-ux-policy-improvements.md) | 회원가입 UX/정책 개선 |
| 10 | [2026-05-26-home-cards-video-divider-guide-seed.md](./2026-05-26-home-cards-video-divider-guide-seed.md) | 홈 카드 2장 + 강의 레벨 구분선 + 가이드 시드 |
| 11 | [2026-05-26-admin-role-permissions.md](./2026-05-26-admin-role-permissions.md) | 관리자 역할/권한 시스템 |
| 12 | [2026-05-26-video-protect-guide-icons-rewrite.md](./2026-05-26-video-protect-guide-icons-rewrite.md) | 영상 외부 유출 방어 + 가이드 아이콘 개편 |
| 13 | [2026-05-26-floating-kakao-back-button-guide-cleanup.md](./2026-05-26-floating-kakao-back-button-guide-cleanup.md) | 카톡 FAB + 뒤로가기(hash 라우팅) + 가이드 정리 |
| 14 | [2026-05-26-floating-meeting-fab.md](./2026-05-26-floating-meeting-fab.md) | 미팅요청 플로팅 버튼 (FAB 3단 적층) |
| 15 | [2026-05-26-footer-policy-and-admin-button.md](./2026-05-26-footer-policy-and-admin-button.md) | 푸터 정책 모달 + 관리자 버튼 위치 이동 |
| 16 | [android-app.md](./android-app.md) | 안드로이드 앱 (living document, versionCode별 갱신) |
| 17 | [2026-06-06-level-test-once-server-side.md](./2026-06-06-level-test-once-server-side.md) | 레벨테스트 최초 1회 노출 보장(서버/DB 기준) |
| 18 | [2026-06-12-signup-org-dropdowns.md](./2026-06-12-signup-org-dropdowns.md) | 회원가입 법인·부서·직무 검색 드롭다운 + 기타 직접입력 (org_units) |
| 19 | [2026-06-15-ai-level-test.md](./2026-06-15-ai-level-test.md) | AI 레벨테스트 — 지식·행동·EBG 3축 측정 + 적응형 퀴즈 + 레벨 1~10 + 관리자 대시보드 |

> ※ 테스트 계정(`test@eland.co.kr` / `000000`)과 15 페르소나 리서치는 별도 PRD 없이 본 CHANGELOG와 `public/research/` 폴더로 관리.

---

## 3. 변경 이력 (시간순 — 최신이 위)

### Phase 7 (안드로이드 + 공개 오픈) — 2026-06

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `ab7c792` | fix(level-test): 점수 비중 갱신 — 지식10·행동50·EBG5·정성35 | 지식 내부 보안1·운영3·자동화3·서비스3, EBG 20→5%, 정성 20→35%(수기). 자동 65%(코딩보류 35%)→100% 환산. 엔진·PRD 동기화 |
| `bd25752` | feat(level-test): 홈 배너 실연결·결과 성장률·매트릭스 내보내기 | 홈 배너→실제 진단/수시 재측정 연결(완료자 'Lv N·다시 측정' 표시), 결과 화면 전월 대비 성장률, 관리자 매트릭스 CSV 내보내기+레벨 신호등 |
| `c6dd5ea` | feat(level-test): AI 레벨테스트 3차 — 관리자 매트릭스(법인/부서/직무) | PRD `2026-06-15-ai-level-test.md`(3차). `/api/admin/ai-level-matrix`(목록+정성 upsert), 'AI레벨 현황' 탭(법인/부서/직무 필터·전월·성장률·영역별·목표/이머니 인라인편집), M009 `ai_level_manual` |
| `d65d59e` | feat(level-test): AI 레벨테스트 2차 — 코딩 채점·총점 재산출·월 재측정 | PRD `2026-06-15-ai-level-test.md`(2차). 관리자 코딩 채점 API+탭(0~100 입력→총점 재산출, 행동=코딩0.6+서비스0.4), `recomputeWithCoding`, /status 월1회 dueForRetake+성장률, 게이트 재측정 반영 |
| `67caa63` | feat(level-test): AI 레벨테스트 1차 — 적응형 퀴즈·3축 채점·레벨 1~10 | PRD `2026-06-15-ai-level-test.md`(1차 MVP). 문항 75+(지식 보안/운영/자동화/서비스매칭·행동·EBG, 보기 셔플·NOA 대비), stateless 적응형 엔진(초→중→고 조기종료·정답 비노출), 지식10·행동50·EBG20 환산 레벨1~10, 코딩(질) 제출(링크/zip/html/이미지)→`ai_level_coding`, `/api/ai-level-test/*`(세션 레이트리밋), 강제 진입, M007·M008 |
| `c031139`~`3a8e0a2` | feat(signup): 회원가입 법인·부서·직무 검색 드롭다운 + 기타 직접입력 | PRD `2026-06-12-signup-org-dropdowns.md`, M006 `org_units` 테이블+시드(이랜드리테일), `/api/org-units`(공개·no-store) + `/api/admin/org-units`(마스터 CRUD), SearchableSelect 콤보박스, 부서→직무 cascading, 데스크톱·모바일 적용, 어드민 '조직 분류' 탭 |
| `6e2e67d` | fix(level-test): 레벨테스트 최초 노출을 계정(서버) 기준 1회로 교정 | PRD `2026-06-06-level-test-once-server-side.md`, M005(users.video_level/level_test_done_at) + /api/users/me 확장 + /api/level-test/seen 신규 + VideoPage 서버 기준 노출. 기기 변경 시 재노출 버그 해결 |

### v1.0-rc (Phase 6 — 시연 준비) — 2026-05-30

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `8653624` | feat: 스테이지 인라인 이미지 + 신규 영상 최상단 정렬 | PRD `2026-05-30-stage-inline-images.md`, 어드민 업로드/삭제 + 사용자 펼침 시 인라인 그리드 + 라이트박스. 신규 영상 자동 MIN(order_idx)-1 |
| `84dced2` | feat: 강의 영상 첨부파일 업로드/다운로드 (Vercel Blob) | PRD `2026-05-30-video-attachments.md`, 신규 `video_attachments` 테이블, 어드민 인라인 패널 + 사용자 모달 "📎 자료" 탭 + 카드 뱃지 |
| `c697422` | fix: 영상 모달 사이드바 위치 — 영상 옆(모달 우측 전체)으로 이동 | 본문 영역 분할 → 모달 전체 row 분할. 영상과 같은 행에서 사이드바 항상 보이게. 모달 maxWidth 에 sidebarW 자동 가산 |
| `45000db` | feat: 관리자 가입자/방문자 통계 + 회원 관리 탭 | PRD `2026-05-30-admin-member-stats.md`, 신규 권한 'members', `/api/admin/stats/overview` + `/api/admin/members` API, AdminMembers 컴포넌트 |
| `cb564eb` | feat: 영상 모달 스테이지 우측 사이드바 (접었다 폈다 + 모바일 오버레이) | PRD `2026-05-30-video-stage-sidebar.md`, 데스크탑 320/36px 토글, 모바일 85% 오버레이 + 백드롭 |
| `4aa2852` | feat: 영상 모달 크기 토글(컴팩트/표준/와이드) + 정보 영역 항상 노출 | 영상 maxHeight 로 크기 제약, 스테이지/스크립트/댓글 항상 스크롤 가능 |
| `52c4262` | fix: 영상 좌하단 공유/저장 콜투액션 버튼 차단 추가 | YouTube 일시정지 시 표시되는 화살표(공유) + 시계(저장) 버튼 가림 (14% × 14%) |
| `d4a6e39` | feat: 영상 모달 최대화 (max-width 860 → 1280px/95vw) + 차단 영역 % 단위 전환 | 풀스크린 차단 보상 — 모달 안에서 최대한 크게 시청. 차단 영역 비례 유지 |
| `9bda35e` | fix: 우하단 YouTube 로고 차단 영역 컨트롤바까지 확장 (bottom:0) | fcd1c7e 후속 — 컨트롤바 위쪽에 배치되어 있던 차단 div 를 bottom:0 까지 내림 |
| `fcd1c7e` | fix: 영상 보호 — YouTube 로고/제목 클릭 차단 위치 교정 + 풀스크린 차단 | 좌하단 차단 → 우하단(YouTube 로고)으로 이동, 상단 전체 차단 추가, fs=0 + allowFullScreen 제거 |
| `c787a06` | feat: 브랜드 마크 통일 — 헤더 3곳 + favicon + apple-icon + OG 이미지 | components/BrandMark.tsx 신규 (파란 그라데이션 + 흰 AI + 우상단 오렌지 점 + 둥근 모서리) |
| `f897872` | feat: 가이드에 Vrew + OpenClaw 추가 + 아이콘 매핑 | DB INSERT 실행 완료. CapCut 은 이미 등록되어 있어 제외 |
| `cc0f145` | feat: 미팅 페이지 이번 주 자동 세팅 + 자정 자동 갱신 | weekDates useMemo, todayKey 추적(1분 interval + visibilitychange/focus), "오늘로 ↩" 버튼, "이번 주" 뱃지 |
| `349cf80` | chore: 도메인 URL 갱신 (test-ai-campus → retail-ai-campus) | layout/OG/capacitor/load-test/문서 일괄, env `NEXT_PUBLIC_SITE_URL` fallback 도 동기화 |
| `ff4ac7b` | feat: SharePage 레이아웃 변경 — 목록 우선 + 등록 모달 분리 | PRD `2026-05-30-share-page-layout-modal.md`, ShareRegisterModal 신규 |
| `0ace015` | fix: 서비스 공유 등록 직후 목록 미반영 (CDN 캐시 우회) | SharePage `load()` cache-busting + `no-store` — Vercel edge `s-maxage=60` 우회 |
| `6df8a74` | feat: 영상 카드 '필수 시청' 빨강 뱃지 + 어드민 토글 | PRD `2026-05-30-video-required-badge.md`, DB `videos.is_required` 컬럼 |
| `8eacdfc` | fix: /m/video 페이지 useSearchParams 미사용 dead code 제거 (빌드 깨짐 픽스) | Suspense boundary 누락으로 prerender 실패하던 것 해결 |
| `22b7006` | fix: 플로팅 액션 버튼(FAB) 3개 우측 정렬 어긋남 수정 | 각 item 너비 56px 고정 → 라벨 글자 수와 무관하게 버튼 일렬 정렬 |
| `375254d` | docs: PRD 마스터 문서 3종 추가 (CHANGELOG/CURRENT-STATE/BACKLOG) | living docs 운영 시작 |
| `e593a25` | feat: 테스트 계정 반복 시연 지원 (가입 이력 자동 초기화) | 매 시연마다 신규 가입 화면 재현 |
| `3b1b36b` | feat: 데모용 테스트 계정 + 7일 자동 만료 + cron 정리 | `test@eland.co.kr` / `000000`, Vercel Cron 매일 00:00 UTC |
| `7b1e081` | docs: 15 페르소나 사용자 리서치 + 인사이트·커리큘럼 제안 | `public/research/personas-raw.md`, `insights-summary.md` |
| `b496b21` | feat: 서비스 공유 권한 회원 전체 개방 (관리자 → 회원 누구나) | 로그인만 하면 공유 가능 |
| `2fbfa42` | feat: 푸터 정책 모달 활성화 + 관리자 모드 버튼 푸터 이동 | 개인정보처리방침/이용약관/관리자 문의 4링크 |

### v0.6 (Phase 5 — UI 리프레시 + 권한) — 2026-05-26 ~ 27

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `c9a7bf2` | feat: 미팅요청 플로팅 버튼 추가 (FAB 3단 적층) | 미팅요청·안드로이드앱·소통방 (PRD #14) |
| `903a594` | feat: 플로팅 액션 2개 (안드로이드 앱 + 소통방) + 라벨 | FAB 초기 도입 |
| `49c29e6` | fix: 서비스 아이콘 CDN 교체 (cdn.simpleicons.org 404 → jsDelivr + Favicon) | 32개 서비스 아이콘 복구 |
| `bb4fec9` | feat: 홈 '만들기' 섹션 PC 4열 + Claude/OpenAI 실제 로고 | 그리드 레이아웃 |
| `8667d07` | feat: 카카오톡 FAB + hash 라우팅(뒤로가기) + 가이드 stats 제거 | PRD #13 |
| `1e93781` | feat: 영상 외부 유출 방어(옵션A) + 가이드 아이콘/Figma/설명 개편 | PRD #12, 워터마크/우클릭 차단/오버레이 |
| `2c62e1f` | feat: 관리자 역할·권한 시스템 + 홈 워딩 3건 | PRD #11, master/admin/user 3단계 |
| `43db1b5` | feat: 홈 카드 2장 + 강의 레벨 구분선 + 가이드 시드 + 카톡 링크 | PRD #10 |

### v0.5 (Phase 4 — 운영 가시성 + UX 디테일) — 2026-05-26

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `c0fc75f` | chore: 부하 테스트 스크립트 추가 (Node 18+ 내장 fetch 사용) | `scripts/loadtest.mjs` |
| `6266044` | feat: 회원가입 UX/정책 개선 — 라벨·비번 정책·완료 후 분기 | PRD #9 |
| `37f4f05` | feat: 회원가입 이메일 도메인 예외 허용 (한시적) | `NEXT_PUBLIC_EMAIL_DOMAIN_EXCEPTIONS` |
| `4c95615` | feat: 로그인/회원가입 비밀번호 입력에 보기 토글(눈 아이콘) 추가 | PRD #8 |
| `ebc0cec` | chore: 메일 발송 실패 진단 강화 + Sentry 동작 확인 테스트 라우트 | `/api/__sentry-test` |
| `ec85425` | feat: 메인 페이지 헤더에 로그아웃 버튼 추가 | PRD #7 (이후 헤더에서 푸터로 이동) |
| `0eaa16e` | feat: Sentry SDK 연동 — 운영 에러 자동 추적 | `instrumentation.ts`, 4종 config |

### v0.4 (Phase 3 — 보안·인증 개편) — 2026-05-26

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `68f45fa` | docs: PRD - 1,800명 공개 오픈 대비 보안·로깅·회원/로그인 개편 | PRD #6 |
| `c547698` | feat: 회원가입/로그인 UI 전면 개편 + 관리자 로그 화면 | 닉네임 도입(이름 → 닉네임), 사번 삭제 |
| `49d9610` | feat: 회원가입 이메일 인증 + JWT 세션 + 로그인 유지 + P1 보안 | Resend OTP 6자리, 10분 TTL |
| `5e5bb24` | feat: 관리자 인증 강화 — JWT 쿠키 로그인 + 레이트리밋 + 로그 조회 API | bcrypt + Upstash + audit |
| `9d4503f` | chore: 인증/세션/레이트리밋/이메일/로그 인프라 헬퍼 도입 | `lib/jwt.ts`, `ratelimit.ts`, `email.ts`, `audit.ts` |

### v0.3 (Phase 2 — DB 이관) — 2026-05-26

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `914f1b0` | feat: 어드민 일괄 임포트 도구 — PC localStorage → DB | PRD #5, 백업 가능 |
| `edc12e8` | fix: 댓글 한글 깨짐 — U+FFFD 손상 텍스트 거부 + 기존 1행 정리 | PRD #4, `lib/text-validation.ts` |
| `784283d` | docs: PRD - localStorage → DB 전면 이관 | PRD #3 |
| `cdfd47d` | feat: Phase 3 — 공유 서비스/가이드/채팅방·NOA 설정 DB 이관 | `shared_services`, `guide_groups`, `app_settings` |
| `1c15c84` | feat: Phase 2 — 예약/차단시간 데이터 DB 이관 | `reservations`, `blocked_slots` |
| `dc09523` | feat: Phase 1 — 영상/레벨 데이터 DB 이관 | `videos`, `video_levels` |
| `665ff8d` | chore: Phase 0 — DB 이관 인프라 (스키마·어드민 인증) | 어드민 쿠키 인증 도입 |

### v0.2 (Phase 1 — 영상 콘텐츠) — 2026-05-26

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `c6a91ef` | docs: PRD - 영상 카드 썸네일·좋아요·댓글 | PRD #2 |
| `caa9a83` | feat: 영상 카드에 썸네일·좋아요·댓글 기능 추가 | YouTube thumbnail API |
| `a81c921` | chore: 영상 좋아요/댓글용 DB 스키마 및 공용 세션 헬퍼 추가 | `video_likes`, `video_comments` |
| `feb8a1f` | feat: 카카오톡/SNS 링크 미리보기용 OG 이미지·메타태그 추가 | `opengraph-image`, `twitter-image` |
| `11f95c0` | fix: 헤더 로고 배지 텍스트 AC → Eland 로 변경 | |
| `108ec1a` | chore: PRD 문서 및 스키마 적용 헬퍼 스크립트 추가 | PRD #1, `scripts/apply-schema.mjs` |
| `85763e7` | feat: 영상 시청 모달 스테이지에 전체 복사 버튼 추가 | PRD #1 |
| `e5fdf37` | feat: 관리자 영상 목록에서 제목/URL 인라인 편집 추가 | PRD #1 |

### v0.1 (Phase 0 — 초기 구축) — 2026-05-25

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `5f30b0d` | feat: meeting block limit removal, home stats sync, employee-id login | |
| `a23f2c0` | feat(home): update hero copy and card text per UX review | |
| `81a862b` | feat: 홈/서비스가이드 페이지 디자인 핸드오프 구현 | |
| `bb3a7f1` | feat: 3단계 회원 인증 플로우 추가 (회원가입/로그인) | 초기 단순 회원 |
| `12b8325` | feat: 예약 차단시간에 종료시간 추가 및 사용자 화면 예약불가 표시 개선 | |
| `fa75780` | feat: Admin PRD - 영상/미팅/채팅방/통계/가이드 전면 개선 | |
| `76f4677` | fix: AdminMeetings handleStatusChange 타입에 pending 추가 | |
| `da5bcbb` | refactor: Supabase → Neon DB 마이그레이션 | DB 백엔드 전환 |
| `5ae000d` | feat: 이랜드리테일 AI 캠퍼스 초기 구현 | 초기 커밋 |

---

## 4. 향후 변경 시 기록 템플릿

새 기능 머지할 때 §3 최상단(현재 phase 섹션)에 한 줄로 추가:

```
| `<커밋해시>` | <feat/fix/docs/chore>: <한 줄 요약> | <PRD 링크 또는 비고> |
```

Phase가 바뀌면 새 phase 섹션을 §3 최상단에 추가하고, §1 표에도 등록.

---

## 5. 관련 문서

- [CURRENT-STATE.md](./CURRENT-STATE.md) — 현재 시스템 상태 스냅샷 (라이브 기능/DB/환경변수)
- [android-app.md](./android-app.md) — 안드로이드 앱 (별도 living document)
- `public/research/personas-raw.md` — 15 페르소나 인터뷰 raw
- `public/research/insights-summary.md` — 인사이트 + 커리큘럼 제안
