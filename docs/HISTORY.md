# HISTORY — 작업 히스토리 & 세션 진척 요약

> **목적**: 대화 세션이 바뀌어도 진행 맥락을 잃지 않도록, 사용자 요청·확정 질의응답·결과를 시간순으로 기록한다.
>
> **세션 연속성 규약 (CLAUDE.md에도 명시)**
> 1. **새 세션 시작 시**: 가장 먼저 이 파일(`docs/HISTORY.md`)의 "현재 상태"와 최신 세션 로그를 읽고 직전까지의 맥락을 파악한 뒤 이어간다.
> 2. **작업 종료/주요 마일스톤마다**: "세션 로그" 맨 위에 새 항목을 추가하고 "현재 상태"를 갱신한다. (한 커밋 = 한 논리단위 원칙은 코드에만, 본 문서는 수시 갱신)
> 3. 커밋 해시·PRD 링크·배포 여부를 함께 남긴다. 상세 변경이력은 `docs/prd/CHANGELOG.md`, 영속 메모는 `~/.claude` 메모리/`MEMORY.md` 참조.

---

## 현재 상태 (Current State) — 2026-08-06 기준

- **운영 URL**: https://retail-ai-campus.vercel.app · **운영 DB**: Neon (`.env.local` `DATABASE_URL`, host `ep-sparkling-breeze…ap-southeast-1.aws.neon.tech`). Vercel main 푸시 → 자동배포.
  - ⚠️ 한때 "prod는 Neon 아님"이라는 착오가 있었으나 **prod = Neon 확정**. 2026-06-23 만든 Prisma "AI-CAMPUS" DB는 별도 빈 DB(미사용). (메모리 `prod-db-is-neon` 참조)
- (구) 마이그레이션 기록: M001~M012는 이전 세션까지 적용. M013은 2026-08-06 적용(위 참조).
- **최근 배포 완료 기능**:
  - **자료실**(배우기 영역, 게시판형) — 외부링크(드라이브/노션/URL) 연동·메타데이터만 DB·좋아요/댓글·관리자 큐레이션·데스크톱+모바일. **로그인 필수**.
  - **세션 30일 durable** — 데스크톱 자동로그인 기본 ON + 가입 자동로그인 durable (기존 6h 만료로 "로그인했는데 401" 버그 해소).
  - **레벨진단 팝업** — 30일 억제 + '30일간 보지 않기' 버튼 + 진단 완료자는 모달 미노출·30일 후 토스트.
- **HEAD**: `fc21143` — origin/main 동기화·Vercel 배포 완료. 골든 47/47(dot-segment 4케이스 추가).
- **🟢 SSO 허브 ON** (2026-08-06 활성화). JWKS 200(`kid=aicampus-rsa-20260806`) · Vercel Production env 4종 등록 · `sso_clients`는 `sso-selftest` 1건(검증 후 `enabled=false`) → **활성 스포크 0개**.
- **마이그레이션**: **M001~M013 전부 prod(Neon) 적용 완료** (2026-08-06 `POST /api/admin/migrate` 1회 실행, 전 항목 `ok`).
- **2026-07-27 ① 관측 선탑재 배포 완료**: M013(`sso_events`·`sso_daily_stats`·`stats_url`) + `logSsoEvent` + authorize/logout 계측 + `GET /api/admin/sso/overview`(master) + AdminSso 탭. env 없이 휴면 동작. 게이트: security(차단1건 수정 후 통과)·설계렌즈(조건부 승인)·release-verifier 통과. 운영 스모크: 홈/login/m 200 · overview 401(`관리자 인증이 필요합니다.`) · admin matrix 401 · userinfo 401 · logout 302 · authorize 미등록앱 400(`unknown app`).
- **🔴 남은 운영 작업**: **known-good 3건**(실제 로그인 / 가입 OTP 메일 수신 / 비번 재설정 메일 수신) — 사람만 가능. SSO를 켠 변경이라 블루프린트 §3 단계 6이 요구한다. 나머지 3건(영상·모바일·admin 권한)은 2026-08-06 자동 점검으로 갈음했다.
- **2026-07-27 ⓪ 보안 선행 패치 배포 완료**: sanitizeNext URL 파서 재작성(+회귀 25케이스) · userinfo nonce 1회 소비 가드+레이트리밋 · Sentry token 마스킹 (`2a9b42a`·`50ad909`·`b62a6ab`+docs `bda5ab9`). 게이트 4종(security·release·설계렌즈·gitleaks) 통과, 사용자 승인 후 푸시. 운영 스모크: 홈/login/m 200 · admin API 401 · userinfo 401 통일응답 · jwks 500(SSO OFF 불변). 롤아웃 다음 단계 = ① 관측 선탑재(M013).
- **2026-07-15 추가 배포**:
  - **강의 영상 팝업 → 영상별 단독 페이지 `/video/[id]` 전환 + 공유 링크**. 목록 클릭 시 팝업 대신 페이지 이동(모달 제거로 `VideoPage.tsx` 2026→1010줄). 로그인 필수(비로그인은 페이지 내 "로그인 후 시청" 게이트 + `/login?next` 복귀), 썸네일+제목 OG 카드(`generateMetadata`, robots noindex), 워터마크·보호레이어 패리티 유지. 신규 `app/video/[id]/page.tsx`(Server, force-dynamic)·`components/VideoWatch.tsx`·`lib/videos.ts`·`GET /api/videos/[id]`. 모바일 `/m/video/[id]` 링크복사 + versionCode 13. DB 변경 없음. 게이트: security ✅·release ✅(tsc·build·golden18)·preview·prod 실측 ✅. **`73150e8`**
- **2026-06-30 추가 배포**:
  - 관리자 'AI 레벨 현황' 매트릭스에 이름 옆 **이메일·가입일시** 컬럼 추가 (CSV 포함). DB 마이그레이션 없음(기존 `users.email`/`users.created_at` 재사용). PII는 `requireAdmin('members')` + `Cache-Control: no-store`로 보호. **`f599261`**
  - 같은 매트릭스에 **컬럼별 정렬**(15개 컬럼, 오름→내림→해제 3단 토글, `localeCompare('ko')`, null/빈값 항상 마지막, CSV/카운트 모두 정렬 상태 반영). 클라이언트사이드만 — API/권한/캐시/DB 무변경. **`7e474c9`**
- **남은/후속 (비차단)**:
  - 자료실에 실제 자료 등록(관리자 '자료실 관리' 탭) — 운영 작업.
  - (보안 후속) 가입 직후 durable 자동로그인의 공유PC 시 로그아웃 안내 검토.
  - (레벨테스트 후속) insert 실패 Sentry 가시화, `users.level_test_done_at` 폴백.
  - SSO 허브 실제 활성화 = 롤아웃 ② (아래 "다음 세션 착수 지점" 참조). **런북·로드맵은 `docs/sso/SSO-HUB-BLUEPRINT.md` §3·§7.**

