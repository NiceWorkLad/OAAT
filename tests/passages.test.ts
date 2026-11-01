import { beforeAll, describe, expect, it } from 'vitest';
import { LEVELS, PASSAGES, passagesFor, type Level, type Passage } from '../src/calibration/passages';
import { difficultyOf, setDifficultyData } from '../src/engine/difficulty';
import { tokenize } from '../src/engine/tokenize';
import real from '../src/data/difficulty.json';

const WORDS: Record<Level, [number, number]> = { A2: [85, 125], B1: [115, 155], B2: [130, 180], C1: [145, 200] };

export function metrics(p: Passage) {
  const tokens = tokenize(p.text);
  const words = tokens.filter((t) => t.kind === 'word');
  const sentences = new Set(tokens.map((t) => t.sentenceIndex)).size;
  const buckets = words.map((t) => difficultyOf(t.core));
  return {
    words: tokens.length,
    sentenceLen: tokens.length / sentences,
    rareShare: buckets.filter((b) => b >= 5).length / words.length,
    meanBucket: buckets.reduce((a, b) => a + b, 0) / buckets.length,
  };
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('passages', () => {
  beforeAll(() => setDifficultyData(real));

  it('has six passages per level with unique ids', () => {
    for (const l of LEVELS) expect(passagesFor(l)).toHaveLength(6);
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(PASSAGES.length);
  });

  it('has three questions with four distinct options each', () => {
    for (const p of PASSAGES) {
      expect(p.questions).toHaveLength(3);
      for (const q of p.questions) {
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options).size).toBe(4);
      }
    }
  });

  it.each(PASSAGES.map((p) => [p.id, p] as const))('%s is within the word range for its level', (_, p) => {
    const [lo, hi] = WORDS[p.level];
    const n = metrics(p).words;
    expect(n).toBeGreaterThanOrEqual(lo);
    expect(n).toBeLessThanOrEqual(hi);
  });

  it('gets harder level by level (rare words, sentence length)', () => {
    const byLevel = LEVELS.map((l) => {
      const ms = passagesFor(l).map(metrics);
      return { l, rare: avg(ms.map((m) => m.rareShare)), sent: avg(ms.map((m) => m.sentenceLen)), bucket: avg(ms.map((m) => m.meanBucket)) };
    });
    console.table(byLevel);
    for (let i = 1; i < byLevel.length; i++) {
      expect(byLevel[i].rare).toBeGreaterThan(byLevel[i - 1].rare);
      expect(byLevel[i].bucket).toBeGreaterThan(byLevel[i - 1].bucket);
      expect(byLevel[i].sent).toBeGreaterThan(byLevel[i - 1].sent);
    }
  });
});
