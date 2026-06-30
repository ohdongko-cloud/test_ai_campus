# PRD: 관리자 AI 레벨 매트릭스 — 이메일·가입일시 컬럼 추가

- 작성일: 2026-06-30 · 작성자: Claude (요청자: <오너>)
- 범위: `app/api/admin/ai-level-matrix/route.ts` + `components/AdminAiLevelMatrix.tsx`. DB 마이그레이션 없음.
- 상태: **사후 문서화** (구현 완료) — /prd-review 게이트 통과 권장.

---

## 1. 배경/문제

관리자 'AI 레벨 현황' 매트릭스는 직원별 레벨·점수·성장률을 한 화면에 제공한다. 그러나 이름(name) 외에 이메일과 가입일시가 빠져 있어, 담당자가 특정 직원의 신원을 확인하거나 가입 시점과 레벨 성장을 연관 지어 분석하려면 별도 '회원 관리' 탭을 오가야 하는 비효율이 있었다.

`users.email`과 `users.created_at`은 기존 DB 컬럼이므로 신규 스키마 변경 없이 SELECT 확장만으로 해결 가능하다.

> **PII 주의**: `email`은 개인식별정보(PII)이다. 이 컬럼은 이미 `requireAdmin(req, 'members')` 게이트로 보호된 관리자 전용 엔드포인트에서만 노출된다. `Cache-Control: no-store` 헤더가 기존 구현에도 적용되어 있어 CDN 캐시를 우회한다.

---

## 2. 목표·비목표

**목표 (Goals)**

- G1. API 응답에 `u.email`, `u.created_at AS joined_at` 추가 — DB 신규 컬럼·마이그레이션 없음.
- G2. 매트릭스 테이블에 '이메일' 열과 '가입일시(YYYY-MM-DD)' 열 추가 — 이름 우측에 배치.
- G3. CSV 내보내기에도 이메일·가입일시 포함.
- G4. 기존 열(레벨·점수·성장률·EBG·행동·지식 등) 동작 무영향.

**비목표 (Non-Goals)**

- 이메일·가입일시의 정렬/필터 기능(이번 범위 밖).
- 회원(일반 사용자) 화면에 이메일·가입일시 노출 (관리자 전용).
- 모바일(`app/m/*`) 대상 아님 — 관리자 대시보드는 데스크톱 전용 UI이다.
- DB 마이그레이션 불필요 — `users.email`, `users.created_at` 기존 컬럼 사용.

---

## 3. 사용자 시나리오

- S1. 관리자가 'AI 레벨 현황' 탭 진입 → 테이블에 이름 옆 '이메일' 열과 '가입일시' 열이 표시된다.
- S2. 관리자가 특정 행의 이메일을 보고, 가입일과 현재 레벨을 비교해 신규 입사자 성장 속도를 확인한다.
- S3. 관리자가 'CSV 내보내기' → 다운로드된 파일에 '이메일', '가입일시' 컬럼이 포함된다.
- S4. `members` 권한이 없는 위임관리자는 탭 자체에 접근할 수 없어 이메일이 노출되지 않는다.

---

## 4. 기능 요구사항

- F1. **API 응답 확장** (`GET /api/admin/ai-level-matrix`): CTE `ranked`에서 users 조인 시 `u.email`, `u.created_at AS joined_at` 추가. 기존 `requireAdmin(req, 'members')` 및 `Cache-Control: no-store` 유지.
- F2. **Row 인터페이스** (`AdminAiLevelMatrix.tsx`): `email: string | null`, `joined_at: string | null` 필드 추가.
- F3. **날짜 포매터**: `fmtDate(s: string | null) → 'YYYY-MM-DD' | '-'` 유틸 추가 (ISO 8601 문자열 파싱, 무효값은 `'-'`).
- F4. **테이블 헤더**: 1행 '구분' `colSpan` 2 → 4, 2행에 `<th>이메일</th>`, `<th>가입일시</th>` 추가.
- F5. **테이블 바디**: 이름 `<td>` 우측에 이메일(좌측정렬·11.5pt·`#5B6B7E`), 가입일시(중앙정렬·11.5pt·`#5B6B7E`) `<td>` 삽입.
- F6. **테이블 최소 너비**: `minWidth` 1080 → 1260(px) — 컬럼 추가로 인한 수평 스크롤 보정.
- F7. **CSV 내보내기**: 헤더 배열에 `'이메일'`, `'가입일시'` 추가. 행 배열에 `r.email`, `fmtDate(r.joined_at)` 삽입. CSV 순서는 `법인·부서·직무·이름·이메일·가입일시·…`.
- F8. **DB 마이그레이션 없음**: `users.email`, `users.created_at` 기존 컬럼 그대로 참조. `POST /api/admin/ai-level-matrix`(정성 upsert) 로직 변경 없음.

---

