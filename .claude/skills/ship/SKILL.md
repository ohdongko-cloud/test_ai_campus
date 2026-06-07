---
name: ship
description: >-
  구현이 끝난 변경을 게이트 체인을 통과시킨 뒤 푸시하고 배포를 검증한다. 순서: 빌드/타입체크 게이트 →
  보안 게이트(/security-gate) → 마이그레이션 확인(/db-migrate) → 문서/CHANGELOG 갱신 → 커밋 →
  푸시 → 배포 검증. repo의 빌드 명령·배포 타깃·기본 브랜치를 탐지해 적응한다. 사용 시점: "구현 끝 /
  푸시하자 / 배포 / ship / release" 요청 시. 푸시는 배포를 트리거할 수 있으므로 실제 push 전 확인을 받는다.
argument-hint: "[선택: 관련 PRD/이슈]"
---

# /ship — 게이트 통과 후 푸시·배포 (범용)

게이트를 모두 통과해야 푸시한다. **푸시는 CI/CD 배포를 트리거할 수 있으므로** 신중히.

## 0. 규약·타깃 탐지
- 빌드/타입체크: `package.json` scripts(`typecheck`/`build`/`lint`/`test`) 또는 언어별(cargo/go/mvn…). CLAUDE.md 빌드 게이트 우선.
- 배포 타깃: `vercel.json`/`netlify.toml`/`.github/workflows`/`fly.toml`/`Dockerfile` 등 → 푸시가 무엇을 트리거하는지 파악.
- 기본 브랜치: `git symbolic-ref refs/remotes/origin/HEAD` 또는 현재 브랜치.
- 마이그레이션 필요 여부(스키마 변경 동반?), CHANGELOG 존재.

## 게이트 체인 (실패 시 즉시 중단)
1. **빌드 게이트** — 탐지된 타입체크/빌드/테스트 실행. 실패 → 중단.
2. **보안 게이트** — `/security-gate` 실행. 🚫면 중단.
3. **마이그레이션** — 스키마 변경이 있으면 `/db-migrate`로 작성·적용 확인. 운영 적용은 배포 절차에 따름.
4. **문서 갱신** — `CHANGELOG`/PRD 인덱스가 있으면 이번 변경 반영. 상태 문서도 필요 시.
5. **커밋** — 미커밋 변경은 `/prd-commit`으로 정리.
6. **푸시 (확인 후)** — 배포 트리거임을 고지하고 사용자 확인. 확인되면:
   ```bash
   git push origin HEAD
   ```
   위험한 변경이면 브랜치+PR을 제안할 수 있다(기본 브랜치 직접 푸시 정책이면 그에 따름).
7. **배포 검증** — CI/CD 빌드 상태 확인. env 변경 시 재배포 필요 안내. **운영 마이그레이션**은 배포 후 절차대로 실행 안내.

## 출력
```
[ship] 빌드 ✅  보안 ✅  마이그레이션 <상태>
문서: CHANGELOG 갱신 ✅
푸시: origin/<branch> ← <hash> (확인 후)
배포: <타깃> 트리거 / env 변경 <유무>
후속: 운영 마이그레이션 <필요 시 절차>
```
