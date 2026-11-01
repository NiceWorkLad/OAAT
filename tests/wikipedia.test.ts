import { describe, expect, it, vi } from 'vitest';
import { stripMarkdown } from '../src/input/markdown';
import {
  apiUrl,
  articleUrl,
  cleanExtract,
  fetchArticle,
  isLoneWikiUrl,
  parseWikiInput,
  WikiError,
} from '../src/input/wikipedia';

const title = (s: string) => {
  const r = parseWikiInput(s);
  return r.ok ? r.title : `!${r.reason}`;
};

describe('parseWikiInput', () => {
  it.each([
    ['https://en.wikipedia.org/wiki/Alan_Turing', 'Alan Turing'],
    ['http://en.wikipedia.org/wiki/Alan_Turing', 'Alan Turing'],
    ['en.wikipedia.org/wiki/Alan_Turing', 'Alan Turing'],
    ['https://en.m.wikipedia.org/wiki/Alan_Turing#Early_life', 'Alan Turing'],
    ['en.m.wikipedia.org/wiki/Alan_Turing?useskin=vector', 'Alan Turing'],
    ['wikipedia.org/wiki/Alan_Turing', 'Alan Turing'],
    ['https://www.wikipedia.org/wiki/Alan_Turing', 'Alan Turing'],
    ['https://en.wikipedia.org/w/index.php?title=Alan_Turing&oldid=123', 'Alan Turing'],
    ['/wiki/Alan_Turing', 'Alan Turing'],
    ['wiki/Alan_Turing', 'Alan Turing'],
    ['Alan_Turing', 'Alan Turing'],
    ['  Alan   Turing  ', 'Alan Turing'],
    ['Caf%C3%A9', 'Café'],
    ['https://en.wikipedia.org/wiki/Caf%C3%A9', 'Café'],
    ['AC/DC', 'AC/DC'],
    ['https://en.wikipedia.org/wiki/AC/DC', 'AC/DC'],
    ['100%_Pure', '100% Pure'],
    ['Rock_%26_roll', 'Rock & roll'],
  ])('%s → %s', (input, expected) => {
    expect(title(input)).toBe(expected);
  });

  it('rejects empty input', () => {
    expect(title('')).toBe('!empty');
    expect(title('   ')).toBe('!empty');
    expect(title('https://en.wikipedia.org/wiki/')).toBe('!empty');
    expect(title('/wiki/')).toBe('!empty');
  });

  it('rejects other sites', () => {
    expect(title('https://example.com/wiki/Foo')).toBe('!not-wikipedia');
    expect(title('www.bbc.co.uk/news')).toBe('!not-wikipedia');
    expect(title('https://wikipedia.org.evil.com/wiki/Foo')).toBe('!not-wikipedia');
  });

  it('flags non-English Wikipedias', () => {
    expect(title('https://fr.wikipedia.org/wiki/Paris')).toBe('!not-english');
    expect(title('de.m.wikipedia.org/wiki/Berlin')).toBe('!not-english');
  });
});

describe('isLoneWikiUrl', () => {
  it('spots a single Wikipedia URL', () => {
    expect(isLoneWikiUrl('https://en.wikipedia.org/wiki/Alan_Turing')).toBe(true);
    expect(isLoneWikiUrl('  en.m.wikipedia.org/wiki/Moon \n')).toBe(true);
  });
  it('ignores normal text, titles and other links', () => {
    expect(isLoneWikiUrl('Alan_Turing')).toBe(false);
    expect(isLoneWikiUrl('Read https://en.wikipedia.org/wiki/Moon later')).toBe(false);
    expect(isLoneWikiUrl('https://example.com/x')).toBe(false);
  });
});

describe('urls', () => {
  it('builds the API and article URLs', () => {
    const u = new URL(apiUrl('Alan Turing'));
    expect(u.host).toBe('en.wikipedia.org');
    expect(u.searchParams.get('titles')).toBe('Alan Turing');
    expect(u.searchParams.get('origin')).toBe('*');
    expect(u.searchParams.get('explaintext')).toBe('1');
    expect(articleUrl('Alan Turing')).toBe('https://en.wikipedia.org/wiki/Alan_Turing');
    expect(articleUrl('AC/DC')).toBe('https://en.wikipedia.org/wiki/AC/DC');
  });
});

const EXTRACT = `Alan Mathison Turing was an English mathematician.
He was highly influential in the development of computer science.


== Early life ==
Turing was born in Maida Vale, London.

=== Education ===
He went to Sherborne School.


== Empty section ==


== Legacy ==

=== Awards ===
The Turing Award is named after him. The formula {\\displaystyle f(x)={\\frac {1}{x}}} is unrelated.


== See also ==
Turing machine

== References ==
Lots of refs.
`;

describe('cleanExtract', () => {
  const md = cleanExtract('Alan Turing', EXTRACT);

  it('adds the title and converts headings', () => {
    expect(md.startsWith('# Alan Turing\n\n')).toBe(true);
    expect(md).toContain('## Early life');
    expect(md).toContain('### Education');
  });

  it('drops reference sections and everything after', () => {
    expect(md).not.toContain('See also');
    expect(md).not.toContain('Turing machine');
    expect(md).not.toContain('References');
  });

  it('drops empty sections but keeps parents of non-empty subsections', () => {
    expect(md).not.toContain('Empty section');
    expect(md).toContain('## Legacy');
    expect(md).toContain('### Awards');
  });

  it('removes TeX and collapses blank lines', () => {
    expect(md).not.toContain('displaystyle');
    expect(md).toContain('The formula  is unrelated.');
    expect(md).not.toMatch(/\n{3,}/);
  });

  it('gives each extract line its own paragraph', () => {
    const blocks = stripMarkdown(md);
    expect(blocks.slice(0, 3)).toEqual([
      { type: 'heading', text: 'Alan Turing' },
      { type: 'paragraph', text: 'Alan Mathison Turing was an English mathematician.' },
      { type: 'paragraph', text: 'He was highly influential in the development of computer science.' },
    ]);
  });
});

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('fetchArticle', () => {
  it('returns the cleaned article and canonical title', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ query: { pages: [{ title: 'Alan Turing', extract: 'He was a mathematician.' }] } }),
    );
    const a = await fetchArticle('alan turing', { fetchFn: fetchFn as unknown as typeof fetch });
    expect(a.title).toBe('Alan Turing');
    expect(a.url).toBe('https://en.wikipedia.org/wiki/Alan_Turing');
    expect(a.text).toBe('# Alan Turing\n\nHe was a mathematician.\n');
  });

  it('explains missing pages', async () => {
    const fetchFn = async () => jsonResponse({ query: { pages: [{ title: 'Nope', missing: true }] } });
    await expect(fetchArticle('Nope', { fetchFn })).rejects.toThrow(/Couldn’t find/);
  });

  it('explains disambiguation pages', async () => {
    const fetchFn = async () =>
      jsonResponse({ query: { pages: [{ title: 'Mercury', extract: 'x', pageprops: { disambiguation: '' } }] } });
    await expect(fetchArticle('Mercury', { fetchFn })).rejects.toThrow(/disambiguation/);
  });

  it('explains network failures and HTTP errors', async () => {
    const down = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(fetchArticle('X', { fetchFn: down })).rejects.toBeInstanceOf(WikiError);
    await expect(fetchArticle('X', { fetchFn: async () => jsonResponse({}, 503) })).rejects.toThrow(/503/);
  });
});
