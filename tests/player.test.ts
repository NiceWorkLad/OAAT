import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player, type PlayerState } from '../src/engine/player';
import { computeSchedule, RAMP } from '../src/engine/timing';
import { tokenize } from '../src/engine/tokenize';

const TEXT = 'One two three. Four five six. Seven eight nine ten eleven twelve.';

function setup() {
  const tokens = tokenize(TEXT);
  const frames = computeSchedule(tokens, { wpm: 300, sensitivity: 0 });
  const p = new Player();
  const shown: number[] = [];
  const states: PlayerState[] = [];
  p.on('frame', (e) => shown.push(e.frame.tokenIndex));
  p.on('state', (e) => states.push(e.state));
  p.load(tokens, frames);
  shown.length = 0;
  return { p, tokens, frames, shown, states };
}

describe('player', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays through to finished with ramp-up timing', () => {
    const { p, frames, shown, states } = setup();
    p.play();
    expect(shown).toEqual([0]);
    vi.advanceTimersByTime(frames[0].duration * RAMP[0] - 1);
    expect(shown).toEqual([0]);
    vi.advanceTimersByTime(1);
    expect(shown).toEqual([0, 1]);
    vi.advanceTimersByTime(60000);
    expect(shown.length).toBe(frames.length);
    expect(states).toEqual(['playing', 'finished']);
  });

  it('pauses and resumes in place', () => {
    const { p, shown } = setup();
    p.play();
    vi.advanceTimersByTime(1000);
    p.pause();
    const at = p.tokenIndex;
    vi.advanceTimersByTime(5000);
    expect(p.tokenIndex).toBe(at);
    shown.length = 0;
    p.play();
    expect(shown).toEqual([at]);
  });

  it('steps words and jumps sentences', () => {
    const { p } = setup();
    p.stepWord(1);
    p.stepWord(1);
    expect(p.tokenIndex).toBe(2);
    p.jumpSentence(1);
    expect(p.tokenIndex).toBe(3);
    p.jumpSentence(1);
    expect(p.tokenIndex).toBe(6);
    p.stepWord(1);
    p.stepWord(1);
    p.jumpSentence(-1); // back to start of current sentence
    expect(p.tokenIndex).toBe(6);
    p.jumpSentence(-1); // already at start -> previous sentence
    expect(p.tokenIndex).toBe(3);
    p.stepWord(-1);
    expect(p.tokenIndex).toBe(2);
  });

  it('seeks by fraction and restarts', () => {
    const { p, tokens } = setup();
    p.seekFraction(0.5);
    expect(p.tokenIndex).toBe(Math.floor(tokens.length / 2));
    p.restart();
    expect(p.tokenIndex).toBe(0);
  });

  it('keeps position when the schedule changes', () => {
    const { p, tokens } = setup();
    p.seekToken(5);
    p.setSchedule(computeSchedule(tokens, { wpm: 600, sensitivity: 1 }));
    expect(p.tokenIndex).toBe(5);
  });
});
