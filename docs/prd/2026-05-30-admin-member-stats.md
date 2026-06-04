# PRD: 관리자 — 가입자/방문자 통계 + 회원 목록 표

- 작성일: 2026-05-30
- 작성자: <오너> + Claude
- 관련 시스템: `components/AdminStats.tsx`, `components/AdminDashboard.tsx`, `app/api/admin/users/route.ts` (참조), `users` + `auth_logs` 테이블
- 영향 버전: v1.0-rc → v1.0-rc+1

## 1. 배경

현재 관리자 통계 페이지에는 미팅 예약/영상 수/공유 서비스 수/클릭수만 표시된다. 1,800명 공개 오픈을 앞두고 운영자는 다음을 정기적으로 확인해야 한다:

1. **가입 추이** — 전체 회원 수, 오늘 신규 가입자 수
2. **활성 사용자(방문자)** — 오늘/최근 7일/최근 30일 로그인한 고유 사용자 수
3. **회원 명단** — 누가 가입했는지 표로 보고 필터·정렬

위 데이터는 모두 DB에 이미 있다 (`users.created_at`, `auth_logs.type='login_success'`). 새 추적 인프라 없이 SQL 집계만으로 구현 가능.

## 2. 목표 (Goals)

1. 통계 페이지 상단에 **가입자/방문자 카드** 추가.
2. 방문자는 **기간 토글** (오늘 / 7일 / 30일) 선택 가능.
3. **회원 관리** 신규 탭 추가 — 회원 목록 표 + 검색/필터/정렬.
4. 권한 기반 접근 제어 (master 또는 신규 'members' 권한 보유자).

## 3. Non-Goals

- 회원 강제 탈퇴/정지/계정 잠금 같은 회원 관리 액션은 본 PRD 범위 밖.
- 회원 상세 화면(개별 회원 클릭 시 상세 페이지)은 범위 밖.
- 이메일 마케팅·푸시 일괄 발송은 범위 밖.
- 익명(비로그인) 방문자 추적은 범위 밖 (현재 추적 인프라 없음).
- 데이터 export(CSV 다운로드)는 범위 밖 (필요 시 별도 PRD).

## 4. 통계 정의

| 지표 | SQL 정의 | 비고 |
|---|---|---|
| 총 가입자 수 | `SELECT COUNT(*) FROM users` | role 무관 |
| 오늘 가입자 수 | `SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('day', NOW())` | KST 기준 (timezone 처리 §4.2) |
| 방문자 (오늘) | `SELECT COUNT(DISTINCT email) FROM auth_logs WHERE type='login_success' AND created_at >= date_trunc('day', NOW())` | 같은 사용자 여러 번 로그인해도 1로 카운트 |
| 방문자 (최근 7일) | `... AND created_at >= NOW() - INTERVAL '7 days'` | rolling 7일 |
| 방문자 (최근 30일) | `... AND created_at >= NOW() - INTERVAL '30 days'` | rolling 30일 |

### 4.1 "방문자" 정의의 한계

- 로그인 안 한 사용자(비로그인 탐색)는 카운트 안 됨.
- 사내 서비스 특성상 회원가입+로그인이 기본 전제라 의미 있는 활성 사용자 지표로 충분.
- 향후 anonymous 추적이 필요하면 별도 `page_views` 테이블 + 미들웨어로 확장 (별도 PRD).

### 4.2 타임존

- Vercel/Neon 기본 timezone은 UTC. 한국 운영자가 "오늘"이라고 하면 KST 자정 ~ 다음날 KST 자정.
- **결정**: 서버에서 명시적으로 `AT TIME ZONE 'Asia/Seoul'` 처리. 클라이언트 PC 시계가 다른 timezone(예: 미국 출장 시)이어도 항상 KST 기준.
- SQL 예시:
  ```sql
  -- 오늘 가입자
  WHERE created_at AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')

  -- 오늘 방문자
  WHERE type='login_success'
    AND created_at AT TIME ZONE 'Asia/Seoul' >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')
  ```
- "최근 7일/30일"은 rolling 기준이라 timezone 영향 무. `NOW() - INTERVAL '7 days'` 그대로 사용.

## 5. UX 사양

### 5.1 통계 페이지 — 카드 섹션 확장

기존 4카드 (미팅/영상/공유/클릭) 위에 **회원 통계 4카드** 추가 (또는 별도 row).

```
┌──────────────────────┬──────────────────────┐
│ 총 가입자             │ 오늘 가입             │
│ 8 명                  │ 1 명                  │
└──────────────────────┴──────────────────────┘
┌────────────────────────────────────────────┐
│ 방문자                                       │
│ [오늘] [7일] [30일]  ← 토글                   │
│ 3 명 (오늘)                                  │
└────────────────────────────────────────────┘
```