### 🎯 다음 세션 착수 지점 (2026-08-06 세션 종료 시점)

**SSO 롤아웃 진행도**: ⓪ 보안 선행 패치 ✅ · ① 관측 선탑재 ✅ · **② 허브 활성화 ✅완료(2026-08-06, AC2~AC7 11 PASS)** · **③ 파일럿 ← 다음(web-fashion URL 확정이 유일한 차단)** · ④ 확대 · ⑤ 정착

**③ 착수 전 필요한 것**
- **web-fashion 운영 URL 확정**(§9-1, 미해결) → 확정되면 블루프린트 §3의 "실앱용 예시 SQL"로 `enabled=false` 등록 → 스포크 배포·출처 확인 후 `true`.
- ~~스포크 측 `/sso/callback` 구현~~ → **킷 실코드 완비**(`docs/sso/spoke-kit/`, `fc21143`). 스포크는 6파일 복사 + `npm i jose` + env + 어댑터 1파일 작성이면 된다(README 참조).
- 파일럿 시 처음으로 검증되는 것: **AC8**(실제 스포크 왕복) · `nonce` 400 분기(등록·활성 앱이 있어야 도달) · `kit=` 텔레메트리.

1. ~~**[사용자 작업] `POST /api/admin/migrate` 1회 실행**~~ → ✅ **2026-08-06 완료** (M001~M013 전 항목 `ok`). 실행 전 degrade·실행 후 적재까지 실측 완료(아래 세션 로그).
2. ~~**[사용자 결정 — ② 착수 전 필수] 블루프린트 §9**~~ → ✅ **2026-08-06 결정 완료** (파일럿 URL 미확정→②는 selftest만 / §6-10 개정 승인·관측 등급 유지 / Hobby 유지·수용 / rememberMe 기본 ON 확정).
3. **[② 실행] 허브 활성화** — 블루프린트 §3 런북 단계 0~7: RS256 키 생성 → Vercel env 4종(`SSO_PRIVATE_KEY`·`SSO_PUBLIC_KEY`·`SSO_KID`·`SSO_ISSUER`) → 재배포 → `sso_clients` 2단계 등록(enabled=false→검증→true) → 스모크 S1~S3 + AC2~AC7 → **known-good 6종 재실행**.
4. **[코드 후속]** — 4건 중 3건 완료(2026-08-06, 커밋 `1f6dfaf`·`e01f47f`·`14cf880`).
   - ~~계약 문서에 userinfo 단일 사용 명문화~~ ✅ `1f6dfaf` (+ 실패 시 무재진입 규범까지 확장)
   - ~~§7-5 완료 판정에 `login_required` 카운터 전환 선행조건~~ ✅ `e01f47f`
   - ~~`recentFailures`를 등록앱/미등록프로빙으로 분리~~ ✅ `14cf880`
   - **v1.5 cron `/api/cron/sso-daily`(§4.3) — 미착수(의도적 보류).** Tier2 풀 대상 스포크가 아직 0개라 지금 만들면 검증 불가능한 죽은 코드가 된다. 블루프린트 §7-4(확대 단계) 항목이며 90일 내 도입이 시한.
   - **[신규 백로그] M014 `sso_events.was_registered`** — 등록앱/프로빙 분리가 조회 시점 재계산이라 `sso_clients` 삭제·rename 시 과거 실패가 프로빙으로 소급 재분류된다. 현재는 §5.2 "삭제 대신 enabled=false" 운영 규칙 + UI 캡션 고지로만 방어. M013이 방금 적용됐으나 스냅샷 컬럼은 소급 복원이 불가해 실익이 낮다 — 운영 규칙+UI 고지로 유지.
   - **[신규 백로그] 프로빙 대량 유입 시 overview 응답 지연** — `sso_events`에 event 단독 인덱스가 없어 실패 조회 2건이 `created_at` 역방향으로 많은 행을 훑을 수 있다(master 전용 화면이라 즉시 위험은 아님).
- **로컬 개발 환경**: `.env.local` **존재**(2026-08-06 확인 — 이전 기록의 "없음"에서 바뀜, 내용은 규칙상 미열람) → 로컬 DB 실측 불가 상태였음. 템플릿은 코드의 `process.env` 전수 추출본으로 생성해 사용자에게 전달(SSO 4종은 ②에서 채움). 훅이 `.env*` 읽기·출력을 차단하므로 값 확인은 사용자만 가능.
- **2026-07-27 설계 산출물(코드 무변경·미커밋)**: SSO 허브 설계도 v2([docs/sso/SSO-HUB-BLUEPRINT.md](sso/SSO-HUB-BLUEPRINT.md)) + 스포크 구현 패키지 설계([docs/sso/SSO-SPOKE-KIT.md](sso/SSO-SPOKE-KIT.md)). 신규 핵심 = 전 서비스 사용현황 중앙 관리(Tier1 sso_events / Tier2 일일 풀, M013 예정) + 보안 보강 필수 5건(§6 B1~B5: userinfo nonce 가드·Sentry 토큰 마스킹·sanitizeNext URL파서 패치·등록 2단계·키회전 SLA). 구현 착수 전 사용자 결정 필요 항목은 블루프린트 §9.

---

## 세션 로그 (최신이 위)

### 2026-08-06 — 스포크 킷 실코드 구현 + **로그인 오픈리다이렉트 실취약점 수정** (커밋 2개, 배포 완료)

> [배포 완료] `6adf7b7..fc21143` push → Vercel READY → **운영 배포본을 번들에서 꺼내 실행 검증**.

**🔴 이번 라운드의 핵심 — 운영에 살아 있던 오픈리다이렉트**

킷을 만들다 보안 게이트가 킷의 `sanitizeReturnTo`에서 dot-segment 우회를 찾았고, **허브 원본(`app/login/page.tsx` `sanitizeNext`)에도 같은 결함이 있음**을 확인했다. 독립 재현 성공:

```
/login?next=%2F..%2F%2Fevil.com → sanitizeNext → "//evil.com" → https://evil.com/
```

- **원인**: `if (u.origin !== base)` 검사가 정규화 **이전** 값 기준이다. `new URL('/..//evil.com', base)`는 origin이 base 그대로여서 통과하지만, 파서가 `..`를 걷어낸 `pathname`만 `//evil.com`(프로토콜 상대)이 되고, 그 값을 리다이렉트 대상으로 쓰면 외부 오리진으로 해석된다.
- **⓪ 보안 선행 패치(B3)가 고쳤다던 바로 그 함수다.** prefix 문자열 검사 → URL 파서 검증으로 교체해 탭/CR/LF 우회는 막았으나, **정규화 결과를 다시 보지 않아** 이 경로가 남았다.
- **왜 골든 25케이스가 못 잡았나**: 공격 코퍼스에 dot-segment 입력이 아예 없었다. 4종(`/..//evil.com`·`/%2e%2e//evil.com`·`/foo/..//evil.com`·`/..///evil.com`)을 추가해 고정(43 → **47건**).
- **수정**: 정규화 결과 `out`을 base에 한 번 더 상대 해석해 origin 유지를 재판정. 허브·킷 양쪽 동시 패치.
- **운영 실행 검증**: 배포된 minify 번들에서 함수를 그대로 꺼내 실행 — 공격 8종 전부 `/`, 정상 4종 보존(`/foo/../bar` → `/bar`). 추정이 아니라 실행 증거. **`be768d0`**

