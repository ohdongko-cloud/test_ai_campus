#!/usr/bin/env node
// scripts/sso-e2e-verify.mjs — SSO 허브 활성화(롤아웃 ②) 검증 스크립트.
// 근거: docs/sso/SSO-HUB-BLUEPRINT.md §3 단계 6(스모크 S1~S3) · 단계 7(E2E AC2~AC7).
//
// 원칙
//   - 신규 의존성 0 — repo에 이미 설치된 jose만 사용한다.
//   - **운영에 쓰기가 발생한다.** 1회 실행 기준 인벤토리:
//       · `sso_events` INSERT **최대** 3행 — T2 deny_unknown_app · T3 deny_redirect_mismatch · T4 deny_state_missing
//         (T7 prompt=none은 설계상 원시 행을 기록하지 않는다)
//         deny_* 로깅도 `sso_authorize_log` 예산(IP당 3행/분, rate_limited와 공유)을 통과할 때만 남는다 —
//         같은 분에 재실행하면 예산 소진으로 행이 안 생길 수 있다(응답 코드 판정은 영향받지 않는다).
//       · 세션 제공 시에만 추가로: `sso_events` issue 1행(실행자 email 포함) + `sso_nonces` INSERT 1행
//         + T10의 `sso_nonces` UPDATE 1행(consumed=true — nonce 1회 소비)
//       · 레이트리밋에 걸리면 `sso_events` rate_limited 행(IP당 3/분 상한)
//       · 90일 초과분 정리 DELETE — INSERT당 0.2% 확률이라 1회 실행(3~4 INSERT) 기준 약 0.7%
//     T2가 넣는 미등록 app 문자열은 관리자 'SSO 현황'의 **미등록 앱 프로빙 패널에 그대로 뜬다** —
//     공격이 아니라 자체검증 노이즈임을 식별할 수 있도록 app 이름에 selftest를 명시한다.
//   - 토큰·쿠키·이메일 원문을 절대 출력하지 않는다(CLAUDE.md §6-1 PII, §6-8).
//   - **미검증을 통과로 집계하지 않는다** — 조기 반환은 SKIP이며, SKIP이 하나라도 있으면
//     "활성화 완료" 판정을 낼 수 없다(exit 2).
//
// 사용
//   node scripts/sso-e2e-verify.mjs
//   node scripts/sso-e2e-verify.mjs --base https://retail-ai-campus.vercel.app --app sso-selftest
//   node scripts/sso-e2e-verify.mjs --redirect https://retail-ai-campus.vercel.app/sso-selftest-callback
//
// 세션이 필요한 항목(T8~T11)은 허브 세션 쿠키를 환경변수로 넘길 때만 실행된다.
//   PowerShell : $env:SSO_TEST_COOKIE = 'user_session=<값>'
//   bash       : export SSO_TEST_COOKIE='user_session=<값>'
//   (DevTools → Application → Cookies → user_session. httpOnly라 JS로는 못 읽는다.)
// ⚠️ 이 값은 자리표시자가 아니라 **살아 있는 세션 쿠키**다. `.env`/`.env.local`에 절대 기입하지 말 것
//    (자리표시자가 아니므로 gitleaks allowlist 대상도 아니다). 셸 히스토리에 남는 점도 주의.
//    검증이 끝나면 환경변수를 지우고 해당 세션을 로그아웃할 것. 스크립트는 쿠키 값을 출력하지 않는다.
//
// ⚠️ 재실행 간격: /sso/userinfo 레이트리밋이 IP당 10회/분인데 1회 실행이 최대 4회를 쓴다.
//    60초 안에 3회 이상 연달아 돌리지 말 것(429는 FAIL이 아니라 RATE_LIMITED로 분류된다).
//
// 종료 코드
//   0 = 전 항목 실측 통과
//   1 = 실패 항목 존재
//   2 = 실패는 없으나 **미검증(SKIP/RATE_LIMITED) 항목이 남음** → "활성화 완료" 선언 불가
//       (POSIX의 '사용법 오류'가 아니다. 0이 아니면 전부 미완료로 취급할 것.)

import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';

// ── 인자 파싱 ───────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', 'https://retail-ai-campus.vercel.app').replace(/\/+$/, '');
const APP = arg('app', 'sso-selftest');
// 기본 콜백 = 허브 자기 도메인의 404 경로(블루프린트 §3 단계 7). 302 Location만 읽으면 되므로 충분.
// ★ sso_clients에 등록한 redirect_uris 값과 **정확매칭**해야 한다. 다르면 --redirect로 실제 등록값을 넘길 것.
const REDIRECT = arg('redirect', `${BASE}/sso-selftest-callback`);
const ISSUER = arg('issuer', BASE);
const COOKIE = process.env.SSO_TEST_COOKIE || '';

