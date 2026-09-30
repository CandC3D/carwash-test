# The Carwash Test — project notes for Claude

Static site published at `https://carwashtest.org/` via GitHub Pages
(repo `CandC3D/carwash-test`, `main` branch). Plain HTML + one shared `scripts.js`
+ `styles.css`. No build step. All pages render client-side from `data/runs.json`.

## Ground truth
- **`data/runs.json` is the golden master.** When a briefing document disagrees with
  the live transcripts/data, the JSON wins. Verify claims (results, cross-language
  cells, counts) against it before writing them into the site.
- Each run: `id`, `date`, `vendor`, `model_family`, `model`, `thinking`, `result`
  (`pass` / `pass-adjacent` / `verbose` / `fail`, or `no-score` for a system that
  declines the question and never reaches a verb), `response`, `notes`, optional
  `token_estimate`, `language`, `prompt`, `token_method`, `reasoning_trace`.
- `model_families` carries `display_name` (Vendor (Product) form) and optional
  `category` (`general` / `purpose-optimized`).

## Language corpora (separate, not merged)
- Runs without a `language` field are English. Other corpora use `language`:
  `zh-CN` (Simplified Chinese), `fr`, `uk`, `id` (Indonesian), `tr` (Turkish),
  `th` (Thai), and `ja` (Japanese). **English aggregates must stay English-only** via
  `CarwashTest.englishRuns(runs)` — this filters the index, results table + CSV,
  the transcripts-hub family grid, per-vendor pages, the vendor rail, and the
  English metrics charts. Other languages render in their own Metrics sections, in
  per-vendor transcript subsections (`renderVendorLanguageRuns`), and on their own
  corpus pages (`transcripts/lang-*.html`), which the transcripts hub lists under
  Language Corpora.
- **Unscored runs (`result: "no-score"`) are outside every scored figure.**
  `englishRuns` and `runsByLanguage` drop them, so tallies, charts, rates, corpus
  counts and the winner's circle never see them; `unscoredRuns` returns them for
  listing on their own (the Purpose-Optimized page has an Unscored section, and hub
  cards show "N runs · unscored"). `thinking` for a system with no toggle is `n/a`.
- **Japanese is the exception.** It has only been run against Sakana AI, so it has
  no corpus page, no hub card and no Metrics section; its runs live on
  `transcripts/sakana.html`.
- **Adding a new language touches three places in `scripts.js`:** `LANG_SHORT` (the
  table marker), `LANG_LIST` (prompt, gloss and corpus note, shared by the vendor
  subsections and the corpus pages), and `LANG_CORPORA` (the hub card and corpus
  page). Then add a `transcripts/lang-XX.html` page, a methodology corpora-table
  row, a sitemap entry, and — if it gets a Metrics section — the section plus its
  lines in `metrics.html`'s bootstrap script. Bump the cache token.
- **REMINDER — the cross-language comparison table in `metrics.html` is static
  hand-written HTML; it does NOT read `runs.json`.** When you add, relabel, or
  re-score any multilingual run, update that table (and its English column, taken
  from the golden master) by hand. Everything else on the site is data-driven and
  updates itself.

## Asset cache versioning (don't skip)
- GitHub Pages serves through a CDN with a ~10-minute cache, so new HTML can hit a
  stale `scripts.js`/`styles.css`. Every page references them with a `?v=YYYYMMDDx`
  query string. **Whenever you edit `scripts.js` or `styles.css`, bump that token on
  every HTML page** (root + `transcripts/*.html`) so the matching asset is fetched.
  Current token lives inline in each `<link>`/`<script>` tag.

## Verifying changes
- `node -c scripts.js` after JS edits.
- Validate JSON: `python -c "import json,io; json.load(io.open('data/runs.json',encoding='utf-8'))"`.
- Where only Windows PowerShell 5.1 is available (no Node or Python), validate JSON
  with `ConvertFrom-Json`. Keep any `.ps1` generator script pure ASCII: 5.1 reads a
  BOM-less script as Windows-1252, so a non-ASCII literal is silently corrupted —
  an em dash becomes `â€”`. That once put mojibake into runs 638–647. Read prose
  from a UTF-8 data file instead, and after any generated write, check `runs.json`
  for U+00E2 followed by U+20AC.
- Serve locally and check the rendered DOM + console (no errors). Note: GitHub Pages
  CDN means a hard refresh may still show stale assets for ~10 min; append `?x=1`
  to force-fetch.

## Conventions
- Charts are dependency-free inline SVG in `scripts.js`; reuse `RESULT_COLORS` /
  `RESULT_ORDER` and the existing chart classes. No external libraries, no shadows
  or animation; palette is the CSS custom properties in `:root`.
- Commit messages: conventional, with the Co-Authored-By trailer already in use.
- Working scratch files live in `_notes/` (Jekyll-ignored, not published).
