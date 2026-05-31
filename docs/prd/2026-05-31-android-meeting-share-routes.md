# PRD: 안드로이드 모바일 UI — 미팅·공유 라우트 분리 + 메뉴 카드 정합성

- 작성일: 2026-05-31
- 작성자: Claude (요청자: ohdongko)
- 범위: 모바일 홈 메뉴 카드 라우팅 버그 수정 + 미팅 신청 페이지 신규 + 공유 서비스 페이지 신규
- 대상 버전: **v1.0.7** (versionCode 7→8)

---

## 1. 배경

### 1.1 현재 상황 (v1.0.6 기준)
홈 화면 메뉴 카드 4개 중 "질문"과 "공유" 카드가 **둘 다 게시판(`/m/board`)으로 이동**한다. 정확한 라우팅:

| 카드 | 현재 href | 의도 |
|---|---|---|
| 학습 | `/m/video` | ✅ |
| 제작 | `/m/video?cat=guide` | ⚠️ 가이드 카테고리 미구현 |
| **질문** | `/m/board` | ✅ |
| **공유** | `/m/board?tab=share` | ❌ 게시판으로 잘못 진입 |

추가 문제: **미팅 예약(`MeetingPage`)이 모바일에서 접근 경로가 전혀 없다**. 데스크톱은 6개 탭(홈/강의/미팅/게시판/공유/가이드)이지만 모바일은 4개 메뉴 카드뿐이라 핵심 기능인 미팅 신청 진입이 빠짐.

### 1.2 영향
- 사용자가 공유 서비스 등록을 원하면 카드 진입 후 다른 페이지로 가서 혼란
- 미팅 신청은 모바일에서 불가 — 핵심 기능 누락
- v1.0.6 .aab가 이미 출시되면 비공개 테스터들이 핵심 기능 못 씀

## 2. 정책 결정

| 항목 | 권장(기본값) | 대안 |
|---|---|---|
| 메뉴 카드 슬롯 수 | **4개 (2×2 유지)** — 핵심 4개로 압축 | 6개 (2×3) — 데스크톱 동등 |
| 메뉴 카드 라인업 | **학습 / 미팅 / 질문 / 공유** | 학습/제작/질문/공유, 학습/미팅/질문/제작 등 |
| "제작(가이드)" 진입 | **메뉴 카드에서 제외 → 별도 보조 진입(추후 헤더 메뉴 또는 v1.0.8)** | 메뉴 카드 5번째 슬롯 |
| 미팅 라우트 | **신규 `/m/meeting`** | `/m/share` 안에 통합 |
| 공유 라우트 | **신규 `/m/share`** | `/m/board?tab=share` 그대로 두고 board에서 분기 |
| 탭바 4개 | **유지** (홈/학습/질문/프로필) — 미팅·공유는 메뉴 카드로 진입 | 탭바를 5개로(홈/학습/미팅/질문/프로필) |
| 인증 | 미팅 신청·공유 등록 **모두 로그인 필수** (데스크톱 동일) | 익명 허용 |
| API | 기존 `/api/reservations`·`/api/blocked-slots`·`/api/services`·`/api/users/me` 그대로 사용 | 모바일 전용 API 신규 |
| 디자인 토대 | 기존 모바일 디자인 토큰(`tokens.ts`) + 인라인 스타일 패턴 일관 유지 | Tailwind 분리 |
| 데스크톱 영향 | **없음** — 기존 `components/SharePage`·`MeetingPage` 미수정 | 일부 공유 |

### 2.5 Happy Path 사용자 여정

#### S1. 미팅 신청
1. 홈 `/m` → 메뉴 카드 "미팅" 탭
2. `/m/meeting` 진입 → 이번 주 캘린더(월~금) + 30분 슬롯 노출
3. 빈 슬롯 탭 → 하단 신청 폼 펼침(이름·소속·문의 내용·이메일·연락처)
4. 폼 제출 → `POST /api/reservations` → 성공 시 토스트 "신청되었습니다"
5. 같은 슬롯이 즉시 `pending` 상태로 캘린더에 반영

