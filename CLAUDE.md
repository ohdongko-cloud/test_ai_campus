# CLAUDE.md — 이랜드리테일 AI 캠퍼스

> 사내 AI 학습 포털. **이 파일은 모든 작업에 자동 적용되는 프로젝트 지침이다.**
> PRD 워크플로우 스킬(`/prd-new`·`/prd-review`·`/prd-commit`·`/security-gate`·`/ship`·`/prd-flow`)이
> 이 문서를 공통 기준점으로 참조한다. 규칙을 바꿀 때는 이 파일을 먼저 고친다.

## 스택 / 운영
- **Next.js 15** (App Router) + **TypeScript** + React 18 + Tailwind
- DB **Neon Postgres**(HTTP 드라이버) · 호스팅 **Vercel**(main 푸시 → 자동 배포)
- 인증 **JWT**(jose, httpOnly) + **bcrypt** · 메일 Gmail SMTP(nodemailer)
- 파일 **Vercel Blob** · 레이트리밋 Upstash · 모니터링 Sentry · 모바일 Capacitor(Android)
- 운영 URL https://retail-ai-campus.vercel.app · 대상 임직원 **~1,800명(실데이터)**

## 명령어
- 개발 `npm run dev` · 빌드 `npm run build` · 린트 `npm run lint`
- **타입체크 `npx tsc --noEmit`** — 커밋/푸시 전 필수 통과

## 빌드 게이트 (필수)
- 커밋·푸시 전 **`npx tsc --noEmit` + `npm run build` 통과**. 빌드가 깨지면 머지/푸시 금지.
- 모든 테스트 체크리스트의 마지막 항목은 "TypeScript 컴파일 에러 없음".

## 커밋 컨벤션
- 형식: `type(scope): 한글 요약` — type ∈ `{feat, fix, chore, docs, security, refactor}`
- 본문에 관련 PRD 링크: `PRD: docs/prd/YYYY-MM-DD-slug.md`
- 한 커밋 = 한 논리 단위 (무관한 변경 섞지 않기)
- 트레일러: `Co-Authored-By: Claude <noreply@anthropic.com>`
- 기능 머지·PRD 추가 시 **CHANGELOG 갱신을 같은 커밋에 포함**한다.

## §6 보안 정책 (반드시 구현)
1. 가입 도메인 `@eland.co.kr` + 이메일 OTP 인증 필수
2. 비밀번호 **bcrypt** 해시(평문 저장·전송 금지), 정책 8~16자
3. 민감 작업 본인확인: 비번 변경(현재 비번)·회원 탈퇴(비번 재입력)
4. 세션 **JWT httpOnly** 쿠키(prod `secure`)
5. 레이트리밋: 가입·로그인·재설정·강의요청·댓글
6. **enumeration 방지**: 가입/재설정 요청은 회원 존재 여부와 무관히 동일 응답
7. **PII 보호**: 예약 사용자 API에서 PII 제외, 캐시 금지
8. **에러 통일**: catch → `"서버 오류가 발생했습니다."` (raw 노출 금지)
9. 영상 보호: 워터마크·우클릭/복사 차단·외부공유 고지
10. 감사 로그(`auth_logs`) + Sentry 리포트
11. **비밀번호 메일 발송 금지** → 재설정 플로우로만

## 구현 시 '특히 더' 체크 (이 프로젝트 특화 9)
1. **PII/개인정보** — 로그·클라이언트 응답·Sentry에 PII 금지(1,800명 실데이터)
2. **DB 마이그레이션 안전성** — 멱등 + 하위호환 + 신규 컬럼 기본값
3. **인증·권한 회귀** — 새 admin API에 master/admin/user 체크, 공개 API 레이트리밋
4. **모바일·안드로이드 패리티** — `app/m/*` 라우트 동반, Capacitor `versionCode` 증가
5. **에러 통일** — §6-8
6. **한글 인코딩 가드** — U+FFFD 손상 문자 차단(과거 실제 버그)
7. **캐시 정합성** — 신규 데이터는 `no-store`로 CDN `s-maxage` 우회
8. **빌드 게이트** — 위 tsc + build
9. **env/시크릿 위생** — 새 변수는 `.env.local.example` + (자리표시자면) `.gitleaks.toml` allowlist 동기화

## DB 마이그레이션 / 권한
- 신규 컬럼·테이블은 멱등 엔드포인트 **`POST /api/admin/migrate`**(마스터 전용)로 1회 실행. 또는 Neon SQL Editor.
- 권한 모델: `master`(env `MASTER_ADMIN_EMAILS`) > `admin`(DB role + permissions JSONB) > `user`.

## 리빙 독스 (기능 커밋과 함께 갱신)
- `docs/prd/CHANGELOG.md` — §3 변경 이력에 `커밋해시 | 메시지 | PRD 링크` 행 추가, 헤더 "최종 갱신" 갱신
- `docs/prd/CURRENT-STATE.md` — 상태가 크게 바뀌면 갱신
- `docs/prd/BACKLOG.md` — 남은 작업(P0~P3) 추적

## 파일 맵
- 인증/세션: `lib/admin-auth.ts` · `lib/session.ts` · `lib/jwt.ts`
- 레이트리밋·감사·메일·첨부: `lib/ratelimit.ts` · `lib/audit.ts` · `lib/email.ts` · `lib/attachments.ts`
- 메인 SPA `app/page.tsx` · 강의 `components/VideoPage.tsx` · `components/AdminVideos.tsx`
- 마이그레이션 `app/api/admin/migrate/route.ts` · 스키마 `supabase/schema.sql`
- 보안 훅 `.husky/pre-commit`(gitleaks) · 시크릿 룰 `.gitleaks.toml`
- PRD `docs/prd/` · 종합 PRD `docs/AI-CAMPUS-IMPLEMENTATION-PRD.md`

## PRD 워크플로우 스킬
| 스킬 | 용도 |
|---|---|
| `/prd-new` | 8섹션 PRD 초안 작성 + `docs/prd` 저장 + 등록 |
| `/prd-review` | PRD 품질 루브릭 점검 (구현 전 게이트) |
| `/prd-commit` | 변경을 PRD 단위 원자적 커밋 + CHANGELOG 갱신 |
| `/db-migrate` | SQL 마이그레이션 멱등·하위호환 작성·적용·검증 |
| `/security-gate` | 푸시 전 시크릿·PII·§6 정책 검토 |
| `/ship` | 빌드·보안 게이트 통과 후 커밋·푸시·배포 검증 |
| `/prd-flow` | 위 단계(+마이그레이션)를 순서대로 잇는 오케스트레이터 |

> 스킬은 **적응형**: repo에 이 `CLAUDE.md`·`docs/prd`가 있으면 그 규약을 따르고, 없는 다른 프로젝트에선 기본 템플릿으로 동작한다(개인 스코프 `~/.claude/skills`에도 동기화되어 전 세션에서 사용 가능).

> PRD 템플릿은 8섹션 고정: ① 배경/문제 ② 목표·비목표(G/non) ③ 사용자 시나리오(S) ④ 기능 요구사항(F) ⑤ UX/디자인 ⑥ 엣지 케이스(표) ⑦ 성공 기준(체크박스) ⑧ 미해결 질문.