## 5. UX/디자인

- '구분' 그룹 헤더(`colSpan=4`)가 부서·이름·이메일·가입일시 4열을 포괄한다.
- 이메일 셀: `textAlign: 'left'`, `color: '#5B6B7E'`, `fontSize: 11.5` — 이름보다 시각적 경중을 낮게 유지.
- 가입일시 셀: 중앙정렬, 동일 색·크기. `YYYY-MM-DD` 형식으로 고정 너비 표시.
- 레이아웃: 가로 스크롤 컨테이너(`overflowX: auto`) 내 `minWidth: 1260` — 기존 1080보다 180px 확장해 열 잘림 없음.
- CSV 파일명·BOM·인코딩(UTF-8 `﻿` 접두) 방식 변경 없음.

---

## 6. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| `users.email`이 NULL인 행 | API가 `null` 반환 → 테이블에 `'-'` 표시, CSV에 빈 문자열 |
| `users.created_at`이 NULL인 행 | `fmtDate(null)` → `'-'` 표시, CSV에 빈 문자열 |
| 잘못된 날짜 문자열(`joined_at` 손상) | `new Date(s).getTime() → NaN` → `'-'` fallback |
| 권한 없는 요청자 (members 권한 미보유) | `requireAdmin(req, 'members')` → 401/403, 이메일 미노출 |
| `Cache-Control` 미설정 시 CDN 캐시 | 기존 `no-store` 헤더 유지 → PII 캐시 위험 없음 |
| CSV 이메일 셀에 특수문자(쉼표·큰따옴표) | `"${String(v).replace(/"/g, '""')}"` 래핑으로 이스케이프 |
| 레벨 응시 없는 사용자 | `JOIN ranked` 조건으로 응시자만 조회 → 해당 없음(기존 동일) |
| 모바일 접근 | 관리자 대시보드는 데스크톱 전용, 비대상 — 별도 대응 없음 |

---

## 7. 성공 기준

- [ ] 관리자 'AI 레벨 현황' 탭 테이블에 '이메일' 열과 '가입일시' 열이 이름 우측에 표시된다.
- [ ] 이메일은 좌측정렬·11.5pt·`#5B6B7E`, 가입일시는 `YYYY-MM-DD` 형식으로 표시된다.
- [ ] 테이블 가로 스크롤이 생기지 않거나 `overflowX: auto`로 정상 스크롤된다 (`minWidth: 1260`).
- [ ] CSV 내보내기 파일에 `이메일`, `가입일시` 컬럼이 포함된다.
- [ ] `null` 이메일·날짜 값은 `'-'`(테이블) / 빈 문자열(CSV)로 표시된다.
- [ ] `members` 권한 없는 사용자는 API 호출 시 401/403이 반환된다 (이메일 비노출 보장).
- [ ] `Cache-Control: no-store` 헤더가 API 응답에 포함된다 (PII CDN 캐시 방지).
- [ ] DB 마이그레이션 없음 — 기존 `users.email`, `users.created_at` 컬럼 재사용 확인.
- [ ] 기존 열(레벨·점수·성장률·EBG·행동·지식·정성 편집) 동작에 회귀가 없다.
- [ ] `npx tsc --noEmit` TypeScript 컴파일 에러 없음.
- [ ] `npm run build` 빌드 통과.

---

## 8. 미해결 질문

- 이메일 클릭 시 `mailto:` 링크로 연결하면 운영 편의가 높아질 수 있다 — 이번 범위에서는 텍스트만 표시하고, 필요 시 후속 PRD로 다룬다.
- '가입일시' 대신 '가입일'(날짜만)이 맞는 레이블인지 — 현재 구현은 `YYYY-MM-DD`(시분초 생략)이므로 '가입일'로 표기 변경을 검토할 수 있다.
- 이메일 열 너비가 길어질 때의 줄바꿈 처리 — 현재 `whiteSpace: nowrap` 전역 적용. 도메인(`@eland.co.kr`)이 일정하므로 대체로 문제 없으나, 도메인 예외 계정 존재 시 확인 필요.

---

## 보안/영향 요약

- **인증·권한**: `requireAdmin(req, 'members')` 기존 게이트 유지 — master 자동 통과, `members` 권한 위임관리자만 접근.
- **PII**: `email`은 1,800명 실데이터 PII. 관리자 전용 엔드포인트 + `no-store`로 보호. 로그·클라이언트 에러 응답에 이메일 노출 없음.
- **DB 마이그레이션**: 없음 — 기존 컬럼만 참조, 멱등·하위호환 문제 없음.
- **모바일/안드로이드**: 비대상 — 관리자 대시보드는 데스크톱 전용.
- **env 동기화**: 신규 환경변수 없음.
- **에러 통일**: catch 블록 → `"서버 오류가 발생했습니다."` 기존 패턴 유지.