**표류 방지 장치가 작동한 사례**: 프로덕션만 고치고 테스트 미러를 안 고쳤을 때 골든 PART 2의 소스 계약 검사(C1)가 정확히 실패했다. 미러·계약 패턴까지 갱신해야 통과한다.

**스포크 킷 실코드 6파일 (`fc21143`)**

`docs/sso/spoke-kit/` — 설계 문서로만 있던 것을 "복사 = 설치"가 성립하는 실제 `.ts`로.
`lib/sso-spoke.ts`(코어) · `lib/sso-adapter.example.ts` · `app/sso/login|callback/route.ts` · `app/api/sso/stats/route.ts` · `README.md`.

주요 설계 결정:
- **userinfo 기본 OFF** — 어댑터가 `mergeUserinfo`를 정의한 경우에만 콜백이 동기 1회 호출. 이렇게 해야 "콜백은 DO NOT EDIT"과 "userinfo 확장"이 동시에 성립한다(설계문서의 자기모순 해소). `fetchUserinfoOnce`는 재시도를 **아예 구현하지 않아** 계약 §2.1 MUST NOT을 코드로 강제.
- `randomToken` = `randomBytes(32).base64url`(43자) — 계약 §2.2 nonce 요건과 `kit=` 화이트리스트를 항상 만족.
- `SSO_SELF_URL` trailing slash 제거 — 콜백 URL을 문자열 결합으로 만들어 슬래시가 남으면 `//sso/callback`이 되어 허브 정확매칭에서 **항상 400**.
- 미들웨어는 실제 파일로 배포하지 않고 README 스니펫으로만 — Next는 루트 `middleware.ts`를 자동 활성화하므로 스포크 기존 미들웨어와 충돌 위험. §7-5 선행조건 경고 동봉.
- `tsconfig.json` exclude에 `docs/sso/spoke-kit` 추가 — 킷의 `@/lib/sso-adapter`는 허브에 없는 경로라 방치하면 허브 tsc 게이트가 깨진다.

**web-fashion URL 후보 실측 (2026-08-06)** — 확정은 여전히 사용자 몫

| 후보 | 응답 | 판단 |
|---|---|---|
| `https://eland-apparel.vercel.app` | **307 → `/dashboard`** | 살아 있는 앱. 루트를 대시보드로 보내는 실서비스 형태 — **유력 후보** |
| `https://eland-fashion.vercel.app` | 404 | 배포 없음 |
| `https://web-fashion.vercel.app` | 200, `<title>React App</title>` | CRA 기본 타이틀 = **무관한 제3자 프로젝트로 추정** |

**확인필요**

- **web-fashion 운영 URL 최종 확정** — 위 실측은 "살아 있다"까지만 말해준다. 그것이 *우리* 앱인지, 커스텀 도메인이 정본인지는 사용자만 안다. `redirect_uri`는 정확매칭이라 오타 1자면 전부 400.
- **`SSO_HUB_ISSUER` 바이트 일치** — 허브 `SSO_ISSUER`가 Vercel Sensitive라 코드로 대조 불가. 파일럿 때 실제 발급 id_token의 `iss`를 디코드해 확인할 것.
- **known-good 3건** 여전히 미실행.
- `app/level-assess-preview/`는 주석에 "로그인 게이트 없이 단독 확인용"이라 적힌 **무인증 공개 라우트**다. 현재 미추적이라 배포되지 않지만 `git add -A`로 딸려 들어가면 운영에 인증 없이 노출된다 — 정리 권장.

### 2026-08-06 — ② 허브 활성화 완료 + 활성화 후 감사 + 하드닝 (커밋 5개, 배포 완료)

> [배포 완료] `31ef775..66101aa` push → Vercel READY → 운영 실측 검증. **SSO 허브가 ON 됐다.**

**② 활성화 실행 기록 (블루프린트 §3 런북)**

| 단계 | 결과 |
|---|---|
| 0 사전 스냅샷 | JWKS **500**(OFF) 확인 — 시작점 증거 |
| 1 RSA 키 생성 | Git Bash + openssl 3.5.6. PKCS#8/SPKI 헤더 확인 + **키쌍 일치 검증** 통과 |
| 2 Vercel env | `SSO_PRIVATE_KEY`·`SSO_PUBLIC_KEY`·`SSO_KID=aicampus-rsa-20260806`·`SSO_ISSUER` Production 전용. 계정 정책이 4종 모두 Sensitive로 강제 |
| 3 재배포 | `vercel redeploy` → alias 확정 |
| 4 검증 | JWKS **200**, `kid` 일치, 개인키 성분(d/p/q) 부재 |
| 5 selftest 등록 | `sso_clients` 1건 `enabled=true` |
| 6~7 E2E | **11 PASS · 0 FAIL · 0 SKIP · 종료코드 0** (AC2~AC7 전항) |
| 8 정리 | selftest `enabled=false` → 라이브 400 확인. 쿠키 파일 삭제 |

**E2E 핵심 실측**: T8 발급 302(`jwt len=699`) · T9 `aud=sso-selftest`·**`ttl=60s`**·인가 클레임 부재 · T10 userinfo 200(필드 정확히 5개·`no-store`) · **T11 동일 토큰 재사용 401**(발급 후 2초) = ⓪ nonce 1회성 가드가 운영에서 실제로 방어 중.

**중간에 잡은 실제 결함 — env 등록 실패**

첫 등록에서 `SSO_PUBLIC_KEY` 값의 **PEM armor 2줄(`-----BEGIN/END PUBLIC KEY-----`)이 통째로 누락**돼 있었다(대시보드 값이 `MIIBIj…`로 시작). `importSPKI`가 armor 없이는 파싱 못 해 JWKS가 계속 500이었다. 로컬 원본 2행과 대조해 **같은 키·armor만 누락**임을 확정한 뒤, `\n` 이스케이프 단일행(`normalizePem` 정식 지원 형식)으로 4종 전부 CLI 재등록해 해소.

**활성화 후 감사 (3렌즈 워크플로우) — 보안 렌즈 URGENT 판정**

