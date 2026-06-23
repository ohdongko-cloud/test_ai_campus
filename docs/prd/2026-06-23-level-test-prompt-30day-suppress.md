# PRD: 레벨테스트 재응시 팝업 30일 과노출 차단

- 작성일: 2026-06-23 · 작성자: Claude (요청자: 오너)
- 범위: `app/page.tsx` 레벨테스트 선택 팝업 게이트. 순수 클라이언트. DB/API/마이그레이션 변경 없음.
- 관련: docs/prd/2026-06-22-level-test-entry-choice.md (선택형 진입 팝업)

## 1. 배경/문제
이미 레벨테스트를 1회 응시한 사용자에게도 **로그인/접속마다** "레벨테스트 하세요" 팝업(`AiLevelPrompt`)이 반복 노출된다.
- 게이트(`app/page.tsx:172`): `data.completed === false || data.dueForRetake` 일 때 노출.
- `dueForRetake`는 `ageDays >= 30`으로 이미 올바름([status/route.ts:21](app/api/ai-level-test/status/route.ts:21)).
- 근본원인: 결과 영속이 **베스트에포트**(`catch {}` 무시, [next/route.ts:46](app/api/ai-level-test/next/route.ts:46))라 insert가 조용히 실패하면 `ai_level_attempts` 0건 → status가 영구히 `completed:false` → 매 접속 팝업. 게이트가 누락 가능한 서버 기록만 신뢰.

## 2. 목표/비목표
- G1. 최초 1회 응시 후 **30일 미경과** 시 팝업이 뜨지 않는다(서버 영속 실패 여부와 무관).
- G2. 30일 경과 시에는 기존대로 재측정(retake) 팝업이 정상 노출된다.
- G3. 미응시 사용자에겐 기존대로 first 팝업이 노출된다.
- 비목표: 강제 차단 도입(앱은 계속 fail-open). 서버 영속 로직/스키마 변경(후속 권고로 분리). 모바일(`app/m/*`)은 해당 팝업이 없으므로 범위 외.

## 3. 사용자 시나리오
- S1. A가 오늘 테스트 완료 → 내일 재로그인 → 팝업 안 뜸(30일 이내).
- S2. B가 35일 전 응시 → 접속 → retake 팝업 노출.
- S3. C가 미응시 → 접속 → first 팝업 노출(기존).
- S4. D가 응시했으나 그 순간 DB insert 실패(서버 completed:false) → 그래도 로컬 마커로 30일간 팝업 억제.

## 4. 기능 요구사항
- F1. localStorage 완료 마커 `aiLevelCompletedAt`(epoch ms) 도입. 헬퍼 `markLevelDone(atMs?)` / `recentlyTestedLocally()`(30일 윈도우). localStorage 미가용 시 try/catch 안전(기존 dismiss 헬퍼와 동일 패턴).
- F2. `AiLevelTest onComplete` 시 `markLevelDone()` 호출(완료 시각 기록).
- F3. status fetch에서 `completed:true && latest.at` 이면 마커를 서버 시각으로 동기화(`markLevelDone(new Date(latest.at).getTime())`) — 서버가 소스 오브 트루스, 기기/세션 간 정확성 유지.
- F4. 게이트 조건에 `&& !recentlyTestedLocally()` 추가: 로컬 마커 30일 이내면 팝업 억제. 30일↑/마커없음일 때만 기존 서버 판단(`completed===false || dueForRetake`)대로.
- F5. 재측정 주기 상수 `RETAKE_DAYS = 30`로 클라/서버(status의 `>= 30`)와 일치.

## 5. UX/디자인
- 시각 변경 없음. 팝업 노출 빈도만 감소(완료자 30일 억제).

## 6. 엣지 케이스
| 케이스 | 동작 |
|---|---|
| 서버 completed:true + dueForRetake:false (정상, 30일 이내) | 마커 동기화 후 억제. 팝업 안 뜸 |
| 서버 completed:false (영속 누락) + 로컬 마커 30일 이내 | 억제. 팝업 안 뜸 (핵심 수정) |
| 서버 dueForRetake:true (≥30일) | 마커도 서버 시각(≥30일 전)으로 동기화 → recentlyTested=false → retake 노출 |
| 로컬스토리지 미가용/시크릿모드 | 헬퍼 false 반환 → 서버 판단대로(과노출 가능하나 앱 차단 없음) |
| 마커 값 손상(NaN) | `Number.isFinite` 가드 → false → 서버 판단대로 |
| 같은 날 dismiss | 기존 `dismissedToday()` 유지(중첩 안전) |

## 7. 성공 기준
- [ ] 응시 직후 재접속 시 팝업 미노출(로컬 마커 30일 이내).
- [ ] 서버 status가 completed:false여도(영속 누락 시뮬) 로컬 마커 있으면 미노출.
- [ ] 30일 경과(마커 과거시각) 시 retake 팝업 정상 노출.
- [ ] 미응시(마커 없음) 시 first 팝업 정상 노출.
- [ ] TypeScript 컴파일 에러 없음 + build 통과.

## 8. 미해결 질문 / 후속
- (후속, 별도) 근본 영속 강화: ① prod에 M007 적용 확인(`POST /api/admin/migrate`), ② 완료 시 `users.level_test_done_at`(M005 기존 컬럼) 동시 스탬프 + status 폴백, ③ insert 실패를 Sentry로 가시화. — 본 PRD 범위 외(클라 마커로 UX 즉시 해결).

## 보안/영향
- 순수 클라이언트. 신규 API/PII/DB/env 없음. localStorage에 epoch ms만 저장(PII 아님). §6 정책 영향 없음. 모바일 패리티 영향 없음(해당 팝업 미존재).
