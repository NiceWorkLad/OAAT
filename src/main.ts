import './styles.css';
import { loadDifficulty } from './engine/difficulty';
import type { Doc } from './ui/doc';
import { setupInputScreen } from './ui/input-screen';
import { setupReader } from './ui/reader';
import { applyAppearance, loadSettings, saveSettings, setupSettingsDrawer } from './ui/settings';
import { load, MAX_SAVED_TEXT, remove, save } from './ui/storage';

type SavedText = { text: string; isMarkdown: boolean; name: string | null };
type SavedPosition = { hash: string; tokenIndex: number };
type Screen = 'input' | 'reader';

const settings = loadSettings();
applyAppearance(settings);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyAppearance(settings));

const inputScreen = document.getElementById('input-screen')!;
const readerScreen = document.getElementById('reader-screen')!;

let currentDoc: Doc | null = null;

const persistSettings = () => saveSettings(settings);

const drawer = setupSettingsDrawer(settings, () => {
  applyAppearance(settings);
  persistSettings();
});

function savePosition(tokenIndex: number) {
  if (currentDoc) save('position', { hash: currentDoc.hash, tokenIndex } satisfies SavedPosition);
}

function showScreen(which: Screen) {
  inputScreen.hidden = which !== 'input';
  readerScreen.hidden = which !== 'reader';
  save('screen', which);
}

const reader = setupReader({
  settings,
  onSettingsChange: () => {
    persistSettings();
    input.refreshStats();
  },
  onPosition: savePosition,
  onExit: () => {
    showScreen('input');
    input.refreshStats();
    input.focus();
  },
  settingsOpen: drawer.isOpen,
});

const input = setupInputScreen({
  settings,
  isActive: () => !inputScreen.hidden,
  onTextChange: (text, isMarkdown, name) => {
    if (text.length <= MAX_SAVED_TEXT) save('text', { text, isMarkdown, name } satisfies SavedText);
    else remove('text');
  },
  onStart: (doc) => openReader(doc),
});

function openReader(doc: Doc) {
  currentDoc = doc;
  const pos = load<SavedPosition>('position');
  const resumeAt = pos && pos.hash === doc.hash && pos.tokenIndex < doc.tokens.length ? pos.tokenIndex : 0;
  showScreen('reader');
  reader.open(doc, resumeAt);
}

// Esc closes the settings drawer wherever focus is.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drawer.isOpen()) {
    e.preventDefault();
    drawer.close();
  }
});

// Save position when the page goes away.
addEventListener('pagehide', () => {
  if (currentDoc && !readerScreen.hidden) savePosition(reader.tokenIndex);
});

// --- Restore previous session ----------------------------------------------

const saved = load<SavedText>('text');
if (saved && typeof saved.text === 'string') {
  input.setText(saved.text, !!saved.isMarkdown, saved.name ?? null);
  if (load<Screen>('screen') === 'reader' && saved.text.trim()) {
    input.start();
  } else {
    showScreen('input');
  }
} else {
  showScreen('input');
  input.refreshStats();
}
if (!inputScreen.hidden) input.focus();

// The wordlist is a separate chunk; recompute timings once it arrives.
loadDifficulty()
  .then(() => {
    reader.reschedule();
    input.refreshStats();
  })
  .catch(() => {
    /* keep length-only fallback */
  });

// Offline support: cache the app after the first visit (production only).
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

