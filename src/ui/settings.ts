import { MAX_SENSITIVITY } from '../engine/timing';
import { load, save } from './storage';

export type Theme = 'system' | 'light' | 'dark';

export type Settings = {
  wpm: number;
  sensitivity: number; // 0..MAX_SENSITIVITY
  theme: Theme;
  fontSize: number; // rem
  showDifficulty: boolean;
};

export const DEFAULTS: Settings = {
  wpm: 300,
  sensitivity: 0.6,
  theme: 'system',
  fontSize: 3.5,
  showDifficulty: false,
};

export const WPM_MIN = 100;
export const WPM_MAX = 1000;
export const WPM_STEP = 25;
export const FONT_MIN = 2;
export const FONT_MAX = 6;

const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>('settings') ?? {};
  return {
    wpm: Math.round(clamp(s.wpm, WPM_MIN, WPM_MAX, DEFAULTS.wpm) / WPM_STEP) * WPM_STEP,
    sensitivity: clamp(s.sensitivity, 0, MAX_SENSITIVITY, DEFAULTS.sensitivity),
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    fontSize: clamp(s.fontSize, FONT_MIN, FONT_MAX, DEFAULTS.fontSize),
    showDifficulty: typeof s.showDifficulty === 'boolean' ? s.showDifficulty : DEFAULTS.showDifficulty,
  };
}

export function saveSettings(s: Settings): void {
  save('settings', s);
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
  const themeInputs = Array.from(drawer.querySelectorAll<HTMLInputElement>('input[name="theme"]'));
  let opener: HTMLElement | null = null;

  const sync = () => {
    fontInput.value = String(settings.fontSize);
    fontOut.textContent = `${settings.fontSize.toFixed(2).replace(/\.?0+$/, '')} rem`;
    diffInput.checked = settings.showDifficulty;
    for (const r of themeInputs) r.checked = r.value === settings.theme;
  };
  sync();

  fontInput.addEventListener('input', () => {
    settings.fontSize = Number(fontInput.value);
    sync();
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
