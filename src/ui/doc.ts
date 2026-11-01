import { textToBlocks, tokenizeBlocks, type Token } from '../engine/tokenize';
import { stripMarkdown } from '../input/markdown';
import { hashText } from './storage';

export type Doc = {
  text: string;
  isMarkdown: boolean;
  name: string | null;
  /** Where the text came from (a Wikipedia article URL), for attribution. */
  source: string | null;
  tokens: Token[];
  hash: string;
};

export function makeDoc(
  text: string,
  isMarkdown: boolean,
  name: string | null = null,
  source: string | null = null,
): Doc {
  const blocks = isMarkdown ? stripMarkdown(text) : textToBlocks(text);
  return { text, isMarkdown, name, source, tokens: tokenizeBlocks(blocks), hash: hashText(text) };
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatReadingTime(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return 'under a minute';
  if (min < 60) return `about ${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  return `about ${h} h ${Math.round(min % 60)} min`;
}