// ── 결과 수집 ───────────────────────────────────────────────────────────────
/** status: 'pass' | 'fail' | 'skip' | 'rate_limited' */
const results = [];
const MARK = { pass: '✅ PASS', fail: '❌ FAIL', skip: '⏭  SKIP', rate_limited: '⏳ RATE_LIMITED' };

function record(id, title, status, detail) {
  results.push({ id, title, status, detail });
  console.log(`${MARK[status]}  ${id}  ${title}`);
  if (detail) console.log(`         ${detail}`);
}

/** 레이트리밋으로 판정 불가 — FAIL과 구분한다(보안결함 오진단 방지). */
class RateLimited extends Error {}

/**
 * 테스트 실행기.
 *  - 정상 반환 문자열            → PASS
 *  - 'SKIP:' 로 시작하는 문자열  → SKIP (전제 미충족 = 미검증. 절대 PASS로 세지 않는다)
 *  - RateLimited throw           → RATE_LIMITED
 *  - 그 외 throw                 → FAIL
 */
async function check(id, title, fn) {
  try {
    const detail = await fn();
    if (typeof detail === 'string' && detail.startsWith('SKIP:')) {
      record(id, title, 'skip', detail.slice(5).trim());
      return;
    }
    record(id, title, 'pass', detail);
  } catch (e) {
    if (e instanceof RateLimited) {
      record(id, title, 'rate_limited', e.message);
      return;
    }
    record(id, title, 'fail', e instanceof Error ? e.message : String(e));
  }
}

function skip(id, title, why) {
  record(id, title, 'skip', why);
}

// ── 마스킹 유틸 (PII·시크릿 원문 출력 금지) ────────────────────────────────
function maskEmail(v) {
  if (typeof v !== 'string' || !v.includes('@')) return '<non-email>';
  const [l, d] = v.split('@');
  return `${l.slice(0, 1)}***@${d}`;
}
function maskToken(v) {
  return typeof v === 'string' ? `<jwt len=${v.length}>` : '<none>';
}

