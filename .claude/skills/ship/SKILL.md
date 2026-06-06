---
name: ship
description: >-
  구현이 끝난 변경을 게이트 체인을 통과시킨 뒤 main에 푸시하고 배포를 검증한다.
  순서: 빌드 게이트(tsc+build) → 보안 게이트(/security-gate) → (선택)성공기준 스모크 →
  리빙독스 갱신 → DB 마이그레이션 리마인드 → 커밋/푸시 → Vercel 배포·env·안드로이드 확인.
  사용 시점: "구현 끝 / 푸시하자 / 배포 / ship / release" 요청 시. 푸시는 운영(1,800명) 배포를
  트리거하므로 실제 push 전에 반드시 확인을 받는다.
argument-hint: "[선택: 관련 PRD 경로]"
---

# /ship — 구현 완료 후 푸시

게이트를 모두 통과해야 main에 푸시한다. **main 푸시 = Vercel 운영 자동배포(1,800명)** 이므로 신중히.

## 게이트 체인 (실패하면 즉시 중단)

### 1. 빌드 게이트
```bash
npx tsc --noEmit
npm run build
```
- 하나라도 실패 → 중단, 원인 수정 후 재시작.

### 2. 보안 게이트
- **`/security-gate`를 실행**(시크릿·PII·§6 정책). 🚫 차단이면 중단.

### 3. 성공기준 스모크 (선택)
- 관련 PRD의 **성공 기준 체크박스**를 `npm run dev`/프리뷰로 빠르게 확인(가능한 범위).

### 4. 리빙독스 갱신
- `docs/prd/CHANGELOG.md` §3에 이번 변경 행 추가(+ "최종 갱신").
- 상태가 크게 바뀌면 `docs/prd/CURRENT-STATE.md`, 버전 단위면 `PROJECT_HISTORY.md`.

### 5. DB 마이그레이션 리마인드
- 신규 컬럼/테이블이 있으면: **배포 후** 마스터로 `POST /api/admin/migrate`(멱등) 1회 실행해야 함을 명확히 안내.

### 6. 커밋 → 푸시
- 미커밋 변경이 있으면 **`/prd-commit`** 으로 먼저 정리.
- **푸시 전 사용자 확인을 받는다**(운영 배포 트리거임을 고지). 확인 후:
```bash
git push origin HEAD
```
- (대안) 위험한 변경이면 브랜치 푸시 + PR을 제안할 수 있다. 기본은 이 프로젝트의 main 직접 배포 흐름.

### 7. 배포 검증
- Vercel 배포 트리거 확인(대시보드/`vercel` CLI).
- **env 변경 시**: 새 배포부터 적용 → Redeploy 필요함을 안내.
- **안드로이드 영향 시**(웹 변경이 앱 WebView에 반영): `versionCode` 증가·재빌드 필요 안내(`docs/prd/android-app.md`).

## 출력
```
[ship] 빌드 ✅  보안 ✅  스모크 ✅
리빙독스: CHANGELOG 갱신 ✅
마이그레이션: 필요 (videos.new_col) → 배포 후 /api/admin/migrate
푸시: origin/main ← <hash> (확인 후 실행)
배포: Vercel 빌드 시작 — env 변경 없음
```

## 참고
- 게이트·정책 기준: `CLAUDE.md` (빌드 게이트·§6·특화 체크 9)
- 배포·마이그레이션 절차: `docs/AI-CAMPUS-IMPLEMENTATION-PRD.md` §9
