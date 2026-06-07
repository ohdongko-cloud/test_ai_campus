---
name: db-migrate
description: >-
  DB 스키마 변경(SQL 마이그레이션)을 안전하게 작성·적용·검증한다. repo의 마이그레이션 도구를 탐지해
  따르고(Prisma·Drizzle·Knex·TypeORM·Sequelize·Supabase·raw SQL·멱등 엔드포인트 등), 없으면
  타임스탬프 SQL 파일을 만든다. 멱등·하위호환·신규 컬럼 기본값 원칙을 강제하고 파괴적 변경은 확인을 받는다.
  사용 시점: "마이그레이션 / 스키마 변경 / 컬럼 추가 / migration / alter table / db push" 요청 시,
  또는 PRD 구현이 DB를 건드릴 때.
argument-hint: "[변경 요약: 예) videos에 duration 컬럼 추가]"
---

# /db-migrate — SQL 마이그레이션 (범용)

스키마 변경을 **멱등·하위호환**으로 만들고, repo의 도구에 맞춰 적용·검증한다.

## 0. 마이그레이션 방식 탐지
| 신호 | 방식 |
|---|---|
| `prisma/schema.prisma` | Prisma — `npx prisma migrate dev --name <slug>` (로컬) / `migrate deploy`(운영) |
| `drizzle.config.*` | Drizzle — `drizzle-kit generate` → `migrate` |
| `knexfile.*` | Knex — `knex migrate:make <slug>` → `migrate:latest` |
| `supabase/migrations/` | Supabase — 새 SQL 파일 + `supabase db push` |
| `migrations/`·`db/migrations/*.sql` | raw SQL 러너 — 규칙에 맞는 새 파일 |
| TypeORM/Sequelize 설정 | 해당 CLI의 migration 생성·실행 |
| CLAUDE.md가 멱등 엔드포인트 언급(예: `POST /api/admin/migrate`) | SQL 작성 + **배포 후** 엔드포인트 실행 안내 |
| 위 없음 | `migrations/<YYYYMMDDHHMM>__<slug>.sql` 생성 + 적용법 문서화 |

→ CLAUDE.md에 마이그레이션 규칙이 있으면 **그게 우선**.

## 1. 변경 설계 (안전 원칙)
- **멱등**: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- **하위호환(additive-first)**: 신규 컬럼은 `NULL` 허용 또는 `DEFAULT` 제공 → 기존 행/구버전 코드가 깨지지 않게.
- **파괴적 변경 주의**: `DROP`/`RENAME`/`NOT NULL` 추가/타입 변경은 **반드시 사용자 확인**. 가능하면 2단계(추가→백필→전환)로.
- **백필**이 필요하면 배치/기본값 전략 명시.
- 트랜잭션 지원 DB면 가능한 범위에서 트랜잭션으로 감싼다.

## 2. 작성
- 탐지된 방식의 위치·파일명 규칙에 맞춰 마이그레이션을 만든다(up/down 또는 forward-only).
- 롤백 방법(또는 보상 마이그레이션)을 주석으로 남긴다.

## 3. 적용
- **로컬/개발**: 탐지된 명령으로 적용.
- **운영**: 직접 적용하지 않고 **배포 파이프라인/엔드포인트/마스터 권한 절차**를 따른다. 운영 적용 전 사용자 확인.

## 4. 검증
- 재실행 시 **no-op(멱등)** 인지 확인.
- 스키마 반영 확인(컬럼/인덱스 존재). 앱 타입(예: Prisma client, 타입 정의) 재생성 필요하면 안내.

## 출력
```
[db-migrate] 방식: <탐지결과>
파일: <경로>
안전성: 멱등 ✅ / 하위호환 ✅ / 파괴적: 없음
적용: 로컬 완료 / 운영: <절차> (배포 후)
검증: 재실행 no-op ✅
```
> 스키마와 함께 코드도 바뀌면 `/prd-commit`으로 같은 작업 단위 커밋에 포함.
