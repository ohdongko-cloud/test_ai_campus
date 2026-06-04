# PRD: 영상 카드 썸네일 + 좋아요 + 댓글

- 작성일: 2026-05-26
- 작성자: Claude (요청자: <오너>)
- 관련 파일: [components/VideoPage.tsx](../../components/VideoPage.tsx), [supabase/schema.sql](../../supabase/schema.sql), `app/api/videos/...` (신규)
- 범위: 클라이언트 UI + Neon DB (스키마 확장) + Next.js API 라우트 신규

---

## 1. 배경 / 문제

현재 영상 목록 페이지(`VideoPage`)의 카드는 색상 패턴만 표시되어 어떤 영상인지 시각적으로 식별이 어렵다. YouTube 썸네일을 가져올 수 있는데도 활용하지 않고 있다.

또한 학습자가 콘텐츠에 대해 **반응(좋아요)** 하거나 **질문/의견**을 남길 수단이 없다. 게시판으로 가서 별도 글을 쓰면 영상 컨텍스트가 사라진다. 인기 영상 / 의견 누적이 영상 단위로 집계되지 않아 운영진 입장에서도 콘텐츠 효과 측정이 어렵다.

## 2. 목표 / 비목표

### 목표
- G1. 각 영상 카드 썸네일을 YouTube 영상의 실제 썸네일 이미지로 표시한다.
- G2. 각 카드에 좋아요 버튼(❤ + 카운트)을 노출하고, 클릭으로 toggle 한다. 로그인 없이 세션 기반.
- G3. 각 카드에 댓글 개수(💬 N)를 노출한다. 영상 시청 모달에서 댓글 스레드를 보고 작성/삭제할 수 있다.
- G4. 좋아요/댓글 데이터는 모든 사용자에게 공통(서버 DB)으로 보인다.

### 비목표
- 실시간 동기화(WebSocket, polling).
- 댓글 대댓글(1-depth만).
- 좋아요 누른 사람 목록.
- 인기 영상 정렬(이번 PR에서는 기존 정렬 유지; 데이터는 쌓아두고 추후 정렬 옵션 추가).
- 영상 자체의 DB 이관 (현재 videos는 localStorage에 유지. 좋아요/댓글은 `video_id` 문자열로 느슨하게 참조).

## 3. 사용자 시나리오

### S1. 썸네일
1. 학습자가 영상 목록 페이지 접속.
2. 각 카드 상단의 16:9 영역에 해당 YouTube 영상의 썸네일이 표시된다.
3. 썸네일이 없는 영상(이미지 404)이면 기존 색상 패턴 + 재생 아이콘 fallback이 표시된다.

### S2. 좋아요
1. 학습자가 카드 하단의 ❤ 버튼 클릭.
2. 버튼이 채워진 빨간 ♥ 로 바뀌고 카운트가 +1 된다.
3. 다시 클릭하면 카운트 -1 (toggle).
4. 같은 브라우저(세션)에서 새로고침해도 좋아요 상태가 유지된다.
5. 다른 브라우저에서 봐도 누적 카운트는 동일하게 보인다.

### S3. 댓글
1. 학습자가 카드를 클릭 → 영상 시청 모달.
2. 모달 하단(학습 단계 아래)에 "댓글" 섹션이 표시된다. 가장 위에 작성 폼(내용 input + 비밀번호 input + 등록 버튼).
3. 그 아래로 댓글 목록이 최신순 표시 (작성자 표기 없음 — 익명, 게시판 패턴 유지).
4. 등록하면 즉시 목록 상단에 추가되고 카드의 💬 카운트도 +1 된다.
5. 본인 댓글 삭제 시: 댓글 우측의 "삭제" → 비밀번호 입력 모달 → 일치하면 soft delete (`is_deleted = true`, 본문 "삭제된 댓글입니다." 표시).

## 4. 기능 요구사항

### F1. 카드 썸네일
- F1.1. `extractVideoId(youtubeUrl)`로 video ID 추출.
- F1.2. 썸네일 URL: `https://img.youtube.com/vi/${id}/hqdefault.jpg` (480x360, 무료, 인증 불필요). `maxresdefault`는 영상마다 존재 여부가 다르므로 `hqdefault`로 통일(모든 영상에 존재 보장).
- F1.3. 이미지 로드 실패 시(`onError`) 기존 색상 패턴 + 재생 아이콘 fallback. fallback 상태는 카드별 useState로 관리.
- F1.4. 16:9 강제 (`aspectRatio: '16/9'`, `object-fit: cover`).
- F1.5. 카드 호버 시 미세한 zoom-in (transform scale 1.04, transition .25s).
- F1.6. 시청 모달의 iframe 영역은 변경 없음.

