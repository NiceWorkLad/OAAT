import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown, stripInline, stripMarkdown } from '../src/input/markdown';

const texts = (md: string) => stripMarkdown(md).map((b) => b.text);

describe('markdown', () => {
  it('turns headings into heading blocks', () => {
    expect(stripMarkdown('# Title #\n\nText\n\nSub\n===\n\n### Third')).toEqual([
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'Text' },
      { type: 'heading', text: 'Sub' },
      { type: 'heading', text: 'Third' },
    ]);
  });

  it('replaces code fences with [code]', () => {
    expect(texts('Before\n\n```js\nconst x = 1;\n```\n\nAfter')).toEqual(['Before', '[code]', 'After']);
    expect(texts('~~~\ncode\n~~~')).toEqual(['[code]']);
  });

  it('removes images and keeps link text', () => {
    expect(stripInline('See ![a cat](cat.png) the [docs](https://x.io/a_(b)) now')).toBe('See the docs now');
    expect(stripInline('A [ref link][1] and <https://auto.link>')).toBe('A ref link and');
  });

  it('drops reference definitions', () => {
    expect(texts('Text [x][1]\n\n[1]: https://example.com')).toEqual(['Text x']);
  });

  it('removes HTML tags and decodes entities', () => {
    expect(stripInline('<b>bold</b> &amp; <span class="x">it</span>&nbsp;ok')).toBe('bold & it ok');
    expect(texts('<!-- hidden -->\nVisible')).toEqual(['Visible']);
  });

  it('removes emphasis markers but not intra-word underscores', () => {
    expect(stripInline('**bold** __b2__ *em* _em2_ ~~del~~ `code` snake_case_name 2*3*4')).toBe(
      'bold b2 em em2 del code snake_case_name 2*3*4',
    );
  });

  it('removes list bullets, one block per item', () => {
    expect(texts('- one\n- two\n* three\n1. four\n2) five\n- [x] done')).toEqual([
      'one', 'two', 'three', 'four', 'five', 'done',
    ]);
  });

  it('removes blockquote markers', () => {
    expect(texts('> quoted line\n> continues\n>\n> > nested')).toEqual(['quoted line continues', 'nested']);
  });

  it('removes table pipes and separator rows', () => {
    expect(texts('| a | b |\n|---|:-:|\n| 1 | 2 |\nx | y')).toEqual(['a b', '1 2', 'x y']);
  });

  it('drops horizontal rules and preserves paragraphs', () => {
    expect(texts('Para one\nstill one\n\n---\n\nPara two')).toEqual(['Para one still one', 'Para two']);
  });

  it('detects markdown-ish text', () => {
    expect(looksLikeMarkdown('# Heading\n\ntext')).toBe(true);
    expect(looksLikeMarkdown('see [this](http://x.y)')).toBe(true);
    expect(looksLikeMarkdown('Just a normal paragraph. With - dashes.')).toBe(false);
  });
});
