# AI 캠퍼스 — PRD 워크플로우 스킬 가이드

기획 → 구현 → 배포를 **표준화**하는 7개 스킬 + 지침(`CLAUDE.md`) + 훅(가드레일) 사용법.

> 스킬은 **적응형·범용**: 이 repo처럼 `CLAUDE.md`/`docs/prd`가 있으면 그 규약을 따르고, 없는 다른 프로젝트에선 기본 템플릿으로 동작한다. 개인 스코프(`~/.claude/skills`)에도 설치되어 **모든 세션·프로젝트**에서 쓸 수 있다.

---

## 구성

| 층 | 무엇 | 위치 |
|---|---|---|
| **스킬**(호출형 절차) | `/prd-new` `/prd-review` `/prd-commit` `/db-migrate` `/security-gate` `/ship` `/prd-flow` | `.claude/skills/*` + `~/.claude/skills/*` |
| **지침**(항상 적용) | 커밋 컨벤션·§6 보안정책·특화 체크 9·빌드 게이트 | `CLAUDE.md` |
| **훅**(자동 강제) | pre-commit(gitleaks)·pre-push(tsc+gitleaks) | `.husky/*` |

---

## 부르는 법
- **자연어**: "PRD 써줘", "이 PRD 리뷰해줘", "PRD 단위로 커밋", "보안검토 해줘", "푸시하자" → 해당 스킬이 자동 실행.
- **명령어**: `/prd-new` `/prd-review` `/prd-commit` `/security-gate` `/ship` `/prd-flow`
- ⚠️ **최초 1회**: `.claude/skills/`(프로젝트)·`~/.claude/skills/`(개인)가 새로 생겼으므로 **Claude Code를 재시작**해야 스킬이 인식된다. 이후 `SKILL.md` 수정은 즉시 반영.

---

## 추천 흐름
가장 쉬운 길은 **`/prd-flow`** 하나 — 전체를 순서대로 안내한다.

```
/prd-new → /prd-review → (구현) → /db-migrate → /prd-commit → /security-gate → /ship
           [게이트① 품질]       (스키마 변경 시)              [게이트② 보안]
```
- 게이트(리뷰·보안)에서 막히면 → 구현/PRD로 되돌아가 수정 후 재진입.
- 필요한 단계만 개별 호출해도 된다(두 게이트는 건너뛰지 말 것).

---

## 스킬 빠른 참조

| 스킬 | 하는 일 | 트리거 예 |
|---|---|---|
| `/prd-new` | 8섹션 PRD 초안 작성 + `docs/prd` 저장 + 등록 | "로그인 기록 기능 PRD 써줘" |
| `/prd-review` | 루브릭 8항목 ✅/⚠️/❌ 점검 + 수정안 | "이 PRD 구현해도 될지 봐줘" |
| `/prd-commit` | PRD 단위 원자적 커밋 + CHANGELOG 갱신 | "task별로 커밋 정리해줘" |
| `/db-migrate` | SQL 마이그레이션 멱등·하위호환 작성·적용·검증 | "videos에 컬럼 추가 마이그레이션" |
| `/security-gate` | 푸시 전 시크릿·PII·§6 정책 검토 | "푸시 전에 보안검토" |
| `/ship` | 빌드·보안 게이트 → 커밋·푸시 → 배포 검증 | "구현 끝났으니 배포" |
| `/prd-flow` | 위 단계를 순서대로 잇는 오케스트레이터 | "기획부터 배포까지 진행" |

---

## 항상 적용되는 것 (CLAUDE.md)
별도 호출 없이 **모든 작업에 자동 반영**된다:
- 커밋 컨벤션(`type(scope): 한글`, PRD 링크)
- §6 보안정책 11항 + 특화 체크 9(PII·마이그레이션·권한·모바일·에러통일·인코딩·캐시·빌드·env)
- 빌드 게이트(`tsc --noEmit` + `build`)

---

## 가드레일 (훅)
- **pre-commit** — `gitleaks`로 스테이지된 시크릿 자동 차단(기존).
- **pre-push** — `tsc --noEmit` + 푸시 범위 `gitleaks`. 둘 중 하나라도 걸리면 푸시 차단(신규).
- 전체 보안 점검(PII·정책 매핑)은 푸시 전 `/security-gate`로.

---

## 실습 직원용 메모
- 이 저장소를 열어 AI 코딩을 하면 `CLAUDE.md`·스킬·훅이 **자동으로 따라온다** → 보안·품질 표준이 그대로 적용된다.
- 막히면 게이트가 무엇이 문제인지 알려준다(빌드 깨짐 / 시크릿 / 정책 위반). "바이브 코딩"도 가드레일 안에서 안전하게.
- 새 기능은 항상 `/prd-new`로 시작 → 작은 PRD라도 쓰면 리뷰·보안·커밋이 매끄럽게 이어진다.

---

## 공유 / 버전관리
`.gitignore`가 `.claude/skills/`·`.claude/commands/`·`.claude/settings.json`만 추적하고
`.claude/settings.local.json`(개인 설정)은 제외한다. → 스킬은 팀·실습 직원과 공유, 로컬 설정은 비공개.

**원본/동기화**: 이 저장소의 `.claude/skills/`가 **원본(버전관리)**, 개인 스코프 `~/.claude/skills/`는 전 프로젝트용 **사본**이다. 스킬을 고치면 아래로 동기화:
```powershell
Copy-Item "<repo>\.claude\skills\*" "$env:USERPROFILE\.claude\skills" -Recurse -Force
```
