// /login sanitizeNext 오픈리다이렉트 방지 — 회귀 테스트 (골든)
// 실행: npm run test:golden  (= node tests/sanitize-next.test.mjs 포함)
// 의존성 없음(node 내장 assert만 사용). 실 DB/네트워크 호출 없음.
//
// 배경(docs/sso/SSO-HUB-BLUEPRINT.md §6-B3, major):
//   과거 prefix 문자열 검사(startsWith('//') 등)는 탭/CR/LF 삽입으로 우회 가능했다.
//   WHATWG URL 파서는 제어문자(TAB/CR/LF)를 위치 무관 제거하므로 '/\t/evil.com'이
//   브라우저에서 '//evil.com'(프로토콜 상대 → 외부 도메인)으로 해석된다.
//   → URL 파서 기반 검증으로 교체: 더미 오리진(https://x.invalid)에 상대 해석해
//     origin 유지 판정 + '/'-prefix 검사 + 파서 정규화 값(pathname+search+hash) 반환.
//
// 판정 로직 위치(프로덕션): app/login/page.tsx sanitizeNext
//   "use client" tsx라 직접 import 불가 — 리팩터 금지 제약(1,800명 운영 코드).
//
// 구성:
//   PART 1. sanitizeNext 미러 구현에 대한 단위 테스트 (공격/정상 케이스를 실행 가능한 스펙으로 고정)
//   PART 2. 프로덕션 소스 계약 검사 — 핵심 표현식이 소스에서 사라지거나 바뀌면 실패
//           (인라인 로직을 import할 수 없으므로, 미러와 실제 코드의 표류를 이걸로 방지)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────
// sanitizeNext 미러 (app/login/page.tsx 와 1:1 동일 로직 — 표류 시 PART 2가 잡는다)
// ─────────────────────────────────────────────────────────────
function sanitizeNext(raw) {
  if (!raw) return '/';
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  if (!decoded.startsWith('/')) return '/';
  try {
    const base = 'https://x.invalid';
    const u = new URL(decoded, base);
    if (u.origin !== base) return '/';
    const out = u.pathname + u.search + u.hash;
    // 정규화 결과 재판정 — origin 검사는 정규화 '이전' 값 기준이라 dot-segment를 놓친다.
    if (new URL(out, base).origin !== base) return '/';
    return out;
  } catch {
    return '/';
  }
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

console.log('\nPART 1. sanitizeNext 단위 테스트');

// [전제 검증] 위협 모델의 근거: WHATWG 파서는 TAB을 위치 무관 제거한다
test('0. 전제: new URL("/\\t/evil.com", base)의 origin은 https://evil.com (탭 제거 → 프로토콜 상대)', () => {
  const u = new URL('/\t/evil.com', 'https://x.invalid');
  assert.equal(u.origin, 'https://evil.com', '이 전제가 깨지면 위협 모델 자체를 재검토해야 함');
});

// [공격 케이스] 전부 '/' 로 폴백해야 한다
const attacks = [
  ['탭 삽입 프로토콜 상대', '/\t/evil.com'],
  ['LF 삽입', '/\n/evil.com'],
  ['CR 삽입', '/\r/evil.com'],
  ['프로토콜 상대 //', '//evil.com'],
  ['백슬래시 (/\\)', '/\\evil.com'],
  ['백슬래시 시작 (\\\\)', '\\evil.com'],
  ['절대 URL', 'https://evil.com'],
  ['인코딩된 탭 %09 (decodeURIComponent 후 탭)', '/%09/evil.com'],
  ['javascript: 스킴', 'javascript:alert(1)'],
  ['탭 2개 + //', '/\t\t//evil.com'],
  ['인코딩된 슬래시 %2F%2F (decode 후 //)', '%2F%2Fevil.com'],
  ['슬래시 3개 (특수 스킴 슬래시 무시)', '///evil.com'],
  ['백슬래시 2개', '/\\\\evil.com'],
  // ★ dot-segment 정규화 우회 (2026-08-06 킷 보안 게이트가 발견 — 기존 25케이스가 못 잡던 실취약점).
  //   origin 검사는 정규화 '이전' 값 기준이라 통과하고, 파서가 '..'를 걷어낸 pathname만
  //   '//evil.com'(프로토콜 상대)이 되어 리다이렉트 대상으로 쓰이면 외부 오리진으로 해석됐다.
  ['dot-segment → 프로토콜 상대', '/..//evil.com'],
  ['인코딩된 dot-segment %2e%2e', '/%2e%2e//evil.com'],
  ['하위경로 뒤 dot-segment', '/foo/..//evil.com'],
  ['dot-segment + 슬래시 3개', '/..///evil.com'],
];
for (const [desc, input] of attacks) {
  test(`A. 공격 차단: ${desc} → '/'`, () => {
    assert.equal(sanitizeNext(input), '/', `입력 ${JSON.stringify(input)} 은 '/' 로 폴백해야 함`);
  });
}

// [정상 케이스] 기존 동작 보존 — 쿼리·해시 포함 그대로 통과 (SSO authorize 복귀 게이트)
const normals = [
  ['루트', '/', '/'],
  ['일반 경로', '/videos', '/videos'],
  ['해시 보존', '/#board', '/#board'],
  ['SSO authorize 쿼리 보존', '/sso/authorize?app=x&state=y&nonce=z', '/sso/authorize?app=x&state=y&nonce=z'],
  ['인코딩된 next (authorize가 encodeURIComponent로 생성)', encodeURIComponent('/sso/authorize?app=x'), '/sso/authorize?app=x'],
  ['경로+쿼리+해시 동시 보존', '/video/42?t=10#notes', '/video/42?t=10#notes'],
];
for (const [desc, input, expected] of normals) {
  test(`N. 정상 통과: ${desc}`, () => {
    assert.equal(sanitizeNext(input), expected, `입력 ${JSON.stringify(input)} → ${JSON.stringify(expected)}`);
  });
}

// [경계 케이스] null / 빈문자열 / 디코딩 실패
test('E1. null → /', () => { assert.equal(sanitizeNext(null), '/'); });
test('E2. 빈문자열 → /', () => { assert.equal(sanitizeNext(''), '/'); });
test('E3. 디코딩 실패(%zz) → /', () => { assert.equal(sanitizeNext('/%zz'), '/'); });

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

contract('C1. sanitizeNext — URL 파서 기반 검증 계약', 'app/login/page.tsx', [
  ['decodeURIComponent 후 시작 (디코딩 실패 catch → /)',
    /decoded = decodeURIComponent\(raw\);\s*\}\s*catch\s*\{\s*return '\/';/],
  ['/-prefix 선행 검사 (상대경로 의미 변화 방지)',
    /if \(!decoded\.startsWith\('\/'\)\) return '\/';/],
  ['더미 오리진 .invalid TLD',
    /const base = 'https:\/\/x\.invalid';/],
  ['URL 파서 상대 해석',
    /new URL\(decoded, base\)/],
  ['origin 유지 판정 (바뀌면 /)',
    /if \(u\.origin !== base\) return '\/';/],
  ['파서 정규화 값 산출 (pathname+search+hash — 쿼리·해시 보존)',
    /const out = u\.pathname \+ u\.search \+ u\.hash;/],
  ['정규화 결과 재판정 (dot-segment → 프로토콜 상대 우회 차단)',
    /if \(new URL\(out, base\)\.origin !== base\) return '\/';/],
  ['파싱 실패 catch → /',
    /new URL\(decoded, base\);[\s\S]*?\}\s*catch\s*\{\s*return '\/';\s*\}/],
]);

test('C2. sanitizeNext — 취약했던 prefix 문자열 검사(구식 프로토콜 정규식) 잔존 금지', () => {
  // 과거 우회 가능 패턴(/^\/[a-zA-Z][a-zA-Z0-9+\-.]*:/ 정규식 검사)이 되살아나면 실패시킨다
  const text = src('app/login/page.tsx');
  assert.equal(text.includes('[a-zA-Z][a-zA-Z0-9'), false,
    '구식 정규식 기반 프로토콜 검사가 app/login/page.tsx 에 다시 나타남 — URL 파서 검증으로 유지할 것');
  assert.equal(text.includes("startsWith('//')"), false,
    "구식 startsWith('//') prefix 검사가 다시 나타남 — 탭/CR/LF 우회 가능 패턴");
});

// ─────────────────────────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────────────────────────
console.log(`\n결과: ${passed} passed, ${failures.length} failed  (root: ${root})`);
if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log('sanitizeNext 오픈리다이렉트 방지 회귀 테스트 전체 통과');
}
