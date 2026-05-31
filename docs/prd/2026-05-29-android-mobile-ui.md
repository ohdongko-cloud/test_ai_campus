# PRD: 안드로이드 앱 전용 모바일 UI 분리 구축

- 작성일: 2026-05-29
- 작성자: Claude (요청자: ohdongko)
- 범위: 안드로이드 앱 WebView에서 보여줄 모바일 최적화 UI를 별도 라우트로 분리 구축

---

## 1. 배경

### 1.1 현재 상황
v1.0.3까지의 안드로이드 앱은 Capacitor `server.url = https://retail-ai-campus.vercel.app` 로 데스크톱 우선 디자인의 웹 화면을 그대로 WebView에 로드한다. 결과적으로:

- **인라인 스타일 + 픽셀 고정값**으로 작성된 컴포넌트들이 모바일 뷰포트(360–428dp)에서 깨짐
- 데스크톱 그리드(4컬럼·사이드바)가 모바일에서 비좁게 표시
- 영상 시청 모달의 워터마크·컨트롤이 모바일 가로 폭에 안 맞음
- 게시판·예약 캘린더의 가로 스크롤·터치 영역이 좁아 사용 어려움
- 폰트 사이즈·여백 비율이 모바일 가독성에 미달

### 1.2 안 풀리는 이유
기존 컴포넌트(`MainPage`·`VideoPage`·`BoardPage`·`MeetingPage` 등)는 모두 인라인 스타일에 hard-coded 사이즈를 사용한다. 미디어 쿼리·Tailwind 반응형 클래스가 거의 없어 컴포넌트 안에서 분기 추가 비용이 크다. 동시에 데스크톱 사용자(임직원 PC) 경험을 해치지 않아야 한다.

## 2. 정책 결정 (사용자 확정 필요)

| 항목 | 권장(기본값) | 대안 |
|---|---|---|
| 접근 방식 | **별도 라우트 트리 `/m/*`** — Capacitor만 이쪽 로드, 데스크톱 웹은 기존 라우트 유지 | 기존 컴포넌트 반응형화 / 분기 컴포넌트 |
| 1차 범위 | **인증(웰컴) + 메인 홈 + 영상 강의 + 게시판** 4화면 | 메인만 PoC / 전체 한 번에 |
| 인증 처리 | **기존 `/api/users/*` API 그대로 재사용**, UI만 모바일 전용 | 인증도 모바일 신규 |
| Capacitor 라우트 | `server.url = https://retail-ai-campus.vercel.app/m` 으로 변경 | 변경 없이 데스크톱 + 모바일 자동 분기 |
| 디바이스 감지 | **별도 라우트 분리이므로 감지 불필요** — 안드로이드 앱은 무조건 `/m` 진입 | UA 감지 redirect |
| 디자인 토대 | **v1.0.3 스크린샷 mockup 디자인** 그대로 React로 구현 | 신규 디자인 |
| 데스크톱 영향 | **없음** — 기존 라우트·컴포넌트 변경 X | 일부 공유 |
| 타입스크립트 공유 | **`lib/types.ts`·`lib/utils.ts`·`lib/secureScreen.ts` 공유**, UI만 분리 | 전부 신규 |

## 2.5 Happy Path 사용자 여정

### S1. 첫 진입(미인증)
1. 사용자가 Play Store에서 앱 설치 → 홈 아이콘 탭
2. 콜드 스타트(스플래시 ≤ 1.5s) → `/m` 로드
3. `localStorage.userInfo` 없음 → **MobileWelcome**(이메일 입력) 표시
4. 회사 이메일 입력 → "다음" → `/api/users/exists` 호출
5. 신규: **MobileSignup** 폼(이름·법인명·조직명·직무·비밀번호) → `/api/users` POST → 성공 시 `localStorage` 저장 + 메인 진입
6. 기존: **MobileLogin** 폼(비밀번호만) → `/api/users/login` POST → 성공 시 `localStorage` 저장 + 메인 진입

### S2. 영상 시청
1. 메인 → 학습 카드 탭 또는 탭바 "학습" 탭
2. `/m/video` 라우트 → 영상 리스트
3. 영상 카드 탭 → **MobileVideoModal** 진입
4. 모달 마운트 직후 `enableSecureScreen()` 호출 → FLAG_SECURE 활성화 콘솔 로그
5. 영상 재생 + 워터마크(이메일 + 시각) 우상단/좌하단 표시, 30s 마다 위치 교체
6. 닫기 ✕ 탭 → 모달 언마운트 직전 `disableSecureScreen()` 호출

