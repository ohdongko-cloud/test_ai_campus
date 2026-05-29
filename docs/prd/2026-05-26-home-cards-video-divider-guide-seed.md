# PRD: 홈 카드 추가 + 카톡 링크 + 강의 레벨 구분선 + 가이드 시드 복구

- 작성일: 2026-05-26
- 작성자: Claude (요청자: ohdongko)
- 범위: 홈 UI + DB 시드 데이터 + 강의 페이지 UX

---

## 1. 배경 / 문제

1. **홈 '만들기' 섹션 도구 부족**: NOA만 직접 진입 가능. 직원이 실제로 필요한 Claude Code / Codex 같은 코딩 에이전트 안내가 없음.
2. **오픈 카톡 링크 갱신**: 운영 정책에 따라 새 오픈 채팅방으로 변경.
3. **강의 페이지 가독성**: '전체' 필터에서 모든 영상이 한 그리드로 표시 → 레벨 구분이 안 됨.
4. **서비스 가이드 데이터 손실**: 이전 임포트 후 비어있음. 1,800명 오픈 전 핵심 도구 목록을 재시드해야 함.

## 2. 목표 / 비목표

### 목표
- G1. 홈 '만들기' 섹션에 **Claude Code 다운로드** + **Codex 다운로드** 카드 2장 추가. "(유료)" 배지 표시.
- G2. 카톡 링크 기본값을 `https://open.kakao.com/o/gvPCZSvi` 로 갱신.
- G3. 강의 페이지의 '전체' 필터에서 **레벨별 섹션 헤더 + 구분선**으로 그루핑.
- G4. 서비스 가이드에 10개 그룹 + 약 30개 도구를 시드. 관리자 페이지에서 편집 가능.

### 비목표
- 카드 다국어.
- 강의 페이지 정렬 옵션 추가.
- 가이드 도구별 평가/리뷰 기능.

## 3. 기능 요구사항

### F1. 홈 만들기 섹션 — 카드 2장
- `ActionCard`와 동일 외형. `metaRight`에 `<Badge variant="secondary">유료</Badge>`.
- Claude Code: https://claude.com/ko/download
- Codex: https://chatgpt.com/ko-KR/codex (긴 utm 파라미터는 표준화)
- 클릭 시 `window.open(url, '_blank', 'noopener,noreferrer')`.
- 기존 NOA·필수 도구 카드와 함께 그리드 4열 (또는 2×2).

### F2. 카톡 링크
- `app_settings.chatroom_url` 의 기본값을 새 URL로 갱신하는 스크립트 추가.
- 기존 값이 있어도 강제 덮어쓰는 옵션. (이미 다른 값 설정된 경우 운영자 결정 — 본 PR에서는 force update)

### F3. 강의 레벨 구분선
- `levelFilter === '전체'` 일 때:
  - 영상을 레벨별로 그룹화 (`groupBy(v => v.level)`)
  - 각 레벨 그룹 위에 헤더: `[레벨명] N편` + 가로 점선
  - 그 아래 기존 카드 그리드
- 특정 레벨 필터 시: 기존 단일 그리드 유지.
- 레벨 순서: `video_levels.order_idx` 기준.

### F4. 가이드 시드 (10 그룹)
- `scripts/apply-guide-seed.mjs` (멱등 옵션): `--force` 시 기존 데이터 wipe 후 새 데이터 insert.
- 그룹 목록:
  1. AI 코딩 도구 (Claude Code, Codex, Antigravity)
  2. AI 어시스턴트 (Claude, ChatGPT, Gemini, Grok)
  3. 개발 환경 / 소스 관리 (GitHub, CodeSandbox)
  4. 빌드 / 배포 (Vercel, Netlify)
  5. 데이터베이스 / 백엔드 (Supabase, Neon, Render)
  6. 운영 인프라 (Resend, Sentry, Upstash)
  7. 협업 도구 (Notion, Slack, Flow)
  8. 이미지/영상 생성 AI (Midjourney, Nano Banana, Kling, Suno, HeyGen, CapCut)
  9. 디자인 도구 (미리캔버스, Canva)
  10. 앱 배포 콘솔 (Google Play, Google Cloud, Apple App Store)
- 각 도구: name, description(특장점+차이점), cost, url, recommended.
- 관리자 페이지에서 그대로 수정 가능 (기존 PUT /api/admin/guide 사용).

## 4. 데이터 / 마이그레이션

- 신규 테이블 없음.
- `apply-guide-seed.mjs` 실행 결과:
  - `guide_items` DELETE
  - `guide_groups` DELETE
  - 10 그룹 + 약 28개 아이템 INSERT
- `chatroom_url` UPSERT (force update).

## 5. UX

### 홈 만들기 (4 카드)
```
[NOA로 바로 만들기]  [필수 도구 둘러보기]
[Claude Code 받기]   [Codex 받기]
[유료 배지]          [유료 배지]
```

### 강의 페이지 (전체 필터)
```
─────────────────────────────────────────
기초 · 3편
─────────────────────────────────────────
[카드] [카드] [카드]

─────────────────────────────────────────
중급 · 1편
─────────────────────────────────────────
[카드]

...
```

## 6. 성공 기준

- [ ] 홈 만들기에 4 카드 표시. 새 2개 클릭 시 외부 사이트 새 탭 열림.
- [ ] 카톡 입장 팝업 URL이 `gvPCZSvi`.
- [ ] 강의 '전체' 필터에 레벨 헤더+구분선 표시. 단일 필터엔 그대로.
- [ ] 서비스 가이드에 10 그룹·28개 도구 표시.
- [ ] 관리자가 가이드 편집 후 저장 → DB 반영.
- [ ] 빌드 통과.

## 7. 미해결 질문

- Hixfield: 실 존재 확인 어려움 → 일단 빼고 추후 운영자가 필요 시 직접 추가. **결정**: 시드에서 제외.
- "Google Console" 모호 → Google Cloud Console로 해석.
