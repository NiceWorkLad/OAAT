import { difficultyOf } from './difficulty';
import type { Kind, Pause, Token } from './tokenize';

export type TimingSettings = {
  wpm: number;
  sensitivity: number; // 0..1
};

export type Frame = {
  text: string; // what to display
  tokenIndex: number;
  part: 0 | 1; // 1 = second half of a split long word
  bucket: number;
  wordMs: number; // time for the word itself
  pauseMs: number; // extra time for punctuation / breaks
  duration: number; // wordMs + pauseMs, clamped
};

export const DEFAULT_SENSITIVITY = 0.6;
export const BUCKET_WEIGHT = [0.75, 0.8, 0.85, 0.95, 1.0, 1.1, 1.2, 1.3, 1.45, 1.6];
export const KIND_FACTOR: Record<Kind, number> = { word: 1, number: 1.3, name: 1.15, symbol: 1.5 };
export const PAUSE_EXTRA: Record<Pause, number> = {
  none: 0,
  comma: 0.5,
  sentence: 1.2,
  paragraph: 2.0,
  heading: 2.5,
};
export const SPLIT_THRESHOLD = 14;
export const SPLIT_SHARE = 0.6;
export const MIN_MS = 60;
export const MAX_MS = 3000;
export const RAMP = [1.6, 1.45, 1.3, 1.15, 1.05];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function baseMs(wpm: number): number {
  return 60000 / wpm;
}

export function lengthFactor(len: number): number {
  return Math.min(1.4, 1 + Math.max(0, len - 6) * 0.04);
}

/**
 * Length, kind and split-share effects fade in between sensitivity 0 and the
 * default, so that sensitivity 0 means a perfectly uniform pace while the
 * default and above use the full factors.
 */
function fade(sensitivity: number): number {
  return clamp(sensitivity / DEFAULT_SENSITIVITY, 0, 1);
}

/** Split a long word into two display frames, or null if it's short enough. */
export function splitLongWord(text: string, core: string): [string, string] | null {
  if (core.length < SPLIT_THRESHOLD) return null;
  const chars = Array.from(text);
  const mid = chars.length / 2;
  // Prefer an existing interior hyphen near the middle.
  let best = -1;
  chars.forEach((c, i) => {
    if (c === '-' && i > 0 && i < chars.length - 1 && /[\p{L}\p{N}]/u.test(chars[i - 1])) {
      if (best < 0 || Math.abs(i - mid) < Math.abs(best - mid)) best = i;
    }
  });
  if (best >= chars.length * 0.25 && best <= chars.length * 0.75) {
    return [chars.slice(0, best + 1).join(''), chars.slice(best + 1).join('')];
  }
  // Otherwise split after the middle letter.
  const letters: number[] = [];
  chars.forEach((c, i) => /[\p{L}\p{N}]/u.test(c) && letters.push(i));
  const cut = letters[Math.ceil(letters.length / 2)];
  return [chars.slice(0, cut).join('') + '-', chars.slice(cut).join('')];
}

type Raw = { frames: Omit<Frame, 'wordMs' | 'duration'>[]; rawWord: number; shares: number[] };

/**
 * Precompute per-frame durations for a whole document.
 *
 * Word durations are rescaled so the mean time per token (pauses excluded)
 * equals 60000 / wpm; pauses are added on top.
 */
export function computeSchedule(tokens: Token[], settings: TimingSettings): Frame[] {
  const base = baseMs(settings.wpm);
  const s = clamp(settings.sensitivity, 0, 1);
  const f = fade(s);
  const splitShare = 0.5 + (SPLIT_SHARE - 0.5) * f;

  const raws: Raw[] = tokens.map((tok, tokenIndex) => {
    const scored = tok.kind === 'word' || tok.kind === 'name';
    const bucket = scored ? difficultyOf(tok.core) : 4;
    const diff = 1 + s * (BUCKET_WEIGHT[bucket] - 1);
    const len = 1 + f * (lengthFactor(tok.core.length) - 1);
    const kind = 1 + f * (KIND_FACTOR[tok.kind] - 1);
    const pauseMs = PAUSE_EXTRA[tok.pause] * base;
    const rawWord = base * diff * len * kind;
    // Above ~500 WPM two frames can't fit in the word's time budget without
    // breaking the 60 ms floor, so long words stay whole.
    const canSplit = scored && base >= 2 * MIN_MS;
    const split = canSplit ? splitLongWord(tok.text, tok.core) : null;
    if (!split) {
      return { rawWord, shares: [1], frames: [{ text: tok.text, tokenIndex, part: 0, bucket, pauseMs }] };
    }
    return {
      rawWord,
      shares: [splitShare, splitShare],
      frames: [
        { text: split[0], tokenIndex, part: 0, bucket, pauseMs: 0 },
        { text: split[1], tokenIndex, part: 1, bucket, pauseMs },
      ],
    };
  });

  if (raws.length === 0) return [];

  // Find a scale so the mean clamped word time per token equals base.
  const wordTimes = (scale: number) =>
    raws.map((r) => r.shares.map((sh) => clamp(r.rawWord * sh * scale, MIN_MS, MAX_MS)));
  const meanOf = (times: number[][]) =>
    times.reduce((acc, t) => acc + t.reduce((a, b) => a + b, 0), 0) / times.length;

  let scale = 1;
  let times = wordTimes(scale);
  for (let i = 0; i < 20; i++) {
    const mean = meanOf(times);
    if (Math.abs(mean - base) / base < 1e-4) break;
    scale *= base / mean;
    times = wordTimes(scale);
  }

  const out: Frame[] = [];
  raws.forEach((r, ri) => {
    r.frames.forEach((fr, fi) => {
      const wordMs = times[ri][fi];
      const duration = clamp(wordMs + fr.pauseMs, MIN_MS, MAX_MS);
      out.push({ ...fr, wordMs, duration });
    });
  });
  return out;
}

/** Total playback time in ms for frames[from..]. */
export function remainingMs(frames: Frame[], from = 0): number {
  let t = 0;
  for (let i = Math.max(0, from); i < frames.length; i++) t += frames[i].duration;
  return t;
}
