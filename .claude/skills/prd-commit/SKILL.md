---
name: prd-commit
description: >-
  작업한 변경을 PRD의 기능 요구사항(F1·F2…) 단위로 묶어 원자적 커밋으로 만든다.
  한글 컨벤셔널 커밋(type(scope): 요약)으로 메시지를 쓰고, 본문에 PRD 링크를 달며,
  docs/prd/CHANGELOG.md 변경 이력을 같은 커밋에 갱신한다. 사용 시점: "PRD 단위로 커밋 /
  task별 커밋 / 커밋 정리 / commit this" 요청 시, 또는 /ship 전에 커밋이 필요할 때.
  로컬 커밋만 한다(푸시는 /ship).
argument-hint: "[선택: 대상 PRD 경로]"
---

# /prd-commit — PRD task별 커밋

변경을 PRD 요구사항 단위의 **원자적 커밋**으로 만든다. 컨벤션은 `CLAUDE.md`의 **커밋 컨벤션**을 따른다.
**푸시는 하지 않는다** — 푸시는 `/ship` 또는 `/security-gate` 통과 후.

## 절차

### 1. 변경·대상 PRD 파악
```bash
git status --short
git diff --stat
```
- 대상 PRD를 식별한다(인자로 받은 경로 → 없으면 `docs/prd/`의 관련/최근 문서). 없으면 커밋 후 `/prd-new`로 PRD 작성을 권한다.

### 2. 빌드 게이트 (커밋 전)
```bash
npx tsc --noEmit
```
- 실패하면 **커밋 중단**, 원인부터 수정(`CLAUDE.md` 빌드 게이트).

### 3. F1..Fn → 원자적 커밋으로 분할
- PRD의 **기능 요구사항(F)** 단위로 변경 파일을 묶는다.
- 한 커밋 = 한 논리 단위. 무관한 변경(리팩터/포맷/문서)은 별도 커밋.
- 단위별로 스테이징: `git add <경로...>` (필요하면 hunk 단위로 나눠 설명).

### 4. 커밋 메시지 (컨벤션)
형식: `type(scope): 한글 요약` — type ∈ `{feat, fix, chore, docs, security, refactor}`
본문에 PRD 링크와 핵심 변경 요지, 끝에 트레일러.
```
feat(video): 스테이지 인라인 이미지 라이트박스

어드민 업로드/삭제 + 사용자 펼침 시 인라인 그리드.
PRD: docs/prd/2026-05-30-stage-inline-images.md

Co-Authored-By: Claude <noreply@anthropic.com>
```
- 멀티라인 메시지는 임시 파일(`git commit -F`) 또는 여러 `-m`으로 안전하게 전달한다.

### 5. CHANGELOG 갱신 (같은 커밋에 포함)
`docs/prd/CHANGELOG.md` 운영 규칙: 새 기능/PRD마다 §3 변경 이력에 `커밋해시 | 메시지 | 비고(PRD 링크)` 행 추가 + 헤더 "최종 갱신" 갱신.
해시는 커밋 후에야 확정되므로:
1. 기능 변경을 먼저 커밋한다.
2. `git rev-parse --short HEAD`로 해시를 얻는다.
3. CHANGELOG에 그 해시로 행을 추가하고 "최종 갱신" 날짜를 고친다.
4. `git add docs/prd/CHANGELOG.md && git commit --amend --no-edit` 로 **같은 커밋에 접어 넣는다**(아직 push 전일 때만 amend). push된 뒤라면 `docs(changelog): …` 후속 커밋으로 추가한다.
- 상태가 크게 바뀌면 `docs/prd/CURRENT-STATE.md`도 함께 갱신.

### 6. 마무리
- 생성한 커밋 목록(`git log --oneline -n <개수>`)을 보여준다.
- 다음 단계 안내: `/security-gate`(보안 검토) → `/ship`(푸시).

## 참고
- 커밋 타입·트레일러·리빙독스 규칙: `CLAUDE.md`
- 기존 이력 형식 예시: `docs/prd/CHANGELOG.md` §3
