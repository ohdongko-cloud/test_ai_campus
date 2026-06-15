// AI 레벨테스트 — 적응형 출제 + 채점 엔진 (서버 전용)
// PRD: docs/prd/2026-06-15-ai-level-test.md (F2·F4)
//
// 설계: stateless. 클라이언트가 attemptId(난수 시드)와 지금까지의 답(answers)을 매번 보내면,
//   서버가 그 둘로 '다음 문항' 또는 '최종 결과'를 결정론적으로 재계산한다.
//   → 정답은 서버에만 있고(클라이언트 미전송), DB 없이도 응시 흐름이 동작(프리뷰 가능).
//   → 최종 결과만 별도 라우트에서 DB에 영속(베스트 에포트).
//
// 적응형 규칙: 영역별로 초급 2 → (영역 누적비율 ≥ 0.5면) 중급 1 → (≥0.5면) 고급 1.
//   낮은 허들에서 걸러지면 그 영역의 상위 난이도는 건너뜀(조기 종료). 영역당 2~4문항, 총 10~20.

import { LEVEL_TEST_SEED, type LtSeedQuestion } from './level-test-questions';

export const AREA_ORDER = ['security', 'ops', 'automation', 'services', 'ebg', 'service_count'] as const;
export type Area = (typeof AREA_ORDER)[number];

const ADVANCE_RATIO = 0.5;   // 다음 난이도로 진급하는 영역 누적 득점비율
const BASE_PER_TIER1 = 2;    // 영역당 초급 출제 수

export interface ClientQuestion {
  id: string;                // 안정 식별자 (area#tier#index)
  area: string;
  tier: number;
  tierLabel: string;
  category: string;
  body: string;
  options: string[];
  kind: 'knowledge' | 'behavior';  // 클라이언트 표시용(정답/배점은 미전송)
}

export interface Answer { id: string; choice: number; }

export interface ScoreResult {
  done: true;
  areaRatio: Record<string, number>;   // 0~1
  c1: number; c2: number; c3: number;  // 0~100 (지식/행동/EBG)
  codingStatus: 'pending';             // MVP: 코딩 보류
  autoScore: number;                   // 0~100 (코딩 제외 잠정 환산)
  level: number;                       // 1~10
  served: number; correctish: number;
}

// ── 안정 ID 부여 + 인덱싱 ──
const TIER_LABELS: Record<number, string> = { 1: '초급', 2: '중급', 3: '고급' };
type IndexedQ = LtSeedQuestion & { id: string };

const INDEXED: IndexedQ[] = (() => {
  const counter: Record<string, number> = {};
  return LEVEL_TEST_SEED.map((q) => {
    const key = `${q.area}#${q.tier}`;
    const i = counter[key] = (counter[key] ?? 0) + 1;
    return { ...q, id: `${q.area}#${q.tier}#${i - 1}` };
  });
})();
const BY_ID = new Map(INDEXED.map((q) => [q.id, q]));
const byAreaTier = (area: string, tier: number) => INDEXED.filter((q) => q.area === area && q.tier === tier);

// ── 시드 PRNG (attemptId → 결정론적 셔플) ──
function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// attemptId로 영역별·난이도별 후보 순서를 결정론적으로 생성
function buildPlan(attemptId: string): Record<string, Record<number, IndexedQ[]>> {
  const rnd = mulberry32(hashSeed(attemptId));
  const plan: Record<string, Record<number, IndexedQ[]>> = {};
  for (const area of AREA_ORDER) {
    plan[area] = { 1: shuffled(byAreaTier(area, 1), rnd), 2: shuffled(byAreaTier(area, 2), rnd), 3: shuffled(byAreaTier(area, 3), rnd) };
  }
  return plan;
}

// 보기 순서를 (attemptId, 문항id)로 결정론적 셔플 → 정답 위치를 사용자별 무작위화.
// perm[displayIndex] = originalIndex
function optionPerm(attemptId: string, qid: string, n: number): number[] {
  // 행동/EBG의 '숫자 구간(0개<1개<…)' 보기는 순서가 의미 → 셔플 안 함.
  const q = BY_ID.get(qid);
  if (!q || !q.correct) return Array.from({ length: n }, (_, i) => i);
  return shuffled(Array.from({ length: n }, (_, i) => i), mulberry32(hashSeed(attemptId + '|' + qid)));
}

// 한 문항 채점: earned(획득), max(배점). choice는 '표시 순서' 기준 → 원본 인덱스로 환원해 채점.
function gradeOne(q: IndexedQ, displayChoice: number, attemptId: string): { earned: number; max: number } {
  const max = q.points;
  const perm = optionPerm(attemptId, q.id, q.options.length);
  const orig = perm[displayChoice] ?? displayChoice;
  if (q.correct) return { earned: q.correct.includes(orig) ? max : 0, max };          // 지식: 정답형
  const ratio = q.optionScores?.[orig] ?? 0;                                          // 행동/EBG: 구간형
  return { earned: max * ratio, max };
}