| 발견 | 성격 | 조치 |
|---|---|---|
| `sso-selftest`가 검증 후에도 `enabled=true` 잔존 | 로그인한 임직원의 id_token을 404 URL로 유출 가능 + `prompt=none` 로그인상태 오라클 | ✅ 즉시 비활성화 |
| **`deny_*` 3종 무제한 INSERT** | `rate_limited`만 저빈도 버킷이 있었고 `deny_*`는 없음 → 86,400행/일/IP(40~60MB) | ✅ `2efa121` |
| **`sso_nonces` 정리 코드 0건 + nonce 무검증** | 블루프린트 G5. 쿼리 원문이 검증 없이 PK 저장(btree 상한 ~2.7KB) → 계정 1개로 200MB+/일 | ✅ `00c3f81`·`2efa121` |
| PII 응답 `no-store` 누락 | 전수 조사 결과 3곳이 아니라 **9개 라우트**. reservations는 `String(e)` 원문 노출(§6-8 위반)도 동반 | ✅ `8aa3e34`·`66101aa` |

**둘 다 어제까지는 무해했다** — M013 미적용으로 INSERT가 조용히 실패했고 SSO는 OFF였다. **migrate + 활성화가 동시에 실체화시킨 위험**이다. 소진 시 Neon Free 0.5GB를 앱 전체가 공유하므로 로그인·가입 OTP·재설정이 동반 중단된다.

**핵심 설계 판단**

- `deny_*` 게이트에 **과거 회귀 재발 방지**를 구조로 넣었다. ① 세션에서 로깅용 `checkRateLimit`을 판정 try 안에 두는 바람에 throw 시 `return tooManyRequests()`를 건너뛰어 차단 대상이 통과한 사고가 있었다 → `canLogSso()`를 **절대 throw하지 않게**(exit 경로가 `return` 둘뿐) 설계해 응답 흐름을 구조적으로 불변화.
- nonce는 **치환이 아니라 400 거부**. 킷이 토큰 nonce를 자기 쿠키와 대조하므로(KIT §2.3) 허브가 값을 바꾸면 정상 스포크 로그인이 전부 깨진다. **활성 스포크 0개인 지금이 규칙을 세울 수 있는 유일한 시점**이라 계약 §2.2 신설로 동기화.
- 계약 문서의 코드 참조를 **줄번호 → 코드 앵커**로 전환. 이번 수정으로 행이 밀려 기존 참조가 어긋났고, 줄번호는 앞으로도 계속 어긋난다.

**내가 놓쳤다가 실측에서 드러난 것**

`8aa3e34` 커밋 메시지에 "모든 응답 경로에 no-store"라고 썼으나 **거부(401/403) 응답은 라우트가 아니라 공유 헬퍼가 만들어서 빠져 있었다.** 배포 후 실측에서 드러나 `lib/admin-auth.ts`에 `denied()` 헬퍼를 넣어 한 곳에서 덮도록 수정(`66101aa`). 운영 재확인 **6/6 `no-store`**.

**확인필요**

