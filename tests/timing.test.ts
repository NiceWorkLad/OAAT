import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDifficultyData } from '../src/engine/difficulty';
import { tokenize } from '../src/engine/tokenize';
import { computeSchedule, MAX_MS, MIN_MS, splitLongWord, type Frame } from '../src/engine/timing';
import real from '../src/data/difficulty.json';

const SAMPLE = `The quick brown fox jumps over the lazy dog. Serendipity, however, is an
ephemeral and capricious phenomenon; one cannot simply summon it. In 1987 Margaret
visited https://example.com and found 42 internationalisation guides.

A new paragraph begins here, with ordinary words and the occasional sesquipedalian flourish.`;

/** Word time per token (sum of its frames' wordMs), excluding pauses. */
function wordTimes(frames: Frame[]): number[] {
  const m = new Map<number, number>();
  for (const f of frames) m.set(f.tokenIndex, (m.get(f.tokenIndex) ?? 0) + f.wordMs);
  return [...m.values()];
}
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

describe('timing', () => {
  beforeAll(() => setDifficultyData(real));
  afterAll(() => setDifficultyData(null));

  it.each([100, 300, 600, 1000])('rescales so word-only average matches %i WPM', (wpm) => {
    const frames = computeSchedule(tokenize(SAMPLE), { wpm, sensitivity: 0.6 });
    const target = 60000 / wpm;
    expect(Math.abs(mean(wordTimes(frames)) - target) / target).toBeLessThan(0.01);
  });

  it('gives common words less time than rare ones', () => {
    const tokens = tokenize('the serendipity');
    const [the, ser] = computeSchedule(tokens, { wpm: 300, sensitivity: 1 });
    expect(the.wordMs).toBeLessThan(ser.wordMs);
  });

  it('gives equal word durations at sensitivity 0', () => {
    const frames = computeSchedule(tokenize(SAMPLE), { wpm: 300, sensitivity: 0 });
    const times = wordTimes(frames);
    for (const t of times) expect(t).toBeCloseTo(200, 6);
  });

  it('adds pauses on top of word time', () => {
    const frames = computeSchedule(tokenize('one, two. three\n\nfour'), { wpm: 300, sensitivity: 0 });
    expect(frames.map((f) => f.pauseMs)).toEqual([100, 240, 400, 0]);
    expect(frames[1].duration).toBeCloseTo(440, 6);
  });

  it('clamps every duration', () => {
    for (const wpm of [100, 1000]) {
      const frames = computeSchedule(tokenize(SAMPLE + ' ' + 'x'.repeat(200)), { wpm, sensitivity: 1 });
      for (const f of frames) {
        expect(f.duration).toBeGreaterThanOrEqual(MIN_MS);
        expect(f.duration).toBeLessThanOrEqual(MAX_MS);
      }
    }
    const huge = computeSchedule(tokenize('end.\n\nx'), { wpm: 20, sensitivity: 0 });
    expect(huge[0].duration).toBe(MAX_MS);
  });

  it('splits long words into two frames at ~60% each', () => {
    const tokens = tokenize('internationalisation is long');
    const frames = computeSchedule(tokens, { wpm: 300, sensitivity: 0.6 });
    expect(frames.length).toBe(4);
    expect(frames[0].tokenIndex).toBe(0);
    expect(frames[1].tokenIndex).toBe(0);
    expect(frames[1].part).toBe(1);
    expect(frames[0].wordMs).toBeCloseTo(frames[1].wordMs, 6);
  });

  it('splits at a hyphen when there is one, else mid-word with a dash', () => {
    expect(splitLongWord('state-of-the-art', 'state-of-the-art')).toEqual(['state-of-', 'the-art']);
    expect(splitLongWord('internationalisation,', 'internationalisation')).toEqual([
      'internatio-',
      'nalisation,',
    ]);
    expect(splitLongWord('short', 'short')).toBeNull();
  });

  it('handles an empty document', () => {
    expect(computeSchedule([], { wpm: 300, sensitivity: 0.6 })).toEqual([]);
  });
});