### S3. 게시판 사용
1. 탭바 "질문" 탭 → `/m/board`
2. 게시글 리스트 표시 (Neon `posts` 조회, 최근 20건)
3. 게시글 탭 → 상세 모달(조회수 +1)
4. 좋아요 탭 → `/api/posts/[id]/like` POST → 카운트 업데이트

### S4. 백그라운드 복귀
1. 영상 시청 중 홈 화면 이동 → FLAG_SECURE로 앱 미리보기 검정 처리
2. 앱 재진입 → 그대로 영상 모달 표시 (`singleTask` launchMode 유지)

## 3. 목표 / 비목표

### 목표 (G)
- **G1**: 안드로이드 앱 사용자가 깨짐 없이 핵심 기능 4개(인증·메인·영상·게시판)를 이용
- **G2**: 영상 시청 시 워터마크·FLAG_SECURE·외부 공유 금지 안내가 모바일 화면에 명확히 표시
- **G3**: 모든 터치 타깃 ≥ 44×44pt, 가독성 최소 14px
- **G4**: 콜드 스타트 → 메인 진입까지 3초 이내 (4G 환경)
- **G5**: 데스크톱 웹 사용자(@eland.co.kr 임직원 PC) 경험에 0 영향
- **G6**: 동일 `users`·`posts`·`comments` DB 공유, 별도 로그인 불필요

### 비목표 (NG)
- iOS 앱용 UI (별도 PRD)
- 미팅 예약·가이드·관리자 페이지 모바일화 (2차 범위)
- 오프라인 작성(서비스워커 큐잉)
- 푸시 알림(FCM, 별도 PRD)
- 다크모드 (1차 범위 외)

## 4. 기능 요구사항

### F1. 라우팅 / 레이아웃
- F1.1 `app/m/layout.tsx` — 모바일 전용 상위 레이아웃. viewport-fit=cover, dark/light 자동, 한국어 폰트 프리로드
- F1.2 `app/m/page.tsx` — 인증 미완료 시 웰컴 표시, 완료 시 홈 표시(클라이언트 분기)
- F1.3 `app/m/video/page.tsx`, `app/m/board/page.tsx` — 하위 라우트
- F1.4 모든 페이지에 **고정 하단 탭바**(홈·학습·질문·프로필) — fixed bottom, 안전 영역 패딩

### F2. 인증 (Welcome / Login / Signup)
- F2.1 3단계 인증 플로우(이메일 → 신규/기존 분기)는 기존과 동일
- F2.2 모바일 최적화: 큰 입력 박스(높이 56px), 한 줄에 하나씩
- F2.3 인증 완료 시 `localStorage.userInfo` 저장 (기존 형식 유지)
- F2.4 입력 시 가상 키보드 가려짐 방지 — input focus 시 scrollIntoView

### F3. 메인 홈
- F3.1 그라데이션 Hero 카드(인사 + 학습 시간·완료 강의·내 게시글 통계 3개)
- F3.2 4개 메뉴 카드(학습/제작/질문/공유) — 각각 그라데이션 + 큰 숫자 + 화살표
- F3.3 추천 강의 가로 카드 1개
- F3.4 하단 탭바

### F4. 영상 강의 리스트
- F4.1 상단 레벨 필터 칩(전체/입문/중급/고급) — 가로 스크롤
- F4.2 영상 카드 세로 리스트 — 큰 썸네일 + 제목 + 레벨 뱃지 + 메타(조회수/댓글/좋아요)
- F4.3 탭 시 영상 모달 진입

### F5. 영상 시청 모달
- F5.1 풀 스크린 다크 배경
- F5.2 영상 영역(16:9) — 이메일 워터마크 우상단·좌하단 반투명, 30초마다 위치 교체
- F5.3 영상 하단에 "본 영상은 사내 한정 자료 · 외부 공유 금지" 안내
- F5.4 빨간색 "화면 캡처·녹화 차단 중(FLAG_SECURE 활성화)" 배너 노출
- F5.5 닫기(✕) 버튼은 좌상단, 안전 영역 고려
- F5.6 모달 진입 시 `enableSecureScreen()`, 이탈 시 `disableSecureScreen()` 호출(기존 헬퍼 재사용)

