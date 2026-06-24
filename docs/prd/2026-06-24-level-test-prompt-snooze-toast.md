# PRD: 레벨진단 팝업 — 30일 스누즈 버튼 + 진단자 토스트 전환

- 작성일: 2026-06-24 · 작성자: Claude (요청자: 오너)
- 범위: `app/page.tsx` 게이트 + `components/AiLevelPrompt.tsx`. 순수 클라이언트. DB/API/마이그레이션 변경 없음.
- 관련: docs/prd/2026-06-23-level-test-prompt-30day-suppress.md, 2026-06-22-level-test-entry-choice.md

## 1. 배경/문제
30일 억제 1차 적용 후에도 접속마다 레벨진단 **모달**이 계속 뜸. 원인: 사용자 계정이 미응시(서버 completed:false)면 첫 진단 유도 모달이 노출되는데, '먼저 둘러보기'(onLater)는 **당일(dismissToday)** 억제뿐이라 다음날 재노출. 또 이미 진단한 사용자에게도 30일 후 모달이 다시 뜨는 구조라 과하다는 피드백.

## 2. 목표/비목표
- G1. 팝업에 **'30일간 보지 않기'** 버튼 추가 → 클릭 시 30일 스누즈(localStorage).
- G2. **이미 진단한 사용자는 모달 영구 미노출.** 재측정 시기(30일 경과)는 **토스트**(비모달, 하루 1회)로만 안내.
- G3. 모달은 **서버가 명시적으로 미응시(completed:false)**일 때만 노출(모호/파싱실패 시 미노출).
- 비목표: 강제 차단(fail-open 유지). 서버 영속/스키마 변경. 모바일(`app/m/*`)은 해당 팝업 없음 → 범위 외.

## 3. 사용자 시나리오
- S1. 미진단자 접속 → 모달 → '30일간 보지 않기' → 이후 30일간 모달 안 뜸.
- S2. 미진단자 → '먼저 둘러보기' → 당일만 억제(기존), 다음날 다시 권유.
- S3. 진단 완료자 재접속 → **모달 안 뜸**. 30일 경과 시 화면 하단 토스트 "30일 지났어요, 다시 진단?" (하루 1회).
- S4. 토스트의 '진단하기' → 레벨테스트 진입. 완주 시 마커 갱신 → 다시 30일 무알림.

## 4. 기능 요구사항
- F1. 헬퍼: `snoozePromptFor30Days()`/`promptSnoozed()`(localStorage `aiLevelPromptSnoozedUntil`, 30일). `localCompletedAtMs()`(완료 마커 raw ts). `retakeToastShownToday()`/`markRetakeToastShown()`(localStorage `aiLevelRetakeToastShownAt`, 하루 1회).
- F2. 게이트: `hasTested = 서버 completed:true || 로컬 완료 마커 보유`.
  - `hasTested` → 모달 미노출. `overdue(서버 dueForRetake || 로컬 30일 경과)` && 오늘 토스트 미표시면 토스트.
  - `!hasTested && 서버 completed:false` → 스누즈/오늘dismiss 아니면 모달('first').
- F3. `AiLevelPrompt`에 `onSnooze` prop + '30일간 보지 않기' 텍스트 버튼.
- F4. 재측정 토스트 엘리먼트(하단 중앙 비모달, '진단하기'/닫기, 9초 자동 숨김).
- F5. 완료(onComplete) 시 `markLevelDone()`(기존 유지) → 이후 모달 미노출 보장.

## 5. UX/디자인
- 모달: 기존 2버튼 아래 '30일간 보지 않기' 밑줄 텍스트 링크(저강조).
- 토스트: 네이비 pill, 하단 중앙, z-index 55(모달 60보다 아래), 9초 후 사라짐.

## 6. 엣지 케이스
| 케이스 | 동작 |
|---|---|
| 서버 completed:true·dueForRetake:false | 모달X·토스트X (무알림) |
| 서버 completed:true·dueForRetake:true | 토스트만(하루1회) |
| 서버 completed:false·로컬마커 없음 | 모달(스누즈/오늘dismiss 아니면) |
| 서버 completed:false·로컬마커 30일 이내 | hasTested=true → 모달X, 토스트X |
| 서버 completed:false·로컬마커 30일 경과 | 토스트만 |
| 서버 파싱실패(data={}) | 모달X·토스트X (보수적) |
| localStorage 미가용/시크릿모드 | 헬퍼 안전 false → 모달 노출 가능(앱 차단 없음) |
| 스누즈 값 손상(NaN) | `Number.isFinite` 가드 → 미스누즈 처리 |

## 7. 성공 기준
- [ ] 모달에 '30일간 보지 않기' 노출, 클릭 시 30일간 모달 미노출.
- [ ] 진단 완료(로컬 마커 보유) 계정은 모달이 다시 뜨지 않음.
- [ ] 30일 경과 시 모달 대신 토스트로만 안내(하루 1회).
- [ ] TypeScript 컴파일 에러 없음 + build 통과.

## 8. 미해결/후속
- (후속, 별도) 서버 영속 강화: 완료 시 `users.level_test_done_at` 스탬프 + status 폴백, insert 실패 Sentry. 본 PRD는 클라 UX 한정.

## 보안/영향
- 순수 클라이언트. 신규 API/PII/DB/env 없음. localStorage에 ts/날짜 문자열만(PII 아님). §6 영향 없음. 모바일 패리티 영향 없음.