#### S2. 공유 서비스 등록·열람
1. 홈 → 메뉴 카드 "공유" 탭
2. `/m/share` 진입 → 동료들이 공유한 AI 서비스 카드 목록 (`GET /api/services`)
3. 우하단 FAB(+) 탭 → 등록 모달 또는 별도 화면(`/m/share/new`)
4. 서비스명·URL·테스트 계정·설명 입력 → `POST /api/services` → 성공 시 목록 갱신

#### S3. 메뉴 카드 라우팅 정상화
- "질문" → `/m/board` ✅ (기존)
- "공유" → `/m/share` ✅ (신규 라우트)
- "미팅" → `/m/meeting` ✅ (신규 카드 + 라우트)

## 3. 목표 / 비목표

### 목표 (G)
- **G1**: 모바일에서 미팅 신청·공유 서비스 등록·열람 모두 가능
- **G2**: 메뉴 카드 라우팅이 카드 라벨과 일치
- **G3**: 데스크톱 사용자(@eland.co.kr PC) 경험에 0 영향
- **G4**: 기존 백엔드 API 그대로 사용 (DB 마이그레이션 없음)
- **G5**: 영상 보호(FLAG_SECURE)·자동로그인·실데이터 메뉴 카드 등 v1.0.5/v1.0.6 기능 유지

### 비목표 (NG)
- 가이드(`GuidePage`) 모바일화 (v1.0.8 후속)
- 관리자 미팅 차단 슬롯 모바일 UI
- iOS
- 푸시 알림(예약 확정 시)

## 4. 기능 요구사항

### F1. 메뉴 카드 라우팅 + 라인업 수정
- F1.1 `MobileMenuCard` 4개 카드: **학습 / 미팅 / 질문 / 공유**
- F1.2 카드별 href:
  - 학습 → `/m/video`
  - 미팅 → `/m/meeting`
  - 질문 → `/m/board`
  - 공유 → `/m/share`
- F1.3 카운트 매핑:
  - 학습 = `/api/videos` 길이
  - 미팅 = **이번 주 빈 슬롯 개수** (또는 "예약 가능" 라벨 — 슬롯 정확 계산 부담 시)
  - 질문 = `/api/posts` 길이
  - 공유 = `/api/services` 길이
- F1.4 `MenuKind`에 `'meeting'` 추가, `MENU_GRADIENTS`에 색상 토큰 추가

### F2. 미팅 신청 페이지 (`/m/meeting`)
- F2.1 신규 `app/m/meeting/page.tsx`
- F2.2 신규 `app/m/_components/MobileMeetingCalendar.tsx` — 주차 캘린더(월~금) + 30분 슬롯
- F2.3 신규 `app/m/_components/MobileMeetingForm.tsx` — 슬롯 선택 후 펼침. 입력: 이름·소속·문의 내용·이메일·연락처
- F2.4 빈 슬롯 / `pending` / `confirmed` / `blocked` 상태 시각 구분
- F2.5 `< 이전 주` / `> 다음 주` 버튼
- F2.6 자정 지나면 자동으로 "이번 주" 갱신 (`visibilitychange` 리스너)
- F2.7 신청 완료 시 토스트 노출 + 캘린더 자동 새로고침
- F2.8 기존 `lib/utils.ts`의 `getWeekDates`·`generateTimeSlots`·`maskName` 재사용

### F3. 공유 서비스 페이지 (`/m/share`)
- F3.1 신규 `app/m/share/page.tsx`
- F3.2 신규 `app/m/_components/MobileServiceCard.tsx` — 카드: 서비스명·URL(클릭 시 외부 브라우저)·설명·등록자(마스킹)
- F3.3 신규 `app/m/_components/MobileShareRegisterSheet.tsx` — 등록 시트(바텀시트 또는 풀스크린 폼). 입력: 서비스명·URL·테스트 계정·설명
- F3.4 우하단 FAB(+) 탭 → 등록 시트 열기
- F3.5 비로그인 시 등록 차단 + 안내 토스트
- F3.6 `GET /api/services?_={ts}` no-store 캐시 우회 (데스크톱 패턴 그대로)

