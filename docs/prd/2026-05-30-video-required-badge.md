# PRD: 영상 카드 "필수 시청" 뱃지

- 작성일: 2026-05-30
- 작성자: <오너> + Claude
- 관련 시스템: `videos` 테이블, `/api/videos`, `/api/admin/videos`, `VideoPage.tsx`, `AdminVideos.tsx`
- 영향 버전: v1.0-rc → v1.0-rc+1

## 1. 배경

현재 영상 카드(`#videos` 탭)에는 모든 영상이 동일한 가중치로 표시된다. 운영자는 "전 직원 필수 시청" 영상(예: 컴플라이언스, 안전 교육, 신규 정책 안내)을 시각적으로 강조해 우선 시청을 유도하고 싶다.

## 2. 목표 (Goals)

1. 운영자가 관리자 페이지에서 영상별로 "필수 시청" 여부를 토글할 수 있다.
2. 사용자 영상 카드 우측 상단에 빨간 배경 + 노란 글씨의 "필수 시청" 뱃지가 표시된다.
3. 기존 카드 레이아웃, 좋아요/댓글/시청수, 레벨 뱃지 등 다른 요소와 겹치거나 충돌하지 않는다.

## 3. Non-Goals

- 필수 시청 영상에 대한 시청 강제(블로킹), 시청 완료 추적, 미시청자 알림은 본 PRD 범위 밖 (별도 PRD 필요).
- 필수 시청 영상만 모아 보는 별도 필터/탭은 본 PRD 범위 밖.
- 정렬 우선순위 변경(필수 시청을 항상 최상단에 노출하는 등)은 본 PRD 범위 밖.

## 4. UX 사양

### 4.1 사용자 화면 (`VideoPage.tsx`)

| 항목 | 사양 |
|---|---|
| 위치 | 영상 카드 우측 상단 (썸네일 영역 안쪽 우상단) |
| 표시 조건 | `video.isRequired === true` 일 때만 |
| 배경색 | `#E11D2E` (빨강) |
| 글자색 | `#FFD400` (노랑) |
| 문구 | `필수 시청` |
| 폰트 | 11px, 700 weight, letter-spacing -0.01em |
| 패딩/모양 | 4px 8px, border-radius 999 (pill) |
| 그림자 | `0 2px 6px rgba(225,29,46,0.35)` (살짝 떠보이게) |
| z-index | 썸네일 위, 재생 아이콘과는 겹치지 않게 우측 끝 정렬 (top: 8px, right: 8px) |
| 다른 요소와 충돌 | 기존 카메라/이미지 아이콘과 우상단을 공유하지 않음 (이 영상에는 카메라 아이콘 X 또는 좌측으로 이동) |

### 4.2 관리자 화면 (`AdminVideos.tsx`)

**영상 추가 폼**:
- "레벨" 셀렉트 아래에 체크박스 한 줄 추가:
  ```
  [ ] 필수 시청 영상으로 표시 (카드 우측 상단에 빨간 뱃지)
  ```
- 기본값: 체크 해제

**영상 목록 (각 영상 row)**:
- 기존 "편집 / 스테이지 / 삭제" 버튼 좌측에 **"⭐ 필수" 토글 버튼** 추가
  - 활성 시: 빨간 배경 + 노란 글씨 + "⭐ 필수"
  - 비활성 시: 회색 테두리 + "필수 아님"
- 클릭 즉시 PATCH 호출 (낙관적 업데이트 + 실패 시 롤백)

## 5. 데이터 모델

### 5.1 DB 스키마 변경

```sql
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_videos_is_required ON videos(is_required) WHERE is_required = true;
```

- `NOT NULL DEFAULT false`: 기존 row는 모두 false로 채워짐 (안전한 마이그레이션)
- 부분 인덱스: 향후 "필수 시청만 보기" 필터에서 사용 (현 PRD 범위는 아니나 미리 준비)

### 5.2 TypeScript 타입 (`lib/types.ts`)

```ts
export interface Video {
  // ... 기존 필드
  isRequired?: boolean;  // optional — 구버전 클라이언트 호환
}
```

### 5.3 API 응답 매핑

- `GET /api/videos` 응답에 `isRequired: r.is_required` 추가
- `POST /api/admin/videos` body에 `isRequired?: boolean` 허용 → INSERT 시 column 채움
- `PATCH /api/admin/videos/[id]` body whitelist에 `isRequired` 추가

## 6. API 계약 (구체)

### 6.1 GET `/api/videos`

응답 객체에 `isRequired` 추가:
```json
{
  "id": "...",
  "title": "...",
  "isRequired": false
}
```

