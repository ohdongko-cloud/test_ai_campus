# PRD: AI 레벨테스트 진입 완화 — "지금 응시 vs 먼저 둘러보기" 선택

- 작성일: 2026-06-22
- 작성자: Claude (요청자: <오너>)
- 범위: 클라이언트 진입 게이트 변경(app/page.tsx) + 선택 팝업 컴포넌트 신규 + AiLevelTest 중도 이탈(onExit). DB/마이그레이션/env 변경 없음.

---

## 1. 배경 / 문제
현재 로그인 후 AI 레벨테스트가 **100% 강제**다 — `/api/ai-level-test/status`가 미완료(`completed:false`)이거나 월 재측정 도래(`dueForRetake`)면 `app/page.tsx`가 앱 전체를 `<AiLevelTest>` 화면으로 막아 **완료 전엔 둘러볼 수 없다**(스킵 불가). 신규 사용자가 서비스를 살펴보기도 전에 진단을 강요받아 진입 마찰이 크다.

## 2. 목표 / 비목표
### 목표
- G1. 로그인 직후 **선택 팝업**으로 "지금 레벨 진단 / 먼저 둘러보기"를 묻는다.
- G2. "먼저 둘러보기" 선택 시 **앱을 막지 않고** 정상 이용하게 한다.
- G3. **하루 1회** 재유도(오늘 둘러보기 선택 시 그날은 다시 안 물음, 다음날 재노출).
- G4. **완전 선택형** — 영구 미응시 허용. 어떤 경로로도 앱을 강제 차단하지 않음. 지속 유도는 홈 배너(기구현).
- G5. **월 재측정(dueForRetake)** 도래 시에도 동일하게 팝업으로 묻는다(강제 아님).

### 비목표
- 레벨테스트 문항·채점·점수 로직 변경(현행 유지).
- 서버 상태/DB 변경(재유도 기억은 클라이언트 localStorage).
- 관리자 강제 정책 토글(추후). 안드로이드 전용 분기.
- 영구/유예후강제 모드(이번엔 **완전 선택형 확정**).

## 3. 사용자 시나리오
### S1. 신규/미완료 사용자 — 둘러보기
1. 로그인 → 선택 팝업: "지금 레벨 진단하기 / 먼저 둘러보기".
2. "먼저 둘러보기" → 팝업 닫힘, 홈 진입. 오늘은 다시 안 물음.
3. 다음날 첫 진입 → 팝업 재노출. (영구히 안 해도 막히지 않음)

### S2. 지금 응시
1. 팝업에서 "지금 레벨 진단하기" → 전체화면 레벨테스트.
2. 완료 → 결과·레벨 반영(기존). 이후 팝업 없음(완료자).
3. (도중) "나중에 하기" → 오늘 dismiss + 홈 진입.

### S3. 월 재측정
1. 30일 경과(`dueForRetake`) → 로그인 시 팝업("이번 달 재측정 / 나중에").
2. "나중에" → 오늘 dismiss, 다음날 재노출. 완전 선택형이라 강제 없음.

### S4. 배너로 시작 (둘러본 뒤)
1. 둘러보기 선택한 미완료 사용자 → 홈 배너 "내 AI 활용 레벨 진단하기"가 상시 입구.
2. 클릭 → 레벨테스트 시작(기존 onRetake 경로).

## 4. 기능 요구사항
### F1. 진입 선택 팝업 (`components/AiLevelPrompt.tsx` 신규)
- 모달 오버레이(WelcomePopup류, 앱 위 딤). **전체화면 차단 아님**.
- 버튼 2개: `지금 레벨 진단하기`(primary) / `먼저 둘러보기`(secondary).
- 카피 분기: 최초/미완료 = "내 AI 활용 레벨을 진단해보세요(1~2분)". 재측정(`dueForRetake`) = "이번 달 AI 레벨 재측정 시기예요".
- props: `{ mode: 'first' | 'retake'; onStart: () => void; onLater: () => void }`.

### F2. 게이트 로직 변경 (`app/page.tsx`)
- 기존 status useEffect에서 `setLevelTestNeeded(true)` 무조건 호출 제거.
- `shouldPrompt = (data.completed === false || data.dueForRetake)` 이고 **오늘 dismiss 안 됨**이면 `setLevelPromptOpen(true)` + `promptMode`(retake 여부) 설정.
- 팝업 `onStart` → `setLevelPromptOpen(false); setLevelTestNeeded(true)`(기존 전체화면 테스트 재사용).
- 팝업 `onLater` → `setLevelPromptOpen(false); dismissToday()`.
- 팝업은 메인 return의 모달 오버레이로 렌더(`levelPromptOpen && userInfo && !isAdmin && !showWelcome`).