### F4. 탭바 / 헤더 변경 없음
- F4.1 `MobileTabBar` 4개 탭 그대로 (홈/학습/질문/프로필)
- F4.2 미팅·공유는 메뉴 카드를 통해서만 진입
- F4.3 `MobileHeader` 유지

## 4.5 에러 케이스

### E1. 미팅 신청 입력 검증
| 상황 | 처리 |
|---|---|
| 이름·이메일·연락처·문의 내용 빈 칸 | 폼 helper text + 제출 차단 |
| 이메일 형식 오류 | helper "올바른 이메일 형식이 아닙니다" |
| 연락처 형식 오류 (숫자 외) | helper |
| 같은 슬롯 동시 신청(race) | 서버 응답 409 → 토스트 "이미 신청된 슬롯입니다" + 캘린더 새로고침 |
| 과거 슬롯 선택 | UI에서 disabled 처리 |
| 차단 슬롯 (`blocked-slots` 매칭) | UI에서 disabled + "차단됨" 라벨 |
| 비로그인 신청 | `localStorage` 인증 정보 자동 채움 + 서버에서 재검증 |

### E2. 공유 서비스 등록 검증
| 상황 | 처리 |
|---|---|
| URL 형식 오류 | helper "https://로 시작하는 URL 입력" |
| 서비스명 빈 칸 | helper + 제출 차단 |
| 비로그인 등록 | "로그인 후 이용 가능합니다" 토스트 + 차단 |
| 중복 URL | 서버 응답 409 → 토스트 "이미 등록된 서비스입니다" |

### E3. 네트워크 / API 실패
| 상황 | 처리 |
|---|---|
| `/api/reservations` GET 실패 | "예약 정보를 불러올 수 없습니다" + 재시도 버튼 |
| `/api/services` GET 실패 | placeholder 카드 + 재시도 |
| 인증 만료 (401) | localStorage 정리 → Welcome 라우트로 redirect |
| 오프라인 | Service Worker `/offline.html` fallback (기존) |

### E4. 데이터 / 환경
| 상황 | 처리 |
|---|---|
| 캘린더 자정 경과 | `visibilitychange`로 todayKey 갱신, 자동으로 "이번 주" 표시 |
| 신청 폼 작성 중 네트워크 끊김 | 임시 저장(localStorage) → 복귀 시 복원 |
| 안드로이드 백 버튼 | 신청 폼 펼침 상태에서 닫기, 그 외엔 OS 기본 동작 |

## 5. 기술 설계

### 5.1 디렉토리 구조
```
app/m/
  meeting/page.tsx           # 신규 — 미팅 신청 페이지
  share/page.tsx             # 신규 — 공유 서비스 목록
  share/new/page.tsx         # (선택) 신규 — 등록 풀스크린 폼
  _components/
    MobileMeetingCalendar.tsx # 신규
    MobileMeetingForm.tsx     # 신규
    MobileServiceCard.tsx     # 신규
    MobileShareRegisterSheet.tsx # 신규
    MobileMenuCard.tsx         # 수정 — 라우팅/카운트
  _styles/tokens.ts          # 수정 — MENU_GRADIENTS에 'meeting' 추가
```

### 5.2 API 연동 (모두 기존)
- `GET /api/reservations` — 마스킹된 슬롯 상태 목록
- `POST /api/reservations` — 신청
- `GET /api/blocked-slots` — 차단 슬롯
- `GET /api/services` — 공유 서비스 목록 (no-store 캐시 우회)
- `POST /api/services` — 등록
- `GET /api/users/me` — 인증 상태 확인 + 신청자 정보 자동 채움