### 6.2 POST `/api/admin/videos`

요청 body에 선택 필드 추가:
```json
{
  "title": "...",
  "youtubeUrl": "...",
  "level": "기초",
  "isRequired": true
}
```

- 누락 시 기본값 `false`로 처리.
- 타입 가드: `typeof body.isRequired === 'boolean'` 만 허용.

### 6.3 PATCH `/api/admin/videos/[id]`

기존 부분 업데이트 패턴에 한 줄 추가:
```ts
if (typeof body.isRequired === 'boolean') add('is_required', body.isRequired);
```

## 7. 마이그레이션 절차

1. `scripts/apply-video-required-column.mjs` 작성 (기존 `apply-video-tables.mjs` 패턴 따름)
2. 로컬에서 `node scripts/apply-video-required-column.mjs` 실행 → 컬럼 추가 확인
3. Vercel 배포 자동 트리거 (스키마는 멱등성 확보됨)
4. 운영자가 관리자 페이지에서 첫 영상에 필수 토글 → 카드 뱃지 표시 확인

## 8. 보안 / 권한

- `POST /api/admin/videos`, `PATCH /api/admin/videos/[id]` 는 이미 `checkAdmin(req, 'videos')` 가드 적용됨 → 별도 권한 확장 불필요.
- 일반 사용자는 GET만 가능 (변경 X).
- `isRequired` 값 자체는 PII 아님 → 캐시 헤더 `s-maxage=60, stale-while-revalidate=300` 유지.

## 9. 검증 기준 (Acceptance)

- [ ] 마이그레이션 실행 후 `videos.is_required` 컬럼 존재, 모든 row 값 `false`
- [ ] 관리자 페이지 영상 추가 시 체크박스 체크 → DB row `is_required = true` 저장 확인
- [ ] 영상 목록에서 "⭐ 필수" 토글 클릭 → PATCH 200 → 다시 클릭 → false로 돌아옴
- [ ] 사용자 페이지에서 필수 영상 카드 우상단에 빨강+노랑 뱃지 표시
- [ ] 필수 아닌 영상에는 뱃지 없음
- [ ] 빌드 (`npm run build`) 성공, TypeScript 에러 없음
- [ ] 기존 카드의 좋아요/댓글/시청 모달 정상 동작 (회귀 없음)

## 10. 에러 케이스 / 엣지

| 케이스 | 처리 |
|---|---|
| 마이그레이션 전 GET 호출 | `r.is_required` undefined → `isRequired` false로 fallback (`!!r.is_required`) |
| 구버전 클라이언트가 새 API 호출 | `isRequired` 필드 무시 (타입이 optional) |
| 어드민 토글 실패 | 낙관적 업데이트 롤백 + flash 메시지 "필수 시청 변경 실패" |
| 뱃지가 썸네일 안 이미지/로고와 겹침 | `position: absolute; top: 8px; right: 8px; z-index: 5` 로 항상 위에 |

## 11. 텔레메트리 / 로깅

- 별도 추가 없음. 어드민 PATCH는 기존 audit log에 자동 포함됨.

## 12. 작업 분해 (개요)

### 변경 파일 (신규 vs 수정)

| 유형 | 파일 | 변경 내용 |
|---|---|---|
| **신규** | `scripts/apply-video-required-column.mjs` | DB 마이그레이션 스크립트 |
| 수정 | `lib/types.ts` | Video 인터페이스에 `isRequired?: boolean` 추가 |
| 수정 | `app/api/videos/route.ts` | GET 응답에 `isRequired` 매핑 추가 |
| 수정 | `app/api/admin/videos/route.ts` | POST body parse + INSERT 컬럼 추가 |
| 수정 | `app/api/admin/videos/[id]/route.ts` | PATCH whitelist에 `is_required` 추가 |
| 수정 | `components/VideoPage.tsx` | `renderVideoCard` 내부에 뱃지 렌더 |
| 수정 | `components/AdminVideos.tsx` | 추가 폼 체크박스 + 목록 row 토글 버튼 |

### 의존성
- **npm 패키지**: 변경 없음
- **환경변수**: 변경 없음 (`DATABASE_URL`만 사용, 기존)

(세부 태스크는 `/prd-to-tasks` 출력 참조)

## 13. 롤백 플랜

- 컬럼은 `DROP COLUMN`하지 않음 (데이터 손실 방지). 코드 롤백만으로 뱃지 비노출 가능.
- 긴급 시: VideoPage.tsx에서 뱃지 렌더 부분을 `{false && ...}` 로 감싸 즉시 숨김.
