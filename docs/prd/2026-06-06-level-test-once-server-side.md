# PRD: 레벨테스트 최초 1회 노출 보장 (서버/DB 기준)

- 작성일: 2026-06-06
- 작성자: Claude (요청자: <오너>)
- 범위: DB 컬럼 추가(멱등 마이그레이션) + `/api/users/me` 응답 확장 + 레벨테스트 완료/스킵 서버 기록 + `VideoPage` 노출 로직을 localStorage→서버 기준으로 전환

---

## 1. 배경 / 문제

강의 페이지(`VideoPage`) 진입 시 레벨테스트 팝업의 자동 노출 여부가 **오직 localStorage `levelTestDone` 키**에만 의존한다([VideoPage.tsx:135](../../components/VideoPage.tsx)).

localStorage는 **기기·브라우저별 저장소**이므로:
- 다른 기기/브라우저로 접속하면 플래그가 없어 **재노출**된다.
- 시크릿창·캐시 삭제·앱 데이터 초기화 시에도 재노출된다.

실제로 레벨테스트를 여러 번 완료한 사용자에게도 강의 페이지 진입 시 팝업이 다시 떠 불편을 유발한다. `level_tests` 테이블은 응시 기록 로그(append-only)일 뿐 "이 사용자가 완료했는가" 플래그가 아니며, `users` 테이블에는 관련 컬럼이 없다. 이 앱은 **로그인 필수**(WelcomePopup 강제, "나중에 입력" 제거)라 강의 페이지에 도달하는 모든 사용자는 세션을 보유한다 → 노출 판단을 **서버/계정 기준**으로 옮길 수 있다.

## 2. 목표 / 비목표

### 목표
- G1. 레벨테스트 팝업은 **계정 기준 최초 진입 1회만** 자동 노출되고, 완료 또는 스킵 이력이 있으면 **기기·브라우저와 무관하게 재노출되지 않는다**.
- G2. 노출 여부 판단 신호를 localStorage → **`users` 테이블(DB)** 로 이전한다(`level_test_done_at`).
- G3. 선택한 레벨(`video_level`)을 계정에 저장해 다른 기기에서도 "추천" 필터가 복원되게 한다.
- G4. 사이드바 "레벨 테스트 다시하기" 수동 응시는 그대로 동작한다.

### 비목표
- 레벨테스트 문항·채점 로직 변경(현행 유지).
- 비로그인 사용자 대응(앱이 로그인 강제 → 해당 없음, localStorage는 폴백으로만 잔존).
- `level_tests` 응시 로그 구조 변경(그대로 append 유지).
- 관리자 화면에서 사용자별 완료여부 관리 UI(추후).

## 3. 사용자 시나리오

### S1. 최초 진입 (신규 사용자)
1. 로그인 후 강의 탭 최초 진입.
2. `/api/users/me`의 `levelTestDone === false` → 팝업 1회 노출, **즉시 서버에 "본 것으로" 기록**(`level_test_done_at = now()`).
3. 완료 시 선택 레벨이 계정에 저장되고 "추천" 필터로 전환.

### S2. 재진입 (완료 이력 보유)
1. 같은 사용자가 **다른 기기/브라우저**로 강의 탭 진입.
2. `/api/users/me`의 `levelTestDone === true` → 팝업 **노출 안 됨**.
3. 저장된 `video_level`로 "추천" 필터 자동 복원.

### S3. 스킵 후 재진입
1. 최초 노출 시 답하지 않고 닫음(스킵) → 노출 시점에 이미 `level_test_done_at` 기록됨.
2. 재진입 시 노출 안 됨. (수동 "다시하기"는 가능)

### S4. 수동 다시하기
1. 사이드바 "레벨 테스트 다시하기" 클릭 → 팝업 노출.
2. 완료 시 `video_level` 갱신.

## 4. 기능 요구사항