### 5.3 상태 / 라우팅
- Next.js App Router 표준 라우트
- 클라이언트 컴포넌트(`'use client'`) — 인증 분기, 폼 state, 캘린더 인터랙션
- `MobileToast` 재사용

### 5.4 토큰 추가
```ts
// _styles/tokens.ts (MENU_GRADIENTS)
meeting: { from: '#0EA5E9', to: '#0369A1' }, // sky blue
// 또는 success(#1E9E6A) 계열 재사용
```

### 5.5 페이지 메타
- `app/m/meeting/page.tsx`·`app/m/share/page.tsx` 모두 `metadata.robots = { index: false }` (모바일 라우트 SEO 제외)

## 6. UX 명세

### 6.1 미팅 캘린더
- 주차 헤더: `2026.05.31 - 06.04` 형식 + 이전/다음 버튼
- 슬롯 그리드: 5열(요일) × N행(시간) — 30분 단위, 09:00~18:00
- 빈 슬롯: 흰 배경 + 옅은 border
- pending: 노란 배경 + "예약대기" 작은 라벨
- confirmed: 회색 배경 + "확정" 라벨 + 마스킹된 이름
- blocked: 사선 패턴 + "차단" 라벨
- 과거: opacity 0.4 + disabled
- 선택: 파란 테두리 + 폼 펼침

### 6.2 미팅 폼
- 펼침 애니메이션 200ms
- 첫 입력란 자동 포커스
- 가상 키보드 가려짐 방지(scrollIntoView)
- 신청 버튼 풀-와이드, 56px 높이

### 6.3 공유 카드 그리드
- 1열 세로 리스트 (모바일 최적)
- 카드 라운드 16px, 그림자 sm
- "외부 링크" 아이콘 우상단 (시각 표시)
- 등록자 이름: maskName으로 마스킹 ("홍O동")

### 6.4 등록 시트
- 바텀 시트(높이 80vh) 또는 풀스크린
- 상단 핸들 + 닫기 X
- 제출 버튼 sticky bottom

### 6.5 접근성
- 터치 타깃 ≥ 44×44pt
- 색 대비 WCAG AA
- 폼 라벨 명시

## 7. 마이그레이션 / 운영

### 7.1 v1.0.7 출시
- 코드 변경만 (스키마 변경 X)
- versionCode 7→8, versionName 1.0.6→1.0.7
- `cap sync` + `bundleRelease` + Play Console 비공개 테스트 업로드

### 7.2 본 PRD 동기화
- `docs/prd/android-app.md` 헤더·§2·§11 갱신 (`feedback-android-prd-sync` 규칙)

## 8. 보안 / 데이터

| 항목 | 처리 |
|---|---|
| 인증 | localStorage + httpOnly 쿠키 (기존) |
| 신청자 이메일·이름 | 서버 저장, 공개 API에서는 마스킹 |
| 공유 URL | https만 허용 (클라이언트 검증 + 서버 정규화) |
| 비밀번호·결제 정보 | 등록 폼에 받지 않음 |
| FLAG_SECURE | 영상 모달에만 적용 (기존), 미팅·공유 페이지는 비활성 |
| 미팅 신청 rate limit | Upstash Redis 기반 IP 1분당 5회 (기존 `/api/users/login` 패턴 재사용). 초과 시 429 → "요청이 많습니다" 토스트 |
| 공유 외부 링크 보안 | 카드 URL 탭 시 `<a target="_blank" rel="noopener noreferrer">` 강제 — 클릭재킹·referrer leak 방지 |
| 신청자 IP·UA 로깅 | 서버 `/api/reservations` POST 핸들러가 `getClientIp(req)` + UA 헤더를 audit 컬럼에 기록 (기존 `logAuth` 패턴 재사용 가능) |

## 9. 테스트 / 검증

