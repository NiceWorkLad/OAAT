import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  difficultyOf,
  lengthOnlyBucket,
  normalizeWord,
  setDifficultyData,
  stemCandidates,
} from '../src/engine/difficulty';
import real from '../src/data/difficulty.json';

const FIXTURE = {
  buckets: ['the and', 'walk', 'happy', "don't", 'make', 'stop', '', 'quantum', '', ''],
};

describe('difficulty (fixture)', () => {
  beforeAll(() => setDifficultyData(FIXTURE));
  afterAll(() => setDifficultyData(null));

  it('normalises words', () => {
    expect(normalizeWord('“Hello,”')).toBe('hello');
    expect(normalizeWord('Don’t')).toBe("don't");
    expect(normalizeWord('(world)!')).toBe('world');
  });

  it('looks up known words', () => {
    expect(difficultyOf('The')).toBe(0);
    expect(difficultyOf('quantum.')).toBe(7);
  });

  it('handles apostrophes', () => {
    expect(difficultyOf('Don’t')).toBe(3);
    expect(difficultyOf("don't")).toBe(3);
  });

  it('falls back to stems with +1', () => {
    expect(difficultyOf('walks')).toBe(2);
    expect(difficultyOf('walked')).toBe(2);
    expect(difficultyOf('walking')).toBe(2);
    expect(difficultyOf('making')).toBe(5);
    expect(difficultyOf('stopped')).toBe(6);
    expect(difficultyOf('happily')).toBe(3);
    expect(difficultyOf("walk's")).toBe(2);
  });

  it('caps stem bucket at 9', () => {
    setDifficultyData({ buckets: ['', '', '', '', '', '', '', '', '', 'zyx'] });
    expect(difficultyOf('zyxs')).toBe(9);
    setDifficultyData(FIXTURE);
  });

  it('uses the unknown-word fallback', () => {
    expect(difficultyOf('blorft')).toBe(7);
    expect(difficultyOf('blorftastic')).toBe(8);
  });

  it('generates sensible stem candidates', () => {
    expect(stemCandidates('tries')).toContain('try');
    expect(stemCandidates('running')).toContain('run');
  });
});

describe('difficulty (before load)', () => {
  it('uses length-only scoring', () => {
    setDifficultyData(null);
    expect(difficultyOf('cat')).toBe(lengthOnlyBucket('cat'));
    expect(difficultyOf('extraordinary')).toBeGreaterThan(difficultyOf('cat'));
  });
});

describe('difficulty (real wordlist)', () => {
  beforeAll(() => setDifficultyData(real));
  afterAll(() => setDifficultyData(null));

  it('puts common words in low buckets and rare ones high', () => {
    for (const w of ['the', 'and', 'of', 'to', 'is']) expect(difficultyOf(w)).toBeLessThanOrEqual(1);
    expect(difficultyOf('serendipity')).toBeGreaterThanOrEqual(6);
    expect(difficultyOf('house')).toBeLessThan(difficultyOf('ubiquitous'));
  });
});
