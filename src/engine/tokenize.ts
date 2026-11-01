import { normalizeWord } from './difficulty';

export type Pause = 'none' | 'comma' | 'sentence' | 'paragraph' | 'heading';
export type Kind = 'word' | 'number' | 'name' | 'symbol';

export type Token = {
  text: string; // what's displayed, e.g. "world,"
  core: string; // normalised word for lookup, e.g. "world"
  pause: Pause;
  kind: Kind;
  sentenceIndex: number;
};

export type Block = { type: 'paragraph' | 'heading'; text: string };

/** Plain text -> paragraph blocks (blank lines separate paragraphs). */
export function textToBlocks(text: string): Block[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph' as const, text }));
}

// Abbreviations that shouldn't end a sentence. Deliberately excludes ones that
// double as ordinary words (no, sat, sun, mar, wed, min…) to avoid missing
// real sentence ends.
const ABBREVIATIONS = new Set(
  (
    'mr mrs ms mx dr prof sr jr st mt vs etc e.g i.e cf al approx dept fig figs ' +
    'vol vols pp eds inc ltd corp jan feb apr jun jul aug sep sept oct nov ' +
    'tues thurs lt sgt capt gov sen esp'
  ).split(' '),
);

// Stray punctuation that gets merged into a neighbouring token.
const PUNCT_ONLY = /^[.,;:!?…\-\u2010-\u2015'"“”‘’«»()[\]{}*_]+$/u;
const OPENERS = /^[\p{Ps}\p{Pi}"'“‘«]+$/u;
const CLOSERS = /[\p{Pe}\p{Pf}"'”’»*_]+$/u;
const SENTENCE_END = /[.!?…]$/;
const COMMA_END = /[,;:–—]$/;
const URL_RE = /^[(<\["'“]*(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRONOUN_I = new Set(['i', "i'm", "i'll", "i've", "i'd"]);

function isAbbreviation(stripped: string): boolean {
  if (!stripped.endsWith('.')) return false;
  const body = stripped.replace(/^[^\p{L}]+/u, '').slice(0, -1).toLowerCase();
  if (ABBREVIATIONS.has(body)) return true;
  // Initials and dotted acronyms: "J.", "U.S.", "a.m."
  if (/^\p{L}$/u.test(body)) return true;
  if (/^(\p{L}\.)+\p{L}$/u.test(body)) return true;
  return false;
}

function punctuationPause(text: string): Pause {
  const stripped = text.replace(CLOSERS, '');
  if (SENTENCE_END.test(stripped)) return isAbbreviation(stripped) ? 'none' : 'sentence';
  if (COMMA_END.test(stripped)) return 'comma';
  return 'none';
}

function classify(text: string, core: string, sentenceStart: boolean, inHeading: boolean): Kind {
  if (URL_RE.test(text) || EMAIL_RE.test(core)) return 'symbol';
  const bare = text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (/\p{N}/u.test(bare)) return 'number';
  const letters = (bare.match(/\p{L}/gu) ?? []).length;
  if (bare.length === 0 || letters / bare.length < 0.5) return 'symbol';
  if (!sentenceStart && !inHeading && /^\p{Lu}/u.test(bare) && !PRONOUN_I.has(core)) return 'name';
  return 'word';
}

/** Split a block's text into raw display pieces, merging stray punctuation. */
function pieces(text: string): string[] {
  // Break "word—word" into "word—" "word" so the dash can drive a pause.
  const spaced = text.replace(/([^\s–—])([–—]+)(?=[^\s–—])/g, '$1$2 ');
  const raw = spaced.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let prefix = '';
  for (const p of raw) {
    if (PUNCT_ONLY.test(p)) {
      if (OPENERS.test(p) || out.length === 0) prefix += p;
      else out[out.length - 1] += p;
      continue;
    }
    out.push(prefix + p);
    prefix = '';
  }
  if (prefix) {
    if (out.length) out[out.length - 1] += prefix;
    else out.push(prefix);
  }
  return out;
}

export function tokenizeBlocks(blocks: Block[]): Token[] {
  const tokens: Token[] = [];
  let sentenceIndex = 0;
  blocks.forEach((block, bi) => {
    const inHeading = block.type === 'heading';
    const parts = pieces(block.text);
    let sentenceStart = true;
    parts.forEach((text, i) => {
      const core = normalizeWord(text);
      const last = i === parts.length - 1;
      let pause = punctuationPause(text);
      if (last && inHeading) pause = 'heading';
      else if (last && bi < blocks.length - 1) pause = 'paragraph';
      tokens.push({
        text,
        core,
        pause,
        kind: classify(text, core, sentenceStart, inHeading),
        sentenceIndex,
      });
      sentenceStart = pause !== 'none' && pause !== 'comma';
      if (sentenceStart && !(last && bi === blocks.length - 1)) sentenceIndex++;
    });
  });
  return tokens;
}

export function tokenize(text: string): Token[] {
  return tokenizeBlocks(textToBlocks(text));
}