// ── HTTP 헬퍼 ──────────────────────────────────────────────────────────────
async function get(path, { headers = {}, manual = false } = {}) {
  return await fetch(path.startsWith('http') ? path : `${BASE}${path}`, {
    method: 'GET',
    headers,
    redirect: manual ? 'manual' : 'follow',
  });
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function must(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 429면 판정 불가로 분류(스로틀링을 보안결함으로 오진단하지 않기 위해). */
function guardRateLimit(res, which) {
  if (res.status === 429) {
    throw new RateLimited(`${which} 레이트리밋(429) — 60초 대기 후 재실행. 판정 불가(통과 아님).`);
  }
}

/**
 * authorize 400 응답을 "전제 미충족(SKIP)"으로 분류할지 판단.
 * 검증 순서: app → redirect_uri → state (app/sso/authorize/route.ts).
 * 앞 단계에서 걸리면 그 뒤 항목은 애초에 실행되지 않으므로 검증된 것이 아니다.
 */
function preconditionSkip(body) {
  if (body?.error === 'unknown app') {
    return `SKIP: app='${APP}' 미등록 또는 enabled=false — sso_clients 등록·활성화 후 재실행해야 이 항목이 검증된다.`;
  }
  if (body?.error === 'redirect_uri not allowed') {
    return `SKIP: redirect_uri 불일치 — 스크립트 기본값(${REDIRECT})이 sso_clients.redirect_uris와 정확매칭하지 않는다. --redirect 로 실제 등록값을 넘길 것.`;
  }
  return null;
}

function authorizeUrl(params) {
  const u = new URL(`${BASE}/sso/authorize`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

// ── 검증 본체 ──────────────────────────────────────────────────────────────
console.log(`\nSSO 허브 검증  base=${BASE}  app=${APP}`);
console.log(`redirect_uri=${REDIRECT}`);
console.log(`세션 쿠키: ${COOKIE ? '제공됨(발급 경로까지 검증)' : '없음(공개 경로만 검증)'}\n`);

// S1 — JWKS 200 + 개인키 성분 부재
await check('T1', 'JWKS 200 · 공개 성분만 노출(d/p/q 부재)', async () => {
  const res = await get('/.well-known/jwks.json');
  must(res.status === 200, `기대 200, 실제 ${res.status} — SSO_* env 미설정이면 500(=SSO OFF)`);
  const body = await json(res);
  must(body && Array.isArray(body.keys) && body.keys.length > 0, 'keys 배열이 비어 있음');
  const k = body.keys[0];
  must(k.kty === 'RSA' && k.n && k.e, 'kty/n/e 누락');
  must(k.use === 'sig' && k.alg === 'RS256', `use/alg 불일치 (use=${k.use}, alg=${k.alg})`);
  must(typeof k.kid === 'string' && k.kid.length > 0, 'kid 없음');
  for (const priv of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
    must(!(priv in k), `🚨 개인키 성분 ${priv} 노출됨 — 즉시 키 회전 필요`);
  }
  const cc = res.headers.get('cache-control') || '';
  must(cc.includes('max-age'), `Cache-Control에 max-age 없음: "${cc}"`);
  return `kid=${k.kid} · cache-control=${cc}`;
});

// S2 — 미등록 app → 400 (리다이렉트 금지)
await check('T2', '미등록 app → 400 unknown app (오픈리다이렉트 차단)', async () => {
  const res = await get(
    authorizeUrl({ app: '__selftest_unknown__', redirect_uri: 'https://evil.example/cb', state: 'x' }),
    { manual: true },
  );
  guardRateLimit(res, 'authorize');
  must(res.status === 400, `기대 400, 실제 ${res.status}${res.status === 302 ? ' — 🚨 리다이렉트 발생' : ''}`);
  const body = await json(res);
  must(body?.error === 'unknown app', `기대 error="unknown app", 실제 ${JSON.stringify(body)}`);
  must(!res.headers.get('location'), '🚨 400인데 Location 헤더 존재 — 오픈리다이렉트 위험');
  return '400 + Location 헤더 없음';
});

// S3 — redirect_uri 불일치 → 400
await check('T3', 'redirect_uri 불일치 → 400 (정확매칭)', async () => {
  const res = await get(
    authorizeUrl({ app: APP, redirect_uri: 'https://evil.example/cb', state: 'x' }),
    { manual: true },
  );
  guardRateLimit(res, 'authorize');
  const body = await json(res);
  if (body?.error === 'unknown app') return preconditionSkip(body);
  must(res.status === 400, `기대 400, 실제 ${res.status}`);
  must(
    body?.error === 'redirect_uri not allowed',
    `기대 "redirect_uri not allowed", 실제 ${JSON.stringify(body)}`,
  );
  must(!res.headers.get('location'), '🚨 400인데 Location 헤더 존재');
  return 'redirect_uri 정확매칭 동작';
});

// S3' — state 누락 → 400
await check('T4', 'state 누락 → 400 state required (CSRF 필수)', async () => {
  const res = await get(authorizeUrl({ app: APP, redirect_uri: REDIRECT }), { manual: true });
  guardRateLimit(res, 'authorize');
  const body = await json(res);
  const pre = preconditionSkip(body);
  if (pre) return pre;
  must(res.status === 400, `기대 400, 실제 ${res.status}`);
  must(body?.error === 'state required', `기대 "state required", 실제 ${JSON.stringify(body)}`);
  return 'state 필수 강제 확인';
});

// userinfo — Bearer 없음/위조 → 401 통일
await check('T5', 'userinfo Bearer 없음 → 401 unauthorized', async () => {
  const res = await get('/sso/userinfo');
  guardRateLimit(res, 'userinfo');
  must(res.status === 401, `기대 401, 실제 ${res.status}`);
  const body = await json(res);
  must(body?.error === 'unauthorized', `기대 unauthorized, 실제 ${JSON.stringify(body)}`);
  return '통일 401';
});

await check('T6', 'userinfo 위조 토큰 → 401 (서명 검증)', async () => {
  const res = await get('/sso/userinfo', { headers: { authorization: 'Bearer not.a.jwt' } });
  guardRateLimit(res, 'userinfo');
  must(res.status === 401, `기대 401, 실제 ${res.status}`);
  return '서명 검증 실패 → 401';
});

// prompt=none · 무세션 → error=login_required 리다이렉트 (쿠키 불필요)
await check('T7', 'prompt=none + 무세션 → error=login_required 302 (silent 체크)', async () => {
  const res = await get(
    authorizeUrl({ app: APP, redirect_uri: REDIRECT, state: 'st-none', prompt: 'none' }),
    { manual: true },
  );
  guardRateLimit(res, 'authorize');
  if (res.status === 400) {
    const body = await json(res);
    const pre = preconditionSkip(body);
    if (pre) return pre;
    throw new Error(`예상치 못한 400: ${JSON.stringify(body)}`);
  }
  must(res.status === 302, `기대 302, 실제 ${res.status}`);
  const loc = res.headers.get('location') || '';
  must(loc.startsWith(REDIRECT), 'Location이 등록 redirect_uri로 시작하지 않음');
  must(loc.includes('error=login_required'), 'error=login_required 없음');
  must(loc.includes('state=st-none'), 'state echo 없음');
  must(!loc.includes('token='), '🚨 무세션인데 token이 발급됨');
  return 'silent 실패 경로 정상';
});

// ── 세션 필요 구간 (T8~T11) ────────────────────────────────────────────────
if (!COOKIE) {
  skip('T8', 'id_token 발급 302 (세션 필요)', 'SSO_TEST_COOKIE 미설정');
  skip('T9', 'id_token 클레임 검증 (RS256/iss/aud/exp 60s)', 'SSO_TEST_COOKIE 미설정');
  skip('T10', 'userinfo 200 · 최소 프로필 · 권한 클레임 부재', 'SSO_TEST_COOKIE 미설정');
  skip('T11', 'userinfo 재사용 → 401 (nonce 1회성)', 'SSO_TEST_COOKIE 미설정');
} else {
  const state = 'st-' + Math.random().toString(36).slice(2, 10);
  let token = '';
  let tokenIat = 0;
  let t10Ok = false; // T11이 nonce 가드를 실제로 검증했는지 판정하는 전제

  await check('T8', 'id_token 발급 302 · state echo', async () => {
    const res = await get(authorizeUrl({ app: APP, redirect_uri: REDIRECT, state, kit: 'e2e' }), {
      manual: true,
      headers: { cookie: COOKIE },
    });
    guardRateLimit(res, 'authorize');
    if (res.status === 400) {
      const body = await json(res);
      const pre = preconditionSkip(body);
      if (pre) return pre;
      throw new Error(`400 — 예상치 못한 거부: ${JSON.stringify(body)}`);
    }
    must(res.status === 302, `기대 302, 실제 ${res.status}`);
    const loc = res.headers.get('location') || '';
    if (loc.includes('/login?next=')) {
      throw new Error('허브 로그인으로 리다이렉트됨 — SSO_TEST_COOKIE가 만료/무효');
    }
    must(loc.startsWith(REDIRECT), 'Location이 등록 redirect_uri로 시작하지 않음');
    const u = new URL(loc);
    token = u.searchParams.get('token') || '';
    must(token, 'token 파라미터 없음');
    must(u.searchParams.get('state') === state, 'state echo 불일치');
    return `token=${maskToken(token)} · state echo OK`;
  });

  await check('T9', 'id_token 검증 — RS256/kid/iss/aud/exp=60s/nonce', async () => {
    if (!token) return 'SKIP: T8 미통과로 토큰 없음';
    const header = decodeProtectedHeader(token);
    must(header.alg === 'RS256', `alg=${header.alg} (RS256이어야 함)`);
    must(header.kid, 'kid 헤더 없음');
    const jwks = createRemoteJWKSet(new URL(`${BASE}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, { issuer: ISSUER, audience: APP });
    // iat는 서명 검증 직후 즉시 확보한다. 아래 assertion 중 하나라도 실패하면 tokenIat이
    // 0으로 남아 T11의 "만료 vs 재사용 차단" 구분 가드가 무력화되기 때문.
    tokenIat = Number(payload.iat);
    must(typeof payload.nonce === 'string' && payload.nonce, 'nonce 클레임 없음');
    must(typeof payload.sub === 'string' && payload.sub.includes('@'), 'sub가 이메일이 아님');
    must(payload.email === payload.sub, 'email 클레임이 sub와 불일치');
    const ttl = Number(payload.exp) - Number(payload.iat);
    must(ttl === 60, `exp-iat=${ttl}s (60s이어야 함)`);
    for (const forbidden of ['role', 'roles', 'permissions', 'is_admin']) {
      must(!(forbidden in payload), `🚨 인가 클레임 ${forbidden} 포함됨 (N2 위반)`);
    }
    return `kid=${header.kid} · sub=${maskEmail(payload.sub)} · aud=${payload.aud} · ttl=${ttl}s`;
  });

  await check('T10', 'userinfo 200 · 최소 프로필만 · no-store', async () => {
    if (!token) return 'SKIP: T8 미통과로 토큰 없음';
    const res = await get('/sso/userinfo', { headers: { authorization: `Bearer ${token}` } });
    guardRateLimit(res, 'userinfo');
    must(res.status === 200, `기대 200, 실제 ${res.status}`);
    const body = await json(res);
    must(body?.email, 'email 없음');
    const keys = Object.keys(body).sort();
    const expected = ['corporation_name', 'email', 'name', 'organization_name', 'position'];
    must(
      JSON.stringify(keys) === JSON.stringify(expected),
      `응답 필드 불일치: ${keys.join(',')} (기대: ${expected.join(',')})`,
    );
    must(
      (res.headers.get('cache-control') || '').includes('no-store'),
      `Cache-Control에 no-store 없음: ${res.headers.get('cache-control')}`,
    );
    t10Ok = true;
    return `email=${maskEmail(body.email)} · 필드 ${keys.length}개 · no-store OK`;
  });

  await check('T11', 'userinfo 재사용 → 401 (⓪ nonce 1회성 가드 실측)', async () => {
    if (!token) return 'SKIP: T8 미통과로 토큰 없음';
    // T10이 200이 아니었다면 nonce는 애초에 소비된 적이 없다.
    // 그 상태의 401은 "재사용 차단"이 아니라 "처음부터 검증 실패"이므로 통과로 세면 거짓 통과다.
    if (!t10Ok) return 'SKIP: T10이 200이 아니어서 nonce가 소비된 적 없음 — 재사용 차단을 검증할 수 없다';
    // 토큰 TTL이 60초라, 만료로 인한 401을 "재사용 차단"으로 오인하지 않도록 여유시간을 확인한다.
    const elapsed = Math.floor(Date.now() / 1000) - tokenIat;
    if (tokenIat && elapsed >= 50) {
      return `SKIP: 발급 후 ${elapsed}s 경과 — 만료(60s)와 재사용 차단을 구분할 수 없다. 재실행 권장`;
    }
    const res = await get('/sso/userinfo', { headers: { authorization: `Bearer ${token}` } });
    guardRateLimit(res, 'userinfo');
    must(
      res.status === 401,
      `🚨 기대 401(재사용 차단), 실제 ${res.status} — nonce 1회성 가드가 동작하지 않음`,
    );
    return `nonce 소비 후 재조회 차단 확인 (발급 후 ${elapsed}s)`;
  });
}

// ── 요약 ───────────────────────────────────────────────────────────────────
const by = (s) => results.filter((r) => r.status === s);
const failed = by('fail');
const skipped = by('skip');
const throttled = by('rate_limited');
const passed = by('pass');

console.log(
  `\n결과: ${passed.length} PASS · ${failed.length} FAIL · ${skipped.length} SKIP · ${throttled.length} RATE_LIMITED`,
);
if (failed.length) {
  console.log('\n실패:');
  for (const f of failed) console.log(`  - ${f.id} ${f.title}\n    ${f.detail}`);
}
if (skipped.length) {
  console.log('\n미검증(SKIP) — 아래 항목은 "통과"가 아니다:');
  for (const s of skipped) console.log(`  - ${s.id} ${s.title}\n    ${s.detail}`);
}
if (throttled.length) {
  console.log('\n레이트리밋으로 판정 불가 — 60초 후 재실행:');
  for (const t of throttled) console.log(`  - ${t.id} ${t.title}`);
}

console.log('\n판정:');
if (failed.length) {
  console.log('  ❌ 활성화 완료 선언 불가 — 실패 항목 존재.');
} else if (skipped.length || throttled.length) {
  console.log('  ⚠️  활성화 완료 선언 불가 — 미검증 항목이 남아 있다(0 FAIL ≠ 전부 검증됨).');
} else {
  console.log('  ✅ 스모크 S1~S3 + AC2~AC7 전 항목 실측 통과.');
  console.log('     단, known-good 6종(로그인·가입OTP·재설정·영상·모바일·admin) 재실행은 별도다.');
}
console.log(
  '\n주의: T10은 nonce를 실제로 1회 소비한다. 같은 토큰으로 다시 검증할 수 없다(정상 동작).',
);

// 0=전항 통과 · 1=실패 존재 · 2=실패는 없으나 미검증 존재
process.exit(failed.length ? 1 : skipped.length || throttled.length ? 2 : 0);