- 가입자 카드 2개는 always-visible.
- 방문자 카드 1개는 내부에 기간 토글 (3 버튼: 오늘 / 7일 / 30일). 클릭 시 즉시 숫자 갱신.
- 기본 선택: 오늘.

### 5.2 회원 관리 탭 (신규)

좌측 사이드바에 `회원 관리` 탭 추가 (`stats` 와 `logs` 사이 권장).

탭 본문 구조:
```
┌─────────────────────────────────────────────────────────┐
│ 회원 관리 (총 8명)                                       │
├─────────────────────────────────────────────────────────┤
│ [🔍 이메일/닉네임 검색]  [법인 ▼]  [조직 ▼]  [역할 ▼]    │
├─────────────────────────────────────────────────────────┤
│ 이메일 ↕ │ 닉네임 │ 법인     │ 조직 │ 직무 │ 역할 │ 가입일 ↕ │
│ a@e.kr   │ 김… │ 이랜드…  │ CAIO│ AI   │ 회원 │ 5/26     │
│ b@e.kr   │ 이… │ ...      │ ... │ ...  │ 관리자│ 5/27     │
│ ...                                                       │
├─────────────────────────────────────────────────────────┤
│ < 1 / 2 페이지 (8건 / 50개씩) >                          │
└─────────────────────────────────────────────────────────┘
```

| 항목 | 사양 |
|---|---|
| 검색 | 이메일 또는 닉네임(name)에 부분일치 (ILIKE) |
| 필터 — 법인 | DB에서 distinct corporation_name 조회해 드롭다운 (전체 / 법인A / 법인B …) |
| 필터 — 조직 | 선택된 법인 내 distinct organization_name (또는 전체) |
| 필터 — 역할 | 전체 / 마스터(env) / 관리자(role='admin') / 회원(role='user') |
| 정렬 | 가입일(default desc) / 이메일 / 닉네임 — 컬럼 헤더 클릭으로 토글 |
| 페이지네이션 | 50/page, 이전/다음 버튼 |
| 빈 상태 | "조건에 맞는 회원이 없습니다." |

### 5.3 권한

- **신규 권한 키 `members`** 추가 (`lib/admin-auth.ts` PERMISSION_KEYS).
- API GET `/api/admin/stats/overview`, `/api/admin/members` 모두 `requireAdmin(req, 'members')` 또는 master 통과.
- 위임 관리자에 `members: true` 부여 시 접근 가능.

## 6. API 설계

### 6.1 `GET /api/admin/stats/overview`

```ts
// Request: cookies 기반 admin auth
// Response:
{
  totalMembers: number,
  todaySignups: number,
  visitorsToday: number,
  visitors7d: number,
  visitors30d: number,
}
```

캐싱: 60초 stale-while-revalidate 가능 (변동성 낮음). 또는 매 요청 실시간.

### 6.2 `GET /api/admin/members`

```
Query params:
  search    string  — 이메일/닉네임 부분일치
  corp      string  — corporation_name 정확일치 ('' = 전체)
  org       string  — organization_name 정확일치
  role      string  — 'admin' | 'user' | 'master' | '' (master 는 env 비교)
  sort      string  — 'created_at' | 'email' | 'name' (default 'created_at')
  order     string  — 'asc' | 'desc' (default 'desc')
  limit     number  — default 50, max 200
  offset    number  — default 0

Response:
{
  total: number,        // 필터 적용 후 전체 건수 (페이지네이션용)
  rows: [
    {
      id, email, nickname, corporationName, organizationName,
      position, role, isMaster: boolean, createdAt
    }
  ],
  facets: {             // 필터 드롭다운 채움용 (선택 — 별도 API 분리 가능)
    corporations: string[],
    organizations: string[],
  }
}
```

- `isMaster` 는 env `MASTER_ADMIN_EMAILS` 와 email 비교한 서버-계산 값.
- `facets` 는 매 요청마다 계산. 성능 부담 시 별도 캐시.

### 6.3 보안

- 두 API 모두 `requireAdmin(req, 'members')` 가드 → 인증 안 된 경우 401/403.
- PII (이메일/이름) 노출 — `members` 권한 보유자만.
- 로그: `logAdminAction({ action: 'members.list', detail: { search, corp, ... }, req })` 호출 권장 (감사 추적).

## 7. 컴포넌트 변경

| 파일 | 변경 |
|---|---|
| `components/AdminStats.tsx` | 카드 섹션 위에 가입자/방문자 4카드 추가 + 방문자 기간 토글 |
| `components/AdminMembers.tsx` (신규) | 회원 목록 표 + 검색/필터/정렬/페이지네이션 |
| `components/AdminDashboard.tsx` | 신규 탭 'members' 추가 |
| `lib/types.ts` | `AdminTabType` 에 'members' 추가 |
| `lib/admin-auth.ts` | `PERMISSION_KEYS` 에 'members' 추가 |
| `app/api/admin/stats/overview/route.ts` (신규) | 통계 카드 데이터 API |
| `app/api/admin/members/route.ts` (신규) | 회원 목록 API |

