# 인계 메모 — 첨부파일 업로드 이슈 (Vercel Blob)

- 작성: 2026-06-04
- 상태: **거의 해결됨 — 토큰 검증 + redeploy 만 남음**

## 🎯 한 줄 요약

코드는 완벽함. **Vercel Blob 토큰 값 확인 + redeploy** 만 하면 끝.

## 🔍 지금까지 밝혀진 것 (진단 완료)

업로드가 안 됐던 진짜 원인들 (순서대로 발견·수정됨):

1. ✅ **무한 fetch 루프** — `AdminVideoAttachments` 의 onCountChange 의존성 → ref 처리 (커밋 `0f91f15`)
2. ✅ **PPTX MIME 거부** — 확장자 fallback `isAllowedFile` 추가 (커밋 `e8e37b5`)
3. ✅ **adminFetch 가 FormData 에 Content-Type:json 강제** → multipart 깨짐 → binary body 예외 처리 (커밋 `1ef87ad`)
4. ✅ **Blob 스토어가 Private 인데 코드는 access:'public'** → "Cannot use public access on a private store" 에러.
   → **Public 스토어 `test-ai-campus-blob_public` 새로 생성함** (Access: Public 확인됨)
5. ⚠️ **새 Public 스토어 연결 시 read-write 토큰 체크박스 누락** → `BLOB_READ_WRITE_TOKEN` 빈 값이었음.
   → 사용자가 토큰 추가함 (UI 에 "Added just now" + Sensitive 로 표시됨). **값 유효성 미검증 상태.**

## ⚠️ 핵심 인프라 사실 (헷갈리기 쉬움)

- **실제 운영 프로젝트 = `test-ai-campus`** (Vercel)
- 도메인 `retail-ai-campus.vercel.app` 은 `test-ai-campus` 프로젝트에 연결됨
- `retail-ai-campus` 라는 **별도 빈 프로젝트도 존재** (env 0개, 배포 안 됨) — 여기 아님! 헷갈리지 말 것
- Blob 스토어: `test-ai-campus-blob_public` (store_5Y1QhB7GCvSo504P, Access: Public, Region icn1)
- 환경변수는 모두 `test-ai-campus` 프로젝트에 있음 (DATABASE_URL, BLOB_READ_WRITE_TOKEN 등)

## ✅ 다른 노트북에서 할 일 (순서대로)

### 1. Redeploy (필수)
환경변수는 새 배포부터 적용됨.
```
Vercel → test-ai-campus → Deployments → 최신 ⋯ → Redeploy
  → "Use existing Build Cache" 체크 해제 → Redeploy
```

### 2. 진단 endpoint 로 토큰 검증
배포 완료 후, **관리자 로그인 상태**로 브라우저 주소창:
```
https://retail-ai-campus.vercel.app/api/admin/debug/blob
```
- `{ ok: true, message: "Vercel Blob 정상 동작 ✅" }` → **해결!** PPTX 업로드 바로 됨
- `{ ok: false, envTokenPresent: false }` → 토큰 값 비어있음 → 아래 3번
- `{ ok: false, envTokenPresent: true, error: "..." }` → error 메시지 확인

### 3. (토큰 비어있으면) 토큰 다시 연결
```
Vercel → test-ai-campus → Storage → test-ai-campus-blob_public
  → Projects/Connected → test-ai-campus Disconnect → 다시 Connect Project
  → ☑ "Add a read-write token env var to this connection" 반드시 체크
  → Connect → Redeploy
```

### 4. 실제 업로드 테스트
관리자 모드 → 영상 관리 → "📎 첨부" → PPTX 업로드.
실패 시 빨간 에러박스의 `[status]` + 메시지 + Vercel Functions Logs 의 `[ATT-UPLOAD]` 로그 확인.

## 🧰 진단 도구 (이미 배포됨)

- `GET /api/admin/debug/blob` — Blob put/del 단독 테스트 (어드민 한정)
- 업로드 라우트에 `[ATT-UPLOAD]` 단계별 console.log — Vercel Functions Logs 에서 확인
- 클라이언트 에러박스에 HTTP status + 서버 메시지 표시 (닫기 버튼 有)

## 📂 관련 파일

- `app/api/admin/videos/[id]/attachments/route.ts` — 업로드 API (진단 로그 포함)
- `app/api/admin/debug/blob/route.ts` — 진단 endpoint
- `components/AdminVideoAttachments.tsx` — 어드민 첨부 패널
- `lib/admin-client.ts` — adminFetch (multipart 수정됨)
- `lib/attachments.ts` — 파일 정책 (isAllowedFile)

## 🔐 보안 메모

- 작업 중 임시로 받은 운영 env 파일(.env.real, .env.real2, .env.vercel-temp)은 삭제 완료.
- `.vercel/` 폴더는 gitignore 됨 (CLI 링크 정보 — 커밋 안 됨).