### 9.1 회귀 체크리스트
- [ ] 홈 메뉴 카드 4개 라벨·라우팅 일치
- [ ] 메뉴 카드 카운트 4개 모두 실 데이터
- [ ] 미팅 페이지 진입 → 캘린더 표시
- [ ] 빈 슬롯 탭 → 폼 펼침
- [ ] 신청 → 토스트 + 캘린더 갱신
- [ ] 차단 슬롯 / 과거 슬롯 disabled
- [ ] 공유 페이지 목록 표시
- [ ] FAB 탭 → 등록 시트
- [ ] 비로그인 시 등록 차단
- [ ] 외부 링크 탭 → 시스템 브라우저 열림
- [ ] 자동로그인·영상 보호 등 v1.0.5/v1.0.6 기능 정상

### 9.2 단말 검증
- Pixel 6 / 7 에뮬레이터 (Android 14)
- 실 디바이스 가능 시 Galaxy / Pixel

## 10. 영향 파일 / 의존성

### 신규
- `app/m/meeting/page.tsx`
- `app/m/share/page.tsx`
- (선택) `app/m/share/new/page.tsx`
- `app/m/_components/MobileMeetingCalendar.tsx`
- `app/m/_components/MobileMeetingForm.tsx`
- `app/m/_components/MobileServiceCard.tsx`
- `app/m/_components/MobileShareRegisterSheet.tsx`

### 변경
- `app/m/_components/MobileMenuCard.tsx` — 라인업·라우팅·카운트
- `app/m/_styles/tokens.ts` — `MENU_GRADIENTS.meeting` 추가
- `app/m/page.tsx` — `meetingCount`(또는 라벨)·`serviceCount` props 전달
- `android/app/build.gradle` — versionCode 8, versionName 1.0.7
- `docs/prd/android-app.md` — §2·§11

### 영향 없음
- 데스크톱 `app/page.tsx`, `components/**`, `app/api/**`

### npm 신규 의존성
- **없음** — 기존 React + Tailwind + 인라인 스타일

### 환경 변수
- **변경 없음**

## 11. 알려진 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| 캘린더 UI가 작은 폰에서 좁음 | 슬롯 탭 어려움 | 30분 슬롯을 1시간 슬롯으로 변경 또는 가로 스크롤 |
| `/api/services` 캐시(60s) | 등록 직후 본인 옛 목록 | 데스크톱과 동일하게 `_={Date.now()}` cache-busting |
| 미팅 슬롯 동시성 | 두 사용자 동시 신청 | 서버에서 409 → 클라이언트 토스트 + 새로고침 |
| 가이드 진입 경로 부재 | 일부 사용자 가이드 못 찾음 | v1.0.8에서 헤더 메뉴 추가 또는 별도 진입 |
| 외부 URL 로딩 + Capacitor 백 버튼 | 신청 폼/시트 열림 상태에서 OS 백 시 페이지 벗어남 | `@capacitor/app.backButton` 리스너 (v1.0.4부터 설치됨) |

## 11.5 롤백 절차

### R1. 빌드 단계
- `git revert` → 이전 커밋 복귀 → 재빌드

### R2. Play Console 단계
- 이전 1.0.6 .aab는 폐기되었으니 versionCode 9로 한 칸 더 올려 1.0.6 코드 재업로드

### R3. 운영 중
- 메뉴 카드 라우팅만 hotfix: `MobileMenuCard.tsx`만 patch → 새 .aab 빌드
- DB 영향 없음 → 사용자 데이터 손실 없음

## 12. 의사결정 우선순위 (Day 1)

1. **승인**: 메뉴 카드 4개 라인업 = 학습/미팅/질문/공유
2. **승인**: 미팅 카드 카운트는 "예약 가능" 라벨 또는 빈 슬롯 수 (간단한 라벨 권장)
3. **승인**: 미팅 폼은 슬롯 탭 시 펼침 (별도 라우트 X)
4. **승인**: 공유 등록은 바텀 시트 (별도 라우트 X)
5. **승인**: versionCode 8 / versionName 1.0.7
