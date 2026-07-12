// 레벨테스트 팝업 노출 조건 — 회귀 테스트 (골든)
// 실행: npm run test:golden  (= node tests/level-test-popup-gate.test.mjs)
// 의존성 없음(node 내장 assert만 사용). 실 DB 호출 없음.
//
// 배경: "최초 1회만, 완료 후 30일 경과 전에는 다시 뜨지 않음" 조건이 5회 이상 재발한 버그.
// 판정 로직 위치(프로덕션, 인라인이라 직접 import 불가 — 리팩터 금지 제약):
//   - 서버: app/api/ai-level-test/status/route.ts:17-21 (completed / ageDays / dueForRetake)
//   - 클라: app/page.tsx:59-104 (헬퍼) + app/page.tsx:212-231 (게이트 useEffect)
//   - 영속: app/api/level-test/seen/route.ts:18-21, app/api/level-test/route.ts:31-37
//     (COALESCE(level_test_done_at, now()) — 최초값 보존)
//
// 구성:
//   PART 1. 판정 규칙 미러 구현에 대한 단위 테스트 (정책을 실행 가능한 스펙으로 고정)
//   PART 2. 프로덕션 소스 계약 검사 — 핵심 표현식이 소스에서 사라지거나 바뀌면 실패
//           (인라인 로직을 import할 수 없으므로, 미러와 실제 코드의 표류를 이걸로 방지)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
const RETAKE_DAYS = 30; // app/page.tsx:76 과 동일해야 함 (PART 2에서 소스와 대조)

// ─────────────────────────────────────────────────────────────
// 판정 로직 미러 (프로덕션 코드와 1:1 대응 — 표류 시 PART 2가 잡는다)
// ─────────────────────────────────────────────────────────────

// 서버: app/api/ai-level-test/status/route.ts
//   rows = ai_level_attempts 최신순. 없으면 completed:false (미응시로 간주 → 과노출이 미노출보다 안전).
//   DB 에러(catch)도 completed:false.
function computeStatusFromRows(rows, nowMs) {
  if (!rows || rows.length === 0) return { completed: false };
  const ageDays = (nowMs - new Date(rows[0].created_at).getTime()) / DAY; // route.ts:20
  const dueForRetake = ageDays >= 30;                                     // route.ts:21
  return { completed: true, dueForRetake };
}
function computeStatusOnDbError() {
  return { completed: false }; // route.ts:35-37 (catch)
}

// 클라 게이트: app/page.tsx:212-231
//   data              : /api/ai-level-test/status 응답 (fetch/파싱 실패 시 {})
//   localCompletedAtMs: localStorage 'aiLevelCompletedAt' (없으면 null) — page.tsx:80-85
//   snoozedUntilMs    : localStorage 'aiLevelPromptSnoozedUntil' (없으면 null) — page.tsx:91-96
//   dismissedToday    : 'aiLevelPromptDismissedAt' === 오늘 — page.tsx:64-68
//   retakeToastShownToday: 'aiLevelRetakeToastShownAt' === 오늘 — page.tsx:99-101
// 반환: { modal, toast }
function decideLevelPromptGate({
  data,
  localCompletedAtMs = null,
  snoozedUntilMs = null,
  dismissedToday = false,
  retakeToastShownToday = false,
  nowMs,
}) {
  const localAt = localCompletedAtMs;
  const hasTested = data?.completed === true || localAt !== null;         // page.tsx:218
  if (hasTested) {
    // 완료자: 모달 영구 미노출. 30일 경과 시 토스트만(하루 1회). page.tsx:219-225
    const overdue = data?.dueForRetake === true
      || (localAt !== null && (nowMs - localAt) >= RETAKE_DAYS * DAY);    // page.tsx:220-221
    return { modal: false, toast: overdue && !retakeToastShownToday };
  }
  if (data?.completed === false) {
    // 미진단자: 스누즈/오늘 dismiss 아니면 선택 팝업. page.tsx:226-231
    const snoozed = Number.isFinite(snoozedUntilMs) && snoozedUntilMs > nowMs; // page.tsx:91-96
    return { modal: !snoozed && !dismissedToday, toast: false };
  }
  // 모호(응답에 completed 없음 = fetch/파싱 실패): 아무것도 안 띄움. page.tsx:216,232
  return { modal: false, toast: false };
}

// ─────────────────────────────────────────────────────────────
// 테스트 러너 (의존성 없는 미니 러너)
// ─────────────────────────────────────────────────────────────
let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failures.push({ name, e }); console.error(`  FAIL  ${name}\n        ${e.message}`); }
}

// 기준 시각 고정 (실시간 의존 제거)
const NOW = Date.UTC(2026, 6, 12, 9, 0, 0); // 2026-07-12T09:00:00Z
const daysAgo = (n) => new Date(NOW - n * DAY).toISOString();

console.log('\nPART 1. 판정 규칙 단위 테스트');

