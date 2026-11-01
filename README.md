# OAAT — One At A Time

A static web app for reading text one word at a time (RSVP). Paste text or drop in a `.txt` / `.md` file and the words play back at your chosen speed. The timing adapts to each word: common words flash by quickly, while rare, long or tricky ones stay on screen longer. Punctuation adds natural pauses.

It has no backend, no accounts and makes no network calls at runtime. After the first visit it also works offline, through a small service worker.

## Usage

1. Paste text into the box, or drop a `.txt` / `.md` / `.markdown` file anywhere on the page (5 MB max). You can also use **Choose file** or **Paste from clipboard**.
2. Press **Read** (or Ctrl/Cmd + Enter), then **Space** to start.
3. Pause at any time to see the surrounding sentences. Click any word there to jump to it.

Your settings, your last text (if it's under 1 MB) and your position are kept in `localStorage`, so a reload picks up where you left off.

| Key | Action |
| --- | --- |
| Space | Play / pause |
| ← / → | Back / forward one word |
| Shift + ← / → | Back / forward one sentence |
| ↑ / ↓ | Speed ±25 WPM |
| R | Restart |
| Esc | Back to the text (or close settings) |

The settings drawer (gear icon) holds the theme (system / light / dark), the word size, and **Show difficulty colour**, which tints each word from green (easy) to red (hard).

## Speed test ("Find my speed")

A 5-minute test finds the fastest speed at which you still understand what you read. You can start it from the text screen or from the settings drawer.

1. **Choose a level.** The reader picks the plain-English description that best matches their reading, or "Not sure", which starts at B1. The levels follow the CEFR (Common European Framework of Reference for Languages): A2 elementary, B1 intermediate, B2 upper intermediate and C1 advanced.
2. **Normal reading.** The first text is read in the usual way and timed, then followed by 3 questions. This measures normal reading speed. If 2 or more questions are wrong, the rest of the test uses texts one level easier.
3. **Five RSVP rounds.** Each round plays a text one word at a time and then asks 3 questions. The test uses a staircase: 3/3 correct speeds up by 50 WPM, 2/3 keeps the same speed, and 0–1 slows down by 50 WPM. The first round starts at the normal reading speed, between 150 and 600 WPM.
4. **Result.** The recommendation is the fastest speed the reader passed (2 or more of 3 correct) that is still slower than every speed they failed at. They can apply it with one click.

There are 24 passages, 6 per level, each with 3 multiple-choice questions. All of them were written for this project and live in `src/calibration/passages.ts`. They follow the CEFR reading descriptors for each level: everyday topics and short sentences at A2, up to nuanced argument and questions about implication and the writer's attitude at C1. Every question can be answered from the text alone. `tests/passages.test.ts` checks that the passages get harder from level to level, measured with OAAT's own wordlist:

| Level | Rare words (bucket 5+) | Words per sentence |
| --- | --- | --- |
| A2 | 5.7% | 9.5 |
| B1 | 7.6% | 13.8 |
| B2 | 11.0% | 19.0 |
| C1 | 19.4% | 22.5 |

The design follows findings from reading research. Comprehension falls as speed rises, and there is no shortcut around that trade-off (Rayner et al., 2016, *Psychological Science in the Public Interest*). That's why the test measures understanding as well as speed. Typical silent reading speed is about 240–260 WPM (Brysbaert, 2019), and RSVP takes away the ability to glance back at earlier words (Schotter, Tran & Rayner, 2014). So the result is best treated as an upper limit for easy reading, not a target.

## How the timing works

```
duration = base × difficultyFactor × lengthFactor × kindFactor + pauseExtra
base     = 60000 / wpm
```

- **Difficulty**: each word is looked up in a frequency list and given a bucket from 0 (easiest) to 9 (hardest). The factor is `1 + sensitivity × (weight[bucket] − 1)`, with weights running from 0.75 to 1.6. Sensitivity runs from 0 to 200% (default 60%). Above 100% the spread is exaggerated: at 200%, the hardest bucket gets 2.2× the base time and the easiest 0.5×, compared with 1.6× and 0.75× at 100%. Because of the honest-WPM rescale, giving hard words more time takes it from easy words, so the average speed stays the same.
- **Length**: `+4%` per letter beyond 6, capped at `×1.4`. **Kind**: numbers `×1.3`, names `×1.15`, URLs/symbols `×1.5`.
- **Pauses** (multiples of `base`, added on top): comma/semicolon/colon/dash `+0.5`, sentence end `+1.2`, paragraph `+2.0`, heading `+2.5`.
- **Long words** (14+ characters) show as two frames. The split falls at a hyphen if there is one, otherwise mid-word with a trailing `-`.
- **Honest WPM**: after computing a document's durations, the word times are rescaled so that the average time per word (excluding pauses) is exactly `60000 / wpm`.
- **Ramp-up**: the first 5 words after play or resume run at 1.6×, 1.45×, 1.3×, 1.15× and 1.05× of their normal time.
- Every frame is clamped to between 60 ms and 3000 ms.

At sensitivity **0** (“Off”), every word gets exactly the same time. The length and kind factors fade in between 0% and the default 60%, so turning sensitivity down really does make the pace uniform. Above about 500 WPM, long words are no longer split, because two frames can't fit under the 60 ms floor.

Each word is shown with its *optimal recognition point*, a highlighted pivot letter. The pivot always sits at the same spot on screen, marked by tick marks above and below.

## Development

Requires Node 20.19+ (see `.nvmrc`).

```sh
npm install
npm run dev       # dev server
npm test          # unit tests (Vitest)
npm run build     # type-check + static build to dist/
npm run preview   # serve dist/
```

```
scripts/build-wordlist.mjs  generates src/data/difficulty.json
src/engine/                 tokenize, difficulty, timing, orp, player (pure, unit-tested)
src/input/                  markdown stripping, file reading / drag-drop
src/ui/                     input screen, reader, settings, storage
tests/                      Vitest unit tests
```

### Word difficulty data

`src/data/difficulty.json` is generated once and committed. To regenerate it:

```sh
npm run wordlist                              # downloads wordfreq's large_en list
npm run wordlist -- path/to/large_en.msgpack.gz   # or use a local copy
```

The script keeps the 60,000 most frequent alphabetic words (apostrophes allowed) and maps each one's Zipf frequency to a bucket using `clamp(round((6.25 − zipf) × 2.3), 0, 9)`. This mapping is tuned so that the 200 most common words land in buckets 0–1 and the whole 0–9 range gets used. To keep the file small (about 480 KB raw, 235 KB gzipped), the output is grouped by bucket (`{ "buckets": ["the of and …", …] }`) instead of storing one key per word.

At runtime, a word missing from the list is tried with simple stems (-s, -es, -ed, -ing, -ly, -'s), using the stem's bucket +1. A word that still isn't found gets bucket 7 (8 if it's 10 or more characters). The list loads as a separate chunk; until it arrives, a length-only estimate is used, so the app never blocks.

**Data source and licence.** Word frequencies come from [wordfreq](https://github.com/rspeer/wordfreq) by Robyn Speer, which is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). `src/data/difficulty.json` is derived from that data and is therefore also distributed under CC BY-SA 4.0. wordfreq includes data from Google Books Ngrams, Wikipedia, OpenSubtitles, SUBTLEX, Reddit, Twitter and other sources; see its README for full credits.

## Deploying

`npm run build` writes a fully static site to `dist/`. Asset paths are relative, so it works from any sub-path.

- **GitHub Pages**: `.github/workflows/deploy.yml` tests, builds and deploys on every push to `main`. In the repo, go to *Settings → Pages* and set *Source* to **GitHub Actions**.
- **Self-hosted**: copy `dist/` to any static file server (nginx, Caddy, S3, …). The service worker needs to be served over HTTPS or from `localhost`.
