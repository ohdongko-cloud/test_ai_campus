# 이랜드리테일 AI 캠퍼스 — 프로젝트 변경 이력

---

## v1.2.0 — 회원 로그인/회원가입 기능 추가

**구현일시**: 2026-05-21  
**배포 URL**: https://test-ai-campus.vercel.app

### 구현 요약

웰컴 팝업을 **3단계 인증 플로우**로 전면 교체했습니다.  
이메일 입력 → 신규 회원이면 회원가입 폼, 기존 회원이면 로그인 폼으로 자동 분기합니다.  
"나중에 입력" 버튼을 제거하여 반드시 인증을 완료해야 서비스를 이용할 수 있습니다.  
Neon PostgreSQL에 `users` 테이블을 추가하고 3개의 API 라우트로 인증을 처리합니다.

### 변경 기능

| 항목 | 내용 |
|---|---|
| 인증 플로우 | 단일 폼 → 3단계 (이메일 확인 → 회원가입 또는 로그인) |
| 이메일 단계 | 이메일 입력 후 "다음" 클릭 → `/api/users/exists` 호출로 신규/기존 회원 판별 |
| 회원가입 단계 | 이름·법인명·조직명·직무·이메일(읽기전용)·비밀번호(8자 이상) 입력 |
| 로그인 단계 | 이메일(읽기전용)·비밀번호 입력, 비밀번호 분실 안내 표시 |
| 비밀번호 분실 | "비밀번호를 잊으셨습니까? oh_dongha01@eland.co.kr로 문의하세요." |
| 나중에 입력 제거 | 팝업 닫기 버튼 및 "나중에 입력" 버튼 완전 제거 — 인증 필수 |
| UserInfo 확장 | `corporationName`, `organizationName`, `position`, `userId` 필드 추가 |
| DB 사용자 테이블 | Neon `users` 테이블 신규 생성, 이메일 유니크 인덱스 |
| 비밀번호 보안 | SHA-256 해시 저장 (Web Crypto API `crypto.subtle.digest`) |

### 변경된 파일

```
lib/
  types.ts                UserInfo 필드 확장 (corporationName, organizationName, position, userId)

components/
  WelcomePopup.tsx        3단계 인증 플로우로 전면 재작성

app/api/users/
  route.ts                POST /api/users — 회원가입
  login/route.ts          POST /api/users/login — 로그인
  exists/route.ts         GET /api/users/exists?email= — 이메일 중복 확인

supabase/
  schema.sql              users 테이블 + 유니크 인덱스 + updated_at 트리거 추가

PROJECT_HISTORY.md        v1.2.0 항목 추가
```

### DB 구조 변경

```sql
-- Neon PostgreSQL에 추가
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  corporation_name  TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  position          TEXT NOT NULL,
  email             TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_idx ON users (email);
```

### 테스트 체크리스트

- [x] 미등록 이메일 입력 → 회원가입 폼으로 이동
- [x] 등록된 이메일 입력 → 로그인 폼으로 이동
- [x] 비밀번호 8자 미만 입력 시 에러 메시지 표시
- [x] 이미 등록된 이메일로 회원가입 시도 → 오류 처리
- [x] 잘못된 비밀번호로 로그인 시도 → "비밀번호가 올바르지 않습니다." 표시
- [x] 회원가입 성공 시 localStorage에 사용자 정보 저장 후 팝업 닫힘
- [x] 로그인 성공 시 localStorage에 사용자 정보 저장 후 팝업 닫힘
- [x] 팝업 외부 클릭해도 닫히지 않음 (인증 완료 전 강제 표시)
- [x] TypeScript 컴파일 에러 없음 (tsc --noEmit 통과)

---

## v1.1.0 — 예약 차단 시간 종료시간 지원

**구현일시**: 2026-05-21  
**배포 URL**: https://test-ai-campus.vercel.app

### 구현 요약

관리자 예약 차단시간 관리 기능에 **종료시간(endTime)** 을 추가하여 차단 범위를 명확히 지정할 수 있게 했습니다.
사용자 예약 캘린더에서 차단 범위 전체가 **"🚫 예약 불가"** 사선 패턴으로 비활성화 표시됩니다.

### 변경 기능

