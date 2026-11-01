import { describe, expect, it } from 'vitest';
import { adjustLevel, measuredWpm, nextWpm, recommend, startWpm } from '../src/calibration/staircase';

const r = (wpm: number, correct: number) => ({ wpm, correct, total: 3 });

describe('staircase', () => {
  it('measures reading speed', () => {
    expect(measuredWpm(150, 30000)).toBe(300);
    expect(measuredWpm(150, 0)).toBe(0);
  });

  it('starts from the baseline, rounded and capped', () => {
    expect(startWpm(237)).toBe(225);
    expect(startWpm(90)).toBe(150);
    expect(startWpm(1400)).toBe(600);
    expect(startWpm(NaN)).toBe(250);
  });

  it('moves up on 3/3, holds on 2/3, drops on 0–1/3', () => {
    expect(nextWpm(r(300, 3))).toBe(350);
    expect(nextWpm(r(300, 2))).toBe(300);
    expect(nextWpm(r(300, 1))).toBe(250);
    expect(nextWpm(r(300, 0))).toBe(250);
    expect(nextWpm(r(1000, 3))).toBe(1000);
    expect(nextWpm(r(100, 0))).toBe(100);
  });

  it('drops a level after a failed baseline, but not below A2', () => {
    expect(adjustLevel('B2', r(250, 1))).toBe('B1');
    expect(adjustLevel('B2', r(250, 2))).toBe('B2');
    expect(adjustLevel('A2', r(250, 0))).toBe('A2');
  });

  it('recommends the fastest pass below the slowest fail', () => {
    const rounds = [r(300, 3), r(350, 3), r(400, 1), r(350, 2), r(350, 3)];
    expect(recommend(rounds)).toEqual({ wpm: 350, comprehension: 12 / 15, confident: true });
  });

  it('ignores a lucky pass above a failure', () => {
    expect(recommend([r(300, 3), r(350, 1), r(300, 3), r(350, 2)]).wpm).toBe(300);
  });

  it('handles all passes and all fails', () => {
    expect(recommend([r(300, 3), r(350, 3), r(400, 3)]).wpm).toBe(400);
    const fail = recommend([r(300, 1), r(250, 0), r(200, 1)]);
    expect(fail).toMatchObject({ wpm: 150, confident: false });
  });
});