// [케이스 1] 미응시 신규 사용자 → 팝업 노출
test('1. 미응시 신규(서버 기록 없음·로컬 마커 없음·스누즈/디스미스 없음) → 모달 노출', () => {
  const data = computeStatusFromRows([], NOW);
  assert.deepEqual(data, { completed: false });
  const r = decideLevelPromptGate({ data, nowMs: NOW });
  assert.equal(r.modal, true, '신규 사용자에게 팝업이 떠야 함');
  assert.equal(r.toast, false);
});

// [케이스 2] 방금 응시 → 비노출
test('2. 방금 응시(0일 경과) → 모달 비노출·토스트 비노출', () => {
  const data = computeStatusFromRows([{ created_at: daysAgo(0) }], NOW);
  assert.equal(data.completed, true);
  assert.equal(data.dueForRetake, false);
  const r = decideLevelPromptGate({ data, localCompletedAtMs: NOW, nowMs: NOW });
  assert.equal(r.modal, false, '완료 직후에는 절대 다시 뜨면 안 됨');
  assert.equal(r.toast, false);
});

// [케이스 3] 29일 경과 → 비노출
test('3. 응시 후 29일 경과 → 모달 비노출·토스트 비노출 (30일 미만 억제)', () => {
  const data = computeStatusFromRows([{ created_at: daysAgo(29) }], NOW);
  assert.equal(data.dueForRetake, false, '29일은 재측정 도래 아님');
  const r = decideLevelPromptGate({ data, localCompletedAtMs: NOW - 29 * DAY, nowMs: NOW });
  assert.deepEqual(r, { modal: false, toast: false });
});

// [케이스 4] 31일 경과 — 코드가 정한 정책: 완료자는 모달 영구 미노출, 토스트만(하루 1회)
test('4. 응시 후 31일 경과 → 모달은 여전히 비노출, 재측정 토스트만 노출', () => {
  const data = computeStatusFromRows([{ created_at: daysAgo(31) }], NOW);
  assert.equal(data.dueForRetake, true, '30일 이상이면 재측정 도래');
  const r = decideLevelPromptGate({ data, localCompletedAtMs: NOW - 31 * DAY, nowMs: NOW });
  assert.equal(r.modal, false, '완료자에게 모달 재노출 금지 (PRD 2026-06-24 정책)');
  assert.equal(r.toast, true, '대신 토스트로 가볍게 안내');
});

test('4b. 31일 경과 + 오늘 이미 토스트 표시 → 토스트도 비노출 (하루 1회)', () => {
  const data = computeStatusFromRows([{ created_at: daysAgo(31) }], NOW);
  const r = decideLevelPromptGate({ data, retakeToastShownToday: true, nowMs: NOW });
  assert.deepEqual(r, { modal: false, toast: false });
});

test('4c. 경계값: 정확히 30일 경과 → dueForRetake=true (>= 30)', () => {
  const data = computeStatusFromRows([{ created_at: daysAgo(30) }], NOW);
  assert.equal(data.dueForRetake, true, 'ageDays >= 30 이 경계');
});

// [케이스 5] 응시 이력 저장 실패/NULL — 과거 5회 재발 버그의 원인
test('5a. DB insert 실패(서버 completed:false) + 로컬 완료 마커 있음 → 모달 억제 (버그 수정의 핵심)', () => {
  // 응시는 했지만 서버 영속이 조용히 실패한 시나리오. 완료 시 markLevelDone()이 로컬 마커를 남기고,
  // 게이트는 hasTested = completed===true || localAt!==null 로 판단하므로 억제되어야 한다.
  const data = { completed: false }; // 서버는 기록을 못 찾음
  const r = decideLevelPromptGate({ data, localCompletedAtMs: NOW - 1 * DAY, nowMs: NOW });
  assert.equal(r.modal, false, '저장 실패여도 로컬 마커가 있으면 재노출 금지 — 재발 버그 지점');
  assert.equal(r.toast, false, '로컬 마커 1일 경과 → 재측정 토스트도 없음');
});

test('5b. DB 에러(catch) 응답도 completed:false → 로컬 마커 있으면 동일하게 억제', () => {
  const data = computeStatusOnDbError();
  const r = decideLevelPromptGate({ data, localCompletedAtMs: NOW - 2 * DAY, nowMs: NOW });
  assert.equal(r.modal, false);
});

test('5c. 저장 실패 + 로컬 마커도 없음(기기 변경 등) → 모달 재노출 (현재 정책: 과노출이 미노출보다 안전)', () => {
  // 서버·로컬 신호가 모두 없으면 미응시와 구분 불가 → 코드는 노출을 택한다(문서화된 fail-open).
  const r = decideLevelPromptGate({ data: { completed: false }, localCompletedAtMs: null, nowMs: NOW });
  assert.equal(r.modal, true);
});

test('5d. fetch/파싱 실패(data={}, completed 필드 없음) → 아무것도 안 띄움 (모호 시 침묵)', () => {
  const r = decideLevelPromptGate({ data: {}, nowMs: NOW });
  assert.deepEqual(r, { modal: false, toast: false });
});

