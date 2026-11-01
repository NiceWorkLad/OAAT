import { computeSchedule, remainingMs } from '../engine/timing';
import { FileError, readTextFile, setupDropZone } from '../input/file';
import { looksLikeMarkdown } from '../input/markdown';
import { fetchArticle, isLoneWikiUrl, parseWikiInput, WikiError } from '../input/wikipedia';
import { formatReadingTime, makeDoc, type Doc } from './doc';
import type { Settings } from './settings';

const WIKI_TIMEOUT_MS = 15000;

type Source = { name: string | null; isMarkdown: boolean; source?: string | null };

type Options = {
  settings: Settings;
  onStart: (doc: Doc) => void;
  onTextChange: (text: string, isMarkdown: boolean, name: string | null, source: string | null) => void;
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
  const wikiForm = document.getElementById('wiki-form') as HTMLFormElement;
  const wikiInput = document.getElementById('wiki-input') as HTMLInputElement;
  const wikiBtn = document.getElementById('wiki-btn') as HTMLButtonElement;

  // Markdown-ness: files decide by extension; pasted text is sniffed.
  let fileState: { name: string | null; isMarkdown: boolean; source: string | null; text: string } | null = null;
  let wikiAbort: AbortController | null = null;
  let statsTimer = 0;

  const current = () => {
    const text = textarea.value;
    const fromFile = fileState && fileState.text === text ? fileState : null;
    return {
      text,
      isMarkdown: fromFile ? fromFile.isMarkdown : looksLikeMarkdown(text),
      name: fromFile?.name ?? null,
      source: fromFile?.source ?? null,
    };
  };

  const say = (msg: string | Node[], kind: 'info' | 'error' = 'info') => {
    if (typeof msg === 'string') message.textContent = msg;
    else message.replaceChildren(...msg);
    message.dataset.kind = kind;
  };

  const link = (href: string, text: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = text;
    return a;
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
    opts.onTextChange(c.text, c.isMarkdown, c.name, c.source);
    scheduleStats();
  };

  const setText = (text: string, file: Source | null) => {
    fileState = file ? { name: file.name, isMarkdown: file.isMarkdown, source: file.source ?? null, text } : null;
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

  // --- Wikipedia --------------------------------------------------------

  const loadWikipedia = async (input: string) => {
    const parsed = parseWikiInput(input);
    if (!parsed.ok) {
      say(
        parsed.reason === 'not-english'
          ? 'Only English Wikipedia (en.wikipedia.org) is supported for now.'
          : parsed.reason === 'not-wikipedia'
            ? 'That doesn’t look like a Wikipedia link. Paste a link, or just the article title.'
            : 'Type a Wikipedia article title or paste its link.',
        'error',
      );
      wikiInput.focus();
      return;
    }
    wikiAbort?.abort();
    const ctrl = (wikiAbort = new AbortController());
    const timer = window.setTimeout(() => ctrl.abort(), WIKI_TIMEOUT_MS);
    wikiBtn.disabled = true;
    wikiForm.setAttribute('aria-busy', 'true');
    say(`Loading “${parsed.title}” from Wikipedia…`);
    try {
      const article = await fetchArticle(parsed.title, { signal: ctrl.signal });
      if (ctrl !== wikiAbort) return; // superseded
      setText(article.text, { name: `${article.title} — Wikipedia`, isMarkdown: true, source: article.url });
      wikiInput.value = '';
      say([
        document.createTextNode('Loaded '),
        link(article.url, `“${article.title}”`),
        document.createTextNode(' from Wikipedia (CC BY-SA 4.0).'),
      ]);
      textarea.scrollTop = 0;
      startBtn.focus();
    } catch (err) {
      if (ctrl !== wikiAbort) return;
      say(err instanceof WikiError ? err.message : 'Sorry, that article couldn’t be loaded.', 'error');
      wikiInput.focus();
    } finally {
      clearTimeout(timer);
      if (ctrl === wikiAbort) {
        wikiAbort = null;
        wikiBtn.disabled = false;
        wikiForm.removeAttribute('aria-busy');
      }
    }
  };

  wikiForm.addEventListener('submit', (e) => {
    e.preventDefault();
    void loadWikipedia(wikiInput.value);
  });

  textarea.addEventListener('input', () => {
    say('');
    // A lone Wikipedia link pasted into the main box: fetch the article instead
    // of reading the URL out.
    if (isLoneWikiUrl(textarea.value)) {
      const url = textarea.value.trim();
      setText('', null);
      void loadWikipedia(url);
      return;
    }
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
      if (isLoneWikiUrl(text)) {
        void loadWikipedia(text);
        return;
      }
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
    const doc = makeDoc(c.text, c.isMarkdown, c.name, c.source);
    if (doc.tokens.length === 0) return;
    opts.onStart(doc);
  };
  startBtn.addEventListener('click', start);

  return {
    setText: (text: string, isMarkdown: boolean, name: string | null, source: string | null = null) =>
      setText(text, { name, isMarkdown, source }),
    refreshStats: updateStats,
    focus: () => textarea.focus(),
    start,
  };
}
