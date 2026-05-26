# PRD: 댓글 한글 깨짐 진단·정리·방어

- 작성일: 2026-05-26
- 작성자: Claude (요청자: ohdongko)
- 범위: DB 일회성 cleanup + API 입력 가드
- 관련 파일: `app/api/videos/[id]/comments/route.ts`, `app/api/comments/route.ts`, `scripts/cleanup-broken-encoding.mjs` (신규)

---

## 1. 배경 / 문제

모바일에서 영상 시청 모달의 댓글이 `�X�T �������` 처럼 표시됨(스크린샷 첨부). 화면 폭/언어와 무관하게 동일.

원인 진단:
- DB 스캔 결과 `video_comments` 한 행에 U+FFFD(replacement character) 다수 포함.
- 다른 8개 테이블에는 손상 데이터 없음.
- 모바일/PC 브라우저는 `fetch`로 JSON을 전송 → Next.js가 UTF-8로 정상 파싱.
- 따라서 원인은 **Claude가 이전 스모크 테스트 시 Windows bash + curl로 한글 페이로드를 보낸 것**. Windows 콘솔 CP949 바이트가 UTF-8로 해석되며 손상.

→ **데이터 1행만 문제**이며 향후 동일 사고를 막을 가드가 필요함.

## 2. 목표 / 비목표

### 목표
- G1. DB의 손상 댓글 1행 삭제(또는 정상화).
- G2. 향후 어떤 경로로든 U+FFFD를 포함한 텍스트가 댓글/게시판/예약 등에 저장되지 않도록 서버 측 입력 가드 추가.
- G3. 사용자 측은 코드 변경 없이 정상 입력 가능 — 정상 입력 흐름은 영향 없음.

### 비목표
- 댓글 인코딩 변환 시도(이미 손상되어 복원 불가).
- 클라이언트 측 validation (서버에서 막으면 충분).
- 다른 인코딩(EUC-KR 등) 지원.

## 3. 사용자 시나리오

### S1. 모바일에서 한글 댓글 작성
1. 모바일에서 영상 시청 모달 → 한글 댓글 입력 → 등록.
2. 정상적으로 저장되고 다른 사람에게 그대로 한글로 표시. (현재도 정상 동작 — 이 흐름은 변경 없음.)

### S2. 손상 데이터 자동 정리
1. 배포 후 정리 스크립트가 즉시 실행되어 손상 1행 삭제.
2. 다음 페이지 로드 시 댓글 카운트가 1 감소하고, 깨진 댓글이 사라짐.

### S3. 향후 손상 데이터 차단
1. 어떤 클라이언트가 (예: 잘못된 curl 테스트) U+FFFD를 포함한 본문을 POST.
2. 서버는 400 응답 + 메시지 "지원하지 않는 문자가 포함되어 있습니다."
3. DB에는 저장 안 됨.

## 4. 기능 요구사항

### F1. 손상 데이터 정리 스크립트
- `scripts/cleanup-broken-encoding.mjs` 신규 작성.
- DB의 다음 컬럼들에서 U+FFFD를 포함한 row를 DELETE 또는 soft-delete:
  - `video_comments.content` → 행 삭제 + `video_stats.comments_count` 감소
  - `comments.content` (게시판) → soft delete (`is_deleted = true`)
  - `posts.title/content` → soft delete
  - `videos.title/description` → 로그만 (관리자 수동 처리)
  - `reservations.name/task_summary/inquiry` → 로그만
  - `shared_services.service_name/description` → 로그만
- 멱등(여러 번 실행해도 안전).
- 결과 출력: 삭제/soft-delete된 행 수 + 수동 확인 필요 항목 목록.

### F2. 서버 입력 가드
- 헬퍼 `lib/text-validation.ts` 신규:
  - `containsReplacementChar(s: string): boolean` — U+FFFD 포함 여부.
  - `assertCleanText(s: string, fieldName: string)` — throw if contains replacement char.
- 적용 대상 API (텍스트 받는 POST/PATCH):
  - `POST /api/videos/[id]/comments` — content
  - `POST /api/comments` — content
  - `POST /api/posts` — title/content
  - `POST /api/reservations` — 모든 텍스트 필드
  - `POST /api/admin/services` — service_name/description
  - `POST /api/admin/videos`, `PATCH /api/admin/videos/[id]` — title/description
- 검증 실패 시 400 + `{ error: '지원하지 않는 문자가 포함되어 있습니다.' }`.

### F3. 즉시 정리 실행
- 이 PR 머지/배포 후 즉시 로컬에서 cleanup 스크립트 1회 실행.

## 5. 데이터 / 스키마 변경

- 신규 테이블/컬럼 없음. 단순 DELETE/UPDATE.
- 마이그레이션 SQL 불필요.

## 6. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| 손상 댓글이 인기 글의 댓글이라 다른 사용자가 좋아요 누름 | 좋아요 carousel 없음, 단순 삭제 가능 |
| video_comments 삭제로 video_stats.comments_count 음수 | `GREATEST(0, ...)` 가드 |
| 클라이언트가 의도적으로 U+FFFD를 입력 (예: 이모지 fallback) | 거부. 일반 사용자는 입력 못 함(키보드에 없음). |
| 본문 내용에 합법적인 �가 포함되어야 하는 케이스 | 없음. 거부해도 됨. |

## 7. 보안 / 권한

- cleanup 스크립트는 로컬에서만 실행. 운영자가 직접 트리거.
- API 가드는 단순 입력 검증 — 별도 권한 변경 없음.

## 8. 성공 기준 / 테스트

- [ ] `node scripts/cleanup-broken-encoding.mjs` 실행 시 손상 1행 삭제.
- [ ] 모바일/PC 브라우저에서 영상 모달 열면 더 이상 깨진 댓글 안 보임.
- [ ] 정상 한글 댓글 작성/조회 정상.
- [ ] U+FFFD를 포함한 curl POST → 400 응답.
- [ ] `npm run build` 성공.

## 9. 롤아웃

1. 코드 push.
2. Vercel 자동 배포.
3. 로컬에서 cleanup 스크립트 실행 (운영 DB에 직접 영향).
4. 모바일에서 확인.

## 10. 미해결 질문

없음.
