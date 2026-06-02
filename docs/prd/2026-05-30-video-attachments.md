# PRD: 강의 영상 첨부파일 업로드 / 다운로드

- 작성일: 2026-05-30
- 작성자: ohdongko + Claude
- 관련 시스템: `videos` 테이블, `components/AdminVideos.tsx`, `components/VideoPage.tsx`
- 영향 버전: v1.0-rc → v1.0-rc+1
- 상태: **DRAFT — 사용자 컨펌 대기**

## 1. 배경

현재 강의 영상은 YouTube 임베드 + 스테이지(학습 단계) 텍스트만 제공. 운영 중 다음 니즈가 생김:

1. 강의에 사용된 **PPT / PDF 보조자료** 첨부
2. 실습용 **샘플 코드 (zip / 텍스트)** 배포
3. 영상에서 언급된 **참고 문서** 다운로드 제공

→ 어드민이 영상 등록 시 첨부파일을 같이 올리고, 회원은 영상 시청 모달에서 다운로드 가능하게.

## 2. 목표

1. 어드민이 영상별로 첨부파일 추가/삭제 가능
2. 회원이 영상 모달에서 첨부파일 목록 + 다운로드 (사내 한정, 로그인 필수)
3. 외부 유출 추적을 위한 다운로드 로그

## 3. Non-Goals

- 일반 회원이 직접 첨부파일 업로드 (어드민만)
- 첨부파일 인라인 미리보기(PDF Viewer 등) — v2
- 영상 외부(가이드/공유/게시판) 첨부 — v2

## 4. UI 프리뷰 (컨펌 필요 ⭐)

### 4.1 어드민 — 영상 관리 페이지

각 영상 row의 기존 버튼 옆에 **"📎 첨부 (N)"** 버튼 추가:

```
영상 row (현재):
┌──────────────────────────────────────────────────────────────────┐
│ ▲▼ 1 [기초▼] AI 업무 자동화 사내교육... 12회  [⭐필수][편집][스테이지][삭제] │
└──────────────────────────────────────────────────────────────────┘

영상 row (수정 후):
┌────────────────────────────────────────────────────────────────────────────┐
│ ▲▼ 1 [기초▼] AI 업무 자동화 사내교육... 12회  [⭐필수][편집][스테이지][📎첨부 2][삭제] │
└────────────────────────────────────────────────────────────────────────────┘
```

"📎 첨부 N" 클릭 시 — 영상 row 아래로 **인라인 패널** 펼침 (스테이지 편집 패널과 동일 패턴):

```
┌──────────────────────────────────────────────────────────────────┐
│ 📎 첨부파일 관리                                                  │
├──────────────────────────────────────────────────────────────────┤
│ ▢ ai-automation-script.pdf   2.1 MB  2026-05-30   [다운][삭제]    │
│ ▢ sample-code.zip            580 KB   2026-05-30   [다운][삭제]    │
├──────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────┐  │
│ │  📎 파일을 여기로 드래그하거나                                │  │
│ │     [파일 선택] 버튼을 클릭하세요                            │  │
│ │     (PDF/PPT/DOCX/XLSX/ZIP/TXT/MD, 최대 50MB, 영상당 최대 10개)│  │
│ └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- 업로드 진행: 프로그레스 바 + 취소 버튼
- 업로드 성공 시 토스트 + 목록 즉시 갱신

### 4.2 사용자 — 영상 시청 모달

영상 모달 본문 영역 안, **영상 정보(제목/설명) 아래 + 댓글 위**에 "📎 자료 다운로드" 섹션 추가:

```
[영상 모달 좌측 패널 본문 영역]
─────────────────────────────────
[기초] 조회 12회

AI업무 자동화 사내교육, Lv.1
오늘 바로 자동화하는 클로드코드 따라하기

AI의 기본 개념과 머신러닝, 딥러닝의...

┌──────────────────────────────────┐
│ 📎 학습 자료 (2)                 │
├──────────────────────────────────┤
│ 📄 ai-automation-script.pdf      │
│    2.1 MB · 12회 다운로드   [↓]  │
│ 🗜️ sample-code.zip               │
│    580 KB · 8회 다운로드    [↓]  │
└──────────────────────────────────┘

