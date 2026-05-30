# PRD: 이랜드리테일 AI 캠퍼스 — 안드로이드 앱

- 최초 작성: 2026-05-29
- 최종 갱신: 2026-05-29
- 현재 버전: **versionCode 2 / versionName "1.0.1"**
- 작성자/소유자: ohdongko + Claude
- 범위: 안드로이드 앱(Capacitor + WebView) 운영 사양·정책·변경 이력

> **운영 규칙 (필수)**
> 이 문서는 **버전업 시마다 함께 갱신되는 living document**다. `android/app/build.gradle`의 `versionCode` / `versionName`이 바뀌면 반드시:
> 1. 헤더의 "현재 버전", "최종 갱신"
> 2. §11 변경 이력에 새 항목
> 3. 변경된 기능/사양이 있다면 해당 절(§4, §5, §6 등)
> 위 세 군데를 같은 커밋에 포함한다. PR 생성 시 이 PRD 갱신 누락은 차단 사유.

---

## 1. 개요

이랜드리테일 AI 캠퍼스 웹 서비스(https://test-ai-campus.vercel.app)를 안드로이드 네이티브 앱으로 배포한다. 앱은 WebView 기반(**Capacitor**)으로, 동일 백엔드(Next.js 15 SSR + Neon DB)를 그대로 사용하며 모바일 환경에서의 접근성·보안·푸시(추후)를 확장한다.

| 항목 | 값 |
|---|---|
| 패키징 방식 | Capacitor (WebView + Native Plugin) |
| 호스팅 URL | https://test-ai-campus.vercel.app |
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
| versionCode | 2 |
| versionName | 1.0.1 |
| applicationId | `kr.co.eland.aicampus` |
| minSdkVersion | 24 (Android 7.0) |
| compileSdkVersion | 36 |
| targetSdkVersion | 36 |
| Capacitor 버전 | 7.x |
| 배포 상태 | **빌드 완료** (1.0.1 .aab 생성됨, Play Console 업로드 대기) |
| 배포 트랙 | Closed Testing 예정 |
| 산출물 | `android/app/build/outputs/bundle/release/app-release.aab` (1.0.1 ≈ 2.95 MB) |

## 3. 앱 식별 정보

| 항목 | 값 | 변경 가능성 |
|---|---|---|
| 앱 이름 (Play Store) | Eland AI 캠퍼스 | strings.xml 수정으로 변경 가능 |
| 앱 이름 (홈화면) | Eland AI 캠퍼스 | 동일 |
| 짧은 이름 (PWA) | AI 캠퍼스 | `app/manifest.ts` |
| applicationId | `kr.co.eland.aicampus` | **변경 불가** (Play 등록 후) |
| 키스토어 별칭 | `upload` | 변경 불가 (Play App Signing) |
| 아이콘 (1.0.0) | 잠정 — `#1647A8` 배경 + 흰색 "E" | 정식 디자인으로 추후 교체 |

## 4. 기능 사양

### 4.1 외부 URL 로딩 (Capacitor server.url)

- `capacitor.config.ts`의 `server.url = "https://test-ai-campus.vercel.app"`.
- WebView 스킴: `https`, `cleartext: false`.
- `allowNavigation`: `test-ai-campus.vercel.app`, `*.vercel.app`.
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
| 개인정보처리방침 URL | `https://test-ai-campus.vercel.app/privacy` ([app/privacy/page.tsx](../../app/privacy/page.tsx)) |
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
| `test-ai-campus.vercel.app` 도메인에 "test" 포함 | 사용자 인식 부정적 가능 | 정식 도메인(예: `aicampus.eland.co.kr`) 발급 후 server.url 교체 + versionCode 증가 |
| FLAG_SECURE는 안드로이드만 차단, iOS·웹은 별도 | iOS 앱 출시 시 별도 구현 필요 | iOS PRD에서 다룸 |
| 잠정 아이콘 (한 글자 "E") | Play Store 첫인상 약함 | 정식 디자인 확정 후 교체 (versionCode 증가) |
| WebView 쿠키·세션 격리 | 일부 디바이스에서 매번 로그인 요구 가능 | `singleTask` launchMode + 쿠키 정책 점검 |
| Capacitor 7 + targetSdk 36 호환 | 새 SDK 정책(예: 백그라운드 제한) 추적 필요 | Google Play 정책 알림 구독 |

## 11. 변경 이력

### v1.0.1 — 2026-05-29 (개인정보처리방침 페이지 추가)

**versionCode**: 2 / **versionName**: 1.0.1

- 신규 — `app/privacy/page.tsx` 개인정보처리방침 페이지(한국 PIPA 11개 절). URL `/privacy`.
- 갱신 — 본 PRD §6 Play Console 등록정보 표의 "개인정보처리방침 URL" 항목 채움.
- 영향 — Web(Next.js)에만 신규 라우트 추가. 안드로이드 네이티브 코드 변경 없음(외부 URL 로딩 방식이라 자동 노출). versionCode 증가는 Play Console 신규 빌드 등록을 위함.
- 영향 파일: `app/privacy/page.tsx`(신규), `android/app/build.gradle`(versionCode/Name), `docs/prd/android-app.md`(본 PRD).

### v1.0.0 — 2026-05-29 (초기 빌드 준비)

**versionCode**: 1 / **versionName**: 1.0.0

- 신규 — Capacitor 7 + Android 플랫폼 추가 (`android/`).
- 신규 — Capacitor `server.url` 외부 URL 로딩(test-ai-campus.vercel.app).
- 신규 — PWA Service Worker, manifest, offline fallback, 아이콘 3종.
- 신규 — Capacitor `SecureScreen` 커스텀 플러그인 + VideoPage 통합(FLAG_SECURE).
- 신규 — AndroidManifest 보안(`allowBackup=false`, `usesCleartextTraffic=false`).
- 신규 — 잠정 런처 아이콘 (#1647A8 배경 + 흰색 "E"), adaptive icon 배경색.
- 신규 — 서명 설정(`signingConfigs.release`), `keystore.properties.example`.
- 보류 — FCM 푸시 알림 (Firebase 프로젝트 별도 준비 후 후속 버전).
- 영향 파일: `capacitor.config.ts`, `package.json`, `app/manifest.ts`, `app/layout.tsx`, `components/SwRegister.tsx`, `components/VideoPage.tsx`, `lib/secureScreen.ts`, `public/sw.js`, `public/offline.html`, `public/icon-*.png`, `android/**`, `.gitignore`.
