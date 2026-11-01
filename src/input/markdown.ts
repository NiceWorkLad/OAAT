import type { Block } from '../engine/tokenize';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Strip inline Markdown from a single line of text. */
export function stripInline(s: string): string {
  return decodeEntities(
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, '')
      .replace(/\[\^[^\]]+\]/g, '') // footnote refs
      .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1') // [text](url)
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1') // [text][ref]
      .replace(/<(?:https?:\/\/|mailto:)[^>]+>/gi, '') // autolinks
      .replace(/<[^>]+>/g, '') // HTML tags
      .replace(/(`+)(.+?)\1/g, '$2') // inline code
      .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2') // bold
      .replace(/(^|[^\p{L}\p{N}*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}*])/gu, '$1$2') // *em*
      .replace(/(^|[^\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, '$1$2') // _em_
      .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1'), // strike
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const ATX = /^\s{0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const SETEXT = /^\s{0,3}(=+|-+)\s*$/;
const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const LIST = /^\s*(?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?/;
const QUOTE = /^\s{0,3}(?:>\s?)+/;
const TABLE_SEP = /^(?=.*\|)(?=.*-)[\s|:-]+$/;
const REF_DEF = /^\s{0,3}\[[^\]]+\]:\s*\S+/;

/**
 * Convert Markdown to blocks of plain text. Headings become heading blocks;
 * paragraphs, list items and table rows become paragraph blocks.
 */
export function stripMarkdown(md: string): Block[] {
  const src = md.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const lines = src.split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  let inTable = false;

  const flush = () => {
    const text = stripInline(para.join(' '));
    if (text) blocks.push({ type: 'paragraph', text });
    para = [];
  };
  const push = (type: Block['type'], raw: string) => {
    const text = stripInline(raw);
    if (text) blocks.push({ type, text });
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const fence = line.match(FENCE);
    if (fence) {
      flush();
      const marker = fence[1];
      let j = i + 1;
      while (j < lines.length && !lines[j].trimStart().startsWith(marker)) j++;
      i = j;
      blocks.push({ type: 'paragraph', text: '[code]' });
      continue;
    }

    line = line.replace(QUOTE, '');
    if (!line.trim()) {
      flush();
      inTable = false;
      continue;
    }
    if (REF_DEF.test(line)) continue;

    const atx = line.match(ATX);
    if (atx) {
      flush();
      push('heading', atx[2] ?? '');
      continue;
    }

    // Setext heading: a paragraph line underlined with === or ---.
    const next = lines[i + 1]?.replace(QUOTE, '');
    if (para.length === 0 && next !== undefined && SETEXT.test(next) && !LIST.test(line)) {
      push('heading', line);
      i++;
      continue;
    }

    if (HR.test(line)) {
      flush();
      continue;
    }

    if (LIST.test(line)) {
      flush();
      para.push(line.replace(LIST, ''));
      continue;
    }

    if (line.includes('|') && (inTable || TABLE_SEP.test(lines[i + 1] ?? '') || /^\s*\|.*\|\s*$/.test(line))) {
      flush();
      inTable = true;
      if (TABLE_SEP.test(line)) continue;
      // Each row is its own block; cells become plain words.
      push('paragraph', line.replace(/^\s*\||\|\s*$/g, '').split('|').join(' '));
      continue;
    }

    para.push(line);
  }
  flush();
  return blocks;
}

/** Heuristic: does pasted text look like Markdown? */
export function looksLikeMarkdown(text: string): boolean {
  let score = 0;
  if (/^\s{0,3}#{1,6}\s+\S/m.test(text)) score += 2;
  if (/^\s{0,3}(```|~~~)/m.test(text)) score += 2;
  if (/\[[^\]]+\]\([^)\s]+\)/.test(text)) score += 2;
  if (/^\s*[-*+]\s+\S/m.test(text)) score += 1;
  if (/(\*\*|__)\S.*?\S\1/.test(text)) score += 1;
  if (/^\s*>\s/m.test(text)) score += 1;
  return score >= 2;
}
