// Adaptive "staircase" for finding a reader's comfortable RSVP speed.
//
// Each round is a short passage followed by 3 questions:
//   3/3 correct -> speed up by STEP_UP
//   2/3 correct -> keep the same speed
//   0–1 correct -> slow down by STEP_DOWN
// The recommendation is the fastest speed the reader passed (>= 2/3) that is
// still slower than every speed they failed at.

import { LEVELS, type Level } from './passages';

export type Round = { wpm: number; correct: number; total: number };

export const STEP_UP = 50;
export const STEP_DOWN = 50;
export const MIN_WPM = 100;
export const MAX_WPM = 1000;
export const PASS_RATIO = 2 / 3;
export const RSVP_ROUNDS = 5;

const roundTo25 = (v: number) => Math.round(v / 25) * 25;
const clampWpm = (v: number) => Math.min(MAX_WPM, Math.max(MIN_WPM, roundTo25(v)));

export const passed = (r: Round) => r.correct / r.total >= PASS_RATIO - 1e-9;

/** Words per minute from a word count and elapsed milliseconds. */
export function measuredWpm(words: number, ms: number): number {
  return ms > 0 ? (words / ms) * 60000 : 0;
}

/**
 * First RSVP speed, from the reader's normal (baseline) reading speed.
 * Very fast baselines usually mean skimming, so cap the start at 600.
 */
export function startWpm(baselineWpm: number): number {
  if (!Number.isFinite(baselineWpm) || baselineWpm <= 0) return 250;
  return Math.min(600, Math.max(150, roundTo25(baselineWpm)));
}

export function nextWpm(r: Round): number {
  const ratio = r.correct / r.total;
  if (ratio >= 1) return clampWpm(r.wpm + STEP_UP);
  if (passed(r)) return clampWpm(r.wpm);
  return clampWpm(r.wpm - STEP_DOWN);
}

/** Drop one level if the baseline text was too hard (0–1 of 3 correct). */
export function adjustLevel(level: Level, baseline: Round): Level {
  if (passed(baseline)) return level;
  const i = LEVELS.indexOf(level);
  return LEVELS[Math.max(0, i - 1)];
}

export type Recommendation = {
  wpm: number;
  comprehension: number; // 0..1 over all RSVP rounds
  confident: boolean; // false if the reader never passed a round
};

export function recommend(rounds: Round[]): Recommendation {
  const total = rounds.reduce((a, r) => a + r.total, 0);
  const correct = rounds.reduce((a, r) => a + r.correct, 0);
  const comprehension = total ? correct / total : 0;
  if (rounds.length === 0) return { wpm: 250, comprehension, confident: false };

  const passes = rounds.filter(passed);
  if (passes.length === 0) {
    const slowest = Math.min(...rounds.map((r) => r.wpm));
    return { wpm: clampWpm(slowest - STEP_DOWN), comprehension, confident: false };
  }
  const lowestFail = Math.min(Infinity, ...rounds.filter((r) => !passed(r)).map((r) => r.wpm));
  const safe = passes.filter((r) => r.wpm < lowestFail).map((r) => r.wpm);
  const wpm = safe.length ? Math.max(...safe) : lowestFail - 25;
  return { wpm: clampWpm(wpm), comprehension, confident: true };
}
