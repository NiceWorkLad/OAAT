import { LEVEL_INFO, LEVELS, passagesFor, type Level, type Passage } from '../calibration/passages';
import {
  adjustLevel,
  measuredWpm,
  nextWpm,
  recommend,
  RSVP_ROUNDS,
  startWpm,
  type Round,
} from '../calibration/staircase';
import { Player } from '../engine/player';
import { computeSchedule } from '../engine/timing';
import { tokenize } from '../engine/tokenize';
import type { Settings } from './settings';
import { load, save } from './storage';
import { createWordView } from './word-view';

export type CalibrationResult = {
  wpm: number;
  level: Level;
  baselineWpm: number;
  comprehension: number;
  date: string; // ISO
};

type Options = {
  settings: Settings;
  onExit: () => void;
  onApply: (wpm: number) => void;
};

const TOTAL_TEXTS = RSVP_ROUNDS + 1;
/** Above this, the "normal" read was almost certainly skimmed. */
const SKIM_WPM = 900;

// Tiny DOM helper. Children are text or nodes; text is never parsed as HTML.
type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const wordCount = (p: Passage) => tokenize(p.text).length;

export function loadCalibration(): CalibrationResult | null {
  const r = load<CalibrationResult>('calibration');
  return r && typeof r.wpm === 'number' && LEVELS.includes(r.level) ? r : null;
}

