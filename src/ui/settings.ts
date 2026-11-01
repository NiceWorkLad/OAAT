import { MAX_SENSITIVITY } from '../engine/timing';
import { load, save } from './storage';

const supportsWakeLock = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

export type Theme = 'system' | 'light' | 'dark';

export type Settings = {
  wpm: number;
  sensitivity: number; // 0..MAX_SENSITIVITY
  theme: Theme;
  fontSize: number; // rem
  showDifficulty: boolean;
  keepAwake: boolean;
};

export const DEFAULTS: Settings = {
  wpm: 300,
  sensitivity: 0.6,
  theme: 'system',
  fontSize: 5,
  showDifficulty: false,
  keepAwake: true,
};

export const WPM_MIN = 100;
export const WPM_MAX = 1000;
export const WPM_STEP = 25;
export const FONT_MIN = 2.5;
export const FONT_MAX = 12;
export const FONT_STEP = 0.5;
/** Bumped when stored settings need migrating. */
const SETTINGS_VERSION = 2;

const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function loadSettings(): Settings {
  const s = load<Partial<Settings> & { v?: number }>('settings') ?? {};
  // v1 stored the old 3.5rem default for everyone; move those to the new, larger default.
  if ((s.v ?? 1) < 2 && s.fontSize === 3.5) s.fontSize = DEFAULTS.fontSize;
  return {
    wpm: Math.round(clamp(s.wpm, WPM_MIN, WPM_MAX, DEFAULTS.wpm) / WPM_STEP) * WPM_STEP,
    sensitivity: clamp(s.sensitivity, 0, MAX_SENSITIVITY, DEFAULTS.sensitivity),
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    fontSize: clamp(s.fontSize, FONT_MIN, FONT_MAX, DEFAULTS.fontSize),
    showDifficulty: typeof s.showDifficulty === 'boolean' ? s.showDifficulty : DEFAULTS.showDifficulty,
    keepAwake: typeof s.keepAwake === 'boolean' ? s.keepAwake : DEFAULTS.keepAwake,
  };
}

export function saveSettings(s: Settings): void {
  save('settings', { ...s, v: SETTINGS_VERSION });
}

export function nudgeFontSize(s: Settings, steps: number): void {
  s.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((s.fontSize + steps * FONT_STEP) * 2) / 2));
}

export function applyAppearance(s: Settings): void {
  const root = document.documentElement;
  if (s.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = s.theme;
  root.style.setProperty('--word-size', `${s.fontSize}rem`);
  root.classList.toggle('show-difficulty', s.showDifficulty);
  // Keep the browser UI colour in step with the theme.
  const dark =
    s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141416' : '#fbfaf7');
}

/** Wire up the settings drawer. Calls onChange after every edit. */
export function setupSettingsDrawer(settings: Settings, onChange: () => void) {
  const drawer = document.getElementById('settings')!;
  const backdrop = document.getElementById('settings-backdrop')!;
  const closeBtn = document.getElementById('settings-close')!;
  const fontInput = document.getElementById('font-size') as HTMLInputElement;
  const fontOut = document.getElementById('font-size-value')!;
  const diffInput = document.getElementById('show-difficulty') as HTMLInputElement;
  const awakeInput = document.getElementById('keep-awake') as HTMLInputElement;
  const awakeNote = document.getElementById('keep-awake-note')!;
  const themeInputs = Array.from(drawer.querySelectorAll<HTMLInputElement>('input[name="theme"]'));
  let opener: HTMLElement | null = null;

  const sync = () => {
    fontInput.min = String(FONT_MIN);
    fontInput.max = String(FONT_MAX);
    fontInput.step = String(FONT_STEP);
    fontInput.value = String(settings.fontSize);
    const pct = Math.round((settings.fontSize / DEFAULTS.fontSize) * 100);
    fontOut.textContent = pct === 100 ? 'Default' : `${pct}%`;
    diffInput.checked = settings.showDifficulty;
    awakeInput.checked = settings.keepAwake;
    for (const r of themeInputs) r.checked = r.value === settings.theme;
  };
  sync();

  fontInput.addEventListener('input', () => {
    settings.fontSize = Number(fontInput.value);
    sync();
    onChange();
  });
  awakeNote.textContent = supportsWakeLock()
    ? 'Stops the screen dimming or locking while words are playing.'
    : 'Not supported in this browser — your screen may still dim.';
  awakeInput.addEventListener('change', () => {
    settings.keepAwake = awakeInput.checked;
    onChange();
  });
  diffInput.addEventListener('change', () => {
    settings.showDifficulty = diffInput.checked;
    onChange();
  });
  for (const r of themeInputs) {
    r.addEventListener('change', () => {
      if (r.checked) settings.theme = r.value as Theme;
      onChange();
    });
  }

  const isOpen = () => !drawer.hidden;
  const open = (from?: HTMLElement) => {
    opener = from ?? (document.activeElement as HTMLElement | null);
    drawer.hidden = false;
    backdrop.hidden = false;
    document.querySelectorAll('[data-settings-open]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
    closeBtn.focus();
  };
  const close = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
    document.querySelectorAll('[data-settings-open]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    opener?.focus();
  };

  document.querySelectorAll<HTMLElement>('[data-settings-open]').forEach((b) =>
    b.addEventListener('click', () => (isOpen() ? close() : open(b))),
  );
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  });

  return { open, close, isOpen, sync };
}