| 항목 | 내용 |
|---|---|
| 차단 슬롯 타입 | `BlockedSlot.endTime?: string` 필드 추가 |
| 자동 마이그레이션 | 기존 `endTime` 없는 슬롯 → localStorage 읽기 시 `startTime + 1시간`으로 자동 채움 |
| 관리자 폼 | 시작시간·종료시간 한 행에 나란히 배치, 종료시간 옵션은 시작시간 이후만 표시 |
| 입력 검증 | ① 종료시간 > 시작시간 ② 최대 8시간 ③ 기존 예약과 충돌 시 저장 차단 |
| 겹치는 슬롯 병합 | 같은 요일/날짜의 겹치는 차단 범위 자동 병합 |
| 차단 목록 표시 | "09:00–12:00" 형식으로 시작~종료 시간 표시, 표 형식으로 정렬 |
| 사용자 예약 화면 | `isBlocked()` → `startTime <= slot < endTime` 범위 기반으로 변경 |
| 예약 불가 표시 | 사선 스트라이프 배경 + "🚫 예약 불가" 텍스트로 명확한 비활성화 표시 |
| 유틸 함수 | `addMinutes(time, minutes)`, `minutesBetween(start, end)` 추가 |

### 변경된 파일

```
lib/
  types.ts           BlockedSlot.endTime 필드 추가
  utils.ts           addMinutes(), minutesBetween() 추가 / getBlockedSlots() 마이그레이션 로직

components/
  AdminMeetings.tsx  종료시간 필드, 검증, 충돌 체크, 병합 처리, 표 형식 목록
  MeetingPage.tsx    isBlocked() 범위 기반 개선, 예약 불가 시각 표시

PROJECT_HISTORY.md  (신규 생성)
```

### DB 구조 변경

> **참고**: 이 프로젝트의 예약 차단 슬롯은 Neon PostgreSQL이 아닌 **localStorage**에 저장됩니다.  
> (Neon DB는 게시판 posts/comments 전용)

| 저장소 | 키 | 변경 내용 |
|---|---|---|
| localStorage | `axtf_blocked_slots` | 각 항목에 `endTime: string` 필드 추가. 기존 데이터는 읽기 시 자동 마이그레이션 |

### 테스트 체크리스트

- [x] 시작시간보다 이전 종료시간 입력 시 에러 메시지 표시
- [x] 8시간 초과 차단 시 경고 후 저장 불가
- [x] 기존 예약과 겹치는 차단 등록 시 경고 후 저장 불가
- [x] 기존 endTime 없는 차단 데이터 → startTime+1h로 자동 마이그레이션
- [x] 겹치는 차단 범위 등록 시 병합 처리
- [x] 사용자 캘린더에서 차단 범위 전체 셀 비활성화 + "🚫 예약 불가" 표시
- [x] TypeScript 컴파일 에러 없음 (tsc --noEmit 통과)

---

## v1.0.0 — Admin PRD 전면 개선

**구현일시**: 2026-05-21  
**배포 URL**: https://test-ai-campus.vercel.app

### 구현 요약

Admin PRD에 따라 영상관리·미팅관리·채팅방·통계·가이드 기능을 전면 개선하고 Supabase에서 Neon DB로 마이그레이션했습니다.

### 변경 기능

| 영역 | 내용 |
|---|---|
| 영상관리 | 레벨 CRUD, Notion 스타일 학습 단계 에디터, ▲▼ 순서 변경, 삭제 확인 팝업 |
| 강의 페이지 | 동적 레벨 사이드바, 모달 내 학습 단계 아코디언 |
| 미팅관리 | 매주 반복 / 특정 날짜 차단 슬롯 CRUD |
| 채팅방 관리 | URL + 비밀번호 + 이용 규칙 개별 설정 |
| 입장 팝업 | 비밀번호 복사 + 이용규칙 + 카카오톡 입장 팝업 |
| 가이드 관리 | 추천 체크박스 stale-closure 버그 수정 |
| 통계 | 날짜 범위·버튼 타입 필터, 날짜별 클릭 추이 차트 |
| DB | Supabase → Neon DB 마이그레이션 (raw SQL) |

### DB 구조 (Neon PostgreSQL)

```sql
posts (id, title, content, password_hash, link, views_count, likes_count,
       comments_count, is_deleted, created_at, updated_at)
post_likes (id, post_id, session_id, liked_at)
comments (id, post_id, content, password_hash, likes_count, is_deleted,
          created_at, updated_at)
comment_likes (id, comment_id, session_id, liked_at)
```
