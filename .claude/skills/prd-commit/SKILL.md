---
name: prd-commit
description: >-
  작업한 변경을 작업(요구사항 F1·F2…) 단위로 묶어 원자적 커밋으로 만든다. repo의 커밋 컨벤션을 탐지해
  따르고(CLAUDE.md 또는 git log에서 추론), 본문에 PRD/이슈 링크를 달며, CHANGELOG가 있으면 갱신한다.
  커밋 전 빌드/타입체크가 있으면 실행한다. 사용 시점: "커밋해줘 / task별 커밋 / 커밋 정리 / commit this"
  요청 시, 또는 푸시 전에 커밋이 필요할 때. 로컬 커밋만 한다(푸시는 /ship).
argument-hint: "[선택: 대상 PRD/이슈]"
---

# /prd-commit — 작업 단위 커밋 (범용)

변경을 요구사항 단위의 **원자적 커밋**으로 만든다. **푸시는 하지 않는다**(→ `/ship`).

## 0. 규약 탐지
- 커밋 컨벤션: `CLAUDE.md`에 규칙이 있으면 그대로. 없으면 `git log --oneline -20`으로 **기존 스타일을 추론**(Conventional Commits 여부, 언어 KO/EN, scope 사용). 그래도 없으면 기본 `type(scope): 요약`(Conventional Commits).
- 빌드/타입체크 명령: `package.json` scripts(`typecheck`/`tsc`/`build`/`lint`), 또는 언어별(cargo/go/mvn…). CLAUDE.md에 빌드 게이트가 있으면 우선.
- `CHANGELOG.md`/PRD 인덱스 존재 여부.

## 절차
### 1. 변경·대상 파악
```bash
git status --short && git diff --stat
```
대상 PRD/이슈를 식별(인자 → 관련 PRD 폴더 문서 → 없으면 커밋 후 `/prd-new` 권유).

### 2. 빌드 게이트 (있으면)
- 탐지된 타입체크/빌드를 실행. 실패하면 **커밋 중단**, 원인부터 수정.

### 3. 작업 단위로 분할
- 요구사항(F) 단위로 변경을 묶는다. 한 커밋 = 한 논리 단위. 무관한 변경(리팩터/포맷/문서)은 별도 커밋.
- 단위별 스테이징: `git add <경로...>` (필요 시 hunk 단위).

### 4. 메시지 (탐지된 컨벤션)
```
<type>(<scope>): <요약>

<핵심 변경 요지>
PRD: <PRD 경로 또는 이슈 링크>   # 있을 때
```
- 멀티라인은 `git commit -F`(임시 입력)로 안전하게 전달.
- AI 협업 표기 트레일러가 repo 관례면 추가(`Co-Authored-By: …`).

### 5. CHANGELOG (있으면, 같은 커밋에)
1. 기능을 먼저 커밋 → `git rev-parse --short HEAD`로 해시 확보.
2. CHANGELOG에 해시·메시지·PRD 링크 행 추가 + "최종 갱신" 갱신.
3. 아직 push 전이면 `git add CHANGELOG.md && git commit --amend --no-edit`로 같은 커밋에 접어 넣기. push 후면 `docs(changelog): …` 후속 커밋.

### 6. 마무리
- 생성 커밋(`git log --oneline -n N`)을 보여주고 다음 단계 안내: 스키마 변경 시 `/db-migrate`, 그다음 `/security-gate` → `/ship`.
