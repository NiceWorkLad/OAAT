#!/usr/bin/env node
// Builds src/data/difficulty.json from the wordfreq English frequency data.
//
// Source: wordfreq (https://github.com/rspeer/wordfreq), large_en list.
// Data licence: CC BY-SA 4.0. See README for attribution.
//
// Output format (compact, ~half the size of a word->bucket object):
//   { "source": "...", "buckets": ["the of and ...", "...", ...] }
// buckets[i] is a space-separated list of the words in difficulty bucket i
// (0 = easiest, 9 = hardest).
//
// Usage:
//   node scripts/build-wordlist.mjs [path/to/large_en.msgpack.gz]
// With no path the file is downloaded from GitHub.

import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { decode } from '@msgpack/msgpack';

const SOURCE_URL =
  'https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/large_en.msgpack.gz';
const OUT = new URL('../src/data/difficulty.json', import.meta.url);
const MAX_WORDS = 60000;

async function loadRaw() {
  const path = process.argv[2];
  if (path) return readFile(path);
  console.log(`Downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// wordfreq "cBpack" format: [header, bucket0, bucket1, ...] where bucket i
// holds words whose frequency is 10^(-i/100). Zipf = log10(freq) + 9.
function* entries(packed) {
  const [header, ...buckets] = packed;
  if (header?.format !== 'cB') throw new Error('Unexpected wordfreq format');
  for (let i = 0; i < buckets.length; i++) {
    const zipf = 9 - i / 100;
    for (const word of buckets[i]) yield [word, zipf];
  }
}

const WORD_RE = /^[a-z]+(?:'[a-z]+)*$/;

// Tuned against wordfreq large_en: rank 200 sits at zipf ~5.66 (-> bucket 1)
// and rank 60,000 at ~2.38 (-> bucket 9), so the full 0–9 range is used.
export function zipfToBucket(zipf) {
  const b = Math.round((6.25 - zipf) * 2.3);
  return Math.max(0, Math.min(9, b));
}

const packed = decode(gunzipSync(await loadRaw()));
const out = {};
let count = 0;
const ranks = [];
for (const [raw, zipf] of entries(packed)) {
  const word = raw.toLowerCase().replace(/[‘’]/g, "'");
  if (!WORD_RE.test(word) || word in out) continue;
  out[word] = zipfToBucket(zipf);
  ranks.push(out[word]);
  if (++count >= MAX_WORDS) break;
}

const buckets = Array.from({ length: 10 }, () => []);
for (const [word, b] of Object.entries(out)) buckets[b].push(word);
const json = JSON.stringify({
  source: 'wordfreq large_en (CC BY-SA 4.0)',
  buckets: buckets.map((ws) => ws.join(' ')),
});
await writeFile(OUT, json);

const hist = Array(10).fill(0);
for (const b of ranks) hist[b]++;
const top200 = ranks.slice(0, 200);
console.log(`Wrote ${count} words, ${(json.length / 1024).toFixed(0)} KB`);
console.log('Bucket histogram:', hist.join(' '));
console.log('Top 200 max bucket:', Math.max(...top200));
