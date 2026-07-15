# PRD: 강의 영상 단독 페이지화 (팝업 → 공유 가능한 URL)

- 작성일: 2026-07-15 · 작성자: Claude (요청자: 오너)
- 범위: 데스크톱 강의 영상 시청을 **팝업(모달) 제거 → 영상별 단독 페이지 `/video/[id]`** 로 전환. URL 복사·공유로 특정 영상에 바로 접속. 신규 `GET /api/videos/[id]`. 모바일 `/m/video/[id]`(기존)에 링크 복사 추가. **DB 스키마 변경 없음.**
- 확정 결정(2026-07-15): ① **팝업 제거·페이지 전환**(목록 클릭 시 `/video/{id}` 이동) ② **로그인 필수** — 비로그인은 리다이렉트가 아니라 페이지 내 "로그인 후 시청" 게이트 + 로그인 후 `?next`로 원영상 복귀 ③ **링크 미리보기 = 썸네일+제목 OG 카드** — `generateMetadata`는 공개(쿠키 없는 스크래퍼도 카드 렌더), 재생은 로그인 게이트.

## 1. 배경/문제
현재 데스크톱 영상은 `components/VideoPage.tsx`의 **React 상태(`selectedVideo`) 팝업**으로만 열린다([VideoPage.tsx:447](../../components/VideoPage.tsx), [:1275](../../components/VideoPage.tsx)). 어떤 영상을 열어도 **주소창은 `/#videos` 그대로** → 특정 영상을 가리키는 URL이 없어 **복사·공유·딥링크가 불가능**하고, 새로고침하면 열린 영상이 사라진다. 반면 모바일은 이미 영상별 라우트 `/m/video/[id]`가 있다([app/m/video/[id]/page.tsx](../../app/m/video/[id]/page.tsx)). 데스크톱도 같은 패턴으로 전환해 **"강의 링크를 복사해서 사람들에게 공유 → 클릭하면 그 영상이 열리는"** 사용 흐름을 만든다.

## 2. 목표/비목표
- G1. 데스크톱에서 영상 카드 클릭 시 **팝업 대신 `/video/{id}` 단독 페이지**로 이동(팝업 제거).
- G2. 각 영상이 **고유 URL**을 가져 그대로 복사·공유하면 해당 영상이 열린다.
- G3. **로그인 필수** — 비로그인 접속은 페이지 내 로그인 게이트(제목·썸네일 노출, 재생 차단) + 로그인 후 `?next=/video/{id}`로 자동 복귀.
- G4. **링크 미리보기** — 카톡·팀즈·메일에 붙이면 **영상 제목 + 유튜브 썸네일** OG 카드 노출.
- G5. **영상 보호 패리티** — 현행 모달의 워터마크(실이메일)·우클릭/단축키 차단·외부이동 오버레이·FLAG_SECURE·'사내 한정' 문구를 페이지에 그대로 이식.
- G6. **기능 패리티** — 학습 단계·자료(로그인)·댓글·좋아요·조회수를 현행 모달과 동일하게 페이지에서 제공.
- G7. **데스크톱·모바일 패리티** — 공유 canonical URL은 `/video/{id}`(반응형, 폰에서도 열림), 모바일 `/m/video/[id]`에도 '링크 복사' 추가.
- 비목표: 새 DB 컬럼/테이블(videos.id 재사용). 영상별 세밀 권한(레벨/부서 제한) — 로그인 여부만. 재생 시간 이어보기·진도율 저장. 유튜브 외 스토리지. 팝업 UX를 페이지에 100% 재현(크기 3단 토글 등 페이지에선 불필요 → 전체화면만 유지). SEO 색인(사내 자료라 `noindex`).

## 3. 사용자 시나리오
- S1. 회원이 강의 목록에서 영상 클릭 → `/video/{id}` 페이지로 이동, 영상 재생. 주소창에 고유 URL.
- S2. 회원이 페이지의 **'링크 복사'** 버튼 클릭 → `https://retail-ai-campus.vercel.app/video/{id}` 복사 → 동료에게 카톡/메일로 공유.
- S3. 동료가 링크 클릭(비로그인) → 페이지에 제목·썸네일과 **"로그인 후 시청" 게이트** → 로그인 → 자동으로 그 영상으로 복귀해 재생.
- S4. 누군가 링크를 카톡 대화창에 붙임 → **제목 + 썸네일 미리보기 카드**가 뜸.
- S5. 삭제/오타 링크 접속 → "영상을 찾을 수 없습니다" 404 안내.
- S6. 모바일 사용자가 `/video/{id}`(또는 `/m/video/{id}`) 접속 → 반응형으로 정상 재생, 링크 복사 가능.

