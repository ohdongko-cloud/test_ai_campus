# PRD: 회원가입 법인·부서·직무 검색 드롭다운 + 기타 직접입력

- 작성일: 2026-06-12
- 작성자: Claude (요청자: <오너>)
- 범위: WelcomePopup(데스크톱) + MobileWelcome(모바일) signup step · 신규 org 분류 테이블 + 어드민 관리 + 공개 조회 API
- 관련: [2026-05-26-signup-ux-policy-improvements.md](./2026-05-26-signup-ux-policy-improvements.md)

---

## 1. 배경 / 문제

이메일 인증 후 '회원 정보 입력' 화면에서 **법인·부서(브랜드/팀)·직무**가 모두 자유 텍스트 입력이다.

- 1,800명이 자유 입력하면 같은 조직을 **제각각 표기**(예: "엔씨백화점순천점" vs "NC순천", "영업팀" vs "영업")해 회원 통계·세분화가 사실상 불가능하다.
- 한글 오타·복붙 손상(U+FFFD) 위험. 입력 부담도 큼.
- 실제 이랜드리테일 조직은 **부서(점포/CU/본부) → 직무**의 정해진 구조가 있어, 목록에서 고르게 하는 게 정확하고 빠르다.

목록이 매우 많고(점포·CU·본부 수십 개, 부서당 직무 다수) 추후 조직개편으로 바뀌므로, **검색 가능한 드롭다운 + 어드민에서 수정 가능한 DB 관리 + 리스트에 없을 때 기타 직접입력** 조합이 필요하다.

## 2. 목표 / 비목표

### 목표
- **G1. 법인 드롭다운**: 고정 7개 목록에서 선택. "기타(업데이트중)" 선택 시 직접입력 활성화.
- **G2. 부서·직무 cascading 검색 드롭다운**: 법인=이랜드리테일일 때, DB의 분류 데이터로 부서를 검색·선택하고, 선택한 부서에 속한 직무만 검색·선택. 둘 다 "+ 기타 직접입력" 지원.
- **G3. DB + 어드민 관리**: 부서/직무 분류를 신규 테이블로 관리하고, 멱등 시드로 초기 데이터를 적재하며, 마스터/어드민 화면에서 추가·수정·삭제.
- **G4. 공개 조회 API**: 가입 폼이 분류 데이터를 읽는 비민감·레이트리밋·no-store API.
- **G5. 데스크톱·모바일 동시 적용**(플랫폼 패리티).

### 비목표
- 기존 회원의 법인/부서/직무 **소급 정규화·마이그레이션** (신규 가입에만 적용).
- `users` 테이블 스키마 변경 — 저장은 기존 `corporation_name`/`organization_name`/`position`(TEXT)에 **선택된 문자열 그대로** 저장.
- 법인 목록의 DB/어드민 관리 — 법인은 **고정 7개 코드 상수**로 둔다(변동이 드묾).
- 이랜드리테일 외 법인의 부서/직무 목록 제공(타 법인은 직접입력).
- 회원정보 수정 화면(가입 이후 변경 UI).

## 3. 사용자 시나리오

### S1. 이랜드리테일 직원 가입 (목록 선택)
1. 이메일 인증 완료 → '회원 정보 입력' 진입.
2. **법인**: 드롭다운 열어 "이랜드리테일" 선택.
3. **부서**: 드롭다운에 전체 부서 목록 + 검색창. "뉴코아강남" 입력 → "뉴코아강남점"으로 좁혀짐 → 선택.
4. **직무**: 뉴코아강남점에 속한 직무만 표시(영업팀·경영지원·SC팀·리더 등) + 검색. "영업" → "영업팀" 선택.
5. 비번 입력 → 가입 완료. `corporation_name="이랜드리테일"`, `organization_name="뉴코아강남점"`, `position="영업팀"`.

