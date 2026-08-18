# The Carwash Test — project notes for Claude

Static site published at `https://carwashtest.org/` via GitHub Pages
(repo `CandC3D/carwash-test`, `main` branch). Plain HTML + one shared `scripts.js`
+ `styles.css`. No build step. All pages render client-side from `data/runs.json`.

## Ground truth
- **`data/runs.json` is the golden master.** When a briefing document disagrees with
  the live transcripts/data, the JSON wins. Verify claims (results, cross-language
  cells, counts) against it before writing them into the site.
- Each run: `id`, `date`, `vendor`, `model_family`, `model`, `thinking`, `result`
  (`pass` / `pass-adjacent` / `verbose` / `fail`), `response`, `notes`, optional
  `token_estimate`, `language`, `prompt`, `token_method`, `reasoning_trace`.
- `model_families` carries `display_name` (Vendor (Product) form) and optional
  `category` (`general` / `purpose-optimized`).

## Language corpora (separate, not merged)
- Runs without a `language` field are English. Other corpora use `language`
  (`zh-CN`, `fr`, `uk`). **English aggregates must stay English-only** via
  `CarwashTest.englishRuns(runs)` — this filters the index, results table + CSV,
  the transcripts-hub family grid, per-vendor pages, the vendor rail, and the
  English metrics charts. Other languages render in their own Metrics sections and
  in per-vendor transcript subsections (`renderVendorLanguageRuns`).
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
- Serve locally and check the rendered DOM + console (no errors). Note: GitHub Pages
  CDN means a hard refresh may still show stale assets for ~10 min; append `?x=1`
  to force-fetch.

## Conventions
- Charts are dependency-free inline SVG in `scripts.js`; reuse `RESULT_COLORS` /
  `RESULT_ORDER` and the existing chart classes. No external libraries, no shadows
  or animation; palette is the CSS custom properties in `:root`.
- Commit messages: conventional, with the Co-Authored-By trailer already in use.
- Working scratch files live in `_notes/` (Jekyll-ignored, not published).
