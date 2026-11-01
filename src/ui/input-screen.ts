import { computeSchedule, remainingMs } from '../engine/timing';
import { FileError, readTextFile, setupDropZone } from '../input/file';
import { looksLikeMarkdown } from '../input/markdown';
import { formatReadingTime, makeDoc, type Doc } from './doc';
import type { Settings } from './settings';

type Options = {
  settings: Settings;
  onStart: (doc: Doc) => void;
  onTextChange: (text: string, isMarkdown: boolean, name: string | null) => void;
  isActive: () => boolean;
};

export function setupInputScreen(opts: Options) {
  const textarea = document.getElementById('text-input') as HTMLTextAreaElement;
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const chooseBtn = document.getElementById('choose-file')!;
  const pasteBtn = document.getElementById('paste-btn')!;
  const clearBtn = document.getElementById('clear-btn')!;
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const stats = document.getElementById('input-stats')!;
  const message = document.getElementById('input-message')!;
  const overlay = document.getElementById('drop-overlay')!;

  // Markdown-ness: files decide by extension; pasted text is sniffed.
  let fileState: { name: string | null; isMarkdown: boolean; text: string } | null = null;
  let statsTimer = 0;

  const current = () => {
    const text = textarea.value;
    const fromFile = fileState && fileState.text === text ? fileState : null;
    return {
      text,
      isMarkdown: fromFile ? fromFile.isMarkdown : looksLikeMarkdown(text),
      name: fromFile?.name ?? null,
    };
  };

  const say = (msg: string, kind: 'info' | 'error' = 'info') => {
    message.textContent = msg;
    message.dataset.kind = kind;
  };

  const updateStats = () => {
    const { text, isMarkdown } = current();
    if (!text.trim()) {
      stats.textContent = '';
      startBtn.disabled = true;
      return;
    }
    const doc = makeDoc(text, isMarkdown);
    const n = doc.tokens.length;
    const ms = remainingMs(computeSchedule(doc.tokens, opts.settings));
    stats.textContent = `${n.toLocaleString()} word${n === 1 ? '' : 's'} · ${formatReadingTime(ms)} at ${opts.settings.wpm} WPM`;
    startBtn.disabled = n === 0;
  };

  const scheduleStats = () => {
    clearTimeout(statsTimer);
    statsTimer = window.setTimeout(updateStats, textarea.value.length > 50000 ? 400 : 120);
  };

  const changed = () => {
    const c = current();
    opts.onTextChange(c.text, c.isMarkdown, c.name);
    scheduleStats();
  };

  const setText = (text: string, file: { name: string | null; isMarkdown: boolean } | null) => {
    fileState = file ? { ...file, text } : null;
    textarea.value = text;
    changed();
  };

  const loadFile = async (file: File) => {
    try {
      const f = await readTextFile(file);
      setText(f.text, { name: f.name, isMarkdown: f.isMarkdown });
      say(`Loaded “${f.name}”.`);
      startBtn.focus();
    } catch (err) {
      say(err instanceof FileError ? err.message : 'Sorry, that file couldn’t be read.', 'error');
    }
  };

  textarea.addEventListener('input', () => {
    say('');
    changed();
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      start();
    }
  });

  chooseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void loadFile(file);
    fileInput.value = '';
  });

  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) throw new Error('empty');
      setText(text, null);
      say('Pasted from clipboard.');
    } catch {
      textarea.focus();
      textarea.select();
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);
      say(`Press ${mac ? '⌘' : 'Ctrl'}+V to paste.`);
    }
  });

  clearBtn.addEventListener('click', () => {
    setText('', null);
    say('');
    textarea.focus();
  });

  setupDropZone(
    document.body,
    (file) => {
      if (opts.isActive()) void loadFile(file);
    },
    (active) => {
      overlay.hidden = !(active && opts.isActive());
    },
  );

  const start = () => {
    const c = current();
    if (!c.text.trim()) return;
    const doc = makeDoc(c.text, c.isMarkdown, c.name);
    if (doc.tokens.length === 0) return;
    opts.onStart(doc);
  };
  startBtn.addEventListener('click', start);

  return {
    setText: (text: string, isMarkdown: boolean, name: string | null) => setText(text, { name, isMarkdown }),
    refreshStats: updateStats,
    focus: () => textarea.focus(),
    start,
  };
}