💬 댓글 (3)
...
```

- 첨부파일이 0개면 섹션 자체 미노출
- 다운로드 버튼 클릭 → 서명된 URL 받아 즉시 다운로드
- 매 다운로드는 audit log + 워터마크 사용자 표시
- 비로그인 사용자: 영상 자체가 로그인 후 시청이므로 별도 분기 불필요

### 4.3 (선택) 영상 카드 — 첨부 뱃지

영상 카드 우측 하단(좋아요/댓글 옆)에 **"📎 N"** 뱃지로 첨부파일 존재 표시:

```
┌────────────────────────┐
│ [영상 썸네일]           │
│  ▶                     │
│         [필수 시청] →   │
├────────────────────────┤
│ [기초] 조회 12  2단계   │
│ AI업무 자동화...        │
├────────────────────────┤
│ ♥ 2   💬 0    📎 2  →  │
└────────────────────────┘
```

→ 모달 열기 전 카드에서 자료 유무 인지 가능 (UX 향상). **이 부분은 선택사항** — 컨펌 시 yes/no.

## 5. 데이터 모델

### 5.1 신규 테이블 `video_attachments`

```sql
CREATE TABLE IF NOT EXISTS video_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,            -- 원본 파일명 (사용자 다운로드 시 표시)
  blob_pathname TEXT NOT NULL UNIQUE,     -- Vercel Blob 내부 경로
  blob_url      TEXT NOT NULL,            -- 영구 URL (private)
  size_bytes    BIGINT NOT NULL,
  mime_type     TEXT NOT NULL,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_video_attachments_video ON video_attachments(video_id);
