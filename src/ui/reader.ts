import { Player, type PlayerState } from '../engine/player';
import { computeSchedule } from '../engine/timing';
import type { Token } from '../engine/tokenize';
import { formatDuration, type Doc } from './doc';
import { createWordView } from './word-view';
import { nudgeFontSize, WPM_MAX, WPM_MIN, WPM_STEP, type Settings } from './settings';
import { wakeLock } from '../system/wakelock';

const HIDE_CONTROLS_AFTER = 2000;
/** Horizontal travel (px) that counts as a swipe rather than a tap. */
const SWIPE_MIN = 50;
/** Fraction of the stage width on each side that steps a word when tapped. */
const EDGE_ZONE = 0.3;

type Options = {
  settings: Settings;
  onSettingsChange: () => void;
  /** Word size changed from the keyboard. */
  onAppearanceChange: () => void;
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
  const controls = screen.querySelector<HTMLElement>('.controls')!;
  const tuneBtn = $<HTMLButtonElement>('tune-btn');
  const tuneWpm = $('tune-wpm');

  const player = new Player();
  let doc: Doc | null = null;
  let hideTimer = 0;
  let positionTimer = 0;

  // --- Rendering ----------------------------------------------------------

  const wordView = createWordView(wordEl.parentElement!);

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
    wordView.render(frame);
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
    // Keep the screen on while words are moving, like a video player does.
    wakeLock.want('reader', playing);
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
        setTuning(false);
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
    tuneWpm.textContent = String(settings.wpm);
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

  $('wpm-down').addEventListener('click', () => nudgeWpm(-WPM_STEP));
  $('wpm-up').addEventListener('click', () => nudgeWpm(WPM_STEP));

  // On phones the sliders live in a panel behind the "300 WPM" button.
  function setTuning(open: boolean) {
    controls.classList.toggle('tuning', open);
    tuneBtn.setAttribute('aria-expanded', String(open));
  }
  tuneBtn.addEventListener('click', () => setTuning(!controls.classList.contains('tuning')));

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

  // --- Stage: click / tap / swipe ----------------------------------------
  //
  // Mouse: click anywhere toggles play.
  // Touch/pen: tap toggles; while paused, tapping the left/right edge steps a
  // word; a horizontal swipe jumps a sentence (left = forward, like a page).

  let gesture: { id: number; x: number; y: number; t: number; type: string } | null = null;
  let suppressClick = false;

  stage.addEventListener('pointerdown', (e) => {
    suppressClick = false;
    if (e.composedPath().includes(contextEl) || !e.isPrimary) return;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), type: e.pointerType };
  });
  stage.addEventListener('pointercancel', () => (gesture = null));
  stage.addEventListener('pointerup', (e) => {
    const g = gesture;
    gesture = null;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - g.t < 800) {
      player.jumpSentence(dx < 0 ? 1 : -1);
      suppressClick = true;
      activity();
      return;
    }
    if (g.type === 'mouse') return; // handled by click
    if (Math.hypot(dx, dy) > 12) return; // a scroll or drag, not a tap
    suppressClick = true;
    activity();
    if (controls.classList.contains('tuning')) {
      setTuning(false);
      return;
    }
    const rect = stage.getBoundingClientRect();
    const at = (e.clientX - rect.left) / rect.width;
    if (player.state !== 'playing' && player.state !== 'finished' && at < EDGE_ZONE) player.stepWord(-1);
    else if (player.state !== 'playing' && player.state !== 'finished' && at > 1 - EDGE_ZONE) player.stepWord(1);
    else player.toggle();
  });

  stage.addEventListener('click', (e) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
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
      case '+':
      case '=':
        nudgeFontSize(settings, 1);
        opts.onAppearanceChange();
        break;
      case '-':
      case '_':
        nudgeFontSize(settings, -1);
        opts.onAppearanceChange();
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
    setTuning(false);
    opts.onPosition(player.tokenIndex);
    opts.onExit();
  }

  return {
    open(d: Doc, tokenIndex = 0) {
      doc = d;
      docTitle.replaceChildren();
      if (d.source) {
        const link = document.createElement('a');
        link.href = d.source;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = d.name ?? d.source;
        link.title = 'Open on Wikipedia (CC BY-SA 4.0)';
        docTitle.append(link);
      } else docTitle.textContent = d.name ?? '';
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
      setTuning(false);
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
