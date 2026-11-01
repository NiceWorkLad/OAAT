import { describe, expect, it } from 'vitest';
import { orpIndex, orpRank, splitAtOrp } from '../src/engine/orp';

describe('orp', () => {
  it('picks the rank for every length band', () => {
    expect(orpRank(1)).toBe(0);
    for (const n of [2, 3, 4, 5]) expect(orpRank(n)).toBe(1);
    for (const n of [6, 7, 8, 9]) expect(orpRank(n)).toBe(2);
    for (const n of [10, 11, 12, 13]) expect(orpRank(n)).toBe(3);
    for (const n of [14, 20, 40]) expect(orpRank(n)).toBe(4);
  });

  it('indexes into the display text', () => {
    expect(orpIndex('a')).toBe(0);
    expect(orpIndex('word')).toBe(1);
    expect(orpIndex('reading')).toBe(2);
    expect(orpIndex('“word,”')).toBe(2); // leading quote ignored
    expect(orpIndex('(extraordinary)')).toBe(4);
  });

  it('counts letters only', () => {
    // "it's," has 4 letters -> rank 1
    expect(orpIndex("it's,")).toBe(1);
  });

  it('splits around the pivot', () => {
    expect(splitAtOrp('reading')).toEqual(['re', 'a', 'ding']);
    expect(splitAtOrp('“Hi!”')).toEqual(['“H', 'i', '!”']);
    expect(splitAtOrp('')).toEqual(['', '', '']);
  });
});
