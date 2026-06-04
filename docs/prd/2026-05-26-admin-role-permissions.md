# PRD: 관리자 역할·권한 시스템 + 홈 워딩 3건

- 작성일: 2026-05-26
- 작성자: Claude (요청자: <오너>)
- 범위: 권한 모델 (DB + API + UI) + 마스터/위임 관리자 관리 UI + 홈 카드 텍스트 3건

---

## 1. 배경 / 문제

현재 관리자 접근 방식의 한계:
- **단일 비번 모델**: `ADMIN_PASSWORD` 환경변수 하나로 누구든 접근. 누가 작업했는지 식별 불가.
- **위임 불가능**: AX팀 외 다른 운영자에게 일부 권한만 줄 수 없음.
- **감사 추적 약함**: `admin_audit_logs`는 IP만 남음 — 실제 작업자 미상.

운영 요구:
- 마스터 관리자(예: 사이트 소유자 1~2명)가 다른 직원에게 **관리자 권한을 위임**할 수 있어야 함.
- 권한은 **항목별로 세분화** (영상/예약/게시판 등) — 마스터가 켜고 끌 수 있음.
- 위임 관리자는 다른 관리자를 임명할 수 없음 (권한 인플레이션 방지).

추가로 작은 워딩 3건:
- 홈 화면 카드 문구가 운영 의도와 어긋남 → 수정.

## 2. 정책 결정 (사용자 확정)

| 결정 항목 | 선택 |
|---|---|
| 마스터 지정 방식 | **Vercel env `MASTER_ADMIN_EMAILS`** (쉼표 구분 이메일 리스트) |
| 위임 관리자 권한 범위 | **기본값 = 마스터와 100% 동일** (단 관리자 임명/해지 불가). 마스터가 항목별로 ON/OFF 가능 |
| 관리자 모드 진입 | **회원 로그인만으로 자동 진입** (추가 비번 없음) |
| 기존 `ADMIN_PASSWORD` | **유지 — 마스터 fallback / 긴급 비상용** |

## 3. 목표 / 비목표

### 목표
- G1. **마스터 / 위임 관리자 / 일반 회원** 3 단계 역할 모델.
- G2. 위임 관리자의 권한을 **항목별 세분화 (10개 카테고리)**, 마스터가 UI에서 ON/OFF.
- G3. 회원 로그인 시 자동으로 권한 인식 → 헤더에 "관리자 모드" 버튼 노출 → 클릭 시 어드민 페이지 진입.
- G4. 관리자 작업은 **누가 했는지** `admin_audit_logs.detail`에 기록.
- G5. 기존 `ADMIN_PASSWORD` 로그인 흐름은 유지 (마스터 백업).
- G6. 홈 화면 워딩 3건 수정.

### 비목표
- 권한 만료 / 시간제한.
- 부서/팀 단위 자동 권한 부여.
- 권한 변경 알림 메일.
- 위임 관리자의 위임 관리자 임명 (2단계 위임).
- 외부 SSO 연동.

## 4. 역할·권한 모델

### 역할
| 역할 | 부여 방식 | 권한 |
|---|---|---|
| `master` | 회원 이메일이 env `MASTER_ADMIN_EMAILS` 에 포함 | 모든 작업 + **관리자 임명/해지** |
| `admin` (위임) | 마스터가 `users.role`을 'admin'으로 변경 | 마스터가 부여한 항목별 권한 |
| `user` (일반) | 기본값 | 어드민 페이지 접근 불가 |
| (legacy) `ADMIN_PASSWORD` cookie 보유 | env 비번으로 `/api/admin/login` 통과 | 마스터와 동일 — 비상용 |

**중요**: `master` 역할은 DB에 저장하지 않음. 매 요청마다 env에서 계산. env 변경 = 마스터 변경.

### 권한 카테고리 (10개)

| 키 | 영역 | 마스터 전용? |
|---|---|---|
| `videos` | 영상/레벨 CRUD | 아님 |
| `meetings` | 예약/차단시간 관리 | 아님 |
| `services` | 공유 서비스 관리 | 아님 |
| `chatroom` | 채팅방·NOA 설정 | 아님 |
| `board` | 게시판 글/댓글 삭제 | 아님 |
| `guide` | 가이드 편집 | 아님 |
| `stats` | 통계 조회 | 아님 |
| `logs` | 로그 조회 | 아님 |
| `import` | 일괄 임포트 | 아님 |
| `admins` | **다른 관리자 관리** | **마스터 전용** |

위임 관리자 임명 시 기본값: `admins` 제외 모든 키 = `true`.

