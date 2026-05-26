# PRD: 관리자 일괄 임포트 도구 (PC localStorage → DB)

- 작성일: 2026-05-26
- 작성자: Claude (요청자: ohdongko)
- 범위: 어드민 UI 모달 + 단일 서버 엔드포인트
- 관련 파일: `app/api/admin/import/route.ts` (신규), `components/AdminDashboard.tsx` (수정), `components/AdminImport.tsx` (신규)

---

## 1. 배경 / 문제

전면 DB 이관(Phase 0~3) 완료 후 DB는 빈 시드 상태이지만, **운영자의 PC 브라우저 localStorage에는 기존에 쌓아둔 영상·예약·공유 서비스·가이드·채팅방 설정 데이터가 그대로 남아있다**.

이 데이터를 한 번에 서버로 올려야 모든 기기에서 동일한 콘텐츠를 볼 수 있다.

## 2. 목표 / 비목표

### 목표
- G1. 관리자 비번 로그인 후 단일 버튼 클릭으로 **현재 PC의 localStorage 데이터 전체**를 서버 DB로 일괄 업로드.
- G2. 동일 ID는 UPSERT(기존 DB 데이터를 PC 값으로 덮어씀), PC에 없는 DB 데이터는 그대로 유지(파괴 X).
- G3. 업로드 진행 상황을 도메인별 한 줄씩 표시. 실패 시 어느 단계에서 멈췄는지 명확히 표시.
- G4. 임포트 후 새로고침하면 모든 기기에서 동일하게 보임.

### 비목표
- DB의 데이터를 localStorage로 다시 내려받는 export 기능.
- 도메인별 선택 임포트 (이번엔 전부 한꺼번에).
- 사용자별 임포트 (관리자만).
- 임포트 진행 중 중단/취소.

## 3. 사용자 시나리오

### S1. 임포트 실행
1. 관리자 PC 브라우저(=기존 데이터가 있는 곳)에서 로그인 → 어드민 대시보드.
2. 상단 우측 "🔄 로컬 데이터 서버로 올리기" 버튼 클릭.
3. 모달 표시 — 도메인별 발견된 행 수 미리보기 (예: 영상 7개, 레벨 4개, 공유 서비스 3개, 가이드 그룹 7개 + 아이템 27개, 채팅방 URL 1개, NOA URL 1개).
4. 빨간 박스: "기존 서버 데이터 중 동일 ID는 덮어쓰입니다. 계속하시겠습니까?" + 체크박스.
5. "업로드 시작" 클릭 → 진행률 표시.
6. 완료 후 "✅ 모두 완료. 새로고침합니다." → 3초 후 자동 새로고침.

## 4. 기능 요구사항

### F1. 단일 임포트 엔드포인트
- `POST /api/admin/import` (auth 필요).
- 요청 body:
  ```ts
  {
    videoLevels?: { id, name, description, order_idx? }[],
    videos?:      { id, title, level, description?, youtubeUrl, stages?, order? }[],
    services?:    { serviceName, description?, url, testAccount? }[],  // id 없음 (UUID 자동)
    guideGroups?: { id, name, description?, items: { id, name, description?, cost?, url?, recommended? }[] }[],
    settings?:    { chatroom_url?, chatroom_password?, chatroom_rules?, noa_url? },
    reservations?: { ... }[],  // 일반적으로 비어있음(사용자 측 데이터)
    blockedSlots?: { ... }[],
  }
  ```
- 각 도메인별 처리:
  - **video_levels**: UPSERT (id 기준). 누락된 description은 빈 문자열.
  - **videos**: UPSERT (id 기준). stages는 JSON 직렬화.
  - **shared_services**: 모두 INSERT (id가 없으므로 신규 UUID).
  - **guide_groups + items**: 전체 교체(기존 DELETE → 새로 INSERT).
  - **app_settings**: UPSERT per key.
  - **reservations / blocked_slots**: INSERT(localStorage에 있는 미반영 분만 추가). reservations.id 보존을 위해 UUID로 명시 받음.
