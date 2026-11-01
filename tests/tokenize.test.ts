import { describe, expect, it } from 'vitest';
import { tokenize, tokenizeBlocks } from '../src/engine/tokenize';
import { stripMarkdown } from '../src/input/markdown';

const pauses = (t: string) => tokenize(t).map((x) => x.pause);
const kinds = (t: string) => tokenize(t).map((x) => x.kind);

describe('tokenize', () => {
  it('keeps punctuation attached and normalises core', () => {
    const t = tokenize('Hello, world!');
    expect(t.map((x) => x.text)).toEqual(['Hello,', 'world!']);
    expect(t.map((x) => x.core)).toEqual(['hello', 'world']);
  });

  it('detects comma pauses', () => {
    expect(pauses('a, b; c: d — e f')).toEqual(['comma', 'comma', 'comma', 'comma', 'none', 'none']);
    expect(pauses('one–two and three—four')).toEqual(['comma', 'none', 'none', 'comma', 'none']);
  });

  it('detects sentence ends including closing quotes and brackets', () => {
    expect(pauses('Stop. Go! Why? Done')).toEqual(['sentence', 'sentence', 'sentence', 'none']);
    expect(pauses('He said “no.” Then (really.) left')).toEqual([
      'none', 'none', 'sentence', 'none', 'sentence', 'none',
    ]);
    expect(pauses('He said "yes!" ok')).toEqual(['none', 'none', 'sentence', 'none']);
  });

  it('does not end sentences at abbreviations', () => {
    expect(pauses('Mr. Smith met Dr. Jones e.g. today i.e. now etc. and J. K. Rowling in the U.S. too')).toEqual(
      Array(18).fill('none'),
    );
  });

  it('handles curly and straight apostrophes', () => {
    const t = tokenize('Don’t can\'t');
    expect(t.map((x) => x.core)).toEqual(["don't", "can't"]);
  });

  it('keeps hyphenated compounds as one token', () => {
    expect(tokenize('a well-known fact').map((x) => x.text)).toEqual(['a', 'well-known', 'fact']);
  });

  it('attaches stray punctuation to neighbours', () => {
    expect(tokenize('wait — what “ quoted ”').map((x) => x.text)).toEqual(['wait—', 'what', '“quoted”']);
  });

  it('classifies numbers, names and symbols', () => {
    expect(kinds('In 1999 Alice paid $5,000 to bob@example.com via https://x.io and & 3.14')).toEqual([
      'word', 'number', 'name', 'word', 'number', 'word', 'symbol', 'word', 'symbol', 'word', 'symbol', 'number',
    ]);
  });

  it('does not treat sentence-initial capitals or "I" as names', () => {
    expect(kinds('The cat sat. Then I left with Bob.')).toEqual([
      'word', 'word', 'word', 'word', 'word', 'word', 'word', 'name',
    ]);
  });

  it('marks paragraph breaks', () => {
    const t = tokenize('First para here.\n\nSecond one\n  \nThird');
    expect(t.map((x) => x.pause)).toEqual(['none', 'none', 'paragraph', 'none', 'paragraph', 'none']);
  });

  it('treats single newlines as spaces', () => {
    expect(tokenize('line one\nline two').map((x) => x.pause)).toEqual(['none', 'none', 'none', 'none']);
  });

  it('assigns sentence indices', () => {
    const t = tokenize('One two. Three, four! Five\n\nSix');
    expect(t.map((x) => x.sentenceIndex)).toEqual([0, 0, 1, 1, 2, 3]);
  });

  it('marks the last word of a Markdown heading', () => {
    const t = tokenizeBlocks(stripMarkdown('# The Big Title\n\nBody text here.'));
    expect(t.map((x) => x.pause)).toEqual(['none', 'none', 'heading', 'none', 'none', 'sentence']);
    // Title case in headings isn't treated as names.
    expect(t.slice(0, 3).every((x) => x.kind === 'word')).toBe(true);
    expect(t[3].sentenceIndex).toBe(1);
  });

  it('handles empty input', () => {
    expect(tokenize('   \n\n ')).toEqual([]);
  });
});
