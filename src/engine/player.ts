import { RAMP, type Frame } from './timing';
import type { Token } from './tokenize';

export type PlayerState = 'idle' | 'playing' | 'paused' | 'finished';

export type PlayerEvents = {
  frame: { frame: Frame; token: Token; index: number };
  state: { state: PlayerState };
  progress: { index: number; total: number; tokenIndex: number; fraction: number; remainingMs: number };
};

type Listener<K extends keyof PlayerEvents> = (e: PlayerEvents[K]) => void;

/**
 * Playback state machine: idle -> playing <-> paused -> finished.
 * Uses chained setTimeout with drift correction against performance.now().
 */
export class Player {
  private tokens: Token[] = [];
  private frames: Frame[] = [];
  private suffix: number[] = [0]; // suffix[i] = ms remaining from frame i
  private sentenceStarts: number[] = []; // first frame index per sentence
  private index = 0;
  private _state: PlayerState = 'idle';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private target = 0; // performance.now() when the current frame should end
  private rampStep = 0;
  private listeners = new Map<keyof PlayerEvents, Set<(e: never) => void>>();
  private onVisibility = () => {
    if (document.visibilityState === 'hidden' && this._state === 'playing') this.pause();
  };

  constructor() {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  destroy(): void {
    this.clearTimer();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }

  on<K extends keyof PlayerEvents>(type: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn as (e: never) => void);
    return () => set.delete(fn as (e: never) => void);
  }

  private emit<K extends keyof PlayerEvents>(type: K, e: PlayerEvents[K]): void {
    this.listeners.get(type)?.forEach((fn) => (fn as Listener<K>)(e));
  }

  get state(): PlayerState {
    return this._state;
  }
  get frameIndex(): number {
    return this.index;
  }
  get tokenIndex(): number {
    return this.frames[this.index]?.tokenIndex ?? 0;
  }
  get length(): number {
    return this.frames.length;
  }
  get currentFrame(): Frame | undefined {
    return this.frames[this.index];
  }

  /** Load a new document (resets to idle) at an optional token position. */
  load(tokens: Token[], frames: Frame[], tokenIndex = 0): void {
    this.clearTimer();
    this.tokens = tokens;
    this.setFrames(frames, tokenIndex);
    this.setState('idle');
    this.show();
  }

  /** Swap in recomputed durations (settings changed), keeping position. */
  setSchedule(frames: Frame[]): void {
    const tokenIndex = this.tokenIndex;
    const part = this.frames[this.index]?.part ?? 0;
    this.setFrames(frames, tokenIndex, part);
    this.emitProgress();
  }

  private setFrames(frames: Frame[], tokenIndex: number, part = 0): void {
    this.frames = frames;
    this.suffix = new Array(frames.length + 1).fill(0);
    for (let i = frames.length - 1; i >= 0; i--) this.suffix[i] = this.suffix[i + 1] + frames[i].duration;
    this.sentenceStarts = [];
    let last = -1;
    frames.forEach((f, i) => {
      const s = this.tokens[f.tokenIndex]?.sentenceIndex ?? 0;
      if (s !== last) {
        this.sentenceStarts.push(i);
        last = s;
      }
    });
    this.index = this.frameForToken(tokenIndex, part);
  }

  private frameForToken(tokenIndex: number, part = 0): number {
    if (this.frames.length === 0) return 0;
    // Binary search: frames are ordered by tokenIndex.
    let lo = 0;
    let hi = this.frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.frames[mid].tokenIndex < tokenIndex) lo = mid + 1;
      else hi = mid;
    }
    const next = this.frames[lo + 1];
    if (part === 1 && next && next.tokenIndex === this.frames[lo].tokenIndex) return lo + 1;
    return lo;
  }

  private setState(state: PlayerState): void {
    if (state === this._state) return;
    this._state = state;
    this.emit('state', { state });
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private show(): void {
    const frame = this.frames[this.index];
    if (frame) this.emit('frame', { frame, token: this.tokens[frame.tokenIndex], index: this.index });
    this.emitProgress();
  }

  private emitProgress(): void {
    const total = this.frames.length;
    this.emit('progress', {
      index: this.index,
      total,
      tokenIndex: this.tokenIndex,
      fraction: total ? this.index / total : 0,
      remainingMs: this.suffix[this.index] ?? 0,
    });
  }

  /** Show the current frame and schedule the next one. */
  private tick = (): void => {
    const frame = this.frames[this.index];
    if (!frame) {
      this.finish();
      return;
    }
    this.show();
    const ramp = RAMP[this.rampStep] ?? 1;
    this.rampStep++;
    const now = performance.now();
    // If we've fallen far behind (e.g. throttled), don't try to catch up.
    if (now - this.target > 250) this.target = now;
    this.target += frame.duration * ramp;
    this.timer = setTimeout(this.advance, Math.max(0, this.target - performance.now()));
  };

  private advance = (): void => {
    this.timer = null;
    if (this.index >= this.frames.length - 1) {
      this.index = this.frames.length;
      this.finish();
      return;
    }
    this.index++;
    this.tick();
  };

  private finish(): void {
    this.clearTimer();
    this.index = Math.max(0, this.frames.length - 1);
    this.emit('progress', {
      index: this.frames.length,
      total: this.frames.length,
      tokenIndex: this.tokenIndex,
      fraction: 1,
      remainingMs: 0,
    });
    this.setState('finished');
  }

  play(): void {
    if (this.frames.length === 0 || this._state === 'playing') return;
    if (this._state === 'finished') this.index = 0;
    this.rampStep = 0;
    this.target = performance.now();
    this.setState('playing');
    this.tick();
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this.clearTimer();
    this.setState('paused');
  }

  toggle(): void {
    if (this._state === 'playing') this.pause();
    else this.play();
  }

  restart(): void {
    this.seekFrame(0);
  }

  /** Move to a frame; keeps playing if playing (with a fresh ramp-up). */
  seekFrame(i: number): void {
    const wasPlaying = this._state === 'playing';
    this.clearTimer();
    this.index = Math.max(0, Math.min(this.frames.length - 1, i));
    if (wasPlaying) {
      this._state = 'paused';
      this.play();
    } else {
      if (this._state === 'finished') this.setState('paused');
      this.show();
    }
  }

  seekToken(tokenIndex: number): void {
    this.seekFrame(this.frameForToken(tokenIndex));
  }

  /** Seek to a fraction (0..1) of the document. */
  seekFraction(fraction: number): void {
    this.seekFrame(Math.floor(Math.max(0, Math.min(1, fraction)) * this.frames.length));
  }

  stepWord(delta: 1 | -1): void {
    const current = this.tokenIndex;
    const target = Math.max(0, Math.min(this.tokens.length - 1, current + delta));
    this.seekToken(target);
  }

  /** Back: to the start of this sentence, or the previous one if already near the start. */
  jumpSentence(delta: 1 | -1): void {
    const starts = this.sentenceStarts;
    if (starts.length === 0) return;
    let s = 0;
    while (s + 1 < starts.length && starts[s + 1] <= this.index) s++;
    if (delta > 0) {
      if (s + 1 < starts.length) this.seekFrame(starts[s + 1]);
      else this.seekFrame(this.frames.length - 1);
    } else {
      const nearStart = this.index - starts[s] <= 1;
      this.seekFrame(nearStart && s > 0 ? starts[s - 1] : starts[s]);
    }
  }
}