### F1. DB 마이그레이션 (M005, 멱등)
- `/api/admin/migrate`에 추가:
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS video_level TEXT DEFAULT NULL`
  - `ALTER TABLE users ADD COLUMN IF NOT EXISTS level_test_done_at TIMESTAMPTZ DEFAULT NULL`
- 하위호환: 기존 사용자는 두 컬럼 모두 `NULL`(= 미완료) → **한 번은** 노출됨(의도된 동작: 기존 사용자도 계정 기준 최초 1회).
- `supabase/schema.sql`에도 동일 컬럼 반영.

### F2. `/api/users/me` 응답 확장
- `SELECT`에 `video_level, level_test_done_at` 추가.
- 응답 `user`에 필드 추가:
  - `videoLevel: string | null`
  - `levelTestDone: boolean` ( `level_test_done_at != null` )
- PII 아님(레벨 문자열·타임스탬프) → 응답 포함 무방. 캐시는 기존과 동일(no-store 계열 유지).

### F3. "본 것으로" 기록 엔드포인트
- `POST /api/level-test/seen` 신규: 로그인 사용자의 `level_test_done_at`을 `COALESCE(level_test_done_at, now())`로 설정(이미 있으면 보존).
- 레이트리밋 적용(예: `level-test-seen`, 분당 합리적 한도).
- 비로그인/세션없음 → `{ ok: true }` 무해 반환(노출 로직은 클라이언트가 처리, enumeration 무관).

### F4. 완료 시 계정 저장
- 기존 `POST /api/level-test`(응시 로그)에 더해, **로그인 사용자면** `UPDATE users SET video_level = ${level}, level_test_done_at = COALESCE(level_test_done_at, now()) WHERE id = ${session.uid}` 수행.
- 로그 INSERT(현행)는 유지.

### F5. `VideoPage` 노출 로직 전환
- 마운트 시 `/api/users/me` 조회:
  - `user.videoLevel` 있으면 `setUserLevel` + `levelFilter='추천'` 복원.
  - `user.levelTestDone === false` 이면 팝업 노출(`setShowLevelTest(true)`) + `POST /api/level-test/seen` 호출(본 것으로 기록).
  - `levelTestDone === true` → 노출 안 함.
- `handleLevelComplete`: `POST /api/level-test`(레벨 포함)로 계정 저장 → 상태 갱신. localStorage `videoLevel`/`levelTestDone`는 폴백으로 함께 set(무해).
- `handleLevelSkip`: 이미 F3로 기록되므로 추가 서버호출 불필요, 팝업만 닫음.
- `me` 조회 실패(네트워크) 시 폴백: 기존 localStorage `levelTestDone` 기준으로 동작(이중 안전).

## 5. UX / 디자인

- 시각적 변화 없음. 팝업 **노출 빈도만** "기기별 1회" → "계정 1회"로 교정.
- 자동 노출 순간 사용자에게는 즉시 모달이 보이고, 백그라운드로 `seen` 기록(로딩 표시 불필요).
- "레벨 테스트 다시하기" 버튼 위치·동작 유지.

## 6. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 기존 사용자(컬럼 NULL) 첫 진입 | 계정 기준 미완료 → 1회 노출(의도) 후 영구 차단 |
| 다른 기기/브라우저 재진입 | `levelTestDone=true` → 노출 안 됨 (핵심 수정) |
| 시크릿창·캐시 삭제 | localStorage 비어도 서버 기준 판단 → 노출 안 됨 |
| 노출 직후 답 없이 탭 종료 | `seen` 이미 기록 → 재노출 안 됨 |
| `me` 조회 실패(오프라인) | localStorage 폴백으로 판단(과노출 방지 우선) |
| 비로그인 상태로 강의 접근 | 앱상 불가(로그인 강제). 발생 시 `seen`은 무해 반환 |
| `seen`/`me` 동시성(빠른 더블 마운트) | `COALESCE`로 최초 타임스탬프 보존, 멱등 |
| 마이그레이션 미실행 상태 배포 | `/api/users/me`가 신규 컬럼 조회 실패 시 **기존 컬럼만으로 폴백**(방어적 2단 쿼리) → `{user:null}` 전역 로그아웃 방지. 레벨테스트는 마이그레이션 전까지 localStorage 폴백으로 동작. 배포 후 `/api/admin/migrate` 1회 실행 권장(타이밍 무관 안전) |
| 안드로이드 앱에서 진입 | 앱은 원격 origin(retail-ai-campus.vercel.app)을 WebView로 로드 → `/api/users/me`·`seen` 호출 동일 동작, 별도 앱 변경 불요 |

## 7. 성공 기준

- [ ] `/api/admin/migrate` 실행 후 `users.video_level`·`users.level_test_done_at` 존재.
- [ ] 신규 계정 강의 첫 진입 시 레벨테스트 1회 노출.
- [ ] 완료/스킵 후 같은 브라우저 재진입 시 노출 안 됨.
- [ ] **다른 브라우저(또는 localStorage 삭제 후)** 동일 계정 재진입 시 노출 안 됨 — 핵심.
- [ ] 완료 후 다른 브라우저에서 "추천" 필터가 저장 레벨로 복원.
- [ ] "레벨 테스트 다시하기" 수동 응시 정상 동작.
- [ ] `level_tests` 응시 로그는 종전대로 기록.
- [ ] `npx tsc --noEmit` + `npm run build` 통과 (TypeScript 컴파일 에러 없음).

## 8. 미해결 질문

- 스킵(미완료)도 "최초 1회"로 소진하는 현행 정책 유지로 가정. (요구사항: "이후 입장하는 사용자에게는 노출되지 않도록" → 스킵 포함 차단이 부합) — 확정.
- 기존 사용자에게 1회 재노출되는 점은 "계정 기준 최초"라는 정의상 의도된 동작으로 수용.

---

## 보안 / 영향 (CLAUDE.md §6 / 특화 체크 9)

- **인증/권한**: `seen`·`me`·`level-test`는 세션 기반. 쓰기는 `session.uid`로 본인 행만 UPDATE(타 사용자 변조 불가). `seen`에 레이트리밋 적용.
- **PII**: 추가 필드(`video_level`, `level_test_done_at`)는 PII 아님 → `/api/users/me` 응답 포함 가능. PII 신규 노출 없음.
- **DB**: 신규 컬럼 2개 — 멱등 `ADD COLUMN IF NOT EXISTS` + 기본값 `NULL`(하위호환). `schema.sql` 동기화. **배포 순서상 마이그레이션 선행 필수**.
- **에러 통일**: catch → `"서버 오류가 발생했습니다."` (raw 노출 금지, §6-8).
- **모바일/안드로이드**: `VideoPage`는 PC/모바일 공용 컴포넌트 → `app/m/*` 별도 라우트 불필요. 동작 변경이 앱 빌드에 영향 없으면 `versionCode` 증가 불요(웹 로직). 영향 시 `/ship`에서 판단.
- **env/시크릿**: 신규 env 없음.
