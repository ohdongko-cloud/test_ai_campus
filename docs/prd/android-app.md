# PRD: 이랜드리테일 AI 캠퍼스 — 안드로이드 앱

- 최초 작성: 2026-05-29
- 최종 갱신: 2026-05-29
- 현재 버전: **versionCode 12 / versionName "1.0.11"**
- 작성자/소유자: <오너> + Claude
- 범위: 안드로이드 앱(Capacitor + WebView) 운영 사양·정책·변경 이력

> **운영 규칙 (필수)**
> 이 문서는 **버전업 시마다 함께 갱신되는 living document**다. `android/app/build.gradle`의 `versionCode` / `versionName`이 바뀌면 반드시:
> 1. 헤더의 "현재 버전", "최종 갱신"
> 2. §11 변경 이력에 새 항목
> 3. 변경된 기능/사양이 있다면 해당 절(§4, §5, §6 등)
> 위 세 군데를 같은 커밋에 포함한다. PR 생성 시 이 PRD 갱신 누락은 차단 사유.

---

## 1. 개요

이랜드리테일 AI 캠퍼스 웹 서비스(https://retail-ai-campus.vercel.app)를 안드로이드 네이티브 앱으로 배포한다. 앱은 WebView 기반(**Capacitor**)으로, 동일 백엔드(Next.js 15 SSR + Neon DB)를 그대로 사용하며 모바일 환경에서의 접근성·보안·푸시(추후)를 확장한다.

| 항목 | 값 |
|---|---|
| 패키징 방식 | Capacitor (WebView + Native Plugin) |
| 호스팅 URL | https://retail-ai-campus.vercel.app |
| 코드 위치 | `android/` (Capacitor 생성), `lib/secureScreen.ts`, `components/SwRegister.tsx`, `public/sw.js`, `public/offline.html`, `public/icon-*.png`, `app/manifest.ts` |
| 빌드 산출물 | `android/app/build/outputs/bundle/release/app-release.aab` |
| Play Console 계정 | ohdongko 보유 |

### 비목표
- React Native·Flutter 등 완전 네이티브 재작성.
- iOS 앱(추후 별도 PRD로 분리).
- 자체 회원 인증 분리(웹 인증을 그대로 사용).

## 2. 현재 버전 (2026-05-29)

| 항목 | 값 |
|---|---|
| versionCode | 12 |
| versionName | 1.0.11 |
| applicationId | `kr.co.eland.aicampus` |
| minSdkVersion | 24 (Android 7.0) |
| compileSdkVersion | 36 |
| targetSdkVersion | 36 |
| Capacitor 버전 | 8.x |
| 배포 상태 | **빌드 완료** (1.0.11 .aab 생성됨, Play Console 업로드 대기) |
| 배포 트랙 | Closed Testing 예정 |
| 산출물 | `android/app/build/outputs/bundle/release/app-release.aab` (1.0.11 ≈ 3.90 MB) |

## 3. 앱 식별 정보

| 항목 | 값 | 변경 가능성 |
|---|---|---|
| 앱 이름 (Play Store) | Eland AI 캠퍼스 | strings.xml 수정으로 변경 가능 |
| 앱 이름 (홈화면) | Eland AI 캠퍼스 | 동일 |
| 짧은 이름 (PWA) | AI 캠퍼스 | `app/manifest.ts` |
| applicationId | `kr.co.eland.aicampus` | **변경 불가** (Play 등록 후) |
| 키스토어 별칭 | `upload` | 변경 불가 (Play App Signing) |
| 아이콘 (1.0.3) | 정식 — 이랜드 블루 그라데이션(#1647A8→#0B2664) + 흰색 "AI" + 우상단 오렌지 액센트(#FF914D) | PWA 3종 + Android mipmap 5단계 × 3장 모두 통일 |

## 4. 기능 사양

### 4.1 외부 URL 로딩 (Capacitor server.url)

- `capacitor.config.ts`의 `server.url = "https://retail-ai-campus.vercel.app"`.
- WebView 스킴: `https`, `cleartext: false`.
- `allowNavigation`: `retail-ai-campus.vercel.app`, `*.vercel.app`.
- **의미**: 모든 화면은 Vercel 운영본을 그대로 로드. 앱 업데이트 없이 콘텐츠 갱신 가능. 대신 **인터넷 연결이 항상 필요**하고 콜드 스타트가 웹 의존.

### 4.2 PWA (Service Worker + Web Manifest)

- `app/manifest.ts` (App Router 표준): `name`, `short_name`, `start_url`, `display: standalone`, `theme_color: #1647A8`, `icons` 3종(192/512/maskable-512).
- `public/sw.js`: navigate 요청 실패 시 `/offline.html` fallback, `_next/static`·아이콘·manifest는 cache-first.
- `components/SwRegister.tsx`: 클라이언트에서 `load` 이벤트 시 SW 등록 (dev 모드 제외).
- `app/layout.tsx`의 `viewport.themeColor`, `metadata.manifest`, `metadata.appleWebApp`도 함께 설정.

### 4.3 영상 화면 캡처 방지 (FLAG_SECURE)

- 네이티브: `SecureScreenPlugin.java` — `@CapacitorPlugin(name="SecureScreen")` + `setSecure({secure: boolean})`. WindowManager.LayoutParams.FLAG_SECURE를 UI 스레드에서 set/clear.
- 등록: `MainActivity.java`의 `onCreate`에서 `registerPlugin(SecureScreenPlugin.class)`.
- 웹: `lib/secureScreen.ts` — `Capacitor.isNativePlatform()` 가드, dynamic import로 SSR 안전.
- 적용 라우트: `components/VideoPage.tsx` — `selectedVideo`가 set일 때만 enable, unset 시 disable (기존 워터마크 정책과 동일 범위).

### 4.4 푸시 알림 (FCM) — **1.0.0 보류**

- 1차 출시에서 제외. Firebase 프로젝트 미생성 상태.
- 추후 진행 시 `@capacitor/push-notifications` + `google-services.json` + `/api/devices` 토큰 저장 API 추가 필요.
- 활성화 시 별도 versionCode 증가 + 본 PRD §4.4 갱신 + §11 변경 이력 기록.

## 5. 보안 정책

| 항목 | 설정 | 위치 |
|---|---|---|
| 사용자 데이터 백업 | 비허용 | `AndroidManifest.xml` `allowBackup="false"` |
| HTTP(평문) 트래픽 | 차단 | `AndroidManifest.xml` `usesCleartextTraffic="false"` + `capacitor.config.ts` `cleartext: false` |
| WebView 디버깅 | 비활성화(릴리즈) | `capacitor.config.ts` `webContentsDebuggingEnabled: false` |
| 영상 캡처/녹화 | 차단(VideoPage 모달에서) | `SecureScreenPlugin` + `useEffect` |
| 워터마크 | 사용자 이메일 + 30초 위치 교체 | 기존 `VideoPage.tsx` |
| 우클릭/단축키 | 차단 | 기존 `VideoPage.tsx` |
| MixedContent | 비허용 | `capacitor.config.ts` `allowMixedContent: false` |

## 6. 배포 정책

### 단계
1. **현재 (1.0.0)**: Play Console **Closed Testing** 트랙으로 출시 → 사내 한정 검증.
2. **이후**: Google Workspace(@eland.co.kr) 조직 인증 완료 후 **Managed Google Play 비공개 앱**으로 전환 — 일반 검색 노출 없이 조직 사용자만 설치.
3. **제외**: 일반 공개(Production) 트랙은 사용하지 않음 — 회원가입에 사내 이메일 제한이 있어 외부 사용자에게 의미 없음.

### Play Console 등록 정보 (1.0.0 기준)
| 항목 | 값 |
|---|---|
| 카테고리 | 교육 |
| 콘텐츠 등급 | 모든 사용자 (IARC 설문 필요) |
| 타겟 사용자층 | 18세 이상 |
| 광고 | 없음 |
| 인앱 결제 | 없음 |
| 개인정보처리방침 URL | `https://retail-ai-campus.vercel.app/privacy` ([app/privacy/page.tsx](../../app/privacy/page.tsx)) |
| 데이터 보안 양식 | 이메일·이름·소속·직무·IP 수집 명시 |

## 7. 빌드 / 서명

### 키스토어
- 위치: `android/app/upload-keystore.jks` (gitignore)
- 별칭: `upload`
- 알고리즘: RSA 2048
- 유효기간: 27.4년 (10000일)
- 생성자: ohdongko (1.0.0 시점)

### keystore.properties
- 위치: `android/keystore.properties` (gitignore)
- 형식: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`
- 템플릿: `android/keystore.properties.example`

### 빌드 명령 (PowerShell)
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\user\AppData\Local\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
Set-Location "C:\Users\user\test_ai_campus\android"
.\gradlew.bat :app:bundleRelease   # release .aab
.\gradlew.bat :app:assembleDebug   # debug .apk (local 테스트)
```

## 8. 파일 구조

```
test_ai_campus/
  capacitor.config.ts             # appId, appName, server.url
  app/
    manifest.ts                   # PWA manifest
    layout.tsx                    # viewport.themeColor, manifest 링크, SwRegister 마운트
  components/
    SwRegister.tsx                # Service Worker 등록(클라이언트)
    VideoPage.tsx                 # FLAG_SECURE useEffect 통합
  lib/
    secureScreen.ts               # Capacitor SecureScreen 브릿지
  public/
    sw.js                         # Service Worker (오프라인 fallback + 정적 캐싱)
    offline.html                  # 오프라인 안내 페이지
    icon-192.png                  # PWA 아이콘 (잠정)
    icon-512.png                  # PWA 아이콘 (잠정)
    icon-maskable-512.png         # PWA maskable (잠정)
  android/
    app/
      build.gradle                # signingConfigs + keystore.properties 로드
      src/main/
        AndroidManifest.xml       # allowBackup=false, usesCleartextTraffic=false
        java/kr/co/eland/aicampus/
          MainActivity.java       # registerPlugin(SecureScreenPlugin.class)
          SecureScreenPlugin.java # FLAG_SECURE set/clear
        res/
          values/
            strings.xml           # "Eland AI 캠퍼스"
            ic_launcher_background.xml  # #1647A8
          mipmap-*dpi/
            ic_launcher.png       # 잠정
            ic_launcher_round.png # 잠정
            ic_launcher_foreground.png  # adaptive icon foreground (잠정)
    keystore.properties.example   # 템플릿
    keystore.properties           # 실 비번 (gitignore)
    app/upload-keystore.jks       # 키스토어 (gitignore)
  docs/prd/
    android-app.md                # 본 PRD (이 파일)
```

## 9. 업데이트 운영 절차

매 버전 출시 시 다음을 순서대로 수행한다.

1. **버전 증가**
   - `android/app/build.gradle`의 `versionCode +1`, `versionName` semver 갱신.
   - Play Store 정책: `versionCode`는 무조건 단조 증가(낮은 값으로 회귀 불가).

2. **변경 내용 코드 반영**
   - 네이티브 변경이 있으면 `npx cap sync android` 실행.
   - Service Worker 변경 시 `public/sw.js`의 `CACHE_VERSION` bump.

3. **본 PRD 갱신** (필수)
   - 헤더의 "현재 버전", "최종 갱신" 날짜.
   - §2 현재 버전 표.
   - 변경된 기능 사양 절(§4, §5, §6 등).
   - **§11 변경 이력**에 새 항목 추가 (날짜 + versionCode/Name + 요약 + 영향 파일).

4. **빌드 & 업로드**
   - `gradlew.bat :app:bundleRelease`.
   - Play Console → 비공개 테스트 (또는 Managed Google Play) → 새 출시 → .aab 업로드 → 출시 메모 작성 → 검토.

5. **회귀 체크리스트** (출시 전)
   - [ ] 앱 콜드 스타트 → 로그인 화면 정상 표시
   - [ ] 회원가입 / 로그인 성공
   - [ ] 영상 모달 진입 시 스크린샷 차단(다른 앱으로 전환·재진입 시 검정 화면 확인)
   - [ ] 영상 모달 종료 시 스크린샷 다시 가능
   - [ ] 미팅 예약·게시판·가이드 진입 정상
   - [ ] 비행기 모드 → `/offline.html` fallback 표시
   - [ ] 홈 아이콘·이름 정상 ("Eland AI 캠퍼스")
   - [ ] 푸시 알림 권한 다이얼로그 (FCM 통합 후부터)

## 10. 알려진 제약 / 리스크

| 항목 | 영향 | 완화 |
|---|---|---|
| 외부 URL 로딩 방식 → 오프라인 시 사용 불가 | 네트워크 없을 때 진입 차단 | `/offline.html` fallback, 추후 핵심 라우트 SW 캐싱 확대 검토 |
| ~~`test-ai-campus.vercel.app` 도메인에 "test" 포함~~ | ~~사용자 인식 부정적 가능~~ | ✅ 해소(v1.0.5) — `retail-ai-campus.vercel.app` 으로 전환. 옛 도메인은 redirect 유지 → v1.0.4 사용자도 안전. |
| FLAG_SECURE는 안드로이드만 차단, iOS·웹은 별도 | iOS 앱 출시 시 별도 구현 필요 | iOS PRD에서 다룸 |
| ~~잠정 아이콘 (한 글자 "E")~~ | ~~Play Store 첫인상 약함~~ | ✅ 해소(v1.0.3) — 정식 그라데이션 + AI 디자인으로 교체 |
| WebView 쿠키·세션 격리 | 일부 디바이스에서 매번 로그인 요구 가능 | `singleTask` launchMode + 쿠키 정책 점검 |
| Capacitor 7 + targetSdk 36 호환 | 새 SDK 정책(예: 백그라운드 제한) 추적 필요 | Google Play 정책 알림 구독 |

## 11. 변경 이력

### v1.0.11 — 2026-06-05 (versionCode-only 재빌드)

**versionCode**: 12 / **versionName**: 1.0.11

- 변경 — 코드/리소스 변경 없음. **versionCode 증가만** 수행.
- 사유 — Play Console에 새 빌드 번호로 등록하기 위함.
- 영향 파일: `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.10 — 2026-06-05 (모바일 UI 미반영 핫픽스 — 비번 정책·비번 재설정·영상 스테이지·첨부)

**versionCode**: 11 / **versionName**: 1.0.10

데스크톱 웹에 추가된 기능 중 모바일 라우트(`/m/*`)에 자동 반영되지 않은 항목을 수동 동기화. 외부 URL 로딩은 데스크톱 라우트만 자동 반영하므로 모바일 컴포넌트는 별도 업데이트 필요했음.

- 수정 — `MobileWelcome` 비밀번호 정책: 8자 → **8~16자 + 영문/숫자/특수문자 각 1개 이상** (`isValidSimplePassword` 헬퍼 적용). 이전엔 모바일 가입 시 서버 거부 가능성.
- 신규 — `MobileWelcome` **비밀번호 재설정 플로우** 2단계 신규 (`reset-verify`, `reset-password`). `/api/users/reset-request`·`/api/users/reset-verify`·`/api/users/reset-password` 연동. 로그인 화면 "비밀번호를 잊으셨나요?" 버튼.
- 신규 — `app/m/video/[id]/page.tsx` **3-탭 구조**: 정보 / 학습 단계 / 자료. 학습 단계는 stages 배열 아코디언, 자료는 `/api/videos/[id]/attachments` lazy fetch + 다운로드 링크.
- 변경 — YouTube embed에 `vq=hd1080` 옵션 추가 (데스크톱 v1.0.8 변경 반영).
- 후속 보류 — v1.0.11: 영상 모달 댓글 탭, 레벨 테스트 모바일 진입점.
- 영향 파일: `app/m/_components/MobileWelcome.tsx`, `app/m/video/[id]/page.tsx`, `android/app/build.gradle`, `docs/prd/android-app.md`.

### v1.0.9 — 2026-06-02 (웹 최신 반영 재빌드 — 마이페이지·비번 재설정·첨부파일·레벨테스트 포함)

**versionCode**: 10 / **versionName**: 1.0.9

- 변경 — 안드로이드 네이티브/모바일 UI 코드 변경 없음. **Play Console에 새 빌드로 등록하기 위한 versionCode 증가**만 수행.
- 사유 — 외부 URL 로딩 방식이라 웹 변경은 자동 반영되지만, 비공개 테스트 트랙에서 "업데이트 있음" 인식을 받기 위해 새 .aab 발행.
- 포함된 웹 개선 (v1.0.8 이후 25+ 커밋):
  - 계정 셀프서비스: 마이페이지(비번 변경/회원 탈퇴), 비밀번호 재설정 UI + API 5종 + DB M003
  - 강의 영상: 첨부파일 업로드/다운로드(Vercel Blob), 스테이지 인라인 이미지, 시청 모달 UX 개선, 기본 보기 리스트로
  - 레벨 테스트: 강의 첫 진입 적응형 1문제씩 + 맞춤 추천
  - 관리자: 영상 드래그&드롭 순서 변경, 토스트 피드백
  - 로그인: 비밀번호 16자 허용
  - 첨부파일 업로드 다수 버그픽스 (FormData multipart, office 파일, 무한 fetch 루프)
- 영향 파일: `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.8 — 2026-05-31 (웹 최신 반영 재빌드)

**versionCode**: 9 / **versionName**: 1.0.8

- 변경 — 안드로이드 네이티브/모바일 UI 코드 변경 없음. **Play Console에 새 빌드로 등록하기 위한 versionCode 증가**만 수행.
- 사유 — 외부 URL 로딩 방식이라 웹 변경은 v1.0.4~v1.0.7 사용자 모두 즉시 반영되지만, 비공개 테스트 트랙에서 사용자가 "업데이트 있음" 인식을 받아 최신 버전을 받도록 새 .aab 발행.
- 의미 — 운영 도메인(retail-ai-campus.vercel.app)에서 그동안 push된 모든 웹 사이드 개선(예: SharePage 레이아웃 변경·SharePage CDN 캐시 우회 등)을 포함한 상태 스냅샷.
- 영향 파일: `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.7 — 2026-05-31 (모바일 미팅·공유 라우트 신규 + 메뉴 카드 정합)

**versionCode**: 8 / **versionName**: 1.0.7

- 수정 — 메뉴 카드 라우팅 버그: "공유" 카드가 `/m/board?tab=share` (게시판으로 잘못 진입) → `/m/share` 로 정합. "질문"만 `/m/board`.
- 신규 — 메뉴 카드 라인업 변경: **학습 / 미팅 / 질문 / 공유** (제작/가이드는 v1.0.8 후속). MENU_GRADIENTS에 `meeting` 추가(sky blue).
- 신규 — `/m/meeting` 페이지: 주차 캘린더(월~금) + 30분 슬롯 + 신청 폼. `MobileMeetingCalendar`, `MobileMeetingForm` 컴포넌트. `/api/reservations`·`/api/blocked-slots` 연동. 자정 경과 자동 갱신.
- 신규 — `/m/share` 페이지: 공유 서비스 카드 목록 + 우하단 FAB(+) → 등록 바텀시트. `MobileServiceCard`, `MobileShareRegisterSheet` 컴포넌트. 비로그인 시 등록 차단. 외부 링크는 `rel="noopener noreferrer"` 강제.
- 영향 — 데스크톱(`/`) 0 영향. PRD: `docs/prd/2026-05-31-android-meeting-share-routes.md`.
- 영향 파일: `app/m/share/page.tsx`(신규), `app/m/meeting/page.tsx`(신규), `app/m/_components/MobileServiceCard.tsx`(신규), `MobileShareRegisterSheet.tsx`(신규), `MobileMeetingCalendar.tsx`(신규), `MobileMeetingForm.tsx`(신규), `MobileMenuCard.tsx`(라우팅/라인업 변경), `app/m/page.tsx`(가이드 fetch 제거), `app/m/_styles/tokens.ts`(meeting 그라데이션), `android/app/build.gradle`, `docs/prd/android-app.md`(본 PRD).

### v1.0.6 — 2026-05-31 (모바일 UI 3건 수정 — 자동로그인·메뉴 카드 실데이터·추천 강의)

**versionCode**: 7 / **versionName**: 1.0.6

- 신규 — `MobileWelcome` 로그인 단계에 **자동로그인 체크박스**(기본 ON, 30일 유지). `/api/users/login` body에 `rememberMe` 전달. 기존 데스크톱 `WelcomePopup`과 동일 정책.
- 변경 — `MobileMenuCard` 4개 카드(학습/제작/질문/공유)의 **하드코딩된 카운트('32강', '18개', '+12 new', '1 예약') 제거** → props로 받음. `app/m/page.tsx`가 `/api/videos`·`/api/guide`·`/api/posts`·`/api/services`를 병렬 fetch 후 실제 길이 주입. 데이터 로딩 전엔 `–` 표시.
- 변경 — **추천 강의를 "필수시청(`isRequired`) 영상 중 조회수 1위"** 로 자동 선정 (`pickFeatured`). 필수시청 영상이 없으면 전체 영상 중 조회수 1위로 폴백. 영상이 0개면 placeholder 표시.
- 영향 — Web/안드로이드 양쪽 모바일 UI 개선. 데스크톱(`/`)은 0 영향. 다음 빌드에서 외부 URL 로딩 방식으로 자동 반영.
- 영향 파일: `app/m/page.tsx`, `app/m/_components/MobileWelcome.tsx`, `app/m/_components/MobileMenuCard.tsx`, `android/app/build.gradle`, `docs/prd/android-app.md`.

### v1.0.5 — 2026-05-29 (운영 도메인 retail-ai-campus.vercel.app 전환)

**versionCode**: 6 / **versionName**: 1.0.5

- 변경 — Capacitor `server.url`을 `https://test-ai-campus.vercel.app/m` → `https://retail-ai-campus.vercel.app/m` 로.
- 변경 — `capacitor.config.ts` `allowNavigation`에 `retail-ai-campus.vercel.app` 등록.
- 변경 — 운영 PRD/메모리/스크립트 일괄 갱신: 본 PRD §1·§2·§3·§4.1·§6·§10·§11, `docs/prd/2026-05-29-android-mobile-ui.md`, `docs/prd/CHANGELOG.md`, `docs/prd/CURRENT-STATE.md`, `memory/project_aicampus.md`, `memory/project_android_strategy.md`, `scripts/load-test.mjs`, `app/layout.tsx` `SITE_URL` fallback, `app/opengraph-image.tsx`.
- 호환 — 옛 도메인 `test-ai-campus.vercel.app`은 Vercel에서 새 도메인으로 redirect 유지 → 이미 설치된 v1.0.4 사용자도 정상 동작.
- Play Console 작업 필요: ① 개인정보처리방침 URL, ② 계정 URL 삭제, ③ 데이터 URL 삭제, ④ 스토어 등록정보 웹사이트 — 모두 새 도메인으로 갱신 + v1.0.5 .aab 업로드.
- 영향 파일: `capacitor.config.ts`, `android/app/build.gradle`, `docs/prd/android-app.md`(본 PRD), 위 동기화 대상 모두.

### v1.0.4 — 2026-05-29 (안드로이드 전용 모바일 UI 신규 라우트 `/m/*`)

**versionCode**: 5 / **versionName**: 1.0.4

- 신규 — 안드로이드 앱 전용 모바일 UI 라우트 `app/m/*` (PRD: `docs/prd/2026-05-29-android-mobile-ui.md`)
  - `app/m/layout.tsx`, `m/page.tsx`(홈), `m/video/page.tsx`(영상 리스트), `m/video/[id]/page.tsx`(시청 모달), `m/board/page.tsx`(게시판), `m/profile/page.tsx`(프로필)
  - `app/m/_components/`: `MobileHeader`·`MobileTabBar`·`MobileWelcome`·`MobileHero`·`MobileMenuCard`·`MobileFeaturedVideo`·`MobileVideoCard`·`MobilePostCard`·`MobileSearchBar`·`MobileToast`
  - `app/m/_styles/tokens.ts` (전용 디자인 토큰)
- 변경 — `capacitor.config.ts` `server.url`을 `vercel.app` → `vercel.app/m` 로. 안드로이드 앱이 자동으로 모바일 UI 진입.
- 변경 — Capacitor 7 → 8 업그레이드 (sync 결과 `@capacitor/app@8.1.0` 인식)
- 신규 npm — `@capacitor/app` (안드로이드 백 버튼 리스너용)
- 의도 — 데스크톱 컴포넌트를 WebView에 그대로 로드하던 v1.0.0~v1.0.3 패턴 해소. PRD의 모바일 우선 디자인을 React로 그대로 구현하여 깨짐·기능 가독성 문제 해결.
- 데스크톱 웹(`/`)은 그대로 유지 — 외부 영향 0.
- 영향 파일: `app/m/**`(15+ 파일), `capacitor.config.ts`, `android/app/build.gradle`, `docs/prd/android-app.md`, `docs/prd/2026-05-29-android-mobile-ui.md`(신규), `package.json`.

### v1.0.3 — 2026-05-29 (정식 아이콘 디자인 통일 + Play Store 마케팅 자산)

**versionCode**: 4 / **versionName**: 1.0.3

- 신규 — Play Store 등록용 마케팅 자산: `public/play-icon-512.png`(앱 아이콘), `public/play-feature-1024x500.png`(피처 그래픽).
- 갱신 — 런처/PWA 아이콘 전체를 잠정 "E" 단순 디자인에서 정식 디자인으로 교체:
  - PWA: `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
  - Android mipmap: `mdpi`(48)/`hdpi`(72)/`xhdpi`(96)/`xxhdpi`(144)/`xxxhdpi`(192) 각 폴더의 `ic_launcher.png`, `ic_launcher_round.png`, `ic_launcher_foreground.png`
- 디자인 — 이랜드 블루 그라데이션 배경(#1647A8 → #0B2664, 135°) + 중앙 흰색 "AI" + 우상단 오렌지 액센트(#FF914D). Adaptive foreground는 안전 영역(중앙 32%)에 "AI"만, Maskable은 오렌지 점 제외(80% safe area 보장).
- 영향 — 안드로이드 런처 리소스 변경이므로 .aab 재빌드 필수. PWA 사용자는 SW 캐시 만료 후 새 아이콘 자동 적용.
- 영향 파일: `public/icon-*.png`(3), `public/play-icon-512.png`(신규), `public/play-feature-1024x500.png`(신규), `android/app/src/main/res/mipmap-*/*.png`(15), `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.2 — 2026-05-29 (계정 삭제 요청 페이지 추가)

**versionCode**: 3 / **versionName**: 1.0.2

- 신규 — `app/account-deletion/page.tsx` 계정 및 데이터 삭제 요청 안내 페이지. Google Play 데이터 보안 정책 3대 요건(앱/개발자명 기재·삭제 절차 명시·삭제/보관 데이터 항목과 기간 명시) 충족.
- URL — `https://retail-ai-campus.vercel.app/account-deletion` (Play Console "계정 URL 삭제" 항목 등록용).
- 영향 — Web(Next.js)에만 신규 라우트 추가. 안드로이드 네이티브 변경 없음(외부 URL 로딩 방식이라 자동 노출). versionCode 증가는 Play Console 신규 빌드 등록용.
- 영향 파일: `app/account-deletion/page.tsx`(신규), `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.1 — 2026-05-29 (개인정보처리방침 페이지 추가)

**versionCode**: 2 / **versionName**: 1.0.1

- 신규 — `app/privacy/page.tsx` 개인정보처리방침 페이지(한국 PIPA 11개 절). URL `/privacy`.
- 갱신 — 본 PRD §6 Play Console 등록정보 표의 "개인정보처리방침 URL" 항목 채움.
- 영향 — Web(Next.js)에만 신규 라우트 추가. 안드로이드 네이티브 코드 변경 없음(외부 URL 로딩 방식이라 자동 노출). versionCode 증가는 Play Console 신규 빌드 등록을 위함.
- 영향 파일: `app/privacy/page.tsx`(신규), `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.0 — 2026-05-29 (초기 빌드 준비)

**versionCode**: 1 / **versionName**: 1.0.0

- 신규 — Capacitor 7 + Android 플랫폼 추가 (`android/`).
- 신규 — Capacitor `server.url` 외부 URL 로딩(retail-ai-campus.vercel.app).
- 신규 — PWA Service Worker, manifest, offline fallback, 아이콘 3종.
- 신규 — Capacitor `SecureScreen` 커스텀 플러그인 + VideoPage 통합(FLAG_SECURE).
- 신규 — AndroidManifest 보안(`allowBackup=false`, `usesCleartextTraffic=false`).
- 신규 — 잠정 런처 아이콘 (#1647A8 배경 + 흰색 "E"), adaptive icon 배경색.
- 신규 — 서명 설정(`signingConfigs.release`), `keystore.properties.example`.
- 보류 — FCM 푸시 알림 (Firebase 프로젝트 별도 준비 후 후속 버전).
- 영향 파일: `capacitor.config.ts`, `package.json`, `app/manifest.ts`, `app/layout.tsx`, `components/SwRegister.tsx`, `components/VideoPage.tsx`, `lib/secureScreen.ts`, `public/sw.js`, `public/offline.html`, `public/icon-*.png`, `android/**`, `.gitignore`.
