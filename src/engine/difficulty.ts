// Word difficulty lookup: word -> bucket 0 (easiest) … 9 (hardest).

export type DifficultyData = { buckets: string[] };

let table: Map<string, number> | null = null;
let loading: Promise<void> | null = null;

const QUOTES = /[‘’‚‛′`´]/g;
const EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** Lower-case, unify apostrophes, strip surrounding punctuation/quotes. */
export function normalizeWord(raw: string): string {
  return raw.replace(QUOTES, "'").replace(EDGE, '').toLowerCase();
}

export function setDifficultyData(data: DifficultyData | null): void {
  if (!data) {
    table = null;
    return;
  }
  const map = new Map<string, number>();
  data.buckets.forEach((words, bucket) => {
    for (const w of words.split(' ')) if (w && !map.has(w)) map.set(w, bucket);
  });
  table = map;
}

export function isDifficultyLoaded(): boolean {
  return table !== null;
}

/** Load the bundled wordlist asynchronously (a separate chunk). */
export function loadDifficulty(): Promise<void> {
  loading ??= import('../data/difficulty.json').then((mod) => {
    setDifficultyData((mod.default ?? mod) as DifficultyData);
  });
  return loading;
}

/** Used before the wordlist has loaded: length only. */
export function lengthOnlyBucket(word: string): number {
  const n = word.length;
  if (n <= 3) return 1;
  if (n <= 5) return 3;
  if (n <= 7) return 4;
  if (n <= 9) return 5;
  if (n <= 12) return 6;
  return 7;
}

/** Bucket for words missing from the list (and their stems). */
export function unknownWordBucket(word: string): number {
  return Math.min(9, 7 + (word.length >= 10 ? 1 : 0));
}

const VOWEL = /[aeiou]/;

/** Candidate stems for simple inflections, most specific first. */
export function stemCandidates(w: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (s.length >= 2 && s !== w && !out.includes(s)) out.push(s);
  };
  const undouble = (s: string) =>
    s.length >= 3 && s.at(-1) === s.at(-2) && !VOWEL.test(s.at(-1)!) ? s.slice(0, -1) : null;

  if (w.endsWith("'s")) add(w.slice(0, -2));
  if (w.endsWith("s'")) add(w.slice(0, -1));
  if (w.endsWith('ies')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ed')) {
    const s = w.slice(0, -2);
    add(s);
    add(s + 'e');
    const u = undouble(s);
    if (u) add(u);
  }
  if (w.endsWith('ing')) {
    const s = w.slice(0, -3);
    add(s);
    add(s + 'e');
    const u = undouble(s);
    if (u) add(u);
  }
  if (w.endsWith('ily')) add(w.slice(0, -3) + 'y');
  if (w.endsWith('ly')) add(w.slice(0, -2));
  return out;
}

export function difficultyOf(raw: string): number {
  const w = normalizeWord(raw);
  if (!w) return 0;
  if (!table) return lengthOnlyBucket(w);
  const hit = table.get(w);
  if (hit !== undefined) return hit;
  for (const stem of stemCandidates(w)) {
    const b = table.get(stem);
    if (b !== undefined) return Math.min(9, b + 1);
  }
  return unknownWordBucket(w);
}