### F2. 좋아요
- F2.1. DB 신규 테이블: `video_likes (video_id TEXT, session_id TEXT, liked_at TIMESTAMPTZ DEFAULT now(), UNIQUE(video_id, session_id))`. PK는 `(video_id, session_id)` 복합 또는 별도 `id UUID`. 게시판 패턴 따라 `id UUID PRIMARY KEY` + UNIQUE 제약.
- F2.2. 카운트 캐시 테이블: `video_stats (video_id TEXT PRIMARY KEY, likes_count INTEGER NOT NULL DEFAULT 0, comments_count INTEGER NOT NULL DEFAULT 0)`. 좋아요/댓글 추가/삭제 시 함께 update. 첫 좋아요/댓글 시 자동 upsert.
- F2.3. API: `POST /api/videos/[id]/like` body `{ sessionId, action: 'like'|'unlike' }` → 응답 `{ likes_count, liked }`. 게시판의 like 엔드포인트와 동일 패턴.
- F2.4. API: `GET /api/videos/stats?ids=1,2,3` → 응답 `[{ video_id, likes_count, comments_count, liked }]`. `liked`는 요청 쿼리에 `sessionId`가 있을 때만 채움. 카드 목록 일괄 조회용.
- F2.5. 카드 UI: 카드 하단 "시청하기" 라인 위에 `♡/❤ N` 와 `💬 N` 인디케이터. 좋아요 버튼만 클릭 가능(stopPropagation), 댓글 카운트는 표시만(클릭 시 카드 클릭과 동일하게 모달 오픈).
- F2.6. 세션 ID: 기존 BoardPage의 `_board_session` localStorage 키를 공용으로 사용. 새 헬퍼 `getSessionId()`를 `lib/utils.ts`로 이동.
- F2.7. 좋아요 클릭 시 optimistic UI(즉시 상태 반영), API 실패 시 롤백.

### F3. 댓글
- F3.1. DB 신규 테이블: `video_comments (id UUID PK, video_id TEXT NOT NULL, content TEXT NOT NULL, password_hash TEXT, is_deleted BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now())`. 트리거 `set_updated_at` 재사용.
- F3.2. API:
  - `GET /api/videos/[id]/comments` → 댓글 배열 (오래된 순).
  - `POST /api/videos/[id]/comments` body `{ content, password? }` → 생성. `video_stats.comments_count++`.
  - `DELETE /api/videos/comments/[commentId]` body `{ password }` → 비번 일치 시 soft delete + `comments_count--`. (게시판은 동일 라우트 패턴 사용; 새 라우트 그룹 안에 둠.)
- F3.3. 모달 UI: 학습 단계 아코디언 아래 "댓글 (N)" 섹션. 작성 폼(내용 textarea 2줄 + 비번 input + 등록 버튼) → 댓글 리스트.
- F3.4. 댓글 작성: 내용 trim 후 빈 문자열이면 등록 버튼 disabled. 비밀번호는 선택(없으면 삭제 불가). 등록 후 폼 초기화.
- F3.5. 댓글 삭제: "삭제" 버튼 → prompt로 비번 입력 → API 호출. 실패 시 토스트. soft delete된 댓글은 "삭제된 댓글입니다." 회색 텍스트로 노출.
- F3.6. 댓글 좋아요는 이번 범위에서 제외.

## 5. UX/디자인

### 카드 (F1+F2)
```
┌──────────────────────────┐
│                          │
│   [YouTube 썸네일 이미지]   │  ← 16:9, object-fit:cover, hover scale
│                          │
├──────────────────────────┤
│ [기초] 조회 12   2단계         │
│ AI란 무엇인가 — 기초 개념     │
│ AI의 기본 개념과...           │
├──────────────────────────┤
│ ❤ 8   💬 3        시청하기 → │  ← 좋아요/댓글 인디케이터 행
└──────────────────────────┘
```

### 모달 댓글 섹션 (F3)
```
─── 학습 단계 (기존) ───

─────────────────────────
댓글 3
[ 댓글을 남겨주세요...      ]
[ 비밀번호(선택) ] [등록]
─────────────────────────
[댓글 본문]          2026-05-26 15:32
                            [삭제]
─────────────────────────
...
```

## 6. 데이터 / 스키마 변경

