# PRD: 이랜드리테일 AI 캠퍼스 — 마스터 변경 이력 (CHANGELOG)

- 최초 작성: 2026-05-30
- 최종 갱신: 2026-09-22
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

## 2. 작성된 PRD 목록 (30건)

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
| 20 | [2026-06-20-sso-hub.md](./2026-06-20-sso-hub.md) | SSO 허브(IdP) — AI캠퍼스를 사내 중앙 로그인 허브로 승격 (RS256/JWKS/OIDC-lite) |
| 21 | [2026-06-22-level-test-entry-choice.md](./2026-06-22-level-test-entry-choice.md) | 레벨테스트 진입 완화 — '지금 응시 vs 먼저 둘러보기' 선택 팝업(하루1회·완전선택형) |
| 22 | [2026-06-22-level-test-dont-know-option.md](./2026-06-22-level-test-dont-know-option.md) | 레벨테스트 '잘 모름' 선택지(지식 문항) + 코딩 '만든 서비스 없어요'(0점 확정) |
| 23 | [2026-06-22-home-make-cards-cleanup.md](./2026-06-22-home-make-cards-cleanup.md) | 홈 '만들기' 카드 정리(메타 삭제·NoA 접속·연계서비스 확인 맨뒤·제목 폰트↑) |
| 24 | [2026-06-22-home-all-cards-meta-cleanup.md](./2026-06-22-home-all-cards-meta-cleanup.md) | 홈 전 영역(배우기·물어보기·자랑하기) 카드 하단 메타 제거 + 죽은 fetch/state·미사용 컴포넌트 정리 |
| 25 | [2026-06-23-level-test-prompt-30day-suppress.md](./2026-06-23-level-test-prompt-30day-suppress.md) | 레벨테스트 재응시 팝업 30일 과노출 차단 — 서버 영속 실패에도 로컬 완료 마커로 30일 억제(클라 전용) |
| 26 | [2026-06-24-level-test-prompt-snooze-toast.md](./2026-06-24-level-test-prompt-snooze-toast.md) | 레벨진단 팝업 '30일간 보지 않기' 버튼 + 진단 완료자는 모달 영구 미노출·30일 후 토스트 알림 전환 |
| 27 | [2026-06-24-resource-library.md](./2026-06-24-resource-library.md) | 배우기 '자료실'(게시판형) — 외부링크(드라이브/노션/URL) 연동·메타데이터만 DB·풀 게시판(좋아요·댓글)·관리자 큐레이션·데스크톱+모바일·M012 |
| 28 | [2026-06-30-admin-ai-level-matrix-email-joined.md](./2026-06-30-admin-ai-level-matrix-email-joined.md) | 관리자 AI 레벨 매트릭스 — 이름 옆 이메일·가입일시 컬럼 추가 (DB 마이그레이션 없음, PII no-store) |
| 29 | [2026-07-15-video-standalone-shareable-page.md](./2026-07-15-video-standalone-shareable-page.md) | 강의 영상 팝업 → 영상별 단독 페이지 `/video/[id]` 전환(URL 복사·공유) — 로그인 게이트(?next)·썸네일+제목 OG·GET /api/videos/[id]·모바일 패리티, DB 변경 없음 |
| 30 | [2026-09-21-noa-sso-login.md](./2026-09-21-noa-sso-login.md) | 사내 통합계정(NoA Vibe Keycloak) SSO 로그인 — 브리지 방식(앱 세션은 기존 lib/session.ts httpOnly JWT 그대로), 이메일+비밀번호 로그인과 병행 유지, JIT 프로비저닝, M014 noa_sso_used_tokens(재생 차단), @noa/auth-sdk 배포 브레이크로 제거·와이어 계약 자체구현(벤더링 부채 명시) |

> ※ 테스트 계정(`test@eland.co.kr` / `000000`)과 15 페르소나 리서치는 별도 PRD 없이 본 CHANGELOG와 `public/research/` 폴더로 관리.