### S2. 목록에 없는 부서 (기타 직접입력)
1. 법인 이랜드리테일 선택.
2. 부서 검색해도 없음 → 목록 하단 **"+ 기타 직접입력"** 클릭 → 텍스트 입력칸 등장, "신규TF" 입력.
3. 부서가 기타이면 직무도 자동으로 직접입력 모드(또는 직무도 "+ 기타 직접입력") → "기획" 입력.
4. 가입 완료 — 입력한 문자열 그대로 저장.

### S3. 타 법인 직원 가입
1. 법인 드롭다운에서 "이랜드파크" 선택.
2. 부서/직무는 목록이 없으므로 **직접입력 텍스트칸**으로 표시(드롭다운 비활성). 자유 입력.
3. 가입 완료.

### S4. 법인=기타(업데이트중)
1. 법인 드롭다운에서 "기타(업데이트중)" 선택 → 법인 직접입력칸 등장 → 회사명 입력.
2. 부서/직무도 직접입력.

### S5. 마스터/어드민이 조직 분류 수정
1. 어드민 대시보드 → "조직 분류" 탭.
2. 부서 추가/이름수정/삭제, 직무를 부서에 추가/삭제.
3. 저장 시 가입 폼의 드롭다운에 반영(다음 조회부터).

## 4. 기능 요구사항

### F1. 법인 고정 목록 상수
- `lib/org.ts`(신규)에 `CORPORATIONS: string[]` = `["이랜드리테일","팜앤푸드(킴스클럽 포함)","이랜드월드","이랜드이츠","이랜드건설","이랜드파크","기타(업데이트중)"]`.
- 부서/직무 목록을 노출할 "조직도 보유 법인"을 식별하는 상수: `ORG_DIRECTORY_CORP = "이랜드리테일"`.
- "기타" 식별 상수: `CORP_OTHER = "기타(업데이트중)"`.

### F2. 신규 테이블 `org_units` (분류 데이터)
- 컬럼: `id UUID PK`, `corporation_name TEXT NOT NULL DEFAULT '이랜드리테일'`, `department TEXT NOT NULL`, `position TEXT NOT NULL`, `sort_order INT NOT NULL DEFAULT 0`, `is_active BOOLEAN NOT NULL DEFAULT true`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
- 유니크: `UNIQUE(corporation_name, department, position)` — 멱등 시드/중복 방지.
- 인덱스: `(corporation_name, department)`.
- 마이그레이션 `M006`을 `app/api/admin/migrate/route.ts`에 추가(멱등: `CREATE TABLE IF NOT EXISTS` + 시드는 `ON CONFLICT DO NOTHING`).
- `supabase/schema.sql`에도 테이블 정의 추가(문서 동기화).

### F3. 멱등 시드
- 제공된 부서/직무 쌍 전체를 `corporation_name='이랜드리테일'`로 적재. (왼쪽=department, 오른쪽=position, 공백 trim)
- 시드는 마이그레이션 내부 또는 별도 멱등 엔드포인트에서 `INSERT ... ON CONFLICT (corporation_name, department, position) DO NOTHING`.
- 한글 인코딩 가드: 시드 소스 문자열에 U+FFFD가 없도록 코드 상수로 보관(외부 복붙 손상 방지).

### F4. 공개 조회 API `GET /api/org-units`
- 응답: `{ corporation: "이랜드리테일", departments: [{ department, positions: string[] }] }` (is_active=true만, sort_order/한글 정렬).
- **레이트리밋** 적용(공개 GET). **PII 없음**(조직 분류만). `Cache-Control: no-store`로 CDN `s-maxage` 우회(어드민 수정 즉시 반영).
- catch → `"서버 오류가 발생했습니다."` (§6-8).

### F5. 어드민 관리 API `…/api/admin/org-units`
- `GET`(목록), `POST`(부서 또는 직무 추가), `PATCH`(이름/활성 수정), `DELETE`(직무 또는 부서 전체 삭제) — 모두 **마스터/어드민 권한 체크**(`requireMaster`/admin-auth 패턴), 레이트리밋.
- 입력 검증: 빈 문자열·길이 초과·U+FFFD 차단. 에러 통일.