// 한 영역의 '적응형 출제 시퀀스'를 현재까지의 답으로부터 재구성
function areaSequence(plan: Record<number, IndexedQ[]>, answers: Map<string, number>, attemptId: string): IndexedQ[] {
  const seq: IndexedQ[] = [...plan[1].slice(0, BASE_PER_TIER1)];          // 초급 2
  let earned = 0, max = 0, answeredAll = true;
  for (const q of seq) {
    if (answers.has(q.id)) { const g = gradeOne(q, answers.get(q.id)!, attemptId); earned += g.earned; max += g.max; }
    else answeredAll = false;
  }
  if (answeredAll && max > 0 && earned / max >= ADVANCE_RATIO && plan[2][0]) {  // 중급 진급
    const mid = plan[2][0]; seq.push(mid);
    if (answers.has(mid.id)) {
      const g = gradeOne(mid, answers.get(mid.id)!, attemptId); earned += g.earned; max += g.max;
      if (max > 0 && earned / max >= ADVANCE_RATIO && plan[3][0]) seq.push(plan[3][0]);  // 고급 진급
    }
  }
  return seq;
}

function sanitize(q: IndexedQ, attemptId: string): ClientQuestion {
  const perm = optionPerm(attemptId, q.id, q.options.length);
  return { id: q.id, area: q.area, tier: q.tier, tierLabel: TIER_LABELS[q.tier], category: q.category, body: q.body,
    options: perm.map((pi) => q.options[pi]),
    kind: q.correct ? 'knowledge' : 'behavior' };
}

// 다음 문항 또는 최종 결과를 반환 (stateless)
export function nextOrResult(attemptId: string, rawAnswers: Answer[]): { done: false; question: ClientQuestion; progress: { index: number; max: number } } | ScoreResult {
  const plan = buildPlan(attemptId);
  const answers = new Map<string, number>();
  for (const a of rawAnswers) if (BY_ID.has(a.id)) answers.set(a.id, a.choice);

  // 전체 적응형 시퀀스(영역 순서대로) 재구성
  const fullSeq: IndexedQ[] = [];
  for (const area of AREA_ORDER) fullSeq.push(...areaSequence(plan[area], answers, attemptId));

  // 아직 안 푼 첫 문항 = 다음 문항
  const next = fullSeq.find((q) => !answers.has(q.id));
  if (next) {
    const idx = fullSeq.filter((q) => answers.has(q.id)).length;
    return { done: false, question: sanitize(next, attemptId), progress: { index: idx + 1, max: Math.max(fullSeq.length, idx + 1) } };
  }

  // ── 종료: 채점 ──
  const earnedByArea: Record<string, number> = {}, maxByArea: Record<string, number> = {};
  let served = 0, correctish = 0;
  for (const q of fullSeq) {
    const g = gradeOne(q, answers.get(q.id)!, attemptId);
    earnedByArea[q.area] = (earnedByArea[q.area] ?? 0) + g.earned;
    maxByArea[q.area] = (maxByArea[q.area] ?? 0) + g.max;
    served++; if (g.earned >= g.max * 0.5) correctish++;
  }
  const ratio = (a: string) => (maxByArea[a] > 0 ? earnedByArea[a] / maxByArea[a] : 0);
  const areaRatio: Record<string, number> = {};
  for (const a of AREA_ORDER) areaRatio[a] = ratio(a);

  // 지식 10% 내부 비중: 보안 1 / 운영도구 3 / 자동화 3 / 서비스이해 3 (합 10)
  const k = (areaRatio.security * 1 + areaRatio.ops * 3 + areaRatio.automation * 3 + areaRatio.services * 3) / 10;
  const svc = areaRatio.service_count;                                        // 행동-양
  const ebg = areaRatio.ebg;                                                  // EBG
  const c1 = Math.round(k * 100), c2 = Math.round(svc * 100), c3 = Math.round(ebg * 100);

  // 잠정 환산(코딩 보류 제외): 지식10 + 서비스수20 + EBG5 = 35 → 100%
  // (정성 35%는 관리자 수기로 자동 점수에서 제외)
  const auto = (k * 0.10 + svc * 0.20 + ebg * 0.05) / 0.35 * 100;
  const autoScore = Math.round(auto * 10) / 10;
  const level = Math.min(10, Math.max(1, Math.ceil(autoScore / 10)));

  return { done: true, areaRatio, c1, c2, c3, codingStatus: 'pending', autoScore, level, served, correctish };
}

export function totalQuestionCount(): number { return INDEXED.length; }

// 코딩(질) 채점 반영 후 총점 재산출 (PRD F4 전체 가중치).
// 자동 측정: 지식10 + 행동50(코딩30+서비스20) + EBG5 = 65 → 100%. (정성 35%는 수기 제외)
export function recomputeWithCoding(c1: number, c2svc: number, c3: number, codingScore: number): { autoScore: number; level: number } {
  const k = c1 / 100, svc = c2svc / 100, ebg = c3 / 100, code = Math.max(0, Math.min(100, codingScore)) / 100;
  const behavior = code * 0.6 + svc * 0.4;   // 코딩30/서비스20 = 0.6/0.4 of 50%
  const auto = (k * 0.10 + behavior * 0.50 + ebg * 0.05) / 0.65 * 100;
  const autoScore = Math.round(auto * 10) / 10;
  return { autoScore, level: Math.min(10, Math.max(1, Math.ceil(autoScore / 10))) };
}