### F6. 게시판 리스트
- F6.1 상단 검색 바
- F6.2 게시글 카드 — 제목, 작성자·소속, 작성 시각, 조회/댓글/좋아요
- F6.3 NEW 뱃지 — 24시간 이내 작성
- F6.4 우하단 글쓰기 FAB — 진입 시 모바일 작성 화면(2차 범위)

### F7. 글로벌 컴포넌트
- F7.1 헤더 — 로고(이랜드 AI 캠퍼스) + 알림 아이콘(미확인 카운트) + 프로필 이니셜
- F7.2 탭바 — 4 탭, 활성 인디케이터
- F7.3 안전 영역 — `env(safe-area-inset-top/bottom)` 활용

## 4.5 에러 케이스 (필수 명세)

### E1. 인증 / 입력 검증
| 상황 | UI 처리 | 백엔드 처리 |
|---|---|---|
| 이메일 형식 오류 | 입력란 아래 "올바른 이메일 형식이 아닙니다" 빨간 helper | `/api/users/exists` 호출 안 함 |
| 사내 도메인 아닌 이메일 | "@eland.co.kr 또는 허용 도메인만 가입 가능" 안내 + 가입 차단 | `/api/users` POST 시 서버 재검증, 거부 |
| 비밀번호 8자 미만 | 실시간 helper "8자 이상 입력" | `/api/users` 호출 X |
| 비밀번호 불일치(로그인) | "비밀번호가 올바르지 않습니다 · 분실 시 oh_dongha01@eland.co.kr" | 401 응답 + rate limit |
| 중복 가입 시도 | "이미 가입된 이메일입니다. 로그인하시겠습니까?" + 로그인 폼 분기 | `/api/users` 409 응답 |

### E2. 네트워크 / API 실패
| 상황 | UI 처리 |
|---|---|
| API 5xx | "일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요" 토스트 + 재시도 버튼 |
| 타임아웃 (>10s) | 진행 인디케이터 후 "응답이 늦어요" 안내 + 재시도 |
| 오프라인 진입 | Service Worker `/offline.html` fallback (기존) |
| 인증 만료 (401) | localStorage 정리 → Welcome 라우트로 redirect |
| Rate limit (429) | "요청이 많습니다. 잠시 후 다시 시도해주세요" |

### E3. 권한 / 접근
| 상황 | 처리 |
|---|---|
| `/m/admin/*` 직접 진입 시도 | 클라이언트 가드: Welcome으로 redirect (관리자 페이지는 모바일 1차 범위 외) |
| 영상 모달에서 FLAG_SECURE 실패 (구버전·에뮬레이터 등) | 워터마크 표시는 유지, 상단 "캡처 차단 미지원 기기" 빨간 배너 표시 후 계속 재생 허용 |
| 화면 회전 도중 모달 이탈 | `disableSecureScreen()` 보장 호출 (`useEffect` cleanup) |
| 백 버튼으로 모달 종료 | Capacitor `App.addListener('backButton')` → 모달 닫고 cleanup |

### E4. 데이터 충돌 / 동시성
| 상황 | 처리 |
|---|---|
| 좋아요 더블 탭 | 클라이언트 디바운스 300ms + 낙관적 업데이트 → 서버 실패 시 롤백 |
| 동일 사용자 다중 디바이스 로그인 | 허용(현 정책) — 토큰 단일 세션 아님 |
| 게시글 작성 중 네트워크 끊김 | 임시 저장(localStorage) → 복귀 시 복원 안내 토스트 |
| Capacitor server.url 도달 불가 | `Capacitor.getPlatform() === 'android'` 감지 후 "서비스 연결 실패" 전체 화면 (재시도 버튼) |

### E5. 모바일 환경 엣지 케이스
| 상황 | 처리 |
|---|---|
| 가상 키보드로 입력 가려짐 | input focus 시 `scrollIntoView({block: 'center'})` |
| Notch / 펀치홀 침범 | 모든 화면에 `env(safe-area-inset-*)` 패딩 |
| 가로 모드 진입 | Manifest `orientation: portrait` 유지(이미 설정), WebView에서도 portrait 잠금 |
| 다크모드 OS 설정 | 1차 범위는 라이트 고정, prefers-color-scheme 무시 |
| 저전력 모드 | 추가 처리 없음(브라우저 표준 동작) |