### F6. 어드민 UI `AdminOrgUnits`
- `components/AdminOrgUnits.tsx`(신규) — 부서 목록 + 부서별 직무 편집(추가/삭제/이름수정/활성토글). `adminFetch` 사용.
- 어드민 대시보드 탭에 "조직 분류" 추가(`app/admin` 또는 AdminDashboard 탭 등록 지점).

### F7. 검색 콤보박스 컴포넌트 `SearchableSelect`
- `components/SearchableSelect.tsx`(신규, 공용) — props: `options: string[]`, `value`, `onChange`, `placeholder`, `disabled`, `allowCustom`(기타 직접입력 토글), `customLabel="+ 기타 직접입력"`.
- 기능: 클릭 시 드롭다운, 상단 검색 input으로 옵션 필터(한글 부분일치, 공백 무시), 키보드 ↑↓/Enter/Esc, 외부 클릭 닫힘, 옵션 없을 때 "결과 없음" + 기타 직접입력 진입.
- 기타 직접입력 모드: 자유 텍스트 input + "목록에서 선택"으로 복귀 버튼.
- 모바일/데스크톱 공용(인라인 스타일 또는 기존 토큰). 의존성 추가 없이 자체 구현.

### F8. 데스크톱 signup 폼 적용 — `components/WelcomePopup.tsx`
- 법인: `SearchableSelect`(options=CORPORATIONS, allowCustom은 "기타(업데이트중)" 선택 시 직접입력).
- 부서/직무: 법인===이랜드리테일이면 API 데이터로 cascading `SearchableSelect`(allowCustom). 그 외 법인이면 기존 텍스트 input.
- 법인 변경 시 부서·직무 초기화. 부서 변경 시 직무 초기화.
- `/api/org-units`를 signup step 진입 시 fetch(또는 팝업 오픈 시) → 상태 보관.
- 제출 시 최종 문자열(선택값 또는 직접입력값)을 기존 `corporationName`/`organizationName`/`position` state에 매핑(API 페이로드 불변).

### F9. 모바일 signup 폼 적용 — `app/m/_components/MobileWelcome.tsx`
- F8과 동일 동작을 모바일 컴포넌트(`Input` 헬퍼 옆에 `SearchableSelect`)로 구현. 라벨/표기 모바일 톤 유지.

### F10. 서버 입력 검증(가입 API) — `app/api/users/route.ts`
- 변경 최소화: 기존 필드 그대로 수신·저장. 기존 U+FFFD 가드 유지. (드롭다운/직접입력 구분 없이 문자열만 검증)

## 5. UX / 디자인

```
법인 *
[ 이랜드리테일            ▼ ]   ← 클릭 시 검색+목록
부서(브랜드/팀) *
[ 부서를 검색·선택        ▼ ]
   ┌───────────────────────┐
   │ [🔍 검색…           ]  │
   │ 뉴코아강남점            │
   │ 뉴코아광명점            │
   │ …                      │
   │ ── + 기타 직접입력 ──   │
   └───────────────────────┘
직무 *   (부서 선택 후 활성)
[ 직무를 검색·선택        ▼ ]
```

- 비활성 상태(법인 미선택/타법인): 부서·직무는 안내 placeholder 또는 직접입력칸.
- 기타 직접입력 진입 시 칸 옆에 "목록에서 선택" 토글.
- 기존 라벨 유지: 데스크톱 "부서(브랜드/팀) *", 모바일 "조직(브랜드/팀)".

## 6. 데이터 / 스키마 (마이그레이션)