### permissions JSON 예시
```json
{
  "videos": true, "meetings": true, "services": true,
  "chatroom": true, "board": true, "guide": true,
  "stats": true, "logs": true, "import": true
}
```
키 누락 시 → `false` 로 간주. 향후 신규 권한 추가 시 마스터가 명시 부여 필요.

## 5. 기능 요구사항

### F1. DB 스키마 변경
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role) WHERE role = 'admin';
```

### F2. 권한 계산 헬퍼 (서버)
- `lib/admin-auth.ts` 확장:
  - `getEffectiveRole(req): 'master' | 'admin' | 'legacy' | null` — 우선순위 ① admin_session 쿠키(legacy) ② 회원 세션 + env match (master) ③ 회원 세션 + DB role=admin (admin) ④ 그 외 null.
  - `requireAdmin(req, permission?): Promise<{ role, email } | NextResponse>` — permission 인자가 있으면 해당 권한 확인. master/legacy는 무조건 통과.
  - `requireMaster(req)` — master 또는 legacy만 통과.
- 모든 `/api/admin/*` 라우트의 `requireAdmin` 호출에 적절한 permission 키 전달.

### F3. 마스터 전용 라우트 (관리자 관리)
- `GET /api/admin/users` — `role='admin'` 인 모든 회원 리스트 + 권한 JSON. master 전용.
- `POST /api/admin/users` — body `{ email }`. 해당 회원을 admin으로 승격 + 기본 권한 부여. master 전용.
- `PATCH /api/admin/users/[id]` — body `{ permissions }`. 항목별 권한 갱신. master 전용.
- `DELETE /api/admin/users/[id]` — admin 해지 (`role='user'`). 본인 master는 해지 불가. master 전용.

### F4. 회원 세션 정보 확장
- `GET /api/users/me` 응답에 `role`, `permissions`, `isMaster` 필드 추가.
- 클라이언트는 이 값으로 어드민 버튼 노출 여부·탭 표시 분기.

### F5. 헤더 / 어드민 진입 UX
- `app/page.tsx`:
  - 헤더 우측 "관리자" 버튼 → 권한 보유 회원에게만 노출 (기존 모든 사용자에게 보이는 동작 변경).
  - 비권한 회원에게도 노출하되 클릭 시 `ADMIN_PASSWORD` 모달 유지 (기존 fallback) — **결정**: 권한 회원 = 직접 진입, 비권한 = 기존 모달.
  - 단순화 옵션: 권한 회원은 "관리자" → 즉시 어드민 대시보드, 비권한은 기존 비번 모달.
- AdminDashboard:
  - 사이드바 탭이 권한 기반으로 노출 (없는 권한 = 탭 숨김).
  - master/legacy 만 "관리자 관리" 탭 노출.
  - 우측 상단에 현재 진입 역할 표시 ("마스터" / "위임 관리자 · {닉네임}" / "비상 모드").

### F6. 관리자 관리 화면 (`AdminUsersManage.tsx` 신규)
- master/legacy 만 접근.
- 두 영역:
  - **현재 관리자 목록**: 닉네임/이메일/부서/직무/권한 체크박스 9개(`admins` 제외) + "해지" 버튼.
  - **관리자 추가**: 이메일 입력 → "검색" → 회원 정보 표시 → "관리자로 추가" 버튼 (기본 권한 부여).
- 권한 체크박스 변경 시 즉시 PATCH (또는 "저장" 버튼).
- master 본인은 표시되지만 권한 변경/해지 불가 (env가 결정).
- 변경 시 `admin_audit_logs`에 `admin.promote` / `admin.demote` / `admin.permissions_changed` 액션 + actor 정보 기록.

### F7. 홈 워딩 3건
- `components/MainPage.tsx`:
  - 멘토링 예약 desc: `"AX팀과 1:1 미팅을 예약하세요. 30분 슬롯, 매주 화·목."` → `"AX팀의 1:1 집중 멘토링을 받아보세요."`
  - AI 커뮤니티 참여 title: → `"AI 오픈채팅방 참여"`. desc: → `"실무 AI 적용 고민과 꿀팁을 서로 나누세요."`
  - 익명 Q&A 게시판 desc: → `"강의 내용 및 구현 중 어려운 내용 등 궁금한 사항은 익명 Q&A 게시판에 남겨주세요."`

## 6. 데이터 / 마이그레이션

### SQL
```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role) WHERE role = 'admin';
```

### 환경변수 (Vercel)
- `MASTER_ADMIN_EMAILS` — 신규 (쉼표 구분, 예: `<마스터-이메일>,owner@eland.co.kr`). 한시적으로 `<마스터-이메일>` 포함.

### 데이터 이행
- 기존 회원 모두 `role='user'` 기본값으로 유지.
- 마스터는 env에서만 결정 → DB row 추가 불필요.
- 위임 관리자는 마스터가 추후 UI에서 부여.

## 7. 보안 / 권한

- 모든 권한 확인은 **서버 측**에서 매 요청 진행. 클라이언트의 `permissions` 값은 UI 노출 분기용일 뿐, 신뢰 X.
- master 판정은 매 요청 env 조회 — 즉시 반영.
- 권한 변경은 master만 수행 가능 + audit log에 actor 기록.
- 자기 자신 해지 방지: master는 본인 해지 불가, admin은 본인 해지 가능 (단순화).
- 신규 권한 추가 시 보수적 기본값 (false) — master가 명시 부여 필요.

## 8. UX

### 일반 회원
- 헤더에 "관리자" 버튼 안 보임.

### 마스터
- 헤더에 "관리자 모드" 버튼 보임.
- 클릭 시 어드민 대시보드 즉시 진입.
- 사이드바: 모든 탭 + "관리자 관리".
- 우상단 표시: "마스터 · {닉네임}"

### 위임 관리자
- 헤더에 "관리자 모드" 버튼 보임.
- 클릭 시 즉시 진입.
- 사이드바: 부여된 권한 탭만 + "관리자 관리" 미표시.
- 우상단 표시: "관리자 · {닉네임}"

### Legacy (`ADMIN_PASSWORD` 사용)
- 우상단 표시: "비상 관리자 모드"
- 모든 탭 + "관리자 관리" 표시. (legacy = master 동등)

## 9. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 마스터 회원이 로그아웃 → 다른 사람이 같은 브라우저로 로그인 | user_session 쿠키 새로 발급되어 새 회원으로 인식. 마스터 권한 X. |
| env에서 마스터 이메일 제거 | 다음 요청부터 즉시 일반 회원/admin 다운그레이드. |
| admin이 권한 없는 탭 직접 URL 진입 | 서버 API가 403 반환. 클라이언트도 탭 숨김. |
| permissions JSON에 신규 카테고리 키 누락 | false 로 간주. master가 명시 부여 필요. |
| 마스터가 본인 admin row 해지 시도 | 막힘 — env가 진실 원천. |
| admin → user로 강등 시 진행 중 작업 | 다음 요청부터 권한 잃음. 진행 중 mutation은 그대로 완료(이미 응답 후). |
| 동일 이메일 회원이 중복 가입 시도 | 기존 unique 제약으로 막힘. |
| 마스터 이메일이 회원 DB에 없음 | env에 있어도 user_session 자체가 없으므로 효과 없음. 회원 가입 후 즉시 마스터 권한 인식. |

## 10. 성공 기준

- [ ] SQL 마이그레이션 정상 적용 (users.role, users.permissions).
- [ ] `MASTER_ADMIN_EMAILS` env 등록 후 해당 회원 로그인 시 관리자 버튼 노출 → 클릭 즉시 어드민 진입.
- [ ] 마스터가 다른 회원에게 관리자 권한 부여 → 그 회원도 어드민 진입 가능.
- [ ] 마스터가 위임 관리자의 `videos` 권한 OFF → 영상 관리 탭/API 차단 확인.
- [ ] 위임 관리자 화면에 "관리자 관리" 탭 안 보임.
- [ ] 일반 회원에게 "관리자" 버튼 자체 안 보임.
- [ ] `ADMIN_PASSWORD`로 진입한 사용자는 "비상 관리자 모드" 표시 + 모든 탭 보임.
- [ ] 관리자 작업이 `admin_audit_logs.detail`에 actor 이메일과 함께 기록됨.
- [ ] 홈 화면 3건 워딩 변경 반영.
- [ ] 빌드 통과.

## 11. 롤아웃

1. SQL 마이그레이션 (`apply-role-permissions.mjs`).
2. 코드 push → Vercel 자동 배포.
3. Vercel env `MASTER_ADMIN_EMAILS=<마스터-이메일>` 추가 → Redeploy.
4. <마스터-이메일> 로그인 → 관리자 모드 → "관리자 관리"에서 다른 직원 권한 부여 시나리오 테스트.

## 12. 미해결 질문

- 마스터 권한 양도/계승 절차 — 본 PR 범위 외 (env 변경으로 처리).
- 부서 단위 자동 관리자 부여 — 추후 확장.
