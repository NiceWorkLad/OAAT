// Wikipedia import: turn a link, a partial link or a bare title into an
// article title, fetch the plain-text extract from English Wikipedia's public
// API (CORS-enabled for anonymous requests), and clean it up for reading.

export const WIKI_HOST = 'en.wikipedia.org';

export class WikiError extends Error {}

export type WikiParse = { ok: true; title: string } | { ok: false; reason: 'empty' | 'not-wikipedia' | 'not-english' };

const HOST_RE = /^(?:([a-z][a-z-]*)\.)?(?:m\.)?wikipedia\.org$/i;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    // A stray "%" — decode what we can, leave the rest.
    return s.replace(/(%[0-9a-f]{2})+/gi, (m) => {
      try {
        return decodeURIComponent(m);
      } catch {
        return m;
      }
    });
  }
}

function tidyTitle(raw: string): string {
  return safeDecode(raw.split('#')[0].split('?')[0]).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Accepts any of:
 *   https://en.wikipedia.org/wiki/Alan_Turing
 *   en.m.wikipedia.org/wiki/Alan_Turing#Early_life
 *   https://en.wikipedia.org/w/index.php?title=Alan_Turing&oldid=1
 *   /wiki/Alan_Turing · wiki/Alan_Turing · Alan_Turing · Alan Turing · Caf%C3%A9
 */
export function parseWikiInput(input: string): WikiParse {
  let s = input.trim();
  if (!s) return { ok: false, reason: 'empty' };

  // Looks like a URL (has a scheme or starts with a host name)?
  const urlish = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || /^(?:[\w-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(s);
  if (urlish) {
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      return { ok: false, reason: 'not-wikipedia' };
    }
    const m = HOST_RE.exec(url.hostname);
    if (!m) return { ok: false, reason: 'not-wikipedia' };
    const lang = (m[1] ?? 'en').toLowerCase();
    if (lang !== 'en' && lang !== 'www') return { ok: false, reason: 'not-english' };
    const titleParam = url.searchParams.get('title');
    if (titleParam) s = titleParam;
    else {
      const i = url.pathname.indexOf('/wiki/');
      if (i < 0) return { ok: false, reason: 'empty' };
      s = url.pathname.slice(i + 6);
    }
    const title = tidyTitle(s);
    return title ? { ok: true, title } : { ok: false, reason: 'empty' };
  }

  // Partial path: "/wiki/Foo", "wiki/Foo", or anything containing "/wiki/".
  const i = s.lastIndexOf('/wiki/');
  if (i >= 0) s = s.slice(i + 6);
  else if (/^wiki\//i.test(s)) s = s.slice(5);
  const title = tidyTitle(s);
  return title ? { ok: true, title } : { ok: false, reason: 'empty' };
}

/** True when the text is nothing but a single Wikipedia URL (e.g. pasted into the main box). */
export function isLoneWikiUrl(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  if (!/wikipedia\.org\//i.test(t)) return false;
  return parseWikiInput(t).ok;
}

export function articleUrl(title: string): string {
  return `https://${WIKI_HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`;
}

export function apiUrl(title: string): string {
  const p = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'extracts|pageprops',
    ppprop: 'disambiguation',
    explaintext: '1',
    exsectionformat: 'wiki',
    redirects: '1',
    origin: '*',
    titles: title,
  });
  return `https://${WIKI_HOST}/w/api.php?${p}`;
}

/** Sections from here to the end are reference material, not prose. */
const TAIL_SECTIONS = new Set([
  'see also',
  'notes',
  'note',
  'references',
  'citations',
  'sources',
  'further reading',
  'external links',
  'bibliography',
  'notes and references',
  'references and notes',
  'footnotes',
  'works cited',
  'selected bibliography',
  'primary sources',
  'secondary sources',
]);

/** Remove TeX like `{\displaystyle x^{2}}` that plain-text extracts leave behind. */
function stripMath(s: string): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const j = s.indexOf('{\\displaystyle', i);
    if (j < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, j);
    let depth = 0;
    let k = j;
    for (; k < s.length; k++) {
      if (s[k] === '{') depth++;
      else if (s[k] === '}' && --depth === 0) break;
    }
    i = k + 1;
  }
  return out;
}