## 4. 기능 요구사항
- F1. **라우트 신설** `app/video/[id]/page.tsx` (**Server Component**). `params.id`는 모바일과 동일하게 `decodeURIComponent`. 쿠키를 읽어 **동적 렌더**(정적/CDN 캐시 금지).
- F2. **단일 영상 조회**: 서버 헬퍼 `getVideoById(id)` — Neon 직접 파라미터화 쿼리(`WHERE id = ${id}`), `GET /api/videos` 목록의 컬럼·폴백(duration/attachment_count 누락 환경) 미러링, 없으면 `null`. 공개 API **`GET /api/videos/[id]/route.ts`** 도 신설(단건, 목록과 동일 필드·PII 없음, 미존재 404, 에러 통일). 페이지/`generateMetadata`는 `getVideoById` 직접 사용(HTTP 홉 없음).
- F3. **OG 메타** `generateMetadata({ params })`: 영상 있으면 `title`, `description`(설명 첫 줄), `openGraph.images = https://img.youtube.com/vi/{ytid}/mqdefault.jpg`(`extractVideoId`), `robots: noindex`. 없으면 일반 메타. **인증과 무관하게 항상 반환** → 스크래퍼(쿠키 없음)도 카드 렌더.
- F4. **로그인 게이트(페이지 내, 리다이렉트 아님)**: 서버에서 `getCurrentUser()`(`lib/session.ts`) 조회. **비로그인** → 플레이어 자리에 게이트(제목·썸네일 blur·자물쇠·"이 영상은 로그인 후 시청할 수 있습니다"·**[로그인]** → `/login?next=/video/{encodeURIComponent(id)}`) 렌더, 200 응답. **로그인** → 플레이어 + 워터마크(서버 JWT 이메일) 렌더. 로그인 페이지의 `sanitizeNext`가 오픈리다이렉트 방지(기존).
- F5. **시청 클라 컴포넌트** `components/VideoWatch.tsx` (`'use client'`) — 현행 모달 기능 패리티: YouTube iframe(**동일 파라미터** `autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&playsinline=1&fs=0&enablejsapi=1`), **4모서리 워터마크**(서버 이메일 · 30초 위치 swap), **외부이동 차단 4오버레이** + 우클릭/단축키 차단(`blockContext`/`blockShortcuts`), **FLAG_SECURE**(`enableSecureScreen`/`disableSecureScreen`), '사내 한정 · 외부 유출 금지' 안내, **탭**(학습 단계 / 자료(로그인 401→안내) / 댓글), **좋아요**, **전체화면**, 조회수 +1(`POST /api/videos/{id}/view`), **'링크 복사'**(canonical `/video/{id}`). props: `video`, `watermarkEmail`. 기존 `/api/videos/{id}/{comments,like,attachments,view}` 재사용.
- F6. **목록 → 페이지 이동(팝업 제거)**: `VideoPage.tsx`의 `handleWatch`를 `router.push('/video/{encodeURIComponent(id)}')`로 교체. **`selectedVideo` 영상 모달 블록 제거** + 그에 딸린 죽은 상태·핸들러(modalSize·isFullscreen·sidebar·댓글/첨부/워터마크/secureScreen 등) 정리. **강의 요청·레벨 테스트 모달은 유지**(별개 기능). 카드 렌더러(`renderVideoCard`/`renderVideoListItem`)의 조회수 optimistic +1은 페이지 진입 후 view가 처리하므로 단순화.
- F7. **모바일 패리티**: 공유 canonical = `/video/{id}`(반응형). 모바일 `app/m/video/[id]/page.tsx`에 **'링크 복사'** 버튼 추가(canonical `/video/{id}` 복사). 모바일 파일 변경 동반 시 **Capacitor `versionCode` 증가**.
- F8. **에러/캐시/PII**: 페이지는 동적(no CDN cache) → 사용자별 워터마크 HTML이 공유되지 않음. `GET /api/videos/[id]`는 PII 없음(목록과 동일 필드). 모든 catch → `"서버 오류가 발생했습니다."`. 신규 한글 문자열 **U+FFFD 손상 없음**.