// 스누즈·디스미스 보조 규칙
test('6a. 미응시 + 30일 스누즈 활성 → 모달 비노출', () => {
  const r = decideLevelPromptGate({
    data: { completed: false }, snoozedUntilMs: NOW + 15 * DAY, nowMs: NOW,
  });
  assert.equal(r.modal, false);
});

test('6b. 미응시 + 스누즈 만료(과거 시각) → 모달 다시 노출', () => {
  const r = decideLevelPromptGate({
    data: { completed: false }, snoozedUntilMs: NOW - 1, nowMs: NOW,
  });
  assert.equal(r.modal, true);
});

test('6c. 미응시 + 오늘 dismiss → 모달 비노출 (하루 1회 재유도)', () => {
  const r = decideLevelPromptGate({ data: { completed: false }, dismissedToday: true, nowMs: NOW });
  assert.equal(r.modal, false);
});

test('6d. 서버 completed:true면 로컬 마커 없어도 모달 억제 (서버가 소스 오브 트루스)', () => {
  const data = computeStatusFromRows([{ created_at: daysAgo(3) }], NOW);
  const r = decideLevelPromptGate({ data, localCompletedAtMs: null, nowMs: NOW });
  assert.deepEqual(r, { modal: false, toast: false });
});

// ─────────────────────────────────────────────────────────────
// PART 2. 프로덕션 소스 계약 검사 (미러 구현과 실제 코드의 표류 방지)
// ─────────────────────────────────────────────────────────────
console.log('\nPART 2. 프로덕션 소스 계약 검사');

const root = fileURLToPath(new URL('..', import.meta.url));
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function contract(name, file, patterns) {
  test(name, () => {
    const text = src(file);
    for (const [desc, re] of patterns) {
      assert.match(text, re, `${file} 에서 "${desc}" 계약이 깨짐 (패턴: ${re})`);
    }
  });
}

contract('C1. status 라우트 — 30일 판정·미기록/에러 시 completed:false 유지', 'app/api/ai-level-test/status/route.ts', [
  ['미기록 → completed:false',
    /rows\.length === 0\)\s*return NextResponse\.json\(\{ completed: false \}/],
  ['경과일 계산(ms/86400000)',
    /const ageDays = \(Date\.now\(\) - new Date\(r\.created_at\)\.getTime\(\)\) \/ 86400000/],
  ['재측정 경계 ageDays >= 30',
    /const dueForRetake = ageDays >= 30/],
  ['DB 에러 catch → completed:false',
    /catch\s*\{\s*return NextResponse\.json\(\{ completed: false \}/],
]);

contract('C2. page.tsx 게이트 — 완료자 모달 영구 미노출 + 미진단자 스누즈/디스미스 게이트', 'app/page.tsx', [
  ['RETAKE_DAYS = 30',
    /const RETAKE_DAYS = 30/],
  ['hasTested = 서버 completed || 로컬 마커',
    /const hasTested = data\?\.completed === true \|\| localAt !== null/],
  ['overdue = 서버 dueForRetake || 로컬 30일 경과',
    /data\?\.dueForRetake === true\s*\|\| \(localAt !== null && \(Date\.now\(\) - localAt\) >= RETAKE_DAYS \* 86400000\)/],
  ['미진단자 분기: completed === false 명시 (모호 시 미노출)',
    /else if \(!cancelled && data\?\.completed === false\)/],
  ['스누즈·오늘 dismiss 게이트',
    /if \(!promptSnoozed\(\) && !dismissedToday\(\)\)/],
  ['스누즈 저장 = 지금 + 30일',
    /aiLevelPromptSnoozedUntil', String\(Date\.now\(\) \+ RETAKE_DAYS \* 86400000\)/],
  ['완료 시 로컬 마커 기록(markLevelDone) — 저장 실패 대비 이중화',
    /onComplete=\{\(r\) => \{ setLevelTestNeeded\(false\); markLevelDone\(\);/],
  ['서버 completed 시 로컬 마커를 서버 시각으로 동기화',
    /if \(!cancelled && data\?\.completed && data\?\.latest\?\.at\)/],
]);

contract('C3. seen 라우트 — 최초 노출 시각 보존(COALESCE)', 'app/api/level-test/seen/route.ts', [
  ['COALESCE(level_test_done_at, now()) — 이미 있으면 덮어쓰지 않음',
    /SET level_test_done_at = COALESCE\(level_test_done_at, now\(\)\)/],
]);

contract('C4. level-test 제출 라우트 — 완료 시각 보존(COALESCE)', 'app/api/level-test/route.ts', [
  ['COALESCE(level_test_done_at, now())',
    /level_test_done_at = COALESCE\(level_test_done_at, now\(\)\)/],
]);

// ─────────────────────────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────────────────────────
console.log(`\n결과: ${passed} passed, ${failures.length} failed  (root: ${root})`);
if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log('레벨테스트 팝업 노출 조건 회귀 테스트 전체 통과');
}
