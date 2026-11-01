import { splitAtOrp } from '../engine/orp';
import { Player, type PlayerState } from '../engine/player';
import { computeSchedule, type Frame } from '../engine/timing';
import type { Token } from '../engine/tokenize';
import { formatDuration, type Doc } from './doc';
import { WPM_MAX, WPM_MIN, WPM_STEP, type Settings } from './settings';

const HIDE_CONTROLS_AFTER = 2000;

type Options = {
  settings: Settings;
  onSettingsChange: () => void;
  onPosition: (tokenIndex: number) => void;
  onExit: () => void;
  settingsOpen: () => boolean;
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function setupReader(opts: Options) {
  const { settings } = opts;
  const screen = $('reader-screen');
  const stage = $('stage');
  const wordEl = $('word');
  const wordRow = wordEl.parentElement!;
  const beforeEl = wordEl.querySelector<HTMLElement>('.before')!;
  const pivotEl = wordEl.querySelector<HTMLElement>('.pivot')!;
  const afterEl = wordEl.querySelector<HTMLElement>('.after')!;
  const contextEl = $('context');
  const finishedEl = $('finished');
  const playBtn = $<HTMLButtonElement>('play-btn');
  const wpmInput = $<HTMLInputElement>('wpm');
  const wpmOut = $('wpm-value');
  const sensInput = $<HTMLInputElement>('sensitivity');
  const sensOut = $('sensitivity-value');
  const progress = $('progress');
  const progressFill = $('progress-fill');
  const timeLeft = $('time-left');
  const status = $('reader-status');
  const docTitle = $('doc-title');

  const player = new Player();
  let doc: Doc | null = null;
  let hideTimer = 0;
  let positionTimer = 0;

  // --- Rendering ----------------------------------------------------------

  const renderFrame = (frame: Frame) => {
    const [before, pivot, after] = splitAtOrp(frame.text);
    beforeEl.textContent = before;
    pivotEl.textContent = pivot;
    afterEl.textContent = after;
    wordEl.style.setProperty('--before', String(Array.from(before).length));
    fitWord();
    wordEl.dataset.bucket = String(frame.bucket);
  };

  /** Shrink tokens that would overflow (long URLs etc.); the pivot stays put. */
  const fitWord = () => {
    wordEl.style.setProperty('--fit', '1');
    const row = wordRow.getBoundingClientRect();
    const word = wordEl.getBoundingClientRect();
    const margin = 12;
    const pivotX = row.left + row.width * 0.38;
    let fit = 1;
    if (word.right > row.right - margin) fit = Math.min(fit, (row.right - margin - pivotX) / (word.right - pivotX));
    if (word.left < row.left + margin) fit = Math.min(fit, (pivotX - row.left - margin) / (pivotX - word.left));
    if (fit < 1) wordEl.style.setProperty('--fit', Math.max(0.2, fit).toFixed(3));
  };
  addEventListener('resize', () => {
    if (!screen.hidden) fitWord();
  });

  const sentenceRange = (tokens: Token[], s: number): [number, number] | null => {
    // Tokens are ordered by sentenceIndex; find [start, end) for sentence s.
    let lo = 0;
    let hi = tokens.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tokens[mid].sentenceIndex < s) lo = mid + 1;
      else hi = mid;
    }
    if (lo >= tokens.length || tokens[lo].sentenceIndex !== s) return null;
    let end = lo;
    while (end < tokens.length && tokens[end].sentenceIndex === s) end++;
    return [lo, end];
  };

  const renderContext = () => {
    contextEl.replaceChildren();
    if (!doc) return;
    const tokens = doc.tokens;
    const current = player.tokenIndex;
    const s = tokens[current]?.sentenceIndex ?? 0;
    for (const which of [s - 1, s, s + 1]) {
      const range = sentenceRange(tokens, which);
      if (!range) continue;
      const p = document.createElement('p');
      p.className = which === s ? 'ctx-current' : 'ctx-side';
      for (let i = range[0]; i < range[1]; i++) {
        const span = document.createElement('span');
        span.className = 'ctx-word';
        span.dataset.i = String(i);
        span.textContent = tokens[i].text;
        if (i === current) {
          span.classList.add('ctx-here');
          span.setAttribute('aria-current', 'true');
        }
        p.append(span, ' ');
      }
      contextEl.append(p);
    }
    contextEl.querySelector('.ctx-here')?.scrollIntoView({ block: 'nearest' });
  };

  const updateContextVisibility = (state: PlayerState) => {
    const show = state === 'paused' || state === 'idle';
    contextEl.hidden = !show;
    if (show) renderContext();
  };

  // --- Player wiring ------------------------------------------------------

  player.on('frame', ({ frame }) => {
    renderFrame(frame);
    if (!contextEl.hidden) renderContext();
  });

  player.on('progress', ({ fraction, remainingMs }) => {
    progressFill.style.transform = `scaleX(${fraction})`;
    progress.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    progress.setAttribute('aria-valuetext', `${Math.round(fraction * 100)}%, ${formatDuration(remainingMs)} left`);
    timeLeft.textContent = `${formatDuration(remainingMs)} left`;
    // Persist position, throttled.
    if (!positionTimer) {
      positionTimer = window.setTimeout(() => {
        positionTimer = 0;
        opts.onPosition(player.tokenIndex);
      }, 1000);
    }
  });

  player.on('state', ({ state }) => {
    screen.dataset.state = state;
    const playing = state === 'playing';
    playBtn.setAttribute('aria-label', playing ? 'Pause (Space)' : 'Play (Space)');
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.dataset.icon = playing ? 'pause' : 'play';
    finishedEl.hidden = state !== 'finished';
    updateContextVisibility(state);
    if (playing) scheduleHide();
    else showControls();
    if (state !== 'playing') opts.onPosition(player.tokenIndex);
    const n = doc?.tokens.length ?? 0;
    status.textContent =
      state === 'playing'
        ? 'Playing'
        : state === 'finished'
          ? 'Finished'
          : `Paused at word ${player.tokenIndex + 1} of ${n}`;
  });

  const reschedule = () => {
    if (!doc) return;
    player.setSchedule(computeSchedule(doc.tokens, settings));
  };

  // --- Controls fade ------------------------------------------------------

  function showControls() {
    clearTimeout(hideTimer);
    screen.classList.remove('controls-hidden');
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (player.state === 'playing' && !screen.contains(document.activeElement?.closest('.slider-group') ?? null)) {
        screen.classList.add('controls-hidden');
      }
    }, HIDE_CONTROLS_AFTER);
  }
  const activity = () => {
    showControls();
    if (player.state === 'playing') scheduleHide();
  };
  screen.addEventListener('mousemove', activity);
  screen.addEventListener('touchstart', activity, { passive: true });

  // --- Controls -----------------------------------------------------------

  const syncSliders = () => {
    wpmInput.value = String(settings.wpm);
    wpmOut.textContent = `${settings.wpm} WPM`;
    sensInput.value = String(Math.round(settings.sensitivity * 100));
    const pct = Math.round(settings.sensitivity * 100);
    sensOut.textContent = pct === 0 ? 'Off' : `${pct}%`;
    sensInput.setAttribute('aria-valuetext', pct === 0 ? 'Off' : `${pct} percent`);
  };
  wpmInput.min = String(WPM_MIN);
  wpmInput.max = String(WPM_MAX);
  wpmInput.step = String(WPM_STEP);
  syncSliders();

  let raf = 0;
  const settingsChanged = () => {
    syncSliders();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      reschedule();
      opts.onSettingsChange();
    });
  };
  wpmInput.addEventListener('input', () => {
    settings.wpm = Number(wpmInput.value);
    settingsChanged();
  });
  sensInput.addEventListener('input', () => {
    settings.sensitivity = Number(sensInput.value) / 100;
    settingsChanged();
  });

  const nudgeWpm = (delta: number) => {
    settings.wpm = Math.min(WPM_MAX, Math.max(WPM_MIN, settings.wpm + delta));
    settingsChanged();
  };

  playBtn.addEventListener('click', () => player.toggle());
  $('restart-btn').addEventListener('click', () => player.restart());
  $('prev-sentence-btn').addEventListener('click', () => player.jumpSentence(-1));
  $('next-sentence-btn').addEventListener('click', () => player.jumpSentence(1));
  $('back-btn').addEventListener('click', () => exit());

  contextEl.addEventListener('click', (e) => {
    // Don't let the click reach the stage (which toggles play/pause).
    e.stopPropagation();
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ctx-word');
    if (el?.dataset.i) player.seekToken(Number(el.dataset.i));
  });

  // Click/drag on the progress bar to seek.
  const seekFromPointer = (e: PointerEvent) => {
    const rect = progress.getBoundingClientRect();
    player.seekFraction((e.clientX - rect.left) / rect.width);
  };
  progress.addEventListener('pointerdown', (e) => {
    progress.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  });
  progress.addEventListener('pointermove', (e) => {
    if (progress.hasPointerCapture(e.pointerId)) seekFromPointer(e);
  });
  progress.addEventListener('keydown', (e) => {
    const at = player.length ? player.frameIndex / player.length : 0;
    if (e.key === 'Home') player.seekFraction(0);
    else if (e.key === 'End') player.seekFraction(0.999);
    else if (e.key === 'PageUp') player.seekFraction(at - 0.1);
    else if (e.key === 'PageDown') player.seekFraction(at + 0.1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });

  // Click on the word itself toggles play (handy on touch screens).
  stage.addEventListener('click', (e) => {
    if (e.composedPath().includes(contextEl)) return;
    if (window.getSelection()?.toString()) return;
    player.toggle();
  });

  // --- Keyboard -----------------------------------------------------------

  const onKey = (e: KeyboardEvent) => {
    if (screen.hidden || opts.settingsOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    if (target.matches('textarea, input[type="text"], select')) return;
    activity();
    let handled = true;
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        if (!e.repeat) player.toggle();
        break;
      case 'ArrowLeft':
        if (e.shiftKey) player.jumpSentence(-1);
        else player.stepWord(-1);
        break;
      case 'ArrowRight':
        if (e.shiftKey) player.jumpSentence(1);
        else player.stepWord(1);
        break;
      case 'ArrowUp':
        nudgeWpm(WPM_STEP);
        break;
      case 'ArrowDown':
        nudgeWpm(-WPM_STEP);
        break;
      case 'r':
      case 'R':
        player.restart();
        break;
      case 'Escape':
        exit();
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  // Stop Space from also "clicking" a focused button on keyup.
  document.addEventListener('keyup', (e) => {
    if (!screen.hidden && e.key === ' ' && !opts.settingsOpen()) e.preventDefault();
  });

  // --- Lifecycle ----------------------------------------------------------

  function exit() {
    player.pause();
    opts.onPosition(player.tokenIndex);
    opts.onExit();
  }

  return {
    open(d: Doc, tokenIndex = 0) {
      doc = d;
      docTitle.textContent = d.name ?? '';
      syncSliders();
      player.load(d.tokens, computeSchedule(d.tokens, settings), Math.min(tokenIndex, d.tokens.length - 1));
      screen.dataset.state = 'idle';
      finishedEl.hidden = true;
      updateContextVisibility('idle');
      showControls();
      status.textContent = `Ready. ${d.tokens.length} words. Press Space to play.`;
      playBtn.focus({ preventScroll: true });
    },
    close() {
      player.pause();
      showControls();
    },
    reschedule,
    syncSliders,
    get tokenIndex() {
      return player.tokenIndex;
    },
    get playing() {
      return player.state === 'playing';
    },
  };
}