## 5. 기술 설계

### 5.1 디렉토리 구조
```
app/
  m/
    layout.tsx              # 모바일 전용 레이아웃 (viewport, 폰트, 탭바 wrapper)
    page.tsx                # 홈 (인증 미완료시 Welcome 렌더)
    video/page.tsx          # 영상 리스트
    video/[id]/page.tsx     # 영상 시청 모달 (또는 클라이언트 모달)
    board/page.tsx          # 게시판 리스트
    profile/page.tsx        # 프로필 (스텁)
    _components/
      MobileHeader.tsx
      MobileTabBar.tsx
      MobileWelcome.tsx
      MobileHero.tsx
      MobileMenuCard.tsx
      MobileVideoCard.tsx
      MobileVideoModal.tsx
      MobilePostCard.tsx
      MobileSearchBar.tsx
    _styles/
      tokens.ts             # 컬러·여백·라운드 토큰
```

### 5.2 스타일 시스템
- Tailwind는 기존대로 사용
- 모바일 전용 컴포넌트에는 인라인 스타일 + 토큰 객체 사용 (기존 컨벤션 유지)
- 안전 영역: `paddingTop: 'env(safe-area-inset-top)'`

### 5.3 API 연동
- `/api/users/exists`, `/api/users/login`, `/api/users`, `/api/users/me` — 기존 그대로
- `/api/posts`, `/api/posts/[id]`, `/api/posts/[id]/like` — 기존 그대로
- 영상/가이드 데이터 fetch — 기존 클라이언트 fetch 패턴 재사용

### 5.4 Capacitor 설정 변경
- `capacitor.config.ts` → `server.url = "https://retail-ai-campus.vercel.app/m"`
- `allowNavigation`에 동일 도메인 그대로

### 5.5 영상 보호
- `lib/secureScreen.ts` 재사용
- `MobileVideoModal`에서 `useEffect`로 `enableSecureScreen()` / `disableSecureScreen()`

## 6. UX 명세

### 6.1 디자인 토큰
- Primary: `#1647A8` (그라데이션 → `#0B2664`)
- Accent: `#FF914D`
- 라운드: 카드 24px, 입력 16px, 칩 30px
- 그림자: `0 4px 12px rgba(15,30,51,0.08)`
- 폰트: Noto Sans KR (한국어) + Inter (영문)
- 본문 14.5px / 16px, 타이틀 22–28px

### 6.2 인터랙션
- 카드 탭 → press 효과(0.96 scale, 100ms)
- 탭바 → 즉시 라우트 전환(prefetch 활용)
- 영상 카드 탭 → 모달 진입(애니메이션 250ms)
- 입력 focus → 가상 키보드 안 가려지게 scroll

### 6.3 접근성
- 터치 타깃 최소 44×44pt
- 색상 대비 WCAG AA
- 입력 라벨 명시, screen reader 친화

## 7. 마이그레이션 / 출시

### 7.1 1차 출시 (v1.0.4 — 본 PRD)
- `/m/*` 라우트 신규 + Capacitor URL 변경
- 데스크톱 웹 영향 X

### 7.2 운영 절차
- 본 변경은 안드로이드 versionCode +1 (3 → 4) 트리거
- PRD `docs/prd/android-app.md` §2/§11 동기화 필수

### 7.3 후속 (v1.0.5+)
- 미팅 예약·가이드·관리자 모바일화
- 푸시 알림(FCM)

## 8. 보안 / 데이터

| 항목 | 처리 |
|---|---|
| 인증 토큰 | `localStorage` (기존과 동일) |
| 비밀번호 | SHA-256 해시 전송 (기존 동일) |
| 영상 캡처 차단 | FLAG_SECURE (기존 동일) |
| 워터마크 | 사용자 이메일 + 시각 (기존 동일) |
| HTTPS | 강제 (기존 `cleartext: false`) |

## 9. 테스트 / 검증

### 9.1 단말 검증
- Pixel 6/7 에뮬레이터 (Android 14)
- 실 디바이스(가능 시) Galaxy / Pixel