### 신규 테이블 SQL (supabase/schema.sql에 append)
```sql
-- video_stats: 카운트 캐시
CREATE TABLE IF NOT EXISTS video_stats (
  video_id        TEXT PRIMARY KEY,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER video_stats_updated_at
  BEFORE UPDATE ON video_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- video_likes
CREATE TABLE IF NOT EXISTS video_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  liked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, session_id)
);

CREATE INDEX IF NOT EXISTS video_likes_video_idx ON video_likes (video_id);

-- video_comments
CREATE TABLE IF NOT EXISTS video_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      TEXT NOT NULL,
  content       TEXT NOT NULL,
  password_hash TEXT,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_comments_video_idx ON video_comments (video_id, created_at);

CREATE TRIGGER video_comments_updated_at
  BEFORE UPDATE ON video_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- 기존 `posts/comments` 스키마 변경 없음.
- 마이그레이션 실행: `node --env-file=.env.local scripts/apply-schema.mjs` (idempotent, 기존 헬퍼 재사용).
- 백필: 신규 테이블이므로 기존 데이터 없음. videos는 localStorage에 그대로.

## 7. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| `extractVideoId` 결과 없음 | fallback (색상 패턴 + 재생 아이콘). `img.youtube.com` 호출 안 함. |
| 썸네일 이미지 404 | `onError` 핸들러로 fallback 전환. |
| `video_stats`에 행이 없는 영상 | `GET /api/videos/stats?ids=...`에서 빈 행은 `{likes_count:0, comments_count:0, liked:false}`로 채움. |
| 좋아요 빠른 더블 클릭 | 클라이언트 측 disable + optimistic, 서버는 ON CONFLICT DO NOTHING이라 중복 안전. |
| API 5xx 실패 | optimistic UI 롤백 + 토스트 "잠시 후 다시 시도해주세요". |
| 댓글 내용 1만자 초과 | 클라이언트 maxlength 1000 + 서버 trim 후 길이 검증 (1000자 초과 시 400). |
| 비밀번호 없이 등록한 댓글 | 삭제 시도 시 "비밀번호가 없는 댓글입니다" 안내, 삭제 불가. |
| 비번 불일치 삭제 시도 | 401 + 토스트 "비밀번호가 일치하지 않습니다." |
| videos에 존재하지 않는 `id`로 좋아요/댓글 시도 | 서버는 FK 없이 작동(영상 자체가 localStorage 기반). 데이터는 저장되나 클라이언트에서 보이지 않음 — 허용. |
| 영상 삭제 시 (관리자 액션) | `video_likes`/`video_comments`는 그대로 남음. 다시 같은 id로 영상이 생기면 카운트가 살아남(예외 케이스 — 운영상 무시). 추후 정리는 별도 cron. |
| XSS | 댓글은 React가 자동 escape. dangerouslySetInnerHTML 미사용. |

## 8. 보안 / 권한

- 좋아요/댓글 작성에 로그인 불필요(현재 시스템과 동일).
- 세션 ID는 localStorage 기반(추측 가능하지만 위협 모델상 허용).
- 댓글 비밀번호는 SHA-256 해시(게시판 패턴 따름). 평문 저장 금지.
- 댓글 본문 XSS는 React 텍스트 노드로 안전.
- Rate limiting은 이번 PR 범위 외 — 추후 별도.

## 9. 성공 기준 / 테스트

### 수동 테스트
- [ ] 영상 카드에 YouTube 썸네일이 표시됨. 잘못된 URL의 영상은 fallback 패턴.
- [ ] 좋아요 버튼 클릭 → 카운트 +1, 빨간 ♥로 채워짐. 새로고침해도 유지.
- [ ] 다시 클릭 → -1, 빈 ♡로 돌아옴.
- [ ] 다른 브라우저(시크릿 창)에서 같은 영상 카운트가 동일하게 보임.
- [ ] 카드 클릭 → 모달 → "댓글" 섹션 표시.
- [ ] 댓글 작성 → 즉시 목록 상단 노출, 카드의 💬 카운트 +1 반영.
- [ ] 비번으로 본인 댓글 삭제 → "삭제된 댓글입니다." 노출, 카운트 -1.
- [ ] 비번 틀린 삭제 → 토스트 에러.

### 코드 검증
- [ ] `npm run build` 성공.
- [ ] 신규 API 모두 200/4xx 응답 케이스 확인 (curl로 스모크).

## 10. 롤아웃 / 마이그레이션

1. 코드 push (단일 PR 단위).
2. `scripts/apply-schema.mjs`로 Neon에 신규 테이블 생성 (idempotent, 기존 테이블 영향 없음).
3. Vercel 자동 빌드/배포.
4. 환경변수 변경 없음.

롤백: 신규 라우트만 제거(직전 커밋 revert). DB 테이블은 남겨도 무방.

## 11. 미해결 질문

- 카드 좋아요/댓글 카운트 표기 위치: "기초 / 조회 12 / 2단계" 라인 옆 vs 카드 하단 별도 라인. **결정**: 카드 하단 별도 라인(시청하기 위, 좌측). 시각적 분리·확장성 우선.
- 댓글 정렬: 오래된 순 vs 최신 순. **결정**: 등록 직후 노출 보장을 위해 **최신 순(내림차순)**. 게시판은 오래된 순이지만 영상 댓글은 양이 적을 것으로 가정.
- 댓글 작성자명: 현재 익명. **결정**: 게시판과 동일 익명. 추후 회원 시스템과 연동 시 확장.