- 신규 테이블 `org_units` (F2). **멱등**(`CREATE TABLE IF NOT EXISTS`, 시드 `ON CONFLICT DO NOTHING`), **하위호환**(기존 테이블·가입 흐름 무영향), **기본값**(`corporation_name` 기본 '이랜드리테일', `is_active` true).
- 적용: `POST /api/admin/migrate`(M006, 마스터 전용) 또는 Neon SQL Editor.
- `users` 스키마 **변경 없음**.

### 6-1. 플랫폼 / 안드로이드
- 데스크톱(`components/WelcomePopup.tsx`)·모바일 웹(`app/m/_components/MobileWelcome.tsx`) **둘 다 변경**(패리티).
- 안드로이드: `app/m` 웹 라우트만 변경, 네이티브 셸/플러그인/권한 변경 없음 → **Capacitor `versionCode` 증가 불필요**(웹 자산은 배포 시 갱신됨).

### 6-2. 사전조건 / 의존성
- 신규 env **없음**.
- 기존 모듈 재사용: `lib/db.ts(sql)` · `lib/ratelimit.ts` · `lib/admin-auth.ts(requireMaster)` · `lib/admin-client.ts(adminFetch)`.
- 신규 외부 패키지 **없음**(콤보박스 자체 구현).

## 7. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 법인 미선택 | 부서·직무 비활성, 가입 버튼 검증에서 막힘 |
| 법인=이랜드리테일, 부서 미선택 | 직무 드롭다운 비활성("부서를 먼저 선택") |
| 부서 검색 결과 없음 | "결과 없음" + "+ 기타 직접입력" 노출 |
| 부서=기타 직접입력 | 직무도 직접입력 모드로(목록 의존 불가) |
| 법인=기타(업데이트중) | 법인 직접입력칸 + 부서·직무 직접입력 |
| 타 법인(이랜드파크 등) | 부서·직무 직접입력칸 |
| `/api/org-units` 로드 실패 | 드롭다운 대신 직접입력 폴백 + 재시도 가능, 가입은 가능 |
| 직접입력에 U+FFFD/빈값/과길이 | 클라+서버 검증으로 거부 |
| 어드민이 직무 삭제 후 기존 회원 | 기존 회원 저장값은 문자열이라 영향 없음 |
| 드롭다운 값 == 기타 입력값 중복 | 문자열 동일하면 동일 저장(문제 없음) |
| 모바일 키보드/스크롤 | 드롭다운이 화면 밖 넘치지 않게(작은 화면 대응) |

## 8. 성공 기준

- [ ] 법인 드롭다운에 7개 항목 표시, "기타(업데이트중)" 선택 시 직접입력 동작
- [ ] 법인=이랜드리테일에서 부서 검색·선택 동작(부분 검색)
- [ ] 부서 선택 시 직무가 그 부서 항목만 cascading 표시
- [ ] 부서/직무 "+ 기타 직접입력"으로 임의 값 입력·저장
- [ ] 타 법인/기타 법인 선택 시 부서·직무 직접입력 폴백
- [ ] `GET /api/org-units` 비PII·레이트리밋·no-store 응답
- [ ] 어드민 "조직 분류"에서 부서/직무 추가·수정·삭제가 가입 폼에 반영
- [ ] M006 멱등 마이그레이션·시드 2회 실행해도 중복/에러 없음
- [ ] 데스크톱·모바일 모두 동일 동작
- [ ] 저장값이 기존 `corporation_name`/`organization_name`/`position`에 정확히 기록
- [ ] `npx tsc --noEmit` + `npm run build` 통과 (TypeScript 컴파일 에러 없음)

## 9. 미해결 질문

- Q1. 법인 목록도 추후 어드민에서 관리할 필요가 있는가? (현재는 고정 상수 — 비목표)
- Q2. `org_units`에 법인 컬럼을 두었으니, 향후 타 법인 조직도도 같은 테이블로 확장 가능(스키마는 이미 대비). 초기 시드는 이랜드리테일만.
- Q3. 부서/직무 정렬 기준(가나다 vs 데이터 입력순/sort_order) — 기본 sort_order→한글 정렬로 진행.