- 응답: `{ ok: true, summary: { videos: N, levels: N, services: N, guide_groups: N, guide_items: N, settings: N, reservations: N, blocked_slots: N } }`.
- 부분 실패 시 응답: `{ ok: false, completed: [...], failedAt: 'videos', error: '...' }`.

### F2. 임포트 모달 UI (`AdminImport.tsx`)
- AdminDashboard 헤더 우측에 "🔄 로컬 데이터 서버로 올리기" 버튼 추가 (text가 길면 아이콘만 + tooltip).
- 클릭 시 모달 오픈:
  - 좌측: localStorage 키별 발견된 행 수 (axtf_videos / axtf_video_levels / axtf_services / axtf_guide_groups / axtf_chatroom_* / axtf_noa_url).
  - 빨간 박스 + 체크박스 "기존 DB 데이터를 덮어쓸 수 있다는 점을 이해했습니다".
  - "업로드 시작" 버튼 (체크박스 확인 안 하면 disabled).
- 업로드 중에는 버튼 disabled + 진행 메시지.
- 완료/실패 텍스트 표시.

### F3. localStorage 키 매핑
- 클라이언트에서 다음 키를 읽어 페이로드 구성:
  - `axtf_video_levels` → videoLevels (id 보존)
  - `axtf_videos` → videos (id 보존, stages 그대로)
  - `axtf_services` → services
  - `axtf_guide_groups` → guideGroups
  - `axtf_chatroom_url`, `axtf_chatroom_password`, `axtf_chatroom_rules`, `axtf_noa_url` → settings
  - `axtf_reservations` → reservations (id는 UUID 변환)
  - `axtf_blocked_slots` → blockedSlots

## 5. 보안 / 권한

- `/api/admin/import` 는 `requireAdmin` 필수.
- 임포트는 sessionStorage의 어드민 비번으로 인증.
- 임포트 실행 시 DB 쓰기 작업이 많음 → 단일 트랜잭션은 아니지만 도메인별 멱등 처리(UPSERT).
- 사용자 측 데이터가 섞이지 않도록 (예: 다른 사람의 PC에서 잘못 실행) — 페이로드 검증 후 진행.

## 6. 엣지 케이스

| 케이스 | 동작 |
|---|---|
| localStorage가 비어있는 키 | 페이로드에서 제외. 서버는 빈 배열로 받으면 skip. |
| 일부 도메인에서 SQL 에러 | 그 도메인까지의 결과는 반영, 이후 도메인은 미실행. 응답에 `failedAt` 명시. |
| 같은 ID의 video가 DB에 이미 있음 | UPSERT로 덮어씀(PC 값 우선). |
| `axtf_video_levels` 가 빈 배열 — 기본 4 레벨 시드 유지 | 페이로드에서 제외 → DB 시드 유지. |
| 가이드 트리 전체 교체 시 부분 실패 | `DELETE` 후 `INSERT` 도중 실패하면 가이드가 빈 상태 — 트랜잭션 권장. **결정**: 본 PR에서는 sequential 처리, 향후 트랜잭션화 검토. |
| 임포트 진행 중 페이지 닫힘 | fetch는 중단되지만 서버 처리는 이미 진행된 도메인까지 반영됨. 다시 임포트 실행하면 멱등이라 안전. |
| U+FFFD 포함 데이터 | F1 가드에서 거부. (전제: 이 PC에는 손상 데이터 없음) |

## 7. 성공 기준 / 테스트

- [ ] 어드민 대시보드에 "로컬 데이터 서버로 올리기" 버튼 표시.
- [ ] 클릭 시 도메인별 행 수 미리보기.
- [ ] 체크박스 확인 후 업로드 → 진행 메시지 → 완료.
- [ ] 다른 기기(모바일)에서 새로고침 시 동일 데이터 표시.
- [ ] localStorage가 비어있는 키는 미반영 (실패 X).
- [ ] `npm run build` 통과.

## 8. 롤아웃

1. 코드 push → Vercel 자동 배포.
2. 사용자: PC 브라우저로 https://test-ai-campus.vercel.app 접속 → 어드민 로그인 → 임포트 버튼 클릭.
3. 모바일에서 새로고침해 동일 데이터 표시 확인.

## 9. 미해결 질문

없음.