export function setupCalibration(opts: Options) {
  const screen = document.getElementById('calibrate-screen')!;
  const body = document.getElementById('cal-body')!;
  const stepLabel = document.getElementById('cal-step')!;
  const rsvp = document.getElementById('cal-rsvp')!;
  const rsvpStatus = document.getElementById('cal-rsvp-status')!;
  const progressFill = document.getElementById('cal-progress-fill')!;
  const exitBtn = document.getElementById('cal-exit')!;
  const wordView = createWordView(rsvp.querySelector<HTMLElement>('.word-row')!);

  // Session state. `session` increments on every (re)start so stale async
  // callbacks from an abandoned run do nothing.
  let session = 0;
  let level: Level = 'B1';
  let startLevel: Level = 'B1';
  let pool: Passage[] = [];
  let rounds: Round[] = [];
  let baseline: Round | null = null;
  let wpm = 250;
  let player: Player | null = null;
  let onSpace: (() => void) | null = null;

  const setProgress = (fraction: number) => {
    progressFill.style.transform = `scaleX(${fraction})`;
  };

  const show = (step: string, ...children: Child[]) => {
    rsvp.hidden = true;
    body.hidden = false;
    stepLabel.textContent = step;
    body.replaceChildren(...children.filter((c): c is Node | string => !!c));
    body.scrollTop = 0;
    // Move focus to the heading so screen readers announce the new step.
    const heading = body.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };

  const stopPlayer = () => {
    player?.destroy();
    player = null;
    onSpace = null;
  };

  // --- Steps ---------------------------------------------------------------

  function intro() {
    stopPlayer();
    setProgress(0);
    const last = loadCalibration();
    const name = 'cal-level';
    const choice = (value: string, title: string, desc: string, checked = false) =>
      h(
        'label',
        { class: 'cal-choice' },
        h('input', { type: 'radio', name, value, ...(checked ? { checked: '' } : {}) }),
        h('span', {}, h('strong', {}, title), h('small', {}, desc)),
      );
    const form = h(
      'form',
      { class: 'cal-form' },
      h(
        'fieldset',
        { class: 'cal-levels' },
        h('legend', {}, 'Which sentence describes your English best?'),
        ...LEVELS.map((l) => choice(l, `${LEVEL_INFO[l].name} (${l})`, LEVEL_INFO[l].canDo)),
        choice('B1', 'Not sure', 'Start in the middle. The test will make the texts easier if they are too hard.', true),
      ),
      h('button', { type: 'submit', class: 'btn btn-primary' }, 'Start the test'),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const picked = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
      begin((picked?.value as Level) ?? 'B1');
    });
    show(
      'Speed test',
      h('h2', {}, 'Find your best reading speed'),
      h(
        'p',
        {},
        `This test takes about 5 minutes. You will read ${TOTAL_TEXTS} short texts. After each text, you will answer 3 questions about it.`,
      ),
      h(
        'p',
        {},
        'The test changes the speed after each text. If you understand well, it goes faster. If not, it goes slower. At the end, you will see the fastest speed where you still understood the text well.',
      ),
      last &&
        h(
          'p',
          { class: 'cal-note' },
          `Your last result: ${last.wpm} WPM with ${last.level} texts (${new Date(last.date).toLocaleDateString()}).`,
        ),
      form,
    );
  }

  function begin(chosen: Level) {
    session++;
    startLevel = level = chosen;
    pool = shuffle(passagesFor(level));
    rounds = [];
    baseline = null;
    baselineIntro();
  }

  function baselineIntro() {
    const go = h('button', { type: 'button', class: 'btn btn-primary' }, 'Show the text');
    go.addEventListener('click', baselineRead);
    setProgress(0);
    show(
      `Text 1 of ${TOTAL_TEXTS}`,
      h('h2', {}, 'First: read in your normal way'),
      h(
        'p',
        {},
        'Read the next text at your normal speed, the way you usually read. Read it once. When you finish, press Done.',
      ),
      h('p', {}, 'Then you will answer 3 questions. You cannot see the text during the questions.'),
      go,
    );
  }

  function baselineRead() {
    const passage = pool.pop()!;
    const done = h('button', { type: 'button', class: 'btn btn-primary' }, 'Done');
    show(
      `Text 1 of ${TOTAL_TEXTS} · Normal reading`,
      h('h2', {}, passage.title),
      h('p', { class: 'cal-passage' }, passage.text),
      done,
    );
    const started = performance.now();
    const id = session;
    done.addEventListener('click', () => {
      const elapsed = performance.now() - started;
      const speed = measuredWpm(wordCount(passage), elapsed);
      questions(passage, `Text 1 of ${TOTAL_TEXTS} · Questions`, (correct) => {
        if (id !== session) return;
        baseline = { wpm: Math.round(speed), correct, total: 3 };
        const newLevel = adjustLevel(level, baseline);
        if (newLevel !== level) {
          level = newLevel;
          pool = shuffle(passagesFor(level));
        }
        wpm = startWpm(speed);
        rsvpIntro();
      });
    });
  }

  function rsvpIntro() {
    const n = rounds.length + 2;
    setProgress((n - 1) / TOTAL_TEXTS);
    const start = h('button', { type: 'button', class: 'btn btn-primary' }, 'Start ', h('kbd', {}, 'Space'));
    start.addEventListener('click', rsvpPlay);
    const easier =
      rounds.length === 0 && level !== startLevel
        ? h(
            'p',
            { class: 'cal-note' },
            `The first text seemed hard, so the next texts will be a little easier (${LEVEL_INFO[level].name}, ${level}).`,
          )
        : null;
    show(
      `Text ${n} of ${TOTAL_TEXTS} · ${wpm} WPM`,
      h('h2', {}, rounds.length === 0 ? 'Now: one word at a time' : `Next text: ${wpm} words per minute`),
      easier,
      rounds.length === 0 &&
        h(
          'p',
          {},
          'The words will appear one by one in the middle of the screen. Keep your eyes on the red letter. You cannot go back, so pay attention.',
        ),
      h('p', {}, `Speed: ${wpm} words per minute. Press Start when you are ready.`),
      start,
    );
    onSpace = rsvpPlay;
  }

  function rsvpPlay() {
    const passage = pool.pop()!;
    const n = rounds.length + 2;
    const id = session;
    stopPlayer();
    body.hidden = true;
    rsvp.hidden = false;
    stepLabel.textContent = `Text ${n} of ${TOTAL_TEXTS} · ${wpm} WPM`;
    rsvpStatus.textContent = '';
    const tokens = tokenize(passage.text);
    const frames = computeSchedule(tokens, { wpm, sensitivity: opts.settings.sensitivity });
    const p = (player = new Player());
    p.on('frame', ({ frame }) => wordView.render(frame));
    p.on('progress', ({ fraction }) => setProgress((n - 1 + fraction) / TOTAL_TEXTS));
    p.on('state', ({ state }) => {
      rsvpStatus.textContent = state === 'paused' ? 'Paused. Press Space to continue.' : '';
      if (state === 'finished') {
        onSpace = null;
        window.setTimeout(() => {
          if (id !== session || player !== p) return;
          stopPlayer();
          wordView.clear();
          questions(passage, `Text ${n} of ${TOTAL_TEXTS} · Questions`, (correct) => {
            if (id !== session) return;
            const round = { wpm, correct, total: 3 };
            rounds.push(round);
            wpm = nextWpm(round);
            if (rounds.length < RSVP_ROUNDS) rsvpIntro();
            else result();
          });
        }, 600);
      }
    });
    p.load(tokens, frames);
    onSpace = () => p.toggle();
    p.play();
  }

  function questions(passage: Passage, step: string, onDone: (correct: number) => void) {
    onSpace = null;
    const form = h('form', { class: 'cal-form' });
    const correctAnswers: string[] = [];
    passage.questions.forEach((q, qi) => {
      correctAnswers.push(q.options[0]);
      const name = `q${qi}`;
      form.append(
        h(
          'fieldset',
          { class: 'cal-question' },
          h('legend', {}, `${qi + 1}. ${q.q}`),
          ...shuffle(q.options).map((opt) =>
            h('label', { class: 'cal-option' }, h('input', { type: 'radio', name, value: opt }), h('span', {}, opt)),
          ),
        ),
      );
    });
    const submit = h('button', { type: 'submit', class: 'btn btn-primary', disabled: '' }, 'Check answers');
    const status = h('p', { class: 'cal-score', role: 'status' });
    form.append(status, submit);

    form.addEventListener('change', () => {
      const answered = passage.questions.every((_, qi) => form.querySelector(`input[name="q${qi}"]:checked`));
      submit.disabled = !answered;
    });

    let checked = false;
    let score = 0;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (checked) {
        onDone(score);
        return;
      }
      checked = true;
      score = 0;
      passage.questions.forEach((_, qi) => {
        const inputs = Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="q${qi}"]`));
        for (const input of inputs) {
          input.disabled = true;
          const label = input.closest('label')!;
          const isCorrect = input.value === correctAnswers[qi];
          if (isCorrect) {
            label.classList.add('is-correct');
            label.append(h('em', {}, ' ✓ correct answer'));
          }
          if (input.checked) {
            if (isCorrect) score++;
            else label.classList.add('is-wrong');
          }
        }
      });
      status.textContent = `You got ${score} of 3 right.`;
      submit.textContent = 'Next';
      submit.focus();
    });

    show(step, h('h2', {}, `Questions: ${passage.title}`), form);
  }

  function result() {
    stopPlayer();
    setProgress(1);
    const rec = recommend(rounds);
    const res: CalibrationResult = {
      wpm: rec.wpm,
      level,
      baselineWpm: baseline?.wpm ?? 0,
      comprehension: rec.comprehension,
      date: new Date().toISOString(),
    };
    save('calibration', res);

    const useBtn = h('button', { type: 'button', class: 'btn btn-primary' }, `Use ${rec.wpm} WPM`);
    useBtn.addEventListener('click', () => {
      opts.onApply(rec.wpm);
      opts.onExit();
    });
    const againBtn = h('button', { type: 'button', class: 'btn' }, 'Take the test again');
    againBtn.addEventListener('click', intro);
    const backBtn = h('button', { type: 'button', class: 'btn btn-quiet' }, 'Back to my text');
    backBtn.addEventListener('click', opts.onExit);

    const pct = Math.round(rec.comprehension * 100);
    const rows = [
      baseline && {
        label: 'Normal reading',
        wpm: baseline.wpm > SKIM_WPM ? `over ${SKIM_WPM}` : String(baseline.wpm),
        correct: baseline.correct,
      },
      ...rounds.map((r, i) => ({ label: `One word at a time (${i + 1})`, wpm: String(r.wpm), correct: r.correct })),
    ].filter((r): r is { label: string; wpm: string; correct: number } => !!r);

    show(
      'Speed test · Result',
      h('h2', {}, 'Your result'),
      h('p', { class: 'cal-big' }, h('strong', {}, String(rec.wpm)), ' words per minute'),
      h(
        'p',
        {},
        rec.confident
          ? `This is the fastest speed where you understood the texts well. Overall, you answered ${pct}% of the questions correctly.`
          : `These texts were hard at every speed we tried (${pct}% correct). We suggest ${rec.wpm} WPM for now. Try the test again and choose an easier level.`,
      ),
      baseline &&
        h(
          'p',
          {},
          baseline.wpm > SKIM_WPM
            ? `You read the first text very quickly (more than ${SKIM_WPM} words per minute), so we could not measure your normal reading speed.`
            : `Your normal reading speed was about ${baseline.wpm} words per minute.`,
          ` The texts were ${LEVEL_INFO[level].name} (${level}) level.`,
        ),
      h(
        'table',
        { class: 'cal-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Text'), h('th', {}, 'Speed'), h('th', {}, 'Correct'))),
        h(
          'tbody',
          {},
          ...rows.map((r) =>
            h('tr', {}, h('td', {}, r.label), h('td', {}, `${r.wpm} WPM`), h('td', {}, `${r.correct} of 3`)),
          ),
        ),
      ),
      h(
        'p',
        { class: 'cal-note' },
        'Tip: for difficult or important texts, choose a slower speed. You can change the speed at any time with the ↑ and ↓ keys.',
      ),
      h('div', { class: 'cal-actions' }, useBtn, againBtn, backBtn),
    );
  }

  // --- Keyboard and exit --------------------------------------------------

  const exit = () => {
    session++;
    stopPlayer();
    opts.onExit();
  };
  exitBtn.addEventListener('click', exit);

  document.addEventListener('keydown', (e) => {
    if (screen.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      exit();
    } else if (e.key === ' ' && onSpace && !(e.target as HTMLElement).matches('input, button')) {
      e.preventDefault();
      if (!e.repeat) onSpace();
    } else if (e.key === ' ' && onSpace && !rsvp.hidden) {
      // During playback, Space always toggles, even if a button has focus.
      e.preventDefault();
      if (!e.repeat) onSpace();
    }
  });

  return {
    open() {
      session++;
      intro();
    },
  };
}