### 의존성
- npm 패키지: 변경 없음
- 환경변수: 변경 없음
- DB 마이그레이션: **없음** (기존 `users` + `auth_logs` 사용)

## 8. 에러 케이스 / 엣지

| 케이스 | 처리 |
|---|---|
| 권한 없는 일반 회원이 API 직접 호출 | 401/403 반환 + audit 로그 |
| 검색어가 SQL 와일드카드 문자(`%`, `_`) 포함 | parameterize + ESCAPE 또는 그대로 허용 (Postgres `LIKE` 보안 무관) |
| 결과 0건 | `rows: [], total: 0` — 클라이언트는 빈 상태 UI |
| 정렬 컬럼이 허용 목록 외 | 400 반환 (SQL injection 차단) |
| `limit > 200` | 200으로 clamp |
| auth_logs 비어있음(초기 상태) | visitor 통계 0 반환, 정상 |
| KST 자정 직전/직후 통계 | 클라이언트가 매번 `since` 재계산 (페이지 재로드 시) |

## 9. 검증 기준 (Acceptance)

- [ ] 통계 탭 진입 시 회원 통계 카드 4개 추가 노출 (총 가입자 / 오늘 / 방문자 + 토글)
- [ ] 방문자 카드 [오늘/7일/30일] 클릭 시 숫자 즉시 변경
- [ ] 좌측 사이드바에 `회원 관리` 탭 추가, 클릭 시 회원 목록 표시
- [ ] 검색창에 이메일/닉네임 부분 입력 → 일치 회원만 표시
- [ ] 법인/조직/역할 드롭다운으로 필터링 적용
- [ ] 컬럼 헤더 클릭 시 해당 컬럼 기준 정렬 (asc ↔ desc 토글)
- [ ] 페이지네이션 동작 (50/page 기본, 이전/다음 버튼)
- [ ] 위임관리자에 `members` 권한 없으면 탭 자체 안 보임 (master 는 항상 보임)
- [ ] 권한 없는 사용자가 API 직접 호출 시 401/403
- [ ] 빌드 (`npm run build`) 성공, TypeScript 에러 없음

## 10. 회귀 방지

- 기존 통계(미팅/영상/공유/클릭) 카드 동작 무영향
- 위임관리자 임명 화면(`AdminUsersManage`) 무영향 — 별도 컴포넌트 유지
- 권한 시스템(`requireAdmin`/`requireMaster`)에 'members' 키만 추가, 기존 키 영향 없음

## 11. 텔레메트리

- `logAdminAction({ action: 'members.list', detail: { filters }, req })` — 검색 시점 기록 (감사)
- `logAdminAction({ action: 'stats.overview.view', req })` — 선택 (회원 정보 노출 최소화 차원)

## 12. 작업 분해 (개요)

### 변경 파일

| 유형 | 파일 | 변경 |
|---|---|---|
| **신규** | `app/api/admin/stats/overview/route.ts` | 가입자/방문자 통계 API |
| **신규** | `app/api/admin/members/route.ts` | 회원 목록 API (search/filter/sort/page) |
| **신규** | `components/AdminMembers.tsx` | 회원 관리 탭 UI |
| 수정 | `components/AdminStats.tsx` | 카드 섹션 위에 회원 통계 카드 + 방문자 토글 |
| 수정 | `components/AdminDashboard.tsx` | 'members' 탭 추가 (perm: 'members') |
| 수정 | `lib/types.ts` | `AdminTabType` 에 'members' 추가 |
| 수정 | `lib/admin-auth.ts` | `PERMISSION_KEYS` 에 'members' 추가 |

### 의존성
- npm 패키지: 변경 없음
- 환경변수: 변경 없음
- DB 마이그레이션: 없음

## 13. 롤백 플랜

- 코드 롤백만으로 즉시 복원 (DB 무변경).
- `members` 권한 키는 추가만 함 → 기존 위임관리자 영향 없음.
- 긴급 시: AdminDashboard 의 'members' 탭 항목 1줄 주석으로 비노출.

## 14. 보안 / 권한

- **API**: `requireAdmin(req, 'members')` 가드 — master 자동 통과 + 'members' 권한 보유한 위임관리자.
- **PII 노출 최소화**: 회원 비밀번호 해시는 응답에서 제외. 응답에 email/name 만 포함.
- **레이트리밋**: 신규 API에는 별도 적용 안 함 (관리자 인증 통과한 요청만 도달).
- **audit log**: 회원 목록 조회 시 `logAdminAction` 호출 — 누가 언제 회원 정보 조회했는지 추적 가능.