---

## 3. 변경 이력 (시간순 — 최신이 위)

### Phase 7 (안드로이드 + 공개 오픈) — 2026-06

| 커밋 | 메시지 | 비고 |
|---|---|---|
| `b111c93` | feat(sso): 사내 통합계정(NoA Vibe Keycloak) SSO 브리지 로그인 | PRD `2026-09-21-noa-sso-login.md`. 브리지 방식(Keycloak은 자격증명 확인만, 앱 세션은 기존 `lib/session.ts` httpOnly JWT 그대로 발급 — CLAUDE.md §6-4 근거) — `lib/noa-oidc.ts`(브라우저 PKCE)·`lib/noa-directory.ts`(서버 디렉터리)·`lib/noa-sso.ts`(RS256 JWKS 검증+jti 재생차단) 신규, `POST /api/users/sso-login`(CSRF 동일오리진 검사·레이트리밋), `app/auth/login`·`app/auth/callback`, `WelcomePopup`·`MobileWelcome` 버튼(모바일 패리티), `lib/sanitize-next.ts`(기존 오픈리다이렉트 방지 로직 공용 추출), M014 `noa_sso_used_tokens`(jti 1회 소비). `@noa/auth-sdk`는 사내 CodeArtifact 전용이라 Vercel install이 깨져 의존성 제거 → 와이어 계약만 자체구현(state·nonce 보강, 토큰 sessionStorage 미저장 — 벤더링 부채로 PRD에 명시). 8렌즈 병렬 감사(에이전트 104개, 지적 32건 → 반박단 통과 18건) 전량 수정 반영. 로컬 게이트(tsc·build·golden 50/50) 통과, **실제 Keycloak 왕복은 미검증**(배포 후 M014 마이그레이션 선행 필요 — 미실행 시 SSO 전면 401) |
| `66101aa` | security(api): 관리자 인증/권한 거부 응답에도 no-store | 직전 커밋의 "모든 응답 경로" 주장이 **불완전했음이 배포 후 실측에서 드러남** — 거부 응답은 라우트가 아니라 공유 헬퍼(`requireAdmin`/`requireMaster`)가 만든다. `lib/admin-auth.ts`에 `denied()` 헬퍼를 두고 401/403 4경로 일괄 처리. 본문에 PII는 없지만 **요청자 쿠키에 따라 달라지는 응답**이라 공유 캐시가 저장하면 사용자별 결과가 섞인다. 운영 재확인 6/6 no-store |
| `1f0bb37` | docs(sso): 계약 §2.2 authorize 파라미터 요건 신설 (nonce 형식 명문화) | 허브가 nonce 형식을 강제하게 돼 타 레포 규범 문서를 동기화. 파라미터 요건 표(app·redirect_uri·state·nonce·prompt·kit)와 위반 시 응답. **치환이 아니라 거부인 이유**(치환하면 스포크의 nonce 대조가 항상 실패) 명시. 표준 base64는 `+/=`가 난수에 따라 섞여 **간헐적으로만** 400이 나는 재현 어려운 실패가 되므로 base64url 필수 경고. 코드 참조를 줄번호→코드 앵커로 전환 |
| `8aa3e34` | security(api): PII 응답에 no-store 전수 적용 + 예약 API 에러 통일 | 활성화 후 감사 발견(기존 결함, SSO 무관). `app/api/**` 전수 조사로 **9개 라우트** 수정. 발단 = `/api/users/me`가 email·소속·직급+관리자 role/permissions를 `public, max-age=0, must-revalidate` + Vary에 Cookie 없이 반환(매 페이지 로드마다 호출되는 최고빈도 인증 라우트). reservations는 `catch`에서 `String(e)` 원문 반환(§6-8 위반) 동반 정정. 권한 게이트 무변경 |
| `00c3f81` | security(sso): sso_nonces 만료 행 확률형 정리 — 블루프린트 G5 해소 | repo 전체에 만료 행 정리 코드가 **0건**이었다(INSERT/UPDATE만). G5로 기록돼 있었으나 해소가 v1.5 cron(미착수)에 걸려 있었고 SSO가 켜진 오늘부터 실제 누적 시작. `logSsoEvent` 90일 폴백과 동일 패턴·확률(0.002), `WHERE expires_at < now()`만, `after()`로 응답 이후 실행(발급 경로 지연 0), 이중 try/catch로 절대 throw 안 함. M011의 `sso_nonces_expires_at_idx`가 비로소 사용처를 얻음 |
| `2efa121` | security(sso): authorize — deny_* 로깅 예산 게이트 + nonce 형식 검증 | 활성화 후 감사의 **URGENT 2건**. ① `rate_limited`만 저빈도 버킷이 있고 `deny_*` 3종은 없어 authorize 60/분/IP가 그대로 INSERT → 86,400행/일/IP(40~60MB). Neon Free 0.5GB 공유 소진 시 로그인·가입·재설정 동반 중단 → `canLogSso()`로 4종 통합, 4,320행/일/IP. **과거 회귀(로깅 보조 호출 throw → 차단 대상 통과) 재발을 구조로 차단** — `canLogSso`는 절대 throw하지 않아 각 `return badRequest()`가 항상 실행됨. ② nonce 쿼리 원문이 검증 없이 PK 저장(btree 상한 ~2.7KB) → `/^[A-Za-z0-9._~-]{16,128}$/` 위반 시 400+리다이렉트 금지, 세션 확인보다 앞에 배치 |
| `7dc8bd0` | docs(rules): known-good 6종 재실행 규율 + 보안 게이트 SSO 트리거 보강 | CLAUDE.md에 known-good 6종(로그인·가입OTP·재설정·영상재생·모바일패리티·admin권한) 명문화. `.claude/agents/security-reviewer.md` [SSO 모드] 발동조건에 `middleware.ts`(신규 생성 포함) 추가 — 설계 렌즈가 잡은 게이트 갭(middleware만 단독 추가 시 §7-5 선행조건 게이트가 아예 안 읽힘) |
| `271641c` | docs(prd): §6-10 감사 로그 문구 개정 — auth_logs → sso_events (관측 등급 유지) | 사용자 승인(블루프린트 §9-3). **코드가 이 개정을 전제로 먼저 배포된 순서를 문서로 정합화.** 각주로 등급을 못박음 — `logSsoEvent`(lib/audit.ts:79-111)가 INSERT 실패를 삼키고(:109) issue는 `after()`로 응답 후 기록(authorize:113)이라 **발급 건수 완전성 미보장 = 감사 증적 아님**. 거부 4종만 동기 await로 상대적 안정. 회원 인증 `auth_logs`는 불변 |
| `2758ec0` | feat(sso): 허브 활성화 검증 스크립트 (스모크 S1~S3 + AC2~AC7) | `scripts/sso-e2e-verify.mjs`. 신규 의존성 0(repo jose 재사용) T1~T11. **미검증을 통과로 세지 않는 설계** — 전제 미충족(앱 미등록·redirect 불일치·쿠키 미제공)은 PASS 아닌 SKIP이고 SKIP 존재 시 종료코드 2로 "활성화 완료" 선언 차단(0=전항통과/1=실패/2=미검증). 429는 RATE_LIMITED로 분리(스로틀링→보안결함 오진단 방지), T11은 T10 200 + 발급 후 50초 이내일 때만 판정(만료를 재사용차단 성공으로 오인 방지). 토큰·쿠키·이메일 원문 미출력 |
| `93d712a` | security(sso): 로그 새니타이저 — bidi·제로폭 제거 + 코드포인트 단위 절단 | 게이트 경고 반영. C0/DEL에 더해 bidi 오버라이드(U+202A~202E)·격리(U+2066~2069)·제로폭(U+200B~200D·U+FEFF) 제거(코드포인트 비교로 판정 — 소스에 비가시 문자 미포함). 길이 절단을 UTF-16 slice → `Array.from` 기반으로 교체(서러게이트 페어 분할 → 고립 서러게이트 → U+FFFD 렌더, 이 프로젝트 과거 버그 클래스). 원문 함수 직접 실행 검증: 한글·이모지 보존, RLO/제로폭 제거, 이모지 60→40 절단 시 U+FFFD 0 |
| `14cf880` | fix(admin): SSO 현황 — 최근 실패를 '등록 앱' vs '미등록 프로빙'으로 분리 | ① 설계 렌즈 권고(공격 노이즈가 실장애 신호를 밀어냄). `EXISTS`/`NOT EXISTS`(sso_clients) 서브쿼리로 SQL 측 분리 → `recentFailures`(등록앱 20) + `recentProbes`(프로빙 20). degrade 분기에도 `recentProbes: []`. UI는 프로빙을 건수 먼저+기본 접힘, app 문자열은 코드포인트 말줄임+`unicodeBidi:'isolate'`. 한계 명시 = 조회 시점 재계산이라 등록해제·rename 시 과거 실패가 소급 재분류(§4.6 캐빗·UI 캡션, 근본해소 M014는 백로그) |
| `1f6dfaf` | docs(sso): 스포크 계약 — userinfo 단일 사용 규약 + 실패 시 무재진입 규범 | ⓪ 설계 렌즈 조건(③ 파일럿 전 필수). **보안 게이트 차단 반영** — 초안의 "실패 시 `/sso/authorize` 재진입"은 허브 세션 생존 시 사용자 상호작용 0으로 재발급되어 콜백→실패→재진입 **무한 루프(자기-DoS)**가 된다(storeNonce 삼킴·PUBLIC_KEY 오류·users 행 부재 = 결정적 실패 경로 실재). 최종 규범 = **재시도·자동재진입 금지, 검증된 id_token 클레임(email)만으로 세션 발급**(userinfo는 프로필 보강 전용이라 인가 영향 0). 네트워크 예외 동일취급 + HTTP 클라이언트 자동재시도 비활성화 MUST. §2.1.1 응답코드표(200/401/404/429/500/무응답) 신설. §8 이슈창구 정정(auth_logs·Sentry → sso_events / userinfo 실패는 허브 무기록, Vercel 액세스 로그가 유일 단서) |
| `e01f47f` | docs(sso): SSO 허브 설계도 v2 + 스포크 킷 등재 (② 착수 전 결정 4건 기록) | `docs/sso/SSO-HUB-BLUEPRINT.md`+`SSO-SPOKE-KIT.md`. §9에 2026-08-06 사용자 결정: 파일럿 URL **미확정→②는 `sso-selftest` 1건만 등록** / §6-10 개정 승인(관측 등급 유지) / **Vercel Hobby 유지·리스크 수용**(Pro는 비상경로) / rememberMe **현행 기본 ON 확정·종결**(WelcomePopup:146·MobileWelcome:81 `useState(true)` 실측). §7-5 완료판정에 `login_required` 표본·카운터 전환을 선행조건 명문화(①렌즈). §3 런북에 ②용 selftest SQL과 ③용 실앱 예시 분리 |
| `566e8a8` | feat(admin): 'SSO 현황' 탭 (masterOnly) | 블루프린트 §4.6. 앱별 카드(오늘·7일·30일 발급/유니크/거부)·14일 BarChart·최근 실패 20건(email 컬럼 없음)·Tier2 병기·cron 상태. "발급 기준 ≠ DAU" 툴팁 고정, `ssoEnabled=false` 휴면 배너 + 빈 상태(현 운영 상태가 정상으로 보이게). adminFetch·팔레트·recharts는 기존 Admin* 이식 |
| `c7909bc` | feat(sso): 관리자 SSO 현황 overview API (master 전용) | 블루프린트 §4.4·§4.6. `requireMaster`+`force-dynamic`+`no-store`. PII 이중 강제 — 응답 타입에 email 필드 부재 + SQL은 `COUNT(DISTINCT email)` 집계로만 소비(원문이 JS로 안 넘어옴). apps 카드는 등록 클라이언트 기준(임의 app 값 대시보드 오염 차단, 공격 가시성은 recentFailures 유지). M013 미적용 시 `to_regclass` 빈 응답 degrade. 90일 lazy DELETE는 `after()` |
| `93bddec` | feat(sso): logSsoEvent + authorize·logout 계측 (Tier1 관측) | 블루프린트 §4.1. PII·인젝션 가드(이메일 마스킹·제어문자 제거·app 64/UA 255/detail 500자 절단). issue는 `after()`로 응답 후 기록, kit 텔레메트리는 화이트리스트 통과분만. **보안 게이트 차단 반영**: logout은 유효 세션+레이트리밋(10/분)일 때만 기록(익명 GET 무제한 INSERT 벡터 제거), 429 로깅은 저빈도 버킷(3/분), 레이트리밋 판정·429 반환을 try 밖으로 분리. 보존 폴백 = 삽입 500회당 1회 확률 정리. `login_required`는 원시 행 미기록(타입만 예약) |
| `5682503` | feat(sso): M013 — SSO 관측 스키마(sso_events·sso_daily_stats·stats_url) | 블루프린트 §4.5. 멱등(IF NOT EXISTS 전량 + `to_regclass` 가드로 M010 선행 의존 처리). `sso_daily_stats` PK(app,stat_date,source)는 Tier1 재집계·Tier2 풀 공용 업서트 키, Tier2 전용 컬럼은 nullable("미보고" vs "0건 보고" 구분). **DB 미적용** — 배포 후 `POST /api/admin/migrate` 1회 필요 |
| `b62a6ab` | security(sentry): 이벤트·브레드크럼 SSO id_token 쿼리 마스킹 | 블루프린트 §6-B1①. `lib/sentry-scrub.ts` 신규(`?token=`/`id_token=` 값만 `[Filtered]`, 구분자 조건으로 오탐 없음, url·query_string 3형태·Referer·breadcrumb 커버) + client/server/edge config 3파일에 beforeSend·beforeSendTransaction·beforeBreadcrumb 연결. regex 7케이스 실측 |
| `50ad909` | security(sso): userinfo nonce 1회 소비 가드 + IP 레이트리밋 | 블루프린트 §6-B1②(blocker)·G4 해소. `/sso/userinfo`에 payload.nonce 검증→`consumeNonce` 1회 소비(재사용 401, DB 오류 fail-closed 500) + IP 10회/분(`sso-userinfo`). authorize storeNonce 침묵 실패에 에러 로그. 정상 스포크 첫 호출 항상 통과(nonce TTL 90s > 토큰 60s). 스키마 무변경. sso-auth-architect 설계 렌즈 조건부 승인(후속=계약 문서에 userinfo 단일사용·재시도 금지 명문화) |
| `2a9b42a` | security(login): sanitizeNext 오픈리다이렉트 우회 차단 — URL 파서 기반 재작성 | 블루프린트 §6-B3(major). 구 prefix 검사는 `/\t/evil.com`(탭/CR/LF) 우회 가능 → 더미 origin URL 파싱·origin 유지 판정으로 교체. 회귀 테스트 `tests/sanitize-next.test.mjs` 25케이스(공격13·정상6·경계3) + test:golden 체인. 게이트: tsc·build 73p·golden 43/43·gitleaks·security-reviewer ✅ |
| `73150e8` | feat(video): 강의 영상 팝업 → 영상별 단독 페이지(/video/[id]) 전환·공유 링크 | PRD `2026-07-15-video-standalone-shareable-page.md`. 데스크톱 영상 모달 제거(VideoPage.tsx 2026→1010줄, handleWatch→router.push('/video/{id}')) + 신규 라우트 `app/video/[id]/page.tsx`(Server, force-dynamic·generateMetadata OG 제목+유튜브썸네일·robots noindex·getCurrentUser 로그인 게이트, 비로그인은 리다이렉트 대신 페이지 내 "로그인 후 시청"+`/login?next`) + `components/VideoWatch.tsx`(플레이어·워터마크·우클릭/단축키차단·외부이동오버레이·FLAG_SECURE·학습단계/자료/댓글탭·좋아요·전체화면·링크복사) + `lib/videos.ts`(getVideoById 파라미터화·폴백) + `GET /api/videos/[id]`(단건 404·PII없음). 모바일 `/m/video/[id]` 링크복사 추가 + versionCode 13. DB 마이그레이션 없음. 검증: tsc·build(/video/[id]=ƒ Dynamic)·golden18·preview(200게이트·OG·?next) PASS |
| `0de28fd` | docs: 세션 연속성 — HISTORY.md 도입 + CLAUDE.md 규약 | `docs/HISTORY.md` 신규(사용자 요청·확정 질의응답·결과·커밋 시간순 + '현재 상태' 스냅샷). CLAUDE.md에 "⭐ 세션 연속성" 추가 — 매 세션 시작 시 HISTORY.md 먼저 읽고, 마일스톤마다 append. CLAUDE.md는 매 세션 자동 적용되므로 별도 훅 없이 동작 |
| `5dfa9ec` | fix(auth/resources): 자료실 로그인 필수 복원 + 데스크톱 세션 30일 durable | 직전 공개화(`5534186`)를 되돌려 자료실 읽기 3엔드포인트(`/api/resources`·`.../comments`·`.../view`)를 **로그인 회원 전용**으로 복원. 근본원인 = 데스크톱 자동로그인 기본 OFF → 서버 JWT 세션 6h 만료로 '로그인했는데 401'. 해결: `WelcomePopup` 자동로그인 **기본 ON(30일)** + 가입 자동로그인 durable(`/api/users` rememberMe true) → 모바일·문서 정책과 일치. 빈 상태 문구('입력된 자료 없음')는 유지. 배포 후 기존 사용자는 1회 재로그인 시 30일 세션 |
| `5534186` | fix(resources): 자료실 열람 401 해결 — 읽기 공개화 + 빈 상태 문구 | PRD `2026-06-24-resource-library.md` 후속. 로그인 상태(localStorage)인데 서버 JWT 세션(기본 6h) 만료 시 자료실 목록이 401("로그인이 필요합니다")나던 버그. 게시판과 동일하게 `GET /api/resources`·`GET .../comments`·`POST .../view`를 **공개**로 전환(좋아요·댓글작성·등록은 로그인 유지). 빈 상태 문구 '입력된 자료 없음'(데스크톱·모바일). 프리뷰 실측: 비로그인 200·빈상태 렌더 확인 |
| `3a9e0f6` | feat(resources): 배우기 '자료실'(게시판형) — 외부링크 연동·풀 게시판·관리자 큐레이션·모바일 | PRD `2026-06-24-resource-library.md`. M012(resources·resource_likes·resource_comments·resource_comment_likes, 메타데이터만). 공개 API(/api/resources 목록·view·like·comments) + 관리자 CRUD(/api/admin/resources, `resources` 권한). 외부링크 드라이브/노션/URL https검증·새탭(noopener). UI: ResourcesPage·app/m/resources·AdminResources + 배우기 카드 + TabType/AdminTabType 'resources'. 데스크톱+모바일 패리티. PII 비노출·레이트리밋·파라미터화 SQL |
| `0088875` | feat(level-test): 진단 팝업 '30일간 보지 않기' + 진단자 토스트 전환 | PRD `2026-06-24-level-test-prompt-snooze-toast.md`. 팝업에 '30일간 보지 않기'(localStorage `aiLevelPromptSnoozedUntil` 30일 스누즈) 추가. 진단 완료자(서버 completed:true 또는 로컬 완료 마커)는 **모달 영구 미노출** → 30일 경과 시 하단 토스트(하루1회·9초)로만 안내. 모달은 서버 명시 completed:false일 때만. 순수 클라(`app/page.tsx`·`AiLevelPrompt.tsx`, DB/API 변경 없음) |
| `2a4265e` | fix(level-test): 재응시 팝업 30일 과노출 차단 (로컬 완료 마커) | PRD `2026-06-23-level-test-prompt-30day-suppress.md`. 결과 영속이 베스트에포트라 insert 누락 시 status가 영구 completed:false → 매 접속 팝업. localStorage `aiLevelCompletedAt` 마커 도입(완료 시 기록·서버 completed:true면 latest.at로 동기화), 게이트에 `!recentlyTestedLocally()`(30일) 추가로 억제. 순수 클라(DB/API/마이그레이션 변경 없음). 후속: M007 prod 적용 확인·users.level_test_done_at 폴백·insert 실패 Sentry |
| `a0c72b3` | feat(home): 전 영역 카드 하단 메타 제거 + 죽은 코드 정리 | PRD `2026-06-22-home-all-cards-meta-cleanup.md`. FeaturedCard·WideCard에 hideMeta 추가, 배우기·자랑하기 hideMeta·물어보기 2카드 hideMeta large, meta 전부 제거. 죽은 fetch/state(예약슬롯·게시판통계·공유수) + 미사용 Badge·LiveDot·getWeekDates·useEffect import 정리 |
| `7ed918e` | feat(home): 만들기 카드 정리 — 메타 삭제·워딩·순서·폰트 | PRD `2026-06-22-home-make-cards-cleanup.md`. ActionCard hideMeta·large 옵션, 만들기 4카드 메타 제거·제목 22px, 'NoA 접속'·'연계서비스 확인'(맨뒤). 타 섹션 불변 |
| `8992424` | feat(level-test): 지식 문항 '잘 모름' 선택지 + 코딩 '만든 서비스 없어요' | PRD `2026-06-22-level-test-dont-know-option.md`. 지식 4지선다에 '잘 모름'(0점·셔플제외·항상 마지막), 코딩 제출 단계 '만든 서비스 없어요' 버튼→코딩 0점 확정·총점 재산출 |
| `31be110` | feat(level-test): 진입 완화 — 지금 응시 vs 먼저 둘러보기 선택 팝업 | PRD `2026-06-22-level-test-entry-choice.md`. 100% 강제 → 로그인 후 선택 팝업(AiLevelPrompt). 하루1회 재유도(localStorage), 완전 선택형(영구 미응시 허용·배너 유도), 테스트 중도 이탈(onExit), 월 재측정도 팝업 |
| `3b6d231` | feat(sso): SSO 허브 IdP 구현 — RS256/JWKS/sso_clients·nonces/login next 새니타이즈 | PRD `2026-06-20-sso-hub.md`. lib/sso-keys·sso·sso-nonce·sso-clients, app/sso/authorize·logout·userinfo, app/.well-known/jwks.json, login next 오픈리다이렉트 방지, M010 sso_clients·M011 sso_nonces, schema.sql 동기화, .env.local.example SSO env. 게이트: security-reviewer ✅ / release-verifier(tsc·build·AC1·AC5·jose 60s) ✅. 스포크 핸드오프: docs/sso-spoke-integration-contract.md |
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
- [../sso-spoke-integration-contract.md](../sso-spoke-integration-contract.md) — SSO 스포크 통합 계약 (스포크 레포 작업자 핸드오프)