/**
 * Turn an API extract into Markdown-ish text: `== Heading ==` becomes `## Heading`,
 * reference sections and empty sections are dropped, and the title goes on top.
 */
export function cleanExtract(title: string, extract: string): string {
  const lines = stripMath(extract.replace(/\r\n?/g, '\n')).split('\n');
  type Section = { heading: string | null; level: number; body: string[] };
  const sections: Section[] = [{ heading: null, level: 1, body: [] }];
  for (const raw of lines) {
    const line = raw.replace(/\s*\[edit\]\s*$/i, '');
    const h = /^\s*(={2,6})\s*(.*?)\s*\1\s*$/.exec(line);
    if (h) {
      const name = h[2].trim();
      if (h[1].length === 2 && TAIL_SECTIONS.has(name.toLowerCase())) break;
      sections.push({ heading: name, level: h[1].length, body: [] });
    } else {
      sections.at(-1)!.body.push(line);
    }
  }

  const hasText = (sec: Section) => sec.body.some((l) => l.trim());
  const out: string[] = [`# ${title}`, ''];
  sections.forEach((sec, i) => {
    // Keep a heading if it has text, or if a deeper subsection below it does.
    if (sec.heading !== null && !hasText(sec)) {
      let keep = false;
      for (let j = i + 1; j < sections.length && sections[j].level > sec.level; j++) {
        if (hasText(sections[j])) {
          keep = true;
          break;
        }
      }
      if (!keep) return;
    }
    if (sec.heading !== null) out.push(`${'#'.repeat(Math.min(6, sec.level))} ${sec.heading}`, '');
    // Extracts separate paragraphs with a single newline; give each its own
    // Markdown paragraph so paragraph pauses survive.
    for (const l of sec.body) if (l.trim()) out.push(l.trim(), '');
  });
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
}

export type WikiArticle = { title: string; url: string; text: string };

/** Fetch and clean an article. Throws WikiError with a friendly message. */
export async function fetchArticle(
  title: string,
  { fetchFn = globalThis.fetch, signal }: { fetchFn?: typeof fetch; signal?: AbortSignal } = {},
): Promise<WikiArticle> {
  let res: Response;
  try {
    res = await fetchFn(apiUrl(title), { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw new WikiError('Wikipedia took too long to answer. Try again?');
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new WikiError(
      offline
        ? 'You’re offline — Wikipedia import needs a connection. Pasted text and files still work.'
        : 'Couldn’t reach Wikipedia. Check your connection and try again.',
    );
  }
  if (!res.ok) throw new WikiError(`Wikipedia returned an error (${res.status}). Try again in a moment.`);

  type Page = {
    title?: string;
    missing?: boolean;
    invalid?: boolean;
    extract?: string;
    pageprops?: { disambiguation?: string };
  };
  let data: { query?: { pages?: Page[] } };
  try {
    data = await res.json();
  } catch {
    throw new WikiError('Wikipedia sent back something unexpected. Try again?');
  }
  const page = data.query?.pages?.[0];
  if (!page || page.missing || page.invalid) {
    throw new WikiError(`Couldn’t find a Wikipedia article called “${title}”.`);
  }
  const realTitle = page.title ?? title;
  if (page.pageprops && 'disambiguation' in page.pageprops) {
    throw new WikiError(`“${realTitle}” is a disambiguation page — try a more specific title.`);
  }
  if (!page.extract?.trim()) throw new WikiError(`“${realTitle}” has no readable text.`);
  return { title: realTitle, url: articleUrl(realTitle), text: cleanExtract(realTitle, page.extract) };
}
