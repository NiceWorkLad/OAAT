import { splitAtOrp } from '../engine/orp';
import type { Frame } from '../engine/timing';

/** Pivot x-position as a fraction of the row width (matches .word in CSS). */
const PIVOT_AT = 0.38;

/**
 * Renders one RSVP frame into a `.word-row` containing `.word` with
 * `.before`, `.pivot` and `.after` spans. The pivot letter never moves.
 */
export function createWordView(row: HTMLElement) {
  const wordEl = row.querySelector<HTMLElement>('.word')!;
  const beforeEl = wordEl.querySelector<HTMLElement>('.before')!;
  const pivotEl = wordEl.querySelector<HTMLElement>('.pivot')!;
  const afterEl = wordEl.querySelector<HTMLElement>('.after')!;

  /** Shrink tokens that would overflow (long URLs etc.); the pivot stays put. */
  const fit = () => {
    wordEl.style.setProperty('--fit', '1');
    const r = row.getBoundingClientRect();
    if (r.width === 0) return;
    const w = wordEl.getBoundingClientRect();
    const margin = 12;
    const pivotX = r.left + r.width * PIVOT_AT;
    let f = 1;
    if (w.right > r.right - margin) f = Math.min(f, (r.right - margin - pivotX) / (w.right - pivotX));
    if (w.left < r.left + margin) f = Math.min(f, (pivotX - r.left - margin) / (pivotX - w.left));
    if (f < 1) wordEl.style.setProperty('--fit', Math.max(0.2, f).toFixed(3));
  };

  const render = (frame: Pick<Frame, 'text' | 'bucket'>) => {
    const [before, pivot, after] = splitAtOrp(frame.text);
    beforeEl.textContent = before;
    pivotEl.textContent = pivot;
    afterEl.textContent = after;
    wordEl.style.setProperty('--before', String(Array.from(before).length));
    wordEl.dataset.bucket = String(frame.bucket);
    fit();
  };

  const clear = () => render({ text: '', bucket: 0 });

  addEventListener('resize', () => {
    if (row.offsetParent !== null) fit();
  });

  return { render, fit, clear };
}