### 9.2 회귀 체크리스트
- [ ] 콜드 스타트 → 로그인 화면 정상
- [ ] 회원가입 / 로그인 모두 성공
- [ ] 메인 진입 시 사용자 이름·통계 정상 노출
- [ ] 영상 모달 진입 시 워터마크·FLAG_SECURE 동작
- [ ] 영상 모달 종료 시 스크린샷 다시 가능
- [ ] 게시판 진입 / 좋아요 / 조회수 증가 정상
- [ ] 비행기 모드 → `/offline.html` fallback
- [ ] 탭바 4 탭 모두 정상 전환
- [ ] 안전 영역 노치/펀치홀 침범 없음

### 9.3 시각 회귀
- v1.0.3 스크린샷 mockup과 실제 구현 비교, ±5% 디자인 일치율 목표

## 10. 영향 파일 / 의존성

### 신규
- `app/m/` 전체 트리(layout, page, video, board, _components, _styles)

### 변경
- `capacitor.config.ts` (server.url: `vercel.app` → `vercel.app/m`)
- `android/app/build.gradle` (versionCode 3→4, versionName 1.0.3→1.0.4)
- `docs/prd/android-app.md` (§2 / §11 / §4 신규 모바일 UI 명시)

### 영향 없음
- 기존 `app/page.tsx`, `components/*`, `app/api/*`

### npm 신규 의존성
| 패키지 | 용도 | 필수도 |
|---|---|---|
| (선택) `@capacitor/app` | 백 버튼 리스너 (E3 모달 종료) | 권장 |
| (선택) `framer-motion` | 모달·카드 인터랙션 애니메이션 | 선택 — CSS transition으로 대체 가능 |
| (선택) `react-intersection-observer` | 영상 리스트 lazy load | 선택 — 1차는 단순 페이징 |

**1차 출시는 신규 의존성 0개 권장** — 모두 기존 React + Tailwind + 인라인 스타일로 처리.

### 환경변수 변경
- **추가 없음**
- 기존 `NEXT_PUBLIC_SITE_URL`은 그대로 사용 (메인 도메인). 모바일 라우트는 같은 도메인 하위.
- (선택) `NEXT_PUBLIC_MOBILE_ENABLED=true` 같은 feature flag로 가드 가능 — 1차는 미사용.

## 11. 알려진 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| /m 라우트가 검색엔진에 노출 | SEO 중복 | `robots: noindex` 메타 또는 `manifest.ts` scope 분리 |
| Vercel 빌드 사이즈 증가 | 콜드 스타트 지연 | App Router code-splitting, 동적 import 활용 |
| 데스크톱 사용자가 /m 접근 시 어색 | 혼선 | UA 감지로 데스크톱 → 루트 redirect 또는 안내 배너 |
| 안드로이드 14+ edge-to-edge 강제 | 안전 영역 침범 | `env(safe-area-inset-*)` 필수 |
| 폰트 로딩 깜빡임 | 첫 진입 어색 | `font-display: swap` + 시스템 폰트 fallback |

## 11.5 롤백 절차

### R1. 빌드 단계에서 발견
- `git revert` → 이전 커밋으로 복귀 → 다시 빌드 + `gradlew bundleRelease`
- versionCode는 그대로 4 유지(낮출 수 없음). 같은 4로 새 빌드 가능

### R2. Play Console 비공개 테스트 단계에서 발견
- Play Console → 출시 관리 → **이전 버전 1.0.3 .aab 재업로드**(versionCode 5로 한 칸 더 올려서)
- `/m` 라우트는 Vercel에서 그대로 살아있지만 앱이 접근 안 함 → 영향 X
- Vercel에서 `/m` 경로를 일시 503 처리하면 즉시 차단 가능 (rewrite 또는 `noindex`)

### R3. 운영 중(향후) 발견
- Vercel `vercel.json`의 redirect: `/m/*` → `/` 임시 추가 → 데스크톱 UI로 폴백
- 또는 Capacitor `server.url`을 다시 `vercel.app`(루트)로 되돌려서 versionCode +1 빌드 후 재배포

### R4. 데이터 영향
- DB 변경 없음 → 사용자 데이터 손실 없음
- localStorage 키 변경 없음 → 인증 상태 유지

## 12. 의사결정 우선순위 (Day 1 결정 필요)

1. **승인**: 본 PRD의 §2 정책 결정 8개
2. **승인**: 1차 범위 4화면(인증·메인·영상·게시판)
3. **확인**: 데스크톱 웹 영향 0 정책
4. **승인**: v1.0.4 versionCode 증가 + PRD `android-app.md` 갱신
