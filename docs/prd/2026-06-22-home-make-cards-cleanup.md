# PRD: 홈 '만들기' 영역 카드 정리

- 작성일: 2026-06-22 · 작성자: Claude (요청자: <오너>)
- 범위: `components/MainPage.tsx` 만들기 섹션(ActionCard) 시각 정리. 로직/DB/API 변경 없음.

## 1. 배경/문제
만들기 카드 하단 메타('운영중'·'10 CATEGORIES·32 SERVICES'·'공식 사이트'·뱃지)가 글씨 과다로 복잡.

## 2. 목표/비목표
- G1. 만들기 카드 하단 메타 영역 전부 삭제.
- G2. 'NOA로 바로 만들기'→'NoA 접속'.
- G3. '필수 도구 둘러보기'→'연계서비스 확인' + 카드 순서 맨 마지막.
- G4. 카드 제목 폰트 확대(18→22).
- 비목표: ActionCard 쓰는 타 섹션(물어보기 등) 변경 없음(만들기만 스코프), 기능/링크 동작 변경 없음.

## 4. 기능 요구사항
- F1. ActionCard에 `hideMeta`·`large` 옵션 추가. `hideMeta`면 하단 메타 div 미렌더, `large`면 제목 22px. `meta` optional화.
- F2. 만들기 4카드에 `hideMeta large` 부여, meta/metaRight 제거.
- F3. 워딩: NoA 접속 / 연계서비스 확인. 순서: NoA → Claude Code → Codex → 연계서비스 확인.

## 6. 엣지
| 케이스 | 동작 |
|---|---|
| ActionCard 타 섹션 사용처 | meta 그대로(옵션 미부여) — 영향 없음 |
| 링크/onClick | 불변(handleNoa·guide 탭·외부 다운로드) |

## 7. 성공기준
- [x] 만들기 카드 메타 영역 제거.
- [x] NoA 접속 / 연계서비스 확인 워딩 + 연계서비스 맨 마지막.
- [x] 제목 폰트 확대.
- [x] tsc + build 통과. (프리뷰 실측: 순서·워딩·메타제거 확인)

## 보안/영향
- 순수 UI. 신규 API/PII/DB/env 없음. 모바일 공용 SPA 동시 적용. 한글 인코딩 정상.
