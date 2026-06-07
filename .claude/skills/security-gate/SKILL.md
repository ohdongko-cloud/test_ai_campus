---
name: security-gate
description: >-
  푸시 전 마지막 보안 게이트. 변경·푸시 범위에서 시크릿·토큰·자격증명·PII 유출과 보안 위반(인증·인가
  누락, 레이트리밋, 입력검증/인젝션, 에러 누출, 안전하지 않은 기본값)을 검사해 통과/차단을 판정한다.
  repo에 보안정책(CLAUDE.md)이 있으면 그 항목에 매핑하고, gitleaks가 있으면 사용한다. 사용 시점:
  푸시 직전, "보안 검토 / 시크릿 스캔 / security review" 요청 시, 또는 /ship 내부 게이트로 호출될 때.
argument-hint: "[선택: 검토 범위 메모]"
---

# /security-gate — 푸시 전 보안 검토 (범용)

푸시 직전 보안 위반을 **차단**하는 게이트. 판정은 ✅ 통과 / 🚫 차단. **차단이면 푸시·`/ship` 중단.**

## 0. 규약·도구 탐지
- 보안정책: `CLAUDE.md`에 정책 섹션이 있으면 **그 항목을 체크리스트로** 사용. 없으면 아래 일반 기준.
- 시크릿 스캐너: `gitleaks` 설치 여부(`command -v gitleaks`). 설정 파일 `.gitleaks.toml`(allowlist) 존중.
- env 예시 파일: `.env.example`/`.env.local.example` 등.

## 1. 검토 범위
```bash
git status --short
git diff && git diff --staged
git log --oneline @{u}..HEAD 2>/dev/null     # 푸시될 커밋(업스트림 있으면)
git diff @{u}...HEAD 2>/dev/null
```

## 2. 시크릿 스캔
- gitleaks 있으면:
  ```bash
  gitleaks protect --staged --redact --no-banner
  gitleaks detect --redact --no-banner --log-opts="@{u}..HEAD"   # 업스트림 없으면 옵션 생략
  ```
  탐지 시 **차단**(오탐이면 allowlist 안내).
- 없으면: diff에서 API 키·토큰·비밀번호·연결문자열·`-----BEGIN ... KEY-----` 패턴을 Grep으로 수동 점검 + 설치 권장(`winget install gitleaks` / `brew install gitleaks`).

## 3. 자격증명/PII/env
- 하드코딩 시크릿(평문) — `process.env`/시크릿 매니저 사용이 정상.
- `.env`·`.env*.local` 등이 스테이징되지 않았는지(.gitignore 커버).
- 개인정보(실명·이메일·전화·주민/카드번호)가 코드·로그·응답·문서에 들어갔는지.
- 새 env 변수 → `.env.example`에 문서화됐나(자리표시자면 gitleaks allowlist).

## 4. 보안정책 매핑 (변경이 API/auth/DB를 건드릴 때)
CLAUDE.md 정책이 있으면 그 항목, 없으면 **일반 기준**:
- 새/변경 엔드포인트에 **인증·인가** 체크가 있나(역할/소유권).
- 공개 엔드포인트 **레이트리밋**.
- 입력 검증·파라미터화 쿼리(SQL/명령 인젝션 방지).
- **에러 누출 금지**: 스택/내부 메시지를 사용자 응답에 노출하지 않고 통일된 메시지.
- 민감 응답 **PII 최소화 + 캐시 금지**.
- 인증 응답 **enumeration 방지**(존재 여부 노출 X), 비밀번호 **해시 저장**.

## 5. 디버그 잔재
- `console.log`/`print`/디버그 라우트·임시 토큰·주석 처리된 비밀번호 등 Grep.

## 출력
```
[security-gate] 판정: ✅ 통과 | 🚫 차단
- 🚫 <file:line> — <무엇> (<근거>)
- ⚠️ <file:line> — <보강 권고>
권고: <조치>
```
- **차단 1건이라도 있으면 푸시 금지.** 통과 시 "푸시/`/ship` 진행 가능" 명시.