### F3. 하루 1회 재유도 (localStorage)
- 키 `aiLevelPromptDismissedAt` = `YYYY-MM-DD`(로컬 날짜). `dismissToday()`가 오늘로 set.
- status 체크 시 `dismissed === todayStr`면 팝업 미노출. 다음날 자동 재노출.
- localStorage 미가용(시크릿/차단)이면 매 진입 노출(허용, 차단보다 안전).

### F4. 완전 선택형 — 강제 없음
- 어떤 경우에도 `levelTestNeeded`를 사용자 선택 없이 true로 두지 않음(팝업의 onStart에서만).
- 미완료 영구 허용. 지속 유도 = 홈 배너(`MainPage` levelInfo=null → "진단하기", onRetake로 시작 — 기구현).

### F5. 테스트 중도 이탈 (`AiLevelTest` onExit)
- `AiLevelTest`에 선택적 `onExit?: () => void` prop 추가. 있으면 문항/코딩 단계 상단에 "나중에 하기" 텍스트 버튼 노출.
- `app/page.tsx`는 `onExit={() => { setLevelTestNeeded(false); dismissToday(); }}` 전달 → 중도 이탈 시 오늘 dismiss + 홈.
- 결과 화면의 "시작하기"(onComplete)는 기존 유지.

### F6. 월 재측정 동일 적용
- `dueForRetake`도 F1~F4 동일 경로(팝업·하루1회·완전선택). 카피만 retake. 강제 없음.

## 5. UX / 디자인
- 팝업: 중앙 카드(maxWidth ~420), 아이콘 + 제목 + 1줄 설명 + 2버튼(세로 또는 가로). 닫기(X)는 "먼저 둘러보기"와 동일 동작(=onLater)로 처리하거나 생략.
- 기존 게이트(전체화면 테스트)는 "지금" 선택 시에만 등장 — 시각적 일관 유지.
- 모바일에서도 카드 모달 그대로(공용 app/page SPA). 한글 인코딩 가드 준수.

## 6. 엣지 케이스
| 케이스 | 동작 |
|---|---|
| 오늘 이미 "둘러보기" 후 재진입 | 팝업 미노출, 홈 바로 |
| 완료자 & 재측정 미도래 | 팝업 없음(배너만 "내 AI 레벨 Lv N") |
| 어드민 모드 | 팝업/게이트 없음(기존 조건 유지) |
| status 조회 실패(오프라인) | 팝업 안 띄움(앱 차단 방지, fail-open) |
| 시크릿창/localStorage 차단 | 매 진입 팝업(허용) |
| 테스트 도중 "나중에 하기" | 오늘 dismiss + 홈 |
| 재측정 도래자가 매일 "나중에" | 매일 1회 묻되 강제 안 함(완전 선택형) |
| 둘러본 미완료자가 배너 클릭 | 레벨테스트 시작(onRetake) |
| 같은 날 자정 경과 | 날짜 문자열 변경 → 재노출(의도) |

## 7. 성공 기준
- [ ] 로그인 후 미완료/재측정 도래 시 **선택 팝업(2버튼)** 노출, 앱이 막히지 않음.
- [ ] "먼저 둘러보기" → 앱 이용 가능, **같은 날 재진입 시 팝업 미노출**, 다음날 재노출.
- [ ] "지금 진단" → 전체화면 테스트 → 완료 시 레벨 반영, 이후 팝업 없음.
- [ ] 테스트 도중 "나중에 하기" → 홈 복귀 + 오늘 dismiss.
- [ ] **완전 선택형**: 영구 미응시해도 앱 차단 없음. 배너가 상시 입구.
- [ ] 월 재측정도 팝업(강제 아님).
- [ ] `npx tsc --noEmit` + `npm run build` 통과.

## 8. 미해결 질문
- 없음 (재유도=하루1회 / 의무=완전선택형 / UI=팝업 / 재측정=물어보기 — 2026-06-22 확정).

---

## 보안 / 영향 (CLAUDE.md §6 / 특화 체크 9)
- **PII/권한**: 변경은 클라이언트 진입 게이트 + localStorage. 새 API/PII/권한 없음. status는 기존 세션 기반.
- **DB 마이그레이션**: 없음(재유도는 localStorage).
- **모바일/안드로이드**: `app/page.tsx` 공용 SPA — PC/모바일 동시. `app/m/*` 별도 라우트는 영향 없음(웹 로직). versionCode 불요.
- **한글 인코딩 가드**: 팝업 한글 카피 안전 입력.
- **에러 통일/캐시**: status는 no-store(기존). 게이트 fail-open 유지.
- **env/시크릿**: 변경 없음.
