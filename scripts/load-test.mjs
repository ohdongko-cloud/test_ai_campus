// 간단한 부하 테스트 (Node 18+).
// 사용법:
//   node scripts/load-test.mjs                              # 기본 50 VU × 30초
//   node scripts/load-test.mjs --users 100 --duration 60   # 옵션
//   node scripts/load-test.mjs --url https://my.app        # URL 변경
//   node scripts/load-test.mjs --target home               # home | videos | api-videos | mix
//
// 메트릭: 요청 수, RPS, p50/p95/p99 latency, 4xx/5xx 카운트, 캐시 적중률.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const URL_BASE = args.url || 'https://retail-ai-campus.vercel.app';
const USERS    = parseInt(args.users || '50', 10);
const DURATION = parseInt(args.duration || '30', 10); // seconds
const TARGET   = args.target || 'mix';
const VERBOSE  = args.verbose === 'true';

const SCENARIOS = {
  home:      ['/'],
  videos:    ['/'],  // 영상 페이지로 가도 동일 SPA. 대신 API 직접 호출 검증:
  'api-videos': ['/api/videos'],
  mix: [
    '/api/videos',
    '/api/video-levels',
    '/api/services',
    '/api/stats',
    '/api/blocked-slots',
    '/api/guide',
  ],
};
const paths = SCENARIOS[TARGET] || SCENARIOS.mix;

const stats = {
  total: 0, ok: 0, errors: 0,
  status: {},
  latencies: [], // ms
  cacheHits: 0, cacheMisses: 0,
};

function record(ms, status, cache) {
  stats.total++;
  stats.latencies.push(ms);
  stats.status[status] = (stats.status[status] || 0) + 1;
  if (status >= 200 && status < 400) stats.ok++;
  else stats.errors++;
  if (cache === 'HIT') stats.cacheHits++;
  else if (cache === 'MISS') stats.cacheMisses++;
}

async function oneRequest(path) {
  const url = URL_BASE + path;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'load-test-script/1.0' },
    });
    // 본문 읽어야 실제 latency 측정
    await res.text();
    const ms = Date.now() - t0;
    const cache = res.headers.get('x-vercel-cache') || res.headers.get('cf-cache-status') || 'n/a';
    if (VERBOSE) console.log(`${res.status} ${ms}ms ${cache} ${path}`);
    record(ms, res.status, cache);
  } catch (e) {
    const ms = Date.now() - t0;
    record(ms, 0, 'n/a');
    if (VERBOSE) console.error(`ERROR ${ms}ms ${path}:`, e.message);
  }
}

async function virtualUser(endAt) {
  // 사용자 한 명이 endAt까지 루프 요청
  let i = 0;
  while (Date.now() < endAt) {
    const path = paths[i++ % paths.length];
    await oneRequest(path);
    // 사용자가 페이지 안에서 잠시 머무는 시간 (think-time)
    await new Promise(r => setTimeout(r, 200 + Math.random() * 500));
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p / 100));
  return sorted[idx];
}

async function main() {
  console.log(`\n부하 테스트 시작`);
  console.log(`  대상 URL    : ${URL_BASE}`);
  console.log(`  시나리오    : ${TARGET} (${paths.join(', ')})`);
  console.log(`  가상 사용자 : ${USERS}`);
  console.log(`  지속 시간   : ${DURATION}초\n`);

  const endAt = Date.now() + DURATION * 1000;
  const startedAt = Date.now();

  // 모든 VU 동시 시작 — 콜드 캐시 시나리오에 가깝게
  const vus = Array.from({ length: USERS }, () => virtualUser(endAt));
  await Promise.all(vus);

  const elapsed = (Date.now() - startedAt) / 1000;
  const rps = stats.total / elapsed;

  console.log('\n─────────────────────────────────────────');
  console.log('결과');
  console.log('─────────────────────────────────────────');
  console.log(`총 요청        : ${stats.total}`);
  console.log(`성공 (2xx/3xx) : ${stats.ok}`);
  console.log(`실패 (4xx/5xx) : ${stats.errors}`);
  console.log(`RPS            : ${rps.toFixed(1)} req/sec`);
  console.log(`실제 소요 시간 : ${elapsed.toFixed(1)}초`);
  console.log('\n응답 코드 분포:');
  for (const [code, count] of Object.entries(stats.status)) {
    console.log(`  ${code}: ${count}`);
  }
  console.log('\nLatency (응답 시간):');
  console.log(`  p50  (중간값)  : ${percentile(stats.latencies, 50)}ms`);
  console.log(`  p95  (느린 5%) : ${percentile(stats.latencies, 95)}ms`);
  console.log(`  p99  (느린 1%) : ${percentile(stats.latencies, 99)}ms`);
  console.log(`  max            : ${Math.max(...stats.latencies)}ms`);
  console.log('\nVercel Edge 캐시:');
  console.log(`  HIT  : ${stats.cacheHits} (${(stats.cacheHits / stats.total * 100).toFixed(1)}%)`);
  console.log(`  MISS : ${stats.cacheMisses}`);
  console.log('\n─────────────────────────────────────────');

  // 판정
  const errRate = stats.errors / stats.total;
  const p95 = percentile(stats.latencies, 95);
  let verdict = '✅ 양호';
  const issues = [];
  if (errRate > 0.01) issues.push(`에러율 ${(errRate * 100).toFixed(1)}% (>1%)`);
  if (p95 > 2000) issues.push(`p95 ${p95}ms (>2s)`);
  if (issues.length > 0) verdict = `⚠️  ${issues.join(', ')}`;
  console.log(`판정: ${verdict}\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