## 5. UX/디자인
- **페이지 레이아웃(데스크톱)**: 중앙 정렬 `max-width` 컨테이너. 상단 바(← 목록으로 `/#videos` · 제목 · **링크 복사**) → **16:9 플레이어**(워터마크·보호 오버레이) → 하단 **탭**(정보 / 학습 단계 / 자료 / 댓글). 팝업의 크기 3단 토글은 페이지에선 불필요(넓은 지면) → **전체화면 버튼만 유지**. 배경은 현행 데스크톱 톤(밝은 서피스) 또는 모달과 동일한 다크 플레이어 프레임.
- **로그인 게이트**: 플레이어 자리에 유튜브 썸네일(blur) + 자물쇠 + "이 영상은 이랜드리테일 임직원 전용입니다. 로그인 후 시청하세요." + **[로그인]** 버튼(`/login?next=…`).
- **링크 복사**: `navigator.clipboard.writeText(canonical)`(실패 시 textarea 폴백, 기존 `copyStageDescription` 패턴 재사용) → "링크가 복사되었습니다" 토스트.
- **'외부 유출 금지' 문구 조화**: 링크 공유는 **사내 배포 목적**이므로 문구는 "**사내 임직원 전용 · 외부 유출/재배포 금지**"(영상 콘텐츠 재배포 금지의 뜻)로 유지. 미리보기 카드의 썸네일은 **유튜브에 이미 공개된 썸네일**이라 신규 유출이 아님.
- **404**: "영상을 찾을 수 없습니다 · 목록으로" 링크.
- 한글 인코딩 정상.

## 6. 엣지 케이스
| 케이스 | 동작 |
|---|---|
| 존재하지 않는/삭제된 id | `getVideoById`=null → `notFound()`(404 "영상을 찾을 수 없습니다") |
| 비로그인 사람 접속 | 페이지 내 로그인 게이트(제목·썸네일·[로그인]), OG 메타는 노출, 200 |
| 스크래퍼(쿠키 없음) 프리뷰 요청 | 200 + OG(제목·썸네일), 재생 없음 → 카드 정상 렌더 |
| 로그인 후 복귀 | `?next=/video/{id}` → `sanitizeNext` 통과 → 원영상 복귀 |
| `next`에 오픈리다이렉트 시도(`//evil`, `scheme:`) | 기존 `sanitizeNext`가 `/`로 폴백(차단) |
| youtubeUrl 파싱 실패(id 없음) | "영상 ID 없음" placeholder, 페이지 자체는 렌더 |
| 자료(첨부) 탭, 비로그인/세션만료 | 기존과 동일 401 → "로그인이 필요합니다" 안내 |
| 모바일에서 `/video/{id}` 접속 | 반응형 렌더(정상 재생) |
| CDN 캐시로 워터마크 유출 | 페이지 동적/no-store → 사용자간 공유 안 됨 |
| 삭제된 영상의 orphan 통계/댓글(FK 없음) | 페이지는 통계 존재 가정 안 함(0/빈 처리) |
| Capacitor 안드로이드 백버튼 | 모바일 페이지 기존 `router.back` 유지 |
| Capacitor versionCode | 모바일 파일 변경 동반 시 증가 |

## 7. 성공 기준
- [ ] 영상 카드 클릭 → `/video/{id}` 페이지 이동(**팝업 없음**), 주소창 URL이 영상별 고유.
- [ ] 그 URL을 복사→새 창/시크릿에 붙이면 **해당 영상**이 로드.
- [ ] 비로그인 접속 → 로그인 게이트 → 로그인 후 **원영상으로 복귀**(`?next`).
- [ ] 로그인 시 플레이어 + 워터마크(**실이메일**) + 보호 오버레이 + FLAG_SECURE + '사내 한정' 문구.
- [ ] 학습 단계 / 자료(로그인) / 댓글 / 좋아요 / 조회수 = 현행 모달과 동일 동작.
- [ ] 링크를 카톡/팀즈/메일에 붙이면 **제목 + 썸네일 미리보기 카드**.
- [ ] `GET /api/videos/[id]`: 존재 200 / 미존재 404, **PII 없음**, 에러 통일.
- [ ] 데스크톱·모바일(`/video/{id}` 반응형, `/m/video/{id}` 링크 복사) 동작.
- [ ] **TypeScript 컴파일 에러 없음 + build 통과.**