```

### 5.2 video_attachments 다운로드 로그 (별도 안 함)
- `auth_logs` 테이블 재사용: `type='attachment_download'`, `detail` 에 video_id + attachment_id 기록
- 새 테이블 안 만들고 기존 감사 인프라 활용

## 6. 인프라 — Vercel Blob

| 항목 | 값 |
|---|---|
| 패키지 | `@vercel/blob` (신규 설치) |
| 스토리지 | Vercel 대시보드에서 **Blob 스토리지 생성** (사용자 작업 필요) |
| 환경변수 | `BLOB_READ_WRITE_TOKEN` (Vercel 자동 주입) |
| 무료 한도 | 5GB / 월 (예상 영상 50개 × 평균 5MB = 250MB → 충분) |
| 단일 파일 한도 | 50MB |
| 접근 제어 | private — 서버 측 인증 후 다운로드 stream 또는 서명 URL |

### 비용 추정
- 영상 50개 × 평균 첨부 2개 × 평균 5MB = **500MB** → 무료 한도 내
- 다운로드: 1,800명 × 월 평균 5건 = 9,000 다운로드 → 무료 한도 내

## 7. API 설계

### 7.1 `POST /api/admin/videos/[id]/attachments`
- **Multipart form data** (file 필드)
- 권한: `requireAdmin('videos')`
- 검증: MIME type 화이트리스트, 50MB 한도, 영상당 10개 한도
- 흐름: Blob 업로드 → DB INSERT → JSON 응답

### 7.2 `GET /api/videos/[id]/attachments`
- 권한: 로그인 회원
- 응답: `[{ id, filename, size, mime_type, download_count, created_at }]` (blob_url 제외)

### 7.3 `GET /api/videos/[id]/attachments/[attachmentId]/download`
- 권한: 로그인 회원
- 흐름: DB 조회 → audit log → 302 redirect to Blob URL (또는 stream)
- `download_count` 증가

### 7.4 `DELETE /api/admin/videos/[id]/attachments/[attachmentId]`
- 권한: `requireAdmin('videos')`
- Blob 삭제 + DB 삭제

## 8. 보안

- **로그인 필수** — 비로그인은 다운로드 자체 불가 (사내 한정 정책 일관성)
- **외부 유출 추적** — 모든 다운로드는 `auth_logs` 기록 (email/IP/UA/file)
- **MIME 화이트리스트** — `.exe` 등 실행파일 차단
- **악성 파일 방지** — Blob private + 서명 URL (직접 URL 노출 X)
- **레이트리밋** — 회원당 1시간 50건 다운로드 (Upstash)

### 추가 에러 처리

| 케이스 | 처리 |
|---|---|
| Blob 업로드 성공 → DB INSERT 실패 | try-catch로 감지 후 Blob `del()` 호출하여 고아 파일 회수. 실패 시 Sentry 보고 (수동 정리 대비) |
| 동일 파일명 중복 업로드 | `blob_pathname` 에 `${videoId}/${timestamp}_${원본명}` 형태로 prefix 부여 → 충돌 없음. `filename` 컬럼은 원본 그대로 (사용자 표시용) |
| 업로드 중 네트워크 끊김 | 클라이언트 측 fetch 실패 → 사용자에게 재시도 토스트. 서버 도달 못한 경우 Blob/DB 무영향 |
| 영상당 10개 한도 도달 후 추가 시도 | 409 Conflict + "한도 초과" 메시지 |

### 허용 파일 형식
```
PDF: application/pdf
PPT: application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation
DOCX: application/vnd.openxmlformats-officedocument.wordprocessingml.document
XLSX: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
ZIP: application/zip
TXT/MD: text/plain, text/markdown
이미지: image/png, image/jpeg (강의 캡처 등)
```

## 9. 작업 분해 (개요)

| # | 작업 | 파일 |
|---|---|---|
| 1 | Vercel Blob 패키지 설치 + 환경변수 안내 | `package.json` |
| 2 | DB 마이그레이션 (video_attachments) | `scripts/apply-video-attachments.mjs` (신규) |
| 3 | 업로드 API | `app/api/admin/videos/[id]/attachments/route.ts` |
| 4 | 조회/다운로드 API | `app/api/videos/[id]/attachments/route.ts` 등 |
| 5 | 어드민 UI (인라인 패널) | `components/AdminVideos.tsx` |
| 6 | 사용자 모달 UI (학습 자료 섹션) | `components/VideoPage.tsx` |
| 7 | (선택) 카드 첨부 뱃지 | `components/VideoPage.tsx` |

## 10. 검증 기준

- [ ] 어드민이 PDF 1MB 파일 업로드 → 영상 row "📎 첨부 (1)" 표시
- [ ] 사용자가 영상 모달에서 다운로드 버튼 → 파일 다운로드 + `auth_logs` 기록
- [ ] 50MB 초과 시 거부
- [ ] 영상당 10개 초과 시 거부
- [ ] 허용 외 MIME(`.exe`) 거부
- [ ] 어드민 삭제 → Blob 파일도 함께 삭제
- [ ] 영상 자체 삭제 시 첨부파일 모두 cascade 삭제
- [ ] 비로그인 사용자가 직접 다운로드 URL 호출 → 401

## 11. 롤백 플랜

- 코드 롤백만으로 UI/API 즉시 복원
- DB `video_attachments` 테이블은 보존 (데이터 손실 방지)
- Blob 파일은 그대로 남음 (수동 삭제 가능)

## 12. 사용자 결정 필요 사항 (컨펌 ⭐)

다음 항목들에 대해 사용자 컨펌 후 진행:

1. **UI 위치 확정**
   - 어드민: 영상 row 인라인 패널 (스테이지와 동일 패턴) — OK?
   - 사용자: 영상 모달 본문 안 "학습 자료" 섹션 (영상 정보 ↓ 댓글 ↑) — OK?
   - 카드 첨부 뱃지(§4.3) — **추가할지 결정**

2. **파일 형식 제한**
   - 위 §8 허용 목록 — OK or 추가/제거?
   - 동영상(MP4)은 제외 (YouTube로 충분)

3. **사이즈 한도**
   - 단일 파일 50MB / 영상당 10개 — OK?

4. **인프라 선택**
   - **Vercel Blob** (권장) — 사용자가 Vercel 대시보드에서 Blob 스토리지 1회 활성화 필요
   - 또는 다른 옵션 선호?

5. **다운로드 추적**
   - audit log + download_count — 추가 항목 있는지?