- **known-good 3건 미실행** — 실제 로그인 / 가입 OTP / 재설정 메일 수신. 사람만 가능하며 SSO를 켠 변경이라 §3 단계 6이 요구한다. 나머지 3건(영상·모바일·admin)은 자동 점검으로 갈음.
- **`nonce` 400 분기 라이브 미검증** — 등록·활성 앱이 있어야 도달하는데 selftest를 껐다. ③ 파일럿에서 확인된다.
- 개인키가 `C:\Users\oh_dongha01\sso-keys\`에 평문 잔존(사용자 보존 선택). 유출 시 임직원 사칭 가능 — 정리 권고.
- 세션 토큰 1건이 대화에 노출됐다(2026-08-26 만료). 스테이트리스 JWT라 로그아웃으로 무효화되지 않는다. **사용자 결정 = 수용·자연 만료 대기**(무효화하려면 `JWT_SECRET` 회전 = 전원 재로그인).

### 2026-08-06 — ② 착수 전 결정 4건 + 코드 후속 3건 + M013 운영 적용 (커밋 11개, 배포 완료)

> [배포 완료] 커밋 11개 `c71b833..9cbcd7a` push → Vercel 배포 → 운영 스모크 통과(홈·login·m 200 · JWKS 500=SSO OFF 불변 · admin/userinfo 401). 이어서 **M013 마이그레이션 실행 완료**(전 항목 `ok`).
>
> 게이트: security-reviewer **2회 통과**(1차 차단 2건 → 수정 → 재검토 차단 0 → 추가 커밋 2개 재검토도 차단 0) · release-verifier 통과 · sso-auth-architect 차단 1건 수정 후 반영 · pre-push(tsc+gitleaks 11커밋) 통과.

**사용자 결정 (블루프린트 §9 → 문서 반영 완료)**

| 항목 | 결정 | 파급 |
|---|---|---|
| web-fashion 파일럿 URL | **미확정** | ② 활성화는 `sso-selftest` 임시 클라이언트 1건만 등록. 실앱 등록은 URL 확정 후 ③ |
| PRD §6-10 문구 개정 | **승인 · 관측 등급 유지** | `sso_events`를 감사 증적으로 격상하지 않음. 코드 변경 0, 문서만 정합화 |
| Vercel Hobby ToS | **유지 · 리스크 수용** | 각 스포크 자체 로그인 폴백이 살아있어 허브 중단이 전면 장애 아님. Pro $20/월은 비상 경로 |
| rememberMe 기본 체크 | **현행 기본 ON 확정 · 종결** | 실측으로 이미 ON(`WelcomePopup.tsx:146`·`MobileWelcome.tsx:81` `useState(true)`) |

**결과 / 커밋**

| 커밋 | 내용 |
|---|---|
| `e01f47f` | 설계도 v2 + 스포크 킷 등재, §9 결정 기록, §7-5 게이트 문구, §3 런북 selftest/실앱 SQL 분리 |
| `1f6dfaf` | 계약 — userinfo 단일 사용 + **무재진입** 규범, §2.1.1 응답코드표, §8 이슈창구 정정 |
| `14cf880` | 관리자 SSO 현황 `recentFailures` / `recentProbes` 분리 (API+타입+UI) |
| `93d712a` | 로그 새니타이저 bidi·제로폭 제거 + 코드포인트 단위 절단 |
| `2758ec0` | `scripts/sso-e2e-verify.mjs` — 활성화 검증 T1~T11 |
| `271641c` | PRD §6-10 개정 |
| `7dc8bd0` | known-good 6종 규율 + 보안 게이트 `middleware.ts` 트리거 |

**게이트가 잡은 것 (기록 가치 높음)**

- 🚫 **보안 게이트 차단 — 내가 새로 쓴 계약 문서가 자기-DoS 패턴을 MUST로 배포할 뻔했다.** 초안의 "userinfo 실패 시 `/sso/authorize`로 재진입해 재로그인 유도"는, 허브 세션이 살아 있으면 authorize가 **사용자 상호작용 0으로 즉시 재발급**하므로(`app/sso/authorize/route.ts:68-85`) 콜백→userinfo 실패→재진입 **무한 루프**가 된다. 게다가 결정적 실패 경로가 실재한다 — ① `storeNonce` 실패를 삼키고 토큰 발급(`:89-95`) → 첫 호출부터 100% 401, ② `SSO_PUBLIC_KEY` 오류 → 전건 500, ③ `users` 행 부재 → 404. 회전마다 `sso_events` INSERT가 쌓이고 authorize 60/분 레이트리밋에 갇힌다.
  **최종 규범(설계 렌즈 확정)**: 재시도·자동 재진입 **금지**, 이미 검증된 **id_token 클레임(email)만으로 세션 발급**. userinfo는 프로필 보강 전용이고 인가 정보를 주지 않으므로(N2) 누락돼도 권한 영향이 없다 — 자동 리다이렉트가 아예 발생하지 않아 루프가 **구조적으로 불가능**하다. (게이트 원안인 "401만 재진입+마커 쿠키 1회 제한"은 쿠키 상태만 늘고 도달점은 동일해 기각)
- 🚫 **설계 렌즈 차단** — 계약 §8이 여전히 "허브 Sentry + `auth_logs` 확인"으로 안내. `sso_events` 체계와 어긋날 뿐 아니라, `/sso/userinfo`는 `logSsoEvent`·에러 리포터를 호출하지 않고 모든 예외를 자체 catch로 삼켜 **Sentry에도 아무것도 안 온다**. 실제 단서는 Vercel HTTP 액세스 로그 상태코드뿐 → 정정.
- **E2E 스크립트의 구조적 결함** — 초안은 "앱 미등록"으로 조기 반환하는 분기를 **PASS로 집계**했다. `sso-selftest` 미등록 + 쿠키 미제공으로 돌리면 "0 FAIL"로 보이지만 AC2~AC7이 **하나도 검증되지 않은** 상태 → 활성화 완료를 거짓 선언할 수 있었다. SKIP 규약 + 종료코드 2로 교체.
- 새니타이저에서 동일 계열 결함 추가 발견 — 길이 절단이 UTF-16 코드유닛 `slice`라 서러게이트 페어를 쪼개 U+FFFD를 만든다(과거 실제 버그 클래스). `Array.from` 기반으로 교체.
- 보안 게이트의 "`.next` 산출물에 SSO 개인키 인라인" 경고는 **오탐으로 확정** — 헤더 리터럴(`BEGIN PRIVATE KEY`, jose 라이브러리 코드) 1회뿐이고 실제 PEM 본문 블록 미매치.

**②(허브 활성화) 준비 상태**

- 런북 단계 0(사전 스냅샷) 실측: JWKS **500 = SSO OFF 확정** · authorize 미등록앱 400 · userinfo 401 · overview 401 · 홈 200.
- 단계 1~5(키 생성·Vercel env 4종·재배포·`sso_clients` 등록)는 **사용자 작업**(시크릿은 Claude가 취급하지 않음).
- 단계 6~7 검증은 `node scripts/sso-e2e-verify.mjs`로 자동화됨.

**이월돼 있던 확인필요 2건 — 이 세션에서 닫힘 (관리자 화면 실측)**

- ✅ **M013 graceful degrade 실측** — migrate **실행 전** 'SSO 현황' 탭을 열어 확인. 테이블 부재 상태에서 500이 아니라 빈 상태로 정상 렌더("등록된 스포크 앱이 없습니다"/"표시할 추이 데이터가 없습니다"/"실패 이벤트가 없습니다"). `to_regclass` 가드가 의도대로 동작.
- ✅ **AdminSso 탭 실제 렌더** — 정상. 이번에 푸시한 신규 UI("최근 실패 이벤트(등록 앱, 최대 20건)" + "미등록 앱 프로빙(N건)" 2블록 + 소급 재분류 캐빗)까지 배포 반영 확인.
- 참고: 접속 role은 `legacy`(ADMIN_PASSWORD 쿠키, 화면 배지 "비상 모드")였다. `requireMaster`가 `master`·`legacy`를 모두 통과시키므로 overview·migrate 둘 다 정상 동작. 콘솔의 `/api/admin/ping` 401은 관리자 모드 진입 전 초기 로드 1회분.

**M013 적용 후 라이브 검증 — 관리자 화면 실측으로 전부 통과**

운영 `/sso/authorize`에 미등록 app 프로브 2건을 발사하고 'SSO 현황' 탭에서 결과를 확인했다.

| 검증 | 결과 |
|---|---|
| `logSsoEvent` 적재 | ✅ "미등록 앱 프로빙 **2건**" · 90일 누적 2건 · 14일 추이 차트에 08-06 거부 2건 — M013 이전의 조용한 INSERT 실패가 해소됨 |
| **새니타이저 라이브 검증** | ✅ 프로브 2에 **U+202E(RLO)** 를 심어 보냈으나 화면 표기는 `__selftest_unknown__check` — **RLO가 제거되어 문자 순서 역전 없음**. `93d712a`/`fe9039f`가 운영에서 실제로 동작 |
| 등록/프로빙 분리(`14cf880`) | ✅ 프로브 2건이 전부 **프로빙 패널**로 가고 "최근 실패 이벤트(등록 앱)"는 0건 유지 — 공격 노이즈가 실장애 신호를 밀어내지 않음 |
| PII | ✅ 프로빙 표에 event·app·IP·시각만, email 없음 |
| cron 배지 | ✅ "cron 미도입(v1.5 예정)" 정상 표기 |

**확인필요 (남음)**

- `.env.local`이 **존재**한다(이전 기록의 "없음"과 다름). 내용은 규칙상 미열람.
- known-good 6종은 이번 세션에서 미실행 — 이번 변경이 인증/세션/모바일을 건드리지 않아 필수 대상은 아니나, **② 활성화 후에는 반드시 실행**해야 한다.

### 2026-07-27 — ① 관측 선탑재 (Tier1 SSO 이벤트 + 관리자 SSO 현황 탭) — 배포 완료

> [배포 완료] 사용자 푸시 승인 → `e325dc0..8837d18` push → Vercel READY(dpl_DhMsn…) → 운영 스모크 통과(홈/login/m 200 · overview·matrix·userinfo 401 · logout 302 · authorize 미등록앱 400). **M013 DB 적용은 미실행 — `POST /api/admin/migrate` 1회 필요.**

**요청·결정·결과**

| # | 사용자 요청 | 확정 질의응답 | 결과 / 커밋 |
|---|---|---|---|
| 1 | ⓪ 완료 후 롤아웃 ① 착수 | — (푸시 미승인 상태) | 3영역 병렬(migration-guard·api-route-builder·ui-builder) 후 통합. **`5682503`** M013 스키마 · **`93bddec`** logSsoEvent+계측 · **`c7909bc`** overview API · **`566e8a8`** AdminSso 탭. cron(`sso-daily`)은 v1.5라 범위 밖 |

**게이트 통과 기록**
- ✅ security-reviewer — **1차 🚫 차단 1건 → 수정 → 재검토 통과**
- ✅ sso-auth-architect 설계 렌즈 — 조건부 승인(차단 0)
- ✅ release-verifier — tsc 0에러·build 73/73(`/api/admin/sso/overview`=ƒ)·golden 43/43·비인증 401 실측·기존 SSO 응답 불변 런타임 확인
- ✅ pre-commit gitleaks 4커밋 각각 clean

**보안 게이트가 잡은 것 (실제 취약점 — 기록 가치 높음)**
- **차단**: `/sso/logout`은 인증·레이트리밋 없는 GET인데 계측 추가로 요청당 `sso_events` 1행 INSERT가 생겼다(이전엔 DB 무접촉 = 신규 벡터). `<img src>`로 제3자가 방문자 IP를 빌려 분산 유발 가능 → Neon Free 0.5GB 소진 시 1,800명 로그인 동반 중단. **수정**: 유효 세션 + 레이트리밋(10/분/IP)일 때만 기록.
- 경고 반영: UA 원문 무제한 저장 → 255자 절단(헤더 8~16KB 증폭) · 429마다 로깅 → 저빈도 버킷(3/분)으로 레이트리밋이 DB 쓰기를 실제로 막게 · issue 로깅 `after()` 이동 · `kit` 화이트리스트.
- **내가 만든 회귀를 재검토가 잡음**: 로깅용 보조 `checkRateLimit`을 바깥 try 안에 넣어, throw 시 `return tooManyRequests()`를 건너뛰고 차단 대상이 통과할 수 있었다 → 판정과 429 반환을 try 밖으로 분리.

**설계 렌즈 핵심 지적 (반영)**
- **SSO OFF인 지금도 `deny_*` 이벤트는 쌓인다** — 검증 분기가 키 사용보다 앞이라 env 무관하게 동작. 그런데 그 기간이 관리자가 SSO 탭을 열 유인이 가장 낮은 구간 = 90일 lazy 정리가 안 도는 구간. **반영**: `logSsoEvent` 삽입 500회당 1회 확률 정리 폴백 추가(신규 테이블·cron 0).
- PII 설계는 "타입 강제"를 초과 달성(SQL 프로젝션 레벨에서도 email 미투영) 판정.
- 후속 권고(비차단): §7 5단계(자동 리다이렉트) 전에 `login_required` 표본/카운터 전환 게이트 명문화 · `recentFailures`를 등록앱 실패 vs 미등록 프로빙으로 분리 · **PRD §6-10 문구 개정(§9-3)은 여전히 사용자 승인 대기** — 코드가 그 개정을 전제로 먼저 배포되는 순서임.

**확인필요 (실행 증거 없음)**
- M013 graceful degrade(테이블 부재 시 빈 응답) 실측 — 로컬 `.env.local` 부재로 DB 접근 불가. 배포 후 migrate 실행 전 AdminSso 탭 열면 그 경로가 그대로 재현됨.
- AdminSso 탭 실제 렌더 — 마스터 세션 필요.
- **배포 후 `POST /api/admin/migrate` 1회 실행 필요**(M013 미적용 상태).


### 2026-07-27 — ⓪ 보안 선행 패치 3건 구현·커밋·배포 (롤아웃 §7 단계 0 완료)

> [배포 완료] 사용자 푸시 승인 → `16b19a4..bda5ab9` push → Vercel READY(dpl_3LzFe…) → 운영 스모크 통과(홈/login/m 200 · admin 401 · userinfo 401 통일 · jwks 500=SSO OFF 불변).

**요청·결정·결과**

| # | 사용자 요청 | 확정 질의응답 | 결과 / 커밋 |
|---|---|---|---|
| 1 | 블루프린트 §7 롤아웃 단계 ⓪(보안 선행 패치)부터 시작 — 0-1 sanitizeNext(ui-builder)·0-2 userinfo nonce(sso-hub-builder)·0-3 Sentry 마스킹(직접) 분담표 제시 | — (푸시는 미승인 상태로 커밋까지만) | **`2a9b42a`** sanitizeNext URL 파서 재작성+회귀테스트 25케이스 · **`50ad909`** userinfo nonce 1회 소비 가드+IP 레이트리밋 10/분+authorize storeNonce 실패 로그 · **`b62a6ab`** Sentry token 마스킹(lib/sentry-scrub.ts + config 3파일). **전부 로컬 커밋만, 미푸시** |

**게이트 통과 기록**
- ✅ security-reviewer (차단 0 — gitleaks no leaks·§6 전항·구버전이 실제 `/\t/evil.com` 통과하던 것 HEAD 대조 확증)
- ✅ release-verifier (tsc 0에러 · build 73/73 · golden 43/43(18+25) · userinfo 코드 순서 소스 대조 · SSO OFF 시 통일 500 실HTTP 실측)
- ✅ sso-auth-architect 설계 렌즈 — **조건부 승인**: consumeNonce 원자적 UPDATE라 TOCTOU 불가, 첫 호출 선점 레이스는 실효 낮음(수용). 조건 = 후속 문서화 갭
- ✅ pre-commit gitleaks 3커밋 각각 clean

**핵심 발견·결정**
- 보안 게이트 권고 반영 소패치 2건: userinfo 레이트리밋 try/catch fail-closed 통일 500(authorize의 fail-open과 의도적 비대칭 — 주석 명시), authorize storeNonce 침묵 실패에 console.error(401 "재사용 vs 미저장" 사후 구분).
- `TransactionEvent` 타입은 @sentry/nextjs가 재export 안 함(v10) → `@sentry/core`에서 직접 import.
- 정상 스포크 첫 userinfo 호출 항상 통과 보장: nonce TTL 90s > 토큰 60s, authorize는 storeNonce만 호출(consumeNonce 호출처는 userinfo 유일).

**남은 후속 (비차단 — 설계 렌즈 조건)**
- 계약 문서(`docs/sso-spoke-integration-contract.md`·`SSO-SPOKE-KIT.md`)에 "userinfo는 단일 사용·재시도 금지·콜백 중 동기 1회" 규약 명문화 — 파일럿(§7-3) 전.
- Tier1 관측(`sso_events`, M013)은 다음 단계 ①에서 — storeNonce 실패·userinfo 401 구분의 구조적 해소.

### 2026-07-27 — SSO 허브 설계도 v2 + 스포크 킷 설계 (문서만, 코드 무변경)

**요청·결정·결과**

| # | 사용자 요청 | 확정 질의응답 | 결과 / 커밋 |
|---|---|---|---|
| 1 | 이 서비스를 다른 자작 서비스들의 SSO 허브로 만들고, SSO 연결 전 서비스의 사용자 로그·접속 현황을 한 곳에서 관리(일/주 1회 갱신이면 충분). 허브 설계도 + 스포크 구현 패키지 가이드 + 우려점·한계·장단점 정리 | — (자율 세션 — 미해결 질문은 블루프린트 §9로 등재) | 멀티에이전트 워크플로우(현황 판독 3 → 설계 3 → 검증 3렌즈, 9 에이전트) 후 통합. 산출물: `docs/sso/SSO-HUB-BLUEPRINT.md`(설계도 v2 — 활성화 런북·사용현황 중앙관리·운영·보안보강·롤아웃) + `docs/sso/SSO-SPOKE-KIT.md`(copy-paste 킷 v2.0.0 설계 + 계약 v2 개정 목록). **미커밋**(문서만, 푸시는 사용자 승인 후) |

**핵심 발견·결정**
- SSO 허브는 2026-06-20 PRD로 이미 구현 완료·기능 OFF(코드·M010/M011·계약 v1.1 존재). 유일한 하드 차단 = Vercel env 4종. **단, SSO 감사 로그는 미구현**(PRD §6-10 문구와 불일치 — app/sso/**에 logAuth 0건).
- 사용현황 관리 = 2계층: **Tier1** 허브 관측(`sso_events` 신규 M013, 스포크 작업 0, authorize 발급 시점 기록) / **Tier2** 스포크 일별 집계 풀(허브 cron `sso-daily` 일 1회, `days=7` 백필). **인증은 허브 RS256 요청 토큰(scope=stats:read)으로 통일** — 설계 초안 간 모순(blocker)을 해소, 신규 시크릿 0.
- PII 원칙: email은 원 소유 서비스 밖으로 안 나감(Tier2는 집계값만). 관리자 overview 응답은 email 필드 없는 타입으로 강제.
- 보안 보강 필수(구현 전): ① `/sso/userinfo` nonce 1회성 가드(현행은 60초 내 토큰 재사용으로 PII 반복 조회 가능) ② Sentry/로그 token 쿼리 마스킹 ③ **운영 중인 `sanitizeNext`의 탭/개행 오픈리다이렉트 우회 → URL 파서 기반 검증으로 패치**(킷 배포 전 선행) ④ sso_clients 2단계 등록(enabled=false→검증→true) ⑤ 키 회전 실전파 +10분 SLA 명시.
- 무료티어 실측(2026-07 웹 검증): Vercel cron은 전 플랜 100개/프로젝트(2026-01 변경)·Hobby는 일 1회·±1h·무재시도. Neon Free 0.5GB → `sso_events` 90일 보존(≈135MB) 확정. **Vercel Hobby 비상업 조항·무SLA는 수용 리스크로 명문화**(1,800명 사내앱 IdP — Pro $20/월 전환을 비상 경로로).
- 스포크 패키지 = copy-paste 킷(npm private 유료·PAT 부채로 기각). 어댑터 2메서드만 앱별 작성, `kit=` 텔레메트리로 전 스포크 버전 드리프트 자동 관측. 파일럿 = web-fashion(URL 사용자 최종 확인 대기).

**다음 할 일**
- 사용자 결정: 블루프린트 §9 (web-fashion URL 확정·PRD §6-10 문구 개정 승인·Hobby ToS 수용 여부·rememberMe 기본체크 등)
- 구현 순서: 롤아웃 §7 — ⓪보안 선행 패치 → ①관측 선탑재(M013) → ②허브 활성화 → ③파일럿 → ④확대 → ⑤정착

### 2026-07-15 — 강의 영상 팝업 → 영상별 단독 공유 페이지 (/prd-flow)

**요청·결정·결과**

| # | 사용자 요청 | 확정 질의응답 | 결과 / 커밋 |
|---|---|---|---|
| 1 | 강의 영상을 팝업이 아니라 영상별 단독 페이지로 구성해 URL을 복사·공유하고 접속할 수 있게 (/prd-flow) | **Q1 팝업**→페이지로 전환(팝업 제거) · **Q2 접근**→로그인 필수 · **Q3 미리보기**→썸네일+제목 OG | PRD #29. 데스크톱 모달 제거(`VideoPage.tsx` 2026→1010줄, handleWatch→`router.push('/video/{id}')`) + 신규 `app/video/[id]/page.tsx`(Server·force-dynamic·generateMetadata OG·getCurrentUser 로그인 게이트) + `components/VideoWatch.tsx`(플레이어·워터마크·보호레이어·탭·좋아요·링크복사) + `lib/videos.ts`·`GET /api/videos/[id]` + 모바일 `/m/video/[id]` 링크복사·versionCode 13. DB 변경 없음. **`73150e8`** 푸시 → Vercel 배포 |
| 2 | main 푸시(운영 배포) 승인 | 명시 승인 | main ff 머지 → 푸시 → 배포. prod 실측: `/video/{id}` 404→200(신빌드), OG 썸네일·제목, 로그인 게이트+`?next`, 홈 200, `GET /api/videos/{id}` 200(PII 없음), 없는 id 404 |

**게이트 통과 기록**
- ✅ PRD 리뷰 (게이트①, 8섹션·PII/§6 매핑·엣지 표·의존성 보강)
- ✅ security-reviewer (게이트②, 0 차단 — gitleaks·파라미터화 SQL·서버JWT 워터마크·force-dynamic no-store·보호 패리티·에러 통일)
- ✅ release-verifier (tsc·build `/video/[id]`=ƒ Dynamic·golden18·코드정합성)
- ✅ preview 실측 + prod 실측
- ✅ pre-push 훅 (tsc + gitleaks)

**이 세션 핵심 교훈**
- 데스크톱 영상 모달은 URL이 없어(순수 `selectedVideo` state) 공유 불가였음 → 영상별 라우트로 전환이 정답. 모바일은 이미 `/m/video/[id]` 존재(패리티 근거).
- 로그인 필수 + OG 미리보기 동시 충족: **리다이렉트 대신 페이지 내 게이트**(200 응답)로 스크래퍼가 OG 카드를 받게 함. `generateMetadata`는 인증 무관 공개.
- 대형 파일 죽은 코드 제거는 `tsc --noUnusedLocals`를 오라클로 써서 정확히 식별(엔탱글된 `/api/users/me` 효과는 보존).

### 2026-06-30 — 관리자 AI 레벨 매트릭스: 이메일·가입일시 컬럼

**요청·결정·결과**

| # | 사용자 요청 | 확정 질의응답 | 결과 / 커밋 |
|---|---|---|---|
| 1 | 관리자 'AI 레벨 현황' 매트릭스에 부서별 이름 옆 이메일+가입일시 컬럼 추가 | — | API SELECT에 `u.email`/`u.created_at AS joined_at` 추가, AdminAiLevelMatrix Row·thead colSpan(2→4)·tbody·CSV·minWidth(1080→1260) 동기화, `fmtDate(YYYY-MM-DD)` 유틸. DB 마이그레이션 없음 |
| 2 | /prd-flow 전체 진행 + 에이전트 소환해서 PRD 갱신·리뷰 후 배포까지 | 푸시 사용자 명시 승인 | PRD #28 사후 문서화 (`docs/prd/2026-06-30-admin-ai-level-matrix-email-joined.md`) + CHANGELOG 행 등록. **`f599261`** 푸시 → Vercel 자동배포 검증(홈 200, 매트릭스 API 비인증 401 PII 가드 유지) |
| 3 | 같은 매트릭스에 컬럼별 정렬 기능 추가, 완료되면 바로 푸시 | 푸시 사전승인 적용 | 15개 컬럼 정렬(오름→내림→해제 3단), `SortTh` 컴포넌트 + 활성열 강조 + ▲▼/⇅ 화살표 + '정렬 해제' 버튼. `localeCompare('ko')`, null/빈값 항상 마지막. CSV/카운트도 정렬 반영. 게이트: tsc PASS · 빌드(더미 env) PASS · preview 콘솔/서버 에러 없음 · 인라인 보안 점검 PASS(클라이언트사이드만) · pre-push 훅 PASS. **`7e474c9`** 푸시 → Vercel 자동배포 검증(홈 200, 401 PASS) |

**게이트 통과 기록**
- ✅ PRD 리뷰 (인라인 루브릭, 8섹션·PII/보안 §1·§7 명시·엣지 표 완비)
- ✅ release-verifier (tsc PASS, build PASS 73 pages, 401 PASS, UI SKIP-자격증명없음)
- ✅ security-reviewer (15개 항목 PASS — gitleaks 0건, 권한 게이트 `members`, `no-store`, SELECT 위생, catch 통일)
- ✅ pre-push 훅 (tsc + gitleaks)

**이 세션 핵심 교훈**
- 이메일은 PII이지만 `requireAdmin('members')` + `no-store`가 기존에 갖춰져 있어 사후 PRD 작성만으로도 보안 게이트 통과 가능.
- 미커밋 untracked 파일(`.agents/`, `app/level-assess-preview/` 등)이 누적되어 있으므로 커밋 시 정확히 파일을 지정해 범위를 좁힌다(`-A` 금지).
- 로컬 셸에 `DATABASE_URL`이 없으면 `npm run build`가 SSG 단계에서 실패하므로, 빌드 게이트는 더미 env로 돌린다(release-verifier 표준 절차).

### 2026-06-24~25 — 자료실 구축 & 인증/세션 정비

**요청·결정·결과**

| # | 사용자 요청 | 확정 질의응답 (Claude 질문 → 사용자 답변) | 결과 / 커밋 |
|---|---|---|---|
| 1 | 홈 카드 하단 메타 영역 제거 (배우기·물어보기·자랑하기) — 만들기처럼 | — | FeaturedCard·WideCard `hideMeta` 추가, 죽은 코드 정리. (이전 세션 연속) |
| 2 | 미사용 파일 삭제후보 + 폴더 용량 추출 | — | node_modules/.next/리팩토링사본/zip 식별. 워크플로우로 참조검증 |
| 3 | 리팩토링 사본 + 리팩토링 zip 삭제 (서비스 무손상) | — | `리팩토링 캠퍼스/`(910MB)·`AI-CAMPUS-REFACTORING.zip`(213MB) 삭제. **−1.1GB**(2,277→1,154MB). 추적파일 0변경. stale 메모리 정리 |
| 4 | 레벨테스트 재응시 팝업: 최초 1회 후 30일 미경과 시 안 뜨게 (/prd-flow) | — | PRD #25. localStorage `aiLevelCompletedAt` 마커로 30일 억제. **`774c2e7`** 푸시 |
| 5 | 레벨테스트 내역 저장 안 됨? DB 마이그레이션 안 했나 | — | 실측: M007/M008 적용·응시 5건 저장됨. **M004/M009/M010/M011 미적용** 발견 |
| 6 | NEON에서 바로 돌릴 SQL 마이그레이션 코드 | — | M009/M010/M011/M004 멱등 DDL 제공 → 사용자 실행 |
| 7 | M009~11 내용 설명 | — | M009=ai_level_manual(관리자 매트릭스), M010=sso_clients, M011=sso_nonces |
| 8 | 응시내역 보존 여부 (날아갔나) | — | 보존 확인(5건 intact). M009 누락은 관리자 화면만 깨뜨림(저장 무관) |
| 9 | 팝업 30일 억제 커밋 푸시 대기 이유 → 푸시 | — | 이유=운영 푸시 명시승인 규칙. **`774c2e7`** 푸시 |
| 10~11 | 진단 스크립트 설명 → 삭제 | — | 일회성 진단 스크립트 3개 삭제 |
| 12 | 가이드라인이 AWS 전제인가? | — | **Vercel 서버리스 전제**(밑단 인프라만 AWS). *(이하 일부는 사용자가 '다른 세션 내용 혼입'으로 정정)* |
| 13 | (혼입) 잘못 섞인 대화 롤백 | — | "aws 질문" 이후 **우리 레포 파일 변경 0건** 확인 → 롤백할 것 없음 |
| 14 | 레벨진단 팝업: '30일간 보지 않기' 버튼 + 진단자는 모달 대신 토스트 | — | PRD #26. 미진단자=모달+스누즈, 진단자=모달 미노출·토스트. **`17800af`** |
| 15 | **배우기 '자료실' 추가 (/prd-flow)** — 게시판형, 파일은 드라이브/노션 외부링크 | **Q1 등록권한**→관리자만(큐레이션) · **Q2 기능범위**→풀게시판(댓글·좋아요) · **Q3 링크**→드라이브+노션+URL 새탭 · **Q4 모바일**→데스크톱+모바일 동시 | PRD #27. M012 4테이블 + API 8라우트 + UI(데스크톱/모바일/관리자) + 배우기 카드. **`cb53a5f`** 푸시. M012 prod 적용 |
| 16 | prod가 Neon 아니라 다른 DB? | (정정) "NEON이 맞음, 위에서 잘못 얘기함" | 메모리 `prod-db-is-neon` 저장 |
| 17 | 자료실 401 + 빈 DB 시 "입력된 자료 없음" | — | 읽기 공개화 + 빈상태 문구. **`5534186`** 푸시 → *(아래 18에서 되돌림)* |
| 18 | "ㄴㄴ 로그인하고 접근 가능해야함" | **Q 세션정책**→**30일 durable(권장)** | 자료실 로그인 필수 복원 + 데스크톱 세션 30일 durable(자동로그인 기본 ON). **`03a83c1`** 푸시. *사용자: 재로그인 후 정상 확인* |
| 19 | 히스토리 md 기록 + 매 세션 확인 세팅 | — | 본 파일 생성 + CLAUDE.md 규약 추가 |

**이 세션 핵심 교훈**
- prod DB = Neon (`.env.local`). DB 마이그레이션은 마스터가 `POST /api/admin/migrate` 또는 Neon SQL.
- 이 앱은 **클라이언트 로그인(localStorage) ↔ 서버 JWT 세션** 분리. 서버 세션 기본 6h(데스크톱)였어서 만료 시 인증 API 401 → 세션 30일 durable로 해소.
- 게시판(posts)은 무인증 공개, 자료실은 로그인 필수 — 정책 차이 인지.
