// Optimal recognition point: which letter the eye should fixate on.

const LETTER = /[\p{L}\p{N}]/u;

/** Pivot rank (0-based, among letters) for a word with `letters` letters. */
export function orpRank(letters: number): number {
  if (letters <= 1) return 0;
  if (letters <= 5) return 1;
  if (letters <= 9) return 2;
  if (letters <= 13) return 3;
  return 4;
}

/** Index into `text` of the pivot character (leading punctuation ignored). */
export function orpIndex(text: string): number {
  const chars = Array.from(text);
  const letterPositions: number[] = [];
  chars.forEach((c, i) => LETTER.test(c) && letterPositions.push(i));
  if (letterPositions.length === 0) return Math.floor((chars.length - 1) / 2);
  return letterPositions[orpRank(letterPositions.length)];
}

/** Split into [before, pivot, after] around the ORP (code-point safe). */
export function splitAtOrp(text: string): [string, string, string] {
  const chars = Array.from(text);
  if (chars.length === 0) return ['', '', ''];
  const i = orpIndex(text);
  return [chars.slice(0, i).join(''), chars[i], chars.slice(i + 1).join('')];
}
