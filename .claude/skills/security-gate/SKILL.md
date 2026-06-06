---
name: security-gate
description: >-
  푸시 전 마지막 보안 게이트. 변경·푸시 범위에서 시크릿·토큰·PII·실명·기본비번 유출과
  §6 보안정책 위반(인증·권한·레이트리밋·PII 응답 제외·에러 통일·enumeration 방지)을 검사해
  통과/차단을 판정한다. 사용 시점: 푸시 직전, "보안 검토 / 시크릿 스캔 / security review"
  요청 시, 또는 /ship 내부 게이트로 호출될 때. gitleaks 와 .gitleaks.toml allowlist 를 사용한다.
argument-hint: "[선택: 검토 범위 메모]"
---

# /security-gate — 푸시 전 보안 검토

푸시 직전 보안 위반을 **차단**하는 게이트. 기준은 `CLAUDE.md`의 **§6 보안 정책**과 **특화 체크 9**.
판정은 ✅ 통과 / 🚫 차단 둘 중 하나. **차단이면 푸시·`/ship`을 진행하지 않는다.**

## 절차

### 1. 검토 범위 확보
```bash
git status --short
git diff                     # unstaged
git diff --staged            # staged
git log --oneline origin/main..HEAD     # 푸시될 커밋
git diff origin/main...HEAD              # 푸시될 전체 diff
```
`origin/main`이 없으면 현재 작업트리(diff/staged)만 대상으로 한다.

### 2. 시크릿 스캔 (gitleaks)
```bash
gitleaks protect --staged --redact --no-banner   # 스테이지
gitleaks detect --redact --no-banner             # 저장소 범위
```
- 미설치 시: `winget install gitleaks`(Windows) / `brew install gitleaks`(macOS) 안내 후, 아래 4번 수동 패턴 점검으로 대체.
- 탐지 시 **차단**. 오탐이면 `.gitleaks.toml` allowlist에 추가하도록 안내(자리표시자·예시값만).

### 3. 하드코딩 시크릿 / env 노출
- diff에 API 키·토큰·비밀번호·연결문자열이 평문으로 있는지. (`process.env.X` 사용이 정상)
- `.env`, `.env*.local` 이 스테이징되지 않았는지(`.gitignore`로 제외되어야 함).

### 4. PII · 실명 · 기본비번 (Grep으로 diff/신규 파일 점검)
- 개인 이메일(비-자리표시자), 실명, 약한 기본 비밀번호가 코드·문서·로그에 들어갔는지.
- 자리표시자(`<오너>`, `admin@example.com`, `change-me-*` 등)는 정상 → `.gitleaks.toml` 참고.

### 5. §6 보안정책 매핑 (변경이 API/auth/PII를 건드릴 때)
- **인증·권한**: 새/변경된 `app/api/**` 라우트에 세션·권한 체크가 있나? admin은 `master/admin/user`(`lib/admin-auth.ts`, `lib/session.ts`).
- **레이트리밋**: 공개 엔드포인트(가입·로그인·재설정·강의요청·댓글)에 `lib/ratelimit.ts` 적용?
- **PII 응답 제외**: 예약 등 사용자 API가 PII를 응답에 포함하지 않고 `no-store`인가?
- **에러 통일**: `catch`가 raw 에러를 노출하지 않고 `"서버 오류가 발생했습니다."`로 통일?
- **enumeration 방지**: 가입/재설정 요청이 회원 존재 여부와 무관히 동일 응답?
- **비밀번호**: bcrypt 해시인가? 평문 저장·메일 발송이 없나?

### 6. 디버그 잔재
- `console.log`, `console.error`(의도된 로깅 제외), raw 스택 노출, 임시 테스트 라우트(`/api/__sentry-test` 류)가 남았는지 Grep.

### 7. env 동기화
- 새 `process.env.X`가 `.env.local.example`에 문서화됐나. 자리표시자면 `.gitleaks.toml` allowlist에도 반영됐나.

## 출력 형식
```
[security-gate] 판정: ✅ 통과 | 🚫 차단

발견 (차단/경고):
- 🚫 lib/foo.ts:42 — 하드코딩된 토큰 의심 (...)
- ⚠️ app/api/bar/route.ts:10 — 권한 체크 누락 가능

권고: <조치>
```
- **차단 1건이라도 있으면 푸시 금지.** 조치 후 재실행.
- 통과 시: "푸시/`/ship` 진행 가능" 명시.

## 참고
- 정책 원문: `CLAUDE.md` §6 / 특화 체크 9, `docs/AI-CAMPUS-IMPLEMENTATION-PRD.md` §6
- 기존 자동 차단: `.husky/pre-commit`(gitleaks, 스테이지 한정) — 이 스킬은 **푸시 범위 전체 + 정책 매핑**까지 확장한다.