## 8. 미해결/후속
- 데스크톱 페이지 레이아웃: MVP는 **단일 컬럼(넓은 플레이어 + 탭)** 로 간다. 팝업의 좌(영상)·우(학습단계 사이드바) 2분할 재현은 공수·리스크 커서 후속(원하면 조정).
- `VideoWatch.tsx`는 모달 본문을 **신규 컴포넌트로 이식**한다(모달 IIFE는 지역 핸들러 ~30개에 결합돼 그대로 추출 불가). 장기적으로 데스크톱 목록/모바일 페이지가 이 컴포넌트를 공유하도록 리팩터는 별도 PRD.
- `GET /api/videos/[id]` 캐시: PII 없으니 목록처럼 `s-maxage` 공개 캐시 허용. 단 **페이지(워터마크)는 no-store**.
- OG 썸네일 = 유튜브 `mqdefault`(공개) 사용 확정. 사내 정책상 추가 확인 불요(이미 공개 썸네일).
- 기존 hash 라우팅(뒤로가기/딥링크)과의 상호작용: 페이지에서 '목록으로'는 `/#videos` 이동.

## 의존성/사전조건
- **신규 env 없음 · 신규 외부 서비스 없음 · 선행 차단 PRD 없음.** 전부 기존 자산 재사용:
  - 인증/세션: `getCurrentUser()`([lib/session.ts](../../lib/session.ts)) · JWT([lib/jwt.ts](../../lib/jwt.ts)) · 로그인 `?next` + `sanitizeNext`([app/login/page.tsx](../../app/login/page.tsx)).
  - 데이터: `sql`([lib/db.ts](../../lib/db.ts)) · 기존 액션 API `/api/videos/{id}/{view,like,comments,attachments}`.
  - 유틸: `extractVideoId`([lib/utils.ts](../../lib/utils.ts)) · `enableSecureScreen`/`disableSecureScreen`([lib/secureScreen.ts](../../lib/secureScreen.ts)) · `Video`/`VideoStage` 타입([lib/types.ts](../../lib/types.ts)).
- 신규 `GET /api/videos/[id]`는 읽기 전용·PII 없음이라 별도 레이트리밋 불요(§6-5는 쓰기/인증 대상). 조회수 증가는 기존 `POST /api/videos/{id}/view`의 레이트리밋을 따른다.

## 보안/영향 (CLAUDE.md §6 · 특화 9 매핑)
- **인증/권한(§6-3,4 · 특화 #3)**: 페이지 로그인 게이트(서버 `getCurrentUser`), `?next`는 `sanitizeNext`로 오픈리다이렉트 방지(§7.1 기존). 워터마크 = **서버 JWT 이메일**(localStorage 아님 → 시크릿/시크릿브라우저에서도 정합).
- **PII 보호(§6-7 · 특화 #1)**: 페이지 **동적/no-store**(사용자별 워터마크 유출 방지), `GET /api/videos/[id]` 응답 PII 없음, 로그·Sentry에 PII 금지.
- **영상 보호(§6-9 · 특화)**: 워터마크·우클릭/단축키 차단·외부이동 4오버레이·FLAG_SECURE·'사내 한정' 문구를 **페이지에 전부 이식**(누락 시 페이지가 유출구가 됨).
- **캐시 정합성(특화 #7)**: 페이지 no-store로 CDN `s-maxage` 우회.
- **에러 통일(§6-8)**: 신규 API/페이지 catch → `"서버 오류가 발생했습니다."`.
- **모바일 패리티(특화 #4)**: `/video/{id}` 반응형 + `/m/video/{id}` 링크 복사, versionCode↑(모바일 파일 변경 동반 시).
- **한글 인코딩(특화 #6)**: 신규 한글 문자열 U+FFFD 차단.
- **DB 마이그레이션(특화 #2)**: **변경 없음**(videos.id 재사용) → 마이그레이션 불요.
- **빌드 게이트(특화 #8)**: `npx tsc --noEmit` + `npm run build` 통과.
