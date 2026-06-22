# PRD: 홈 전 영역 카드 하단 메타 정리

- 작성일: 2026-06-22 · 작성자: Claude (요청자: <오너>)
- 범위: `components/MainPage.tsx` 배우기·물어보기·자랑하기 카드 하단 메타 제거. #23(만들기) 후속 확장.

## 1. 배경/문제
#23에서 만들기 카드 하단 메타를 제거했으나 배우기(FeaturedCard)·물어보기(ActionCard×2)·자랑하기(WideCard)에는 메타('42 lessons·3 levels'·'5 mentors'·'N posts this week'·아바타·HOT/추천 뱃지 등)가 남아 글씨 과다·복잡.

## 2. 목표/비목표
- G1. 배우기·물어보기·자랑하기 카드 하단 메타 영역 전부 삭제(만들기와 동일).
- G2. 메타 전용으로만 쓰이던 죽은 데이터 흐름(예약슬롯·게시판통계·공유수 fetch/state) + 미사용 Badge·LiveDot 정리.
- 비목표: 카드 onClick/링크·이동 동작 변경 없음. 신규 API/DB/PII/env 없음.

## 4. 기능 요구사항
- F1. FeaturedCard·WideCard에 `hideMeta` 옵션 추가(+meta/metaLeft optional). `hideMeta`면 하단 메타 div 미렌더.
- F2. 배우기 FeaturedCard·자랑하기 WideCard에 `hideMeta`, 물어보기 ActionCard 2개에 `hideMeta large` 부여 + meta/metaRight/metaLeft 제거.
- F3. 메타에서만 쓰이던 `availableSlots`·`boardStats`·`shareCount` state와 `/api/reservations`·`/api/services`·`/api/stats` fetch useEffect 제거, 미사용 `Badge`·`LiveDot`·`getWeekDates`·`useEffect` import 제거.

## 6. 엣지
| 케이스 | 동작 |
|---|---|
| ActionCard 만들기 사용처 | 기존 `hideMeta large` 그대로 — 영향 없음 |
| 모바일 `app/m/*` | 동일 메타 슬롯 없음 → 패리티 작업 불필요 |
| 죽은 fetch 제거 | 홈 진입 시 불필요한 DB API 3콜 사라짐(성능 소폭↑) |

## 7. 성공기준
- [x] 배우기·물어보기·자랑하기 카드 메타 영역 제거.
- [x] 죽은 fetch/state·미사용 컴포넌트·import 제거.
- [x] tsc + build 통과.

## 보안/영향
- 순수 UI + 죽은 코드 제거. 신규 API/PII/DB/env 없음. 한글 인코딩 정상.
