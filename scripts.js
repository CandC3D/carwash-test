(function (global) {
  "use strict";

  const RESULT_LABELS = {
    "pass": "Pass",
    "pass-adjacent": "Pass-adjacent",
    "verbose": "Verbose",
    "fail": "Fail"
  };
  // Compressed labels for the grade pills (CSS uppercases them). The full
  // labels above remain the vocabulary for ARIA text and the CSV export.
  const PILL_LABELS = {
    "pass": "Pass",
    "pass-adjacent": "Pass-adj",
    "verbose": "Verbose",
    "fail": "Fail"
  };

  // Fill + label colors per result, matching the tally cards / badges.
  const RESULT_COLORS = {
    "pass":          { fill: "var(--pass-fill)",    text: "var(--pass-ink)" },
    "pass-adjacent": { fill: "var(--padj-fill)",    text: "var(--padj-ink)" },
    "verbose":       { fill: "var(--verbose-fill)", text: "var(--verbose-ink)" },
    "fail":          { fill: "var(--fail-fill)",    text: "var(--fail-ink)" }
  };
  const RESULT_ORDER = ["pass", "pass-adjacent", "verbose", "fail"];

  // Short gloss for each category, shown beneath the label on the tally cards.
  const RESULT_DESCRIPTIONS = {
    "pass": "Correct and concise",
    "pass-adjacent": "Correct but padded",
    "verbose": "Correct but over-elaborated",
    "fail": "Wrong answer — said walk"
  };

  const THINKING_LABELS = {
    "on": "On",
    "off": "Off",
    "adaptive_on": "Adaptive On",
    "adaptive_off": "Adaptive Off",
    "n/a": "N/A",
    "balanced": "Balanced",
    "think": "Think",
    "research": "Research",
    "fast": "Fast",
    "auto": "Auto",
    "expert": "Expert",
    "contemplating": "Contemplating"
  };

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const LOGO_FILES = {
    "anthropic": "anthropic.svg",
    "openai": "openai.svg",
    "deepseek": "deepseek.svg",
    "google": "googlegemini.svg",
    "meta": "meta.svg",
    "microsoft": "microsoft.svg",
    "xai": "grok.svg",
    "mistral": "mistralai.svg",
    "perplexity": "perplexity.svg",
    "qwen": "qwen.svg",
    "kimi": "kimi.svg",
    "lumo": "lumo.svg",
    "gemma": "gemma.svg",
    "qwen_ow": "qwen.svg",
    "zai": "zai.svg",
    "sakana": "sakana.svg",
    "inkling": "thinkingmachines.svg",
    "bonsai": "bonsai.svg",
    "glimmer": "meta.svg",
    "gptoss": "openai.svg",
    "nemotron": "nvidia.svg"
  };

  async function loadData(basePath) {
    basePath = basePath || "";
    const res = await fetch(basePath + "data/runs.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load runs.json: " + res.status);
    return res.json();
  }

  function formatDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return MONTHS[m] + " " + d + ", " + y;
  }

  function formatThinking(value) {
    return THINKING_LABELS[value] || value;
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tally(runs) {
    const t = { "pass": 0, "pass-adjacent": 0, "verbose": 0, "fail": 0 };
    runs.forEach(function (r) {
      if (t.hasOwnProperty(r.result)) t[r.result]++;
    });
    return t;
  }

  function renderTallyRow(t) {
    return '<div class="tally-row">' + RESULT_ORDER.map(function (k) {
      return '<div class="tally-card tally-' + k + '">' +
        '<span class="count">' + t[k] + '</span>' +
        '<span class="label">' + RESULT_LABELS[k] + '</span>' +
        '<span class="desc">' + escapeHTML(RESULT_DESCRIPTIONS[k]) + '</span>' +
        '</div>';
    }).join("") + '</div>';
  }

  const RESULT_SORT_RANK = { "pass": 0, "pass-adjacent": 1, "verbose": 2, "fail": 3 };
  const THINKING_SORT_RANK = { "off": 0, "adaptive_off": 1, "n/a": 2, "fast": 3, "balanced": 4, "auto": 5, "contemplating": 6, "think": 7, "expert": 8, "adaptive_on": 9, "on": 10, "research": 11 };
  // Reasoning-effort tier ordering (low → max). "xhigh" is OpenAI's extra-high;
  // a run with no effort selector sorts as 0. Used for the Effort column.
  const EFFORT_SORT_RANK = { "none": 0.3, "minimum": 0.6, "instant": 0.6, "low": 1, "standard": 1.5, "medium": 2, "high": 3, "extra": 4, "xhigh": 4, "max": 5 };
  const EFFORT_LABELS = { "none": "None", "minimum": "Minimum", "instant": "Instant", "low": "Low", "standard": "Standard", "medium": "Medium", "high": "High", "extra": "Extra", "xhigh": "X-high", "max": "Max" };
  function formatEffort(value) {
    if (!value) return "";
    return EFFORT_LABELS[value] || (String(value).charAt(0).toUpperCase() + String(value).slice(1));
  }

  function tokenEstimate(response) {
    if (!response) return 0;
    return Math.round(String(response).length / 4);
  }

  function runTokens(run) {
    // Prefer the real output-token count when we have it (API-console runs
    // report it directly, and it includes hidden reasoning tokens).
    if (typeof run.output_tokens === "number" && run.output_tokens >= 0) {
      return run.output_tokens;
    }
    // Otherwise use the explicit token_estimate field if present (for runs
    // whose verbatim record is incomplete — e.g. accompanied by a PDF
    // attachment whose content is not in the response field).
    if (typeof run.token_estimate === "number" && run.token_estimate >= 0) {
      return run.token_estimate;
    }
    return tokenEstimate(run.response);
  }

  // Real output-token counts (reported by an API console) are exact and are
  // shown without the "~" approximation marker; character-based estimates keep it.
  function tokensMeasured(run) {
    return typeof run.output_tokens === "number" && run.output_tokens >= 0;
  }
  function tokenDisplay(run) {
    const t = runTokens(run);
    if (!(t > 0)) return "—";
    return (tokensMeasured(run) ? "" : "~") + t.toLocaleString();
  }

  // Compact language marker for tables that mix corpora (the open-weight
  // table on the overview). English tables omit the column entirely.
  const LANG_SHORT = { "en": "EN", "zh-CN": "ZH", "fr": "FR", "uk": "UK", "ja": "JA" };
  function langShort(r) {
    const c = r.language || "en";
    return LANG_SHORT[c] || c.toUpperCase();
  }

  function buildRow(r, link, showLang) {
    const idCell = link ? '<a href="' + link + '">#' + r.id + '</a>' : '#' + r.id;
    const modelCell = link ? '<a href="' + link + '">' + escapeHTML(r.model) + '</a>' : escapeHTML(r.model);
    const tokens = runTokens(r);
    return '<tr>' +
      '<td class="col-id" data-sort="' + r.id + '">' + idCell + '</td>' +
      '<td data-sort="' + escapeHTML(r.vendor.toLowerCase()) + '">' + escapeHTML(r.vendor) + '</td>' +
      '<td data-sort="' + escapeHTML(r.model.toLowerCase()) + '">' + modelCell + '</td>' +
      '<td class="col-thinking" data-sort="' + (THINKING_SORT_RANK[r.thinking] !== undefined ? THINKING_SORT_RANK[r.thinking] : 99) + '">' + escapeHTML(formatThinking(r.thinking)) + '</td>' +
      '<td class="col-effort" data-sort="' + (EFFORT_SORT_RANK[r.effort] || 0) + '">' + escapeHTML(formatEffort(r.effort) || "—") + '</td>' +
      (showLang ? '<td class="col-lang" data-sort="' + escapeHTML(r.language || "en") + '">' + escapeHTML(langShort(r)) + '</td>' : '') +
      '<td class="col-date" data-sort="' + escapeHTML(r.date) + '">' + escapeHTML(formatDate(r.date)) + '</td>' +
      '<td data-sort="' + RESULT_SORT_RANK[r.result] + '"><span class="badge ' + r.result + '">' + PILL_LABELS[r.result] + '</span></td>' +
      '<td class="col-tokens" data-sort="' + tokens + '">' + tokenDisplay(r) + '</td>' +
      '</tr>';
  }

  function buildHeader(showLang) {
    return '<thead><tr>' +
      '<th scope="col" class="col-id sortable" data-sort-type="number" data-default-dir="asc">#</th>' +
      '<th scope="col" class="sortable" data-sort-type="string" data-default-dir="asc">Company</th>' +
      '<th scope="col" class="sortable" data-sort-type="string" data-default-dir="asc">Model</th>' +
      '<th scope="col" class="col-thinking sortable" data-sort-type="number" data-default-dir="asc">Thinking</th>' +
      '<th scope="col" class="col-effort sortable" data-sort-type="number" data-default-dir="asc" title="Reasoning-effort tier, where the model exposes one">Effort</th>' +
      (showLang ? '<th scope="col" class="col-lang sortable" data-sort-type="string" data-default-dir="asc" title="Prompt language of the run">Lang</th>' : '') +
      '<th scope="col" class="col-date sortable" data-sort-type="string" data-default-dir="desc">Date</th>' +
      '<th scope="col" class="sortable" data-sort-type="number" data-default-dir="asc">Result</th>' +
      '<th scope="col" class="col-tokens sortable" data-sort-type="number" data-default-dir="desc" title="Approximate token count, computed as round(characters / 4)">Tokens (est)</th>' +
      '</tr></thead>';
  }

  // Build a <caption> from a set of runs: date range + run count.
  function buildCaption(runs) {
    if (!runs || !runs.length) return '';
    const dates = runs.map(function (r) { return r.date; }).filter(Boolean).sort();
    const lo = dates[0], hi = dates[dates.length - 1];
    const range = lo === hi ? formatDate(lo) : formatDate(lo) + " – " + formatDate(hi);
    const n = runs.length;
    return '<caption>Carwash Test results, ' + escapeHTML(range) + ', ' +
      n + ' run' + (n === 1 ? '' : 's') + '</caption>';
  }

  // Map a family slug to the transcript page that hosts it. Purpose-optimized
  // families share a single combined page rather than one page per slug.
  function familyPageHref(slug, families, basePath) {
    basePath = basePath || "";
    const f = families && families[slug];
    if (f && f.category === "purpose-optimized") {
      return basePath + "transcripts/purpose-optimized.html#run-";
    }
    return basePath + "transcripts/" + slug + ".html#run-";
  }

  function renderResultsTable(runs, families, opts) {
    const showLang = !!(opts && opts.showLanguage);
    const rows = runs.map(function (r) {
      const link = (families && families[r.model_family])
        ? familyPageHref(r.model_family, families, "") + r.id
        : null;
      return buildRow(r, link, showLang);
    }).join("");
    return '<div class="table-scroll"><table class="results-table">' + buildCaption(runs) + buildHeader(showLang) + '<tbody>' + rows + '</tbody></table></div>';
  }

  function renderResultsTableForFamily(runs) {
    const rows = runs.map(function (r) {
      return buildRow(r, "#run-" + r.id);
    }).join("");
    return '<div class="table-scroll"><table class="results-table">' + buildCaption(runs) + buildHeader() + '<tbody>' + rows + '</tbody></table></div>';
  }

  function makeSortable(table) {
    if (!table) return;
    const headers = table.querySelectorAll("th.sortable");
    headers.forEach(function (th, colIndex) {
      th.addEventListener("click", function () {
        const tbody = table.tBodies[0];
        const rows = Array.prototype.slice.call(tbody.rows);
        const type = th.getAttribute("data-sort-type");
        const currentDir = th.getAttribute("data-dir");
        const defaultDir = th.getAttribute("data-default-dir") || "asc";
        const dir = currentDir
          ? (currentDir === "asc" ? "desc" : "asc")
          : defaultDir;

        rows.sort(function (a, b) {
          const av = a.cells[colIndex].getAttribute("data-sort");
          const bv = b.cells[colIndex].getAttribute("data-sort");
          let cmp;
          if (type === "number") {
            cmp = parseFloat(av) - parseFloat(bv);
          } else {
            cmp = av < bv ? -1 : av > bv ? 1 : 0;
          }
          return dir === "asc" ? cmp : -cmp;
        });

        rows.forEach(function (row) { tbody.appendChild(row); });

        headers.forEach(function (other) {
          other.removeAttribute("data-dir");
          other.classList.remove("sort-asc", "sort-desc");
        });
        th.setAttribute("data-dir", dir);
        th.classList.add(dir === "asc" ? "sort-asc" : "sort-desc");
      });
    });
  }

  function renderLegend() {
    const order = ["pass", "pass-adjacent", "verbose", "fail"];
    return '<div class="legend">' + order.map(function (k) {
      return '<div class="legend-item">' +
        '<span class="badge ' + k + '">' + RESULT_LABELS[k] + '</span>' +
        '</div>';
    }).join("") + '</div>';
  }

  // SVG icon for the Purpose-Optimized category: a small network graph
  // (three connected nodes in a circle) signalling a system organized around
  // internal connections rather than general-purpose reasoning.
  const PURPOSE_OPTIMIZED_ICON =
    '<svg role="img" aria-label="Purpose-optimized models category icon" ' +
    'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="10"/>' +
    '<circle cx="8" cy="9" r="1.5" fill="currentColor"/>' +
    '<circle cx="16" cy="9" r="1.5" fill="currentColor"/>' +
    '<circle cx="12" cy="16" r="1.5" fill="currentColor"/>' +
    '<line x1="8" y1="9" x2="16" y2="9"/>' +
    '<line x1="8" y1="9" x2="12" y2="16"/>' +
    '<line x1="16" y1="9" x2="12" y2="16"/>' +
    '</svg>';

  // SVG icon for the Open-Weight deployment class: an open padlock, signalling
  // a model published as a raw artifact (downloadable weights) rather than
  // gated behind a commercial product surface.
  const OPEN_WEIGHT_ICON =
    '<svg role="img" aria-label="Open-weight models icon" ' +
    'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="4" y="11" width="14" height="9" rx="2"/>' +
    '<path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>' +
    '<circle cx="11" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>' +
    '</svg>';

  function familyCategory(f) {
    return (f && f.category) || "general";
  }

  function _slugsByCategory(families, category) {
    return Object.keys(families)
      .filter(function (slug) { return familyCategory(families[slug]) === category; })
      .sort(function (a, b) {
        const an = (families[a].display_name || a).toLowerCase();
        const bn = (families[b].display_name || b).toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      });
  }

  function _familyCard(slug, families, counts, basePath) {
    const f = families[slug];
    const c = counts[slug] || 0;
    const href = familyCategory(f) === "purpose-optimized"
      ? basePath + "transcripts/purpose-optimized.html"
      : basePath + "transcripts/" + slug + ".html";
    const logo = LOGO_FILES[slug]
      ? '<span class="family-logo" style="--logo-url: url(assets/logos/' + LOGO_FILES[slug] + ')"></span>'
      : '';
    return '<a class="family-card" href="' + href + '">' +
      logo +
      '<span class="family-name">' + escapeHTML(f.display_name) + '</span>' +
      '<span class="family-count">' + c + ' run' + (c === 1 ? '' : 's') + '</span>' +
      '</a>';
  }

  function renderFamilyGrid(runs, families, basePath) {
    basePath = basePath || "";
    // `runs` is the full dataset; count the commercial English corpus for the
    // general/purpose-optimized cards and the full open-weight set separately.
    const counts = {};
    englishRuns(runs).forEach(function (r) {
      counts[r.model_family] = (counts[r.model_family] || 0) + 1;
    });
    const owCounts = {};
    openWeightRuns(runs).forEach(function (r) {
      owCounts[r.model_family] = (owCounts[r.model_family] || 0) + 1;
    });
    const generalSlugs = _slugsByCategory(families, "general");
    const poSlugs = _slugsByCategory(families, "purpose-optimized");
    const owSlugs = _slugsByCategory(families, "open-weight");

    let html = '<div class="family-grid">' + generalSlugs.map(function (slug) {
      return _familyCard(slug, families, counts, basePath);
    }).join("") + '</div>';

    if (owSlugs.length) {
      html += '<div class="family-group-divider" role="separator"></div>' +
        '<div class="family-group-heading">' +
          '<span class="family-group-icon">' + OPEN_WEIGHT_ICON + '</span>' +
          '<h3>Open-Weight Models</h3>' +
          '<p>Models published as downloadable weights and tested in a developer ' +
          'playground — raw artifacts with no consumer product layer. Findings here ' +
          'do not predict the vendor’s commercial product, or vice versa.</p>' +
        '</div>' +
        '<div class="family-grid family-grid-open-weight">' + owSlugs.map(function (slug) {
          return _familyCard(slug, families, owCounts, basePath);
        }).join("") + '</div>';
    }

    if (poSlugs.length) {
      html += '<div class="family-group-divider" role="separator"></div>' +
        '<div class="family-group-heading">' +
          '<span class="family-group-icon">' + PURPOSE_OPTIMIZED_ICON + '</span>' +
          '<h3>Purpose-Optimized Models</h3>' +
          '<p>Domain-specific systems where catalog optimization shapes the answer ' +
          'as much as the underlying model’s reasoning. ' +
          '<a href="' + basePath + 'transcripts/purpose-optimized.html">About this category →</a></p>' +
        '</div>' +
        '<div class="family-grid family-grid-purpose-optimized">' + poSlugs.map(function (slug) {
          return _familyCard(slug, families, counts, basePath);
        }).join("") + '</div>';
    }
    return html;
  }

  // ── Per-vendor transcript navigation ─────────────────────────────────
  // renderVendorRail: a sticky pill-rail at the top of every per-vendor
  // transcript page. Shows all families alphabetized, with the current
  // one highlighted; each pill is a direct-jump link. Includes a
  // "← All Transcripts" back link above the pills.
  //
  // renderVendorPagination: a bottom prev/next pair that wraps around the
  // alphabetical sequence (so the last vendor's "next" is the first).

  function _alphaSortedSlugs(families) {
    return Object.keys(families).sort(function (a, b) {
      const an = (families[a].display_name || a).toLowerCase();
      const bn = (families[b].display_name || b).toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
  }

  function renderVendorRail(currentSlug, families, runs, basePath, opts) {
    basePath = basePath || "";
    const pos = (opts && opts.position === "bottom") ? " vendor-rail-bottom" : "";
    // `runs` is the full dataset; commercial pills count the English corpus,
    // open-weight pills count the full open-weight set.
    const counts = {};
    englishRuns(runs).forEach(function (r) {
      counts[r.model_family] = (counts[r.model_family] || 0) + 1;
    });
    const owCounts = {};
    openWeightRuns(runs).forEach(function (r) {
      owCounts[r.model_family] = (owCounts[r.model_family] || 0) + 1;
    });
    const slugs = _slugsByCategory(families, "general");
    const pills = slugs.map(function (slug) {
      const f = families[slug];
      const c = counts[slug] || 0;
      const isActive = slug === currentSlug;
      const href = isActive ? "#" : slug + ".html";
      const logo = LOGO_FILES[slug]
        ? '<span class="pill-logo" style="--logo-url: url(' + basePath + 'assets/logos/' + LOGO_FILES[slug] + ')"></span>'
        : '';
      return '<a class="vendor-pill' + (isActive ? ' active' : '') + '" href="' + href + '"' +
        (isActive ? ' aria-current="page"' : '') + '>' +
        logo +
        '<span class="pill-name">' + escapeHTML(f.name || f.display_name) + '</span>' +
        '<span class="pill-count">' + c + '</span>' +
        '</a>';
    }).join("");

    // Purpose-optimized families share one combined page; surface it as a
    // single distinguished pill at the end of the rail.
    const poSlugs = _slugsByCategory(families, "purpose-optimized");
    let poPill = "";
    if (poSlugs.length) {
      const poCount = poSlugs.reduce(function (sum, s) { return sum + (counts[s] || 0); }, 0);
      const isActive = currentSlug === "purpose-optimized";
      const href = isActive ? "#" : "purpose-optimized.html";
      poPill = '<span class="vendor-rail-sep" aria-hidden="true"></span>' +
        '<a class="vendor-pill vendor-pill-purpose-optimized' + (isActive ? ' active' : '') + '" href="' + href + '"' +
        (isActive ? ' aria-current="page"' : '') + '>' +
        '<span class="pill-icon">' + PURPOSE_OPTIMIZED_ICON + '</span>' +
        '<span class="pill-name">Purpose-Optimized</span>' +
        '<span class="pill-count">' + poCount + '</span>' +
        '</a>';
    }

    // Open-weight families: each links to its own per-vendor page, in a
    // distinguished pill style with the open-padlock icon.
    const owSlugs = _slugsByCategory(families, "open-weight");
    let owPills = "";
    if (owSlugs.length) {
      owPills = '<span class="vendor-rail-sep" aria-hidden="true"></span>' +
        owSlugs.map(function (slug) {
          const f = families[slug];
          const c = owCounts[slug] || 0;
          const isActive = slug === currentSlug;
          const href = isActive ? "#" : slug + ".html";
          const mark = LOGO_FILES[slug]
            ? '<span class="pill-logo" style="--logo-url: url(' + basePath + 'assets/logos/' + LOGO_FILES[slug] + ')"></span>'
            : '<span class="pill-icon">' + OPEN_WEIGHT_ICON + '</span>';
          return '<a class="vendor-pill vendor-pill-open-weight' + (isActive ? ' active' : '') + '" href="' + href + '"' +
            (isActive ? ' aria-current="page"' : '') + '>' +
            mark +
            '<span class="pill-name">' + escapeHTML(f.display_name) + '</span>' +
            '<span class="pill-count">' + c + '</span>' +
            '</a>';
        }).join("");
    }

    return '<div class="vendor-rail' + pos + '">' +
      '<div class="vendor-rail-inner">' +
        '<a class="vendor-rail-back" href="' + basePath + 'transcripts.html">← All Transcripts</a>' +
        '<div class="vendor-pills">' + pills + poPill + owPills + '</div>' +
      '</div>' +
      '</div>';
  }

  function renderVendorPagination(currentSlug, families) {
    const slugs = _slugsByCategory(families, "general");
    const idx = slugs.indexOf(currentSlug);
    if (idx === -1) return '';
    const n = slugs.length;
    const prevSlug = slugs[(idx - 1 + n) % n];
    const nextSlug = slugs[(idx + 1) % n];
    return '<nav class="vendor-pagination" aria-label="Adjacent vendors">' +
      '<a class="pag-prev" href="' + prevSlug + '.html">← ' +
        escapeHTML(families[prevSlug].display_name) + '</a>' +
      '<a class="pag-next" href="' + nextSlug + '.html">' +
        escapeHTML(families[nextSlug].display_name) + ' →</a>' +
      '</nav>';
  }

  function renderTranscriptEntry(run, basePath) {
    basePath = basePath || "";
    const notesBlock = run.notes && run.notes.trim()
      ? '<div class="transcript-notes">' + escapeHTML(run.notes) + '</div>'
      : '';
    let attachmentBlock = '';
    if (run.attachment && run.attachment.url) {
      const href = basePath + run.attachment.url;
      const label = run.attachment.label || "Download attachment";
      const desc = run.attachment.description ? '<span class="attachment-desc">' + escapeHTML(run.attachment.description) + '</span>' : '';
      attachmentBlock = '<div class="transcript-attachment">' +
        '<a href="' + escapeHTML(href) + '" target="_blank" rel="noopener">' +
          '<span class="attachment-label">' + escapeHTML(label) + '</span>' +
        '</a>' +
        desc +
        '</div>';
    }
    const tokens = runTokens(run);
    const tokenTitle = (typeof run.output_tokens === "number")
      ? "Output tokens reported by the API (includes hidden reasoning tokens)"
      : "Approximate token count, round(characters / 4)";
    const tokensSpan = tokens > 0
      ? '<span title="' + tokenTitle + '">' + tokenDisplay(run) + ' tokens</span>'
      : '';
    const SURFACE_LABELS = { api_console: "API console", consumer: "Consumer app", ai_studio_playground: "AI Studio", local: "Local (LM Studio)", tinker_playground: "Tinker Playground" };
    const surfaceSpan = run.surface
      ? '<span>' + escapeHTML(SURFACE_LABELS[run.surface] || run.surface) + '</span>'
      : '';
    const effortSpan = run.effort
      ? '<span>Effort: ' + escapeHTML(run.effort) + '</span>'
      : '';
    const verbositySpan = run.verbosity
      ? '<span>Verbosity: ' + escapeHTML(run.verbosity) + '</span>'
      : '';
    const registerSpan = run.register
      ? '<span title="Register / politeness level selected in the chat UI">Register: ' + escapeHTML(run.register) + '</span>'
      : '';
    const interfaceSpan = run.interface_language
      ? '<span title="UI interface language at test time, distinct from the prompt language">Interface: ' + escapeHTML(run.interface_language) + '</span>'
      : '';
    const traceLangSpan = run.reasoning_trace_language
      ? '<span title="Internal reasoning-trace language, distinct from the response language">Reasoned in: ' + escapeHTML(run.reasoning_trace_language) + '</span>'
      : '';
    const langAttr = run.language ? ' lang="' + escapeHTML(run.language) + '"' : '';
    const traceBlock = (run.reasoning_trace && run.reasoning_trace.trim())
      ? '<details class="reasoning-trace">' +
          '<summary>&#9656; Reasoning trace &middot; collapsed by default</summary>' +
          '<div' + langAttr + '>' + escapeHTML(run.reasoning_trace) + '</div>' +
        '</details>'
      : '';
    // Ledger layout: a fixed left rail (run number, date, configuration,
    // language) beside the entry body. The verbatim response is shown in
    // full as a quote plate — no click to read the record — while the
    // reasoning trace stays collapsed by default.
    const cfgBits = [];
    cfgBits.push('Thinking: ' + escapeHTML(formatThinking(run.thinking)));
    if (run.effort) cfgBits.push('Effort: ' + escapeHTML(run.effort));
    const railLang = runLang(run);
    const BCP47 = { "zh-CN": "zh-Hans" };
    const quoteLang = ' lang="' + (BCP47[railLang] || railLang) + '"';
    const metaBits = [
      '<span>' + escapeHTML(run.vendor) + '</span>',
      surfaceSpan, verbositySpan, registerSpan, interfaceSpan, traceLangSpan
    ].filter(Boolean).join('');
    return '<div class="transcript-entry" id="run-' + run.id + '">' +
      '<div class="run-rail">' +
        '<span class="run-rail-id transcript-id">#' + run.id + '</span>' +
        '<span class="run-rail-date">' + escapeHTML(formatDate(run.date)) + '</span>' +
        '<span class="run-rail-cfg">' + cfgBits.join('<br>') + '</span>' +
        '<span class="run-rail-lang" title="Prompt language of the run">' + escapeHTML(langShort(run)) + '</span>' +
      '</div>' +
      '<div class="run-main">' +
        '<div class="transcript-header">' +
          '<span class="transcript-model">' + escapeHTML(run.model) + '</span>' +
          '<span class="badge ' + run.result + '">' + PILL_LABELS[run.result] + '</span>' +
          tokensSpan +
        '</div>' +
        '<div class="transcript-meta">' + metaBits + '</div>' +
        traceBlock +
        '<blockquote class="run-quote"' + quoteLang + '>' + escapeHTML(run.response) + '</blockquote>' +
        notesBlock +
        attachmentBlock +
      '</div>' +
      '</div>';
  }

  // Per-vendor non-English subsections: for a family slug, render its
  // Chinese/French runs (prompt block + results table + transcripts).
  function renderVendorLanguageRuns(allRuns, slug, basePath) {
    basePath = basePath || "";
    const fam = allRuns.filter(function (r) { return r.model_family === slug && runLang(r) !== "en"; });
    if (!fam.length) return "";
    const LANGS = [
      { code: "ja", title: "Japanese-Language Runs (日本語)",
        prompt: "車が汚れています。洗車場は35メートル先にあります。歩いて行くべきですか、それとも車で行くべきですか？",
        aria: "Japanese Carwash Test prompt",
        translation: "My car is dirty. The car wash is 35 meters away. Should I walk there or drive?",
        note: "Namazu exposes a register selector (Standard / Polite / Osaka-Kansai) and a Japanese/English interface toggle; both move the verdict. The prompt shown is the Standard-register wording — the Polite and Kansai-ben runs reword it. Token estimates use an approximate Japanese rate (~0.5 tokens/character) and are not directly comparable to the English counts." },
      { code: "zh-CN", title: "Chinese-Language Runs (简体中文)",
        prompt: "我的车脏了。洗车店在35米外。我是该走路去，还是开车去？",
        aria: "Simplified Chinese Carwash Test prompt",
        translation: "My car is dirty. The car wash is 35 meters away. Should I walk there or drive?",
        note: "Token estimates use the Chinese character rate (1 character ≈ 0.6 tokens), so they are not directly comparable to the English counts." },
      { code: "fr", title: "French-Language Runs (Français)",
        prompt: "Ma voiture est sale. Le lave-auto se trouve à 35 mètres. Devrais-je y aller à pied ou en voiture ?",
        aria: "French Carwash Test prompt",
        translation: "My car is dirty. The car wash is 35 meters away. Should I walk there or drive?",
        note: "" },
      { code: "uk", title: "Ukrainian-Language Runs (Українська)",
        prompt: "У мене брудна машина. Автомийка знаходиться за 35 метрів від мене. Мені туди краще йти пішки чи поїхати на машині?",
        aria: "Ukrainian Carwash Test prompt",
        translation: "My car is dirty. The car wash is 35 meters away. Should I walk there or drive?",
        note: "Native-speaker-translated prompt. Token counts for API-console runs are real output-token totals (including hidden reasoning); consumer-app runs use the measured Cyrillic rate (~0.5 tokens/character). Both differ from the English character-based estimates." }
    ];
    let out = "";
    LANGS.forEach(function (L) {
      const rs = fam.filter(function (r) { return r.language === L.code; });
      if (!rs.length) return;
      out += '<section class="lang-runs-section">' +
        '<h2>' + escapeHTML(L.title) + '</h2>' +
        '<div class="corpus-prompt">' +
          '<blockquote lang="' + L.code + '" aria-label="' + escapeHTML(L.aria) + '">' + escapeHTML(L.prompt) + '</blockquote>' +
          '<p class="translation"><em>Translation: ' + escapeHTML(L.translation) + '</em></p>' +
          (L.note ? '<p class="methodology-note"><em>' + escapeHTML(L.note) + '</em></p>' : '') +
        '</div>' +
        renderResultsTableForFamily(rs) +
        rs.map(function (r) { return renderTranscriptEntry(r, basePath); }).join("") +
      '</section>';
    });
    return out;
  }

  function renderChangeLog(entries) {
    return '<div class="change-log">' + entries.map(function (e) {
      return '<div class="change-log-entry">' +
        '<div class="change-log-date">' + escapeHTML(formatDate(e.date)) + '</div>' +
        '<div class="change-log-summary">' + escapeHTML(e.summary) + '</div>' +
        '</div>';
    }).join("") + '</div>';
  }


  function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '<div class="load-error">' + escapeHTML(message) + '</div>';
  }

  // Render a family display name for the page H1: keep a trailing
  // parenthetical together (so a long title breaks cleanly before "(" onto
  // its own line rather than splitting the phrase), and keep hyphenated
  // compounds from breaking at the hyphen.
  function familyTitleHTML(name) {
    name = String(name == null ? "" : name);
    function nbHyphen(s) { return s.replace(/-/g, "‑"); }
    const i = name.indexOf("(");
    if (i > 0) {
      const head = name.slice(0, i).trim();
      const paren = name.slice(i);
      return escapeHTML(nbHyphen(head)) + " " +
        '<span class="title-paren">' + escapeHTML(paren) + '</span>';
    }
    return escapeHTML(nbHyphen(name));
  }

  function renderTitleLogo(slug) {
    const file = LOGO_FILES[slug];
    if (!file) return "";
    // Always relative to styles.css (root), not the calling page —
    // url() inside an inline-style custom property is resolved against
    // the stylesheet, not the document.
    const url = "assets/logos/" + file;
    return '<span class="title-logo" style="--logo-url: url(' + url + ')"></span>';
  }

  // ── Tally charts ─────────────────────────────────────────────────────
  // Two inline-SVG charts that read directly from a tally object: a bar
  // chart of absolute counts and a pie chart of percentage share. Slice
  // and bar colors match the tally cards; bars are labeled with absolute
  // values and pie slices with percentages (the legend supplies the
  // color key, so no category text is repeated on the charts).

  function renderBarChart(t) {
    const W = 320, H = 240, padTop = 26, padBottom = 24, padX = 18;
    const plotH = H - padTop - padBottom;
    const baseY = padTop + plotH;
    // 5px gap between the content and each axis line: bars sit 5px above the
    // baseline, and the topline sits 5px above a full-height (100%) bar.
    // Gap between content and the baseline, matched to the token chart's
    // (its centered rows leave the widest content-to-baseline spacing).
    const gap = 13;
    const usableH = plotH - gap;          // height of a 100%-extension bar
    const max = Math.max.apply(null, RESULT_ORDER.map(function (k) { return t[k]; })) || 1;
    const n = RESULT_ORDER.length;
    const slotW = (W - padX * 2) / n;
    const barW = slotW * 0.58;
    let body = '<line x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) +
      '" y2="' + baseY + '" class="chart-axis"/>';
    RESULT_ORDER.forEach(function (k, i) {
      const val = t[k] || 0;
      const bh = max > 0 ? (val / max) * usableH : 0;
      const x = padX + slotW * i + (slotW - barW) / 2;
      const y = (baseY - gap) - bh;
      const c = RESULT_COLORS[k];
      body += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' +
        barW.toFixed(1) + '" height="' + bh.toFixed(1) +
        '" style="fill:' + c.fill + '"><title>' + RESULT_LABELS[k] + ' — ' + val + ' runs</title></rect>';
      body += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 7).toFixed(1) +
        '" text-anchor="middle" class="chart-value" style="fill:' + c.text + '">' + val + '</text>';
      body += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (baseY + 15) +
        '" text-anchor="middle" class="chart-catlabel">' + PILL_LABELS[k].toUpperCase() + '</text>';
    });
    const aria = "Bar chart of run counts: " +
      RESULT_ORDER.map(function (k) { return RESULT_LABELS[k] + " " + (t[k] || 0); }).join(", ");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      escapeHTML(aria) + '" class="chart-svg">' + body + '</svg>';
  }

  function renderPieChart(t) {
    // Stroked-circle donut sharing the bar chart's 320x240 frame. Segments run
    // in the fixed grade order from 12 o'clock; the centre carries the n=
    // figure in mono; each segment carries a <title> with count and share.
    const W = 320, H = 240, padTop = 26, padBottom = 24, padX = 18;
    const plotH = H - padTop - padBottom;
    const baseY = padTop + plotH;
    const gap = 13;
    const ringTopY = padTop, ringBottomY = baseY - gap;
    const stroke = 30;
    const r = (ringBottomY - ringTopY) / 2 - stroke / 2;
    const cx = W / 2, cy = ringTopY + (ringBottomY - ringTopY) / 2;
    const total = RESULT_ORDER.reduce(function (s, k) { return s + (t[k] || 0); }, 0) || 1;
    let angle = -Math.PI / 2; // 12 o'clock
    let body = "";
    RESULT_ORDER.forEach(function (k) {
      const val = t[k] || 0;
      if (val <= 0) return;
      const frac = val / total;
      const c = RESULT_COLORS[k];
      const pct = Math.round(frac * 100);
      const title = '<title>' + RESULT_LABELS[k] + ' — ' + val + ' runs (' + pct + '%)</title>';
      if (frac >= 0.9999) {
        body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r +
          '" fill="none" style="stroke:' + c.fill + ';stroke-width:' + stroke + '">' + title + '</circle>';
        return;
      }
      // Shave a hair off each end so segments read as discrete units.
      const seam = 0.012;
      const a1 = angle + seam, a2 = angle + frac * 2 * Math.PI - seam;
      const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
      const large = (a2 - a1) > Math.PI ? 1 : 0;
      body += '<path d="M ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
        ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2) +
        '" fill="none" style="stroke:' + c.fill + ';stroke-width:' + stroke + '">' + title + '</path>';
      // Percent label at the segment midpoint, on the ring, for readable shares.
      if (frac >= 0.07) {
        const mid = angle + frac * Math.PI;
        const lx = cx + r * Math.cos(mid), ly = cy + r * Math.sin(mid);
        body += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) +
          '" text-anchor="middle" dominant-baseline="central" class="chart-donut-pct">' + pct + '%</text>';
      }
      angle += frac * 2 * Math.PI;
    });
    body += '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" class="chart-donut-n">n=</text>' +
      '<text x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle" class="chart-donut-total">' + total + '</text>';
    body += '<line x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) +
      '" y2="' + baseY + '" class="chart-axis"/>';
    const aria = "Donut chart of result share: " +
      RESULT_ORDER.map(function (k) {
        return RESULT_LABELS[k] + " " + Math.round((t[k] || 0) / total * 100) + "%";
      }).join(", ");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      escapeHTML(aria) + '" class="chart-svg chart-svg-pie">' + body + '</svg>';
  }

  // Tokens at/above this are treated as outliers: excluded from the median
  // token chart and surfaced in a callout instead (the ~2,400-token Mistral
  // 3 Research response).
  const TOKEN_OUTLIER_MIN = 1500;

  function _median(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort(function (a, b) { return a - b; });
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Horizontal bar chart of median token cost per result type. Bars grow
  // left→right across the full width of the paired charts above; shares
  // their bottom-baseline + 5px gap treatment. Outliers (see
  // TOKEN_OUTLIER_MIN) are excluded from the medians and named in a callout.
  function renderMedianTokenChart(runs, includeOutliers) {
    const byCat = { "pass": [], "pass-adjacent": [], "verbose": [], "fail": [] };
    let outlier = null;
    runs.forEach(function (r) {
      const tk = runTokens(r);
      if (!includeOutliers && tk >= TOKEN_OUTLIER_MIN) {
        if (!outlier || tk > outlier.tk) outlier = { tk: tk, model: r.model };
        return;
      }
      if (byCat[r.result]) byCat[r.result].push(tk);
    });
    const medians = {};
    RESULT_ORDER.forEach(function (k) { medians[k] = _median(byCat[k]); });
    const max = Math.max.apply(null, RESULT_ORDER.map(function (k) {
      return medians[k] || 0;
    })) || 1;

    const W = 680, H = 210, padX = 18, padTop = 14, padBottom = 24;
    const baseY = H - padBottom;
    const baseGap = 5;                 // match the paired charts' bottom gap
    const areaTop = padTop, areaBottom = baseY - baseGap;
    const labelSpace = 48;             // room for the value at the bar's end
    const usableW = (W - padX * 2) - labelSpace;
    const n = RESULT_ORDER.length;
    const rowH = (areaBottom - areaTop) / n;
    const barTh = Math.min(28, rowH * 0.62);

    let body = "";
    RESULT_ORDER.forEach(function (k, i) {
      const med = medians[k];
      const c = RESULT_COLORS[k];
      const rowTop = areaTop + rowH * i;
      const by = rowTop + (rowH - barTh) / 2;
      const len = (med == null) ? 0 : (med / max) * usableW;
      if (len > 0) {
        body += '<rect x="' + padX + '" y="' + by.toFixed(1) + '" width="' +
          len.toFixed(1) + '" height="' + barTh.toFixed(1) +
          '" rx="3" style="fill:' + c.fill + ';stroke:' + c.text + ';stroke-width:1"/>';
      }
      const labelX = padX + len + 6;
      const labelY = by + barTh / 2;
      const txt = (med == null) ? "—" : "~" + Math.round(med).toLocaleString();
      body += '<text x="' + labelX.toFixed(1) + '" y="' + labelY.toFixed(1) +
        '" dominant-baseline="central" class="chart-value" style="fill:' + c.text + '">' +
        txt + '</text>';
    });
    body += '<line x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) +
      '" y2="' + baseY + '" class="chart-axis"/>';

    // Cost ratio: a wrong answer vs. the right answer (Fail vs. Pass median).
    // Stated in the caption below the chart (ratioNote) rather than drawn
    // inside it — an in-chart label collides with the value of whichever bar
    // is longest, which is not always Pass.
    const passM = medians["pass"], failM = medians["fail"];
    const ratio = (passM && failM && passM > 0) ? (failM / passM) : null;

    const aria = "Median tokens by result: " + RESULT_ORDER.map(function (k) {
      return RESULT_LABELS[k] + " " +
        (medians[k] == null ? "no data" : Math.round(medians[k]) + " tokens");
    }).join(", ");
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      escapeHTML(aria) + '" class="chart-svg">' + body + '</svg>';
    const ratioNote = (ratio != null)
      ? '<p class="chart-ratio-callout">A wrong answer costs <strong>' + ratio.toFixed(1) +
          '×</strong> the tokens of the right answer<span class="chart-ratio-sub"> — Fail median vs. Pass median.</span></p>'
      : '';
    const callout = outlier
      ? '<p class="chart-callout">Excludes one outlier set aside as a special case: ' +
          escapeHTML(outlier.model) + ', ≈' + outlier.tk.toLocaleString() + ' tokens.</p>'
      : '';
    const qualifier = '<p class="chart-note">Token counts are estimates based on ' +
      'observed costs in major frontier models.</p>';
    return '<figure class="chart-card chart-card-wide">' +
      '<figcaption>Median tokens by result</figcaption>' + svg +
      ratioNote + callout + qualifier +
    '</figure>';
  }

  // Stat strip (Metrics masthead): headline figures over a 2px ink rule.
  function renderStatStrip(runs, families) {
    const langs = new Set(runs.map(function (r) { return r.language || "en"; }));
    const fams = new Set(runs.map(function (r) { return r.model_family; }));
    const dates = new Set(runs.map(function (r) { return r.date; }));
    const eng = runs.filter(function (r) { return !r.language || r.language === "en"; });
    const engCommercial = eng.filter(function (r) { return r.deployment_class !== "open_weight"; });
    const fails = engCommercial.filter(function (r) { return r.result === "fail"; }).length;
    const failPct = engCommercial.length ? Math.round(100 * fails / engCommercial.length) : 0;
    const cells = [
      { v: engCommercial.length, l: "English runs" },
      { v: fams.size, l: "Model families" },
      { v: langs.size, l: "Languages" },
      { v: failPct + "%", l: "English fail rate" },
      { v: dates.size, l: "Test dates" }
    ];
    return '<div class="stat-strip">' + cells.map(function (c) {
      return '<div class="stat-cell"><span class="stat-value">' + c.v +
        '</span><span class="stat-label">' + c.l + '</span></div>';
    }).join('') + '</div>';
  }

  function renderCharts(runs, opts) {
    opts = opts || {};
    const t = tally(runs);
    return '<div class="charts-row">' +
      '<figure class="chart-card">' +
        '<figcaption>Runs by category</figcaption>' + renderBarChart(t) +
      '</figure>' +
      '<figure class="chart-card">' +
        '<figcaption>Share of total</figcaption>' + renderPieChart(t) +
      '</figure>' +
    '</div>' +
    renderMedianTokenChart(runs, !!opts.includeTokenOutliers);
  }

  // Build a CSV of the results table — the displayed columns only, no
  // transcript text — sorted by run id, with a source attribution line
  // (site URL) at the top of the file.
  function buildResultsCSV(runs) {
    const SITE = "https://candc3d.github.io/carwash-test/";
    function cell(v) {
      return '"' + (v == null ? "" : String(v)).replace(/"/g, '""') + '"';
    }
    const lines = [];
    lines.push(cell("The Carwash Test") + "," + cell(SITE));
    lines.push("");
    lines.push(["#", "Company", "Model", "Thinking", "Effort", "Date", "Result", "Tokens (est)"]
      .map(cell).join(","));
    runs.slice().sort(function (a, b) { return a.id - b.id; }).forEach(function (r) {
      lines.push([
        r.id,
        r.vendor,
        r.model,
        formatThinking(r.thinking),
        formatEffort(r.effort),
        r.date,
        RESULT_LABELS[r.result] || r.result,
        runTokens(r)
      ].map(cell).join(","));
    });
    return lines.join("\r\n") + "\r\n";
  }

  // Compact dashboard (bar + pie only) for the overview/results pages, with
  // a link through to the full metrics page.
  function renderChartsMini(runs, metricsHref) {
    const t = tally(runs);
    return '<div class="charts-row">' +
      '<figure class="chart-card"><figcaption>Runs by category</figcaption>' + renderBarChart(t) + '</figure>' +
      '<figure class="chart-card"><figcaption>Share of total</figcaption>' + renderPieChart(t) + '</figure>' +
    '</div>' +
    '<p class="chart-more"><a href="' + (metricsHref || 'metrics.html') + '">Full metrics &amp; trends →</a></p>';
  }

  // ── Metrics-page charts ──────────────────────────────────────────────
  function _sortedDates(runs) {
    return Array.from(new Set(runs.map(function (r) { return r.date; }))).sort();
  }
  function _shortDate(iso) {
    const p = iso.split("-");
    return MONTHS[parseInt(p[1], 10) - 1] + " " + parseInt(p[2], 10);
  }
  function _metricTok(r) { return runTokens(r); }
  // Cumulative medians (Pass/Fail token cost) at each snapshot date, outlier-excluded.
  function _cumMedians(runs) {
    return _sortedDates(runs).map(function (d) {
      const upto = runs.filter(function (r) { return r.date <= d; });
      function med(res) {
        const v = upto.filter(function (r) {
          return r.result === res && _metricTok(r) < TOKEN_OUTLIER_MIN;
        }).map(_metricTok);
        return _median(v);
      }
      return { date: d, pass: med("pass"), fail: med("fail") };
    });
  }

  // #1 — cumulative runs by result (stacked area) over snapshots.
  function renderCumulativeArea(runs) {
    const W = 700, H = 300, padL = 40, padR = 18, padT = 18, padB = 42;
    const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH;
    const dates = _sortedDates(runs), n = dates.length, total = runs.length || 1;
    const x = function (i) { return padL + (n <= 1 ? plotW / 2 : i * plotW / (n - 1)); };
    const y = function (v) { return baseY - (v / total) * plotH; };
    const cum = dates.map(function (d) {
      const upto = runs.filter(function (r) { return r.date <= d; });
      const c = {}; RESULT_ORDER.forEach(function (k) {
        c[k] = upto.filter(function (r) { return r.result === k; }).length;
      });
      return c;
    });
    let body = '<line x1="' + padL + '" y1="' + baseY + '" x2="' + (W - padR) + '" y2="' + baseY + '" class="chart-axis"/>';
    [0, Math.round(total / 2), total].forEach(function (v) {
      body += '<text x="' + (padL - 6) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end" class="chart-tick">' + v + '</text>';
    });
    let lower = dates.map(function () { return 0; });
    RESULT_ORDER.forEach(function (k) {
      const c = RESULT_COLORS[k];
      const upper = dates.map(function (d, i) { return lower[i] + cum[i][k]; });
      let pts = [];
      for (let i = 0; i < n; i++) pts.push(x(i).toFixed(1) + "," + y(upper[i]).toFixed(1));
      for (let i = n - 1; i >= 0; i--) pts.push(x(i).toFixed(1) + "," + y(lower[i]).toFixed(1));
      body += '<polygon points="' + pts.join(" ") + '" style="fill:' + c.fill + ';fill-opacity:0.35;stroke:' + c.text + ';stroke-width:1.5"/>';
      lower = upper;
    });
    // Annotation at the Carwash III discontinuity + accent endpoint dot.
    const anIdx = dates.indexOf("2026-07-11");
    if (anIdx >= 0) {
      const cum7 = runs.filter(function (r) { return r.date <= "2026-07-11"; }).length;
      body += '<line x1="' + x(anIdx).toFixed(1) + '" y1="' + y(cum7).toFixed(1) + '" x2="' + x(anIdx).toFixed(1) +
        '" y2="' + (y(cum7) - 22).toFixed(1) + '" class="chart-gridline"/>';
      body += '<text x="' + x(anIdx).toFixed(1) + '" y="' + (y(cum7) - 28).toFixed(1) +
        '" text-anchor="middle" class="chart-tick">Carwash III — Jul 11</text>';
    }
    body += '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(total).toFixed(1) + '" r="4" style="fill:var(--acc)"/>';
    const showTick = _dateTicks(n, plotW);
    dates.forEach(function (d, i) {
      if (!showTick[i]) return;
      body += '<text x="' + x(i).toFixed(1) + '" y="' + (baseY + 16) + '" text-anchor="middle" class="chart-tick">' + escapeHTML(_shortDate(d)) + '</text>';
    });
    return '<figure class="chart-card chart-card-wide"><figcaption>Cumulative runs by result</figcaption>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Cumulative runs by result across ' + n + ' snapshots, ending at ' + total + ' runs." class="chart-svg">' + body + '</svg>' +
      '<p class="chart-note">Each run is a different model on the lineup available that date — this tracks the growing corpus, not any single model over time.</p></figure>';
  }

  // X-axis date labels: with 20+ test dates a label per point collides.
  // Pick a step so labels keep ~52px clearance; always keep the first and
  // last, and drop the runner-up tick if it would crowd the final label.
  function _dateTicks(n, plotW) {
    const step = Math.max(1, Math.ceil((n * 68) / Math.max(plotW, 1)));
    const show = [];
    for (let i = 0; i < n; i++) {
      if (i === n - 1) { show.push(true); continue; }
      show.push(i % step === 0 && (n - 1 - i) >= step / 2);
    }
    return show;
  }

  function _lineChart(opts) {
    // opts: {dates, series:[{vals,color,label}], yMax, fmt, caption, note, aria}
    const W = 700, H = 300, padL = 46, padR = 56, padT = 18, padB = 42;
    const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH;
    const n = opts.dates.length;
    const x = function (i) { return padL + (n <= 1 ? plotW / 2 : i * plotW / (n - 1)); };
    const y = function (v) { return baseY - (v / opts.yMax) * plotH; };
    let body = '<line x1="' + padL + '" y1="' + baseY + '" x2="' + (W - padR) + '" y2="' + baseY + '" class="chart-axis"/>';
    (opts.ticks || [0, opts.yMax]).forEach(function (v) {
      if (v > 0) {
        body += '<line x1="' + padL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - padR) +
          '" y2="' + y(v).toFixed(1) + '" class="chart-gridline"/>';
      }
      body += '<text x="' + (padL - 6) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end" class="chart-tick">' + opts.fmt(v) + '</text>';
    });
    opts.series.forEach(function (s) {
      let pts = [];
      s.vals.forEach(function (v, i) { if (v != null) pts.push(x(i).toFixed(1) + "," + y(v).toFixed(1)); });
      body += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + s.color + '" stroke-width="2.5" stroke-linejoin="round"/>';
      s.vals.forEach(function (v, i) {
        if (v != null) body += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (s.radii ? s.radii[i].toFixed(1) : "2.5") + '" style="fill:' + s.color + '"/>';
      });
      // accent endpoint dot + end label
      let li = s.vals.length - 1; while (li >= 0 && s.vals[li] == null) li--;
      if (li >= 0) {
        body += '<circle cx="' + x(li).toFixed(1) + '" cy="' + y(s.vals[li]).toFixed(1) + '" r="4" style="fill:var(--acc)"/>';
        body += '<text x="' + (x(li) + 8).toFixed(1) + '" y="' + (y(s.vals[li]) + 3).toFixed(1) + '" class="chart-endlabel" style="fill:' + s.color + '">' + escapeHTML(s.label) + '</text>';
      }
    });
    const showTick = _dateTicks(n, plotW);
    opts.dates.forEach(function (d, i) {
      if (!showTick[i]) return;
      body += '<text x="' + x(i).toFixed(1) + '" y="' + (baseY + 16) + '" text-anchor="middle" class="chart-tick">' + escapeHTML(_shortDate(d)) + '</text>';
    });
    return '<figure class="chart-card chart-card-wide"><figcaption>' + escapeHTML(opts.caption) + '</figcaption>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escapeHTML(opts.aria) + '" class="chart-svg">' + body + '</svg>' +
      (opts.note ? '<p class="chart-note">' + escapeHTML(opts.note) + '</p>' : '') + '</figure>';
  }

  // #3 — verbosity creep: cumulative median Pass tokens, with Fail as reference.
  function renderVerbosityTrend(runs) {
    const stats = _cumMedians(runs);
    const yMax = Math.max.apply(null, stats.map(function (s) { return Math.max(s.pass || 0, s.fail || 0); })) || 1;
    return _lineChart({
      dates: stats.map(function (s) { return s.date; }),
      yMax: Math.ceil(yMax / 20) * 20,
      fmt: function (v) { return "~" + Math.round(v); },
      series: [
        { vals: stats.map(function (s) { return s.fail; }), color: RESULT_COLORS.fail.text, label: "Fail" },
        { vals: stats.map(function (s) { return s.pass; }), color: RESULT_COLORS.pass.text, label: "Pass" }
      ],
      caption: "Median tokens over time — Pass vs Fail (cumulative)",
      note: "Cumulative median response length as the dataset grows — every run to date, not the runs taken that day. Pass length rose through the spring, then fell sharply when Carwash III added a large block of terse passes; Fail stepped up at the same point. Because each median is taken over the whole corpus, a small recent batch moves these lines very little. Token counts are estimates; the Mistral outlier is excluded.",
      aria: "Line chart of cumulative median token cost over time for Pass and Fail responses."
    });
  }

  // #4 — Fail ÷ Pass cost ratio over time (cumulative).
  function renderCostRatioTrend(runs) {
    const stats = _cumMedians(runs);
    const ratios = stats.map(function (s) { return (s.pass && s.fail) ? s.fail / s.pass : null; });
    const yMax = Math.ceil((Math.max.apply(null, ratios.filter(function (r) { return r != null; })) || 1));
    return _lineChart({
      dates: stats.map(function (s) { return s.date; }),
      yMax: yMax,
      fmt: function (v) { return v.toFixed(0) + "×"; },
      series: [{ vals: ratios.map(function (r) { return r == null ? null : r; }), color: "var(--ink)", label: ratios[ratios.length - 1] != null ? ratios[ratios.length - 1].toFixed(1) + "×" : "" }],
      caption: "Cost of a wrong answer (Fail ÷ Pass median tokens)",
      note: "How many times more tokens the median wrong answer costs versus the median right answer, across the whole corpus to date. The gap narrowed through the spring, then widened again in July as correct answers got terser and wrong answers longer.",
      aria: "Line chart of the Fail-to-Pass median token cost ratio over time."
    });
  }

  // #5 — per-date (NOT cumulative) share of runs that held the constraint.
  // The cumulative charts above damp recent batches by construction: a median
  // over 200+ runs barely moves when a handful are added. This one plots each
  // test date on its own, so a batch that sweeps shows up as a step to 100%.
  function renderHoldRateByDate(runs) {
    const dates = _sortedDates(runs);
    const stats = dates.map(function (d) {
      const day = runs.filter(function (r) { return r.date === d; });
      const held = day.filter(function (r) { return r.result !== "fail"; }).length;
      return { n: day.length, pct: day.length ? (100 * held / day.length) : null };
    });
    const last = stats[stats.length - 1];
    return _lineChart({
      dates: dates,
      yMax: 100,
      ticks: [0, 50, 100],
      fmt: function (v) { return Math.round(v) + "%"; },
      series: [{
        vals: stats.map(function (s) { return s.pct; }),
        color: RESULT_COLORS.pass.text,
        label: last && last.pct != null ? Math.round(last.pct) + "%" : "",
        radii: stats.map(function (s) { return Math.min(7, 2.5 + Math.sqrt(s.n)); })
      }],
      caption: "Held the constraint, by test date (not cumulative)",
      note: "Each point covers only the runs taken that date, so this responds to every new batch where the cumulative charts cannot. Dot size reflects how many runs the date carries — a single-run date can only read 0% or 100%, so read the small dots with caution.",
      aria: "Line chart of the share of runs on each test date that held the constraint, from 0 to 100 percent."
    });
  }

  // Generic horizontal 100%-stacked proportion bars (one row per group).
  function renderProportionBars(groups, caption, aria) {
    const W = 720, rowH = 34, padT = 10, barX = 214, barRight = W - 44, barW = barRight - barX, barH = 18;
    const H = padT * 2 + groups.length * rowH;
    let body = "";
    groups.forEach(function (g, gi) {
      const cy = padT + gi * rowH + rowH / 2, by = cy - barH / 2;
      body += '<text x="0" y="' + (cy + 4).toFixed(1) + '" class="chart-rowlabel">' + escapeHTML(g.label) + '</text>';
      let cx = barX;
      RESULT_ORDER.forEach(function (k) {
        const v = g.counts[k] || 0; if (!v) return;
        const w = (v / g.n) * barW, c = RESULT_COLORS[k];
        body += '<rect x="' + cx.toFixed(1) + '" y="' + by + '" width="' + w.toFixed(1) + '" height="' + barH + '" style="fill:' + c.fill + ';stroke:' + c.text + ';stroke-width:0.75"/>';
        cx += w;
      });
      body += '<text x="' + (barRight + 6) + '" y="' + (cy + 4).toFixed(1) + '" class="chart-tick">' + g.n + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + escapeHTML(aria) + '" class="chart-svg" style="max-width:' + W + 'px">' + body + '</svg>';
  }

  function _groupCounts(runs) {
    const c = {}; RESULT_ORDER.forEach(function (k) { c[k] = 0; });
    runs.forEach(function (r) { if (c.hasOwnProperty(r.result)) c[r.result]++; });
    return c;
  }

  // #6 — result mix by thinking mode.
  function renderResultByThinking(runs) {
    const byT = {};
    runs.forEach(function (r) { (byT[r.thinking] = byT[r.thinking] || []).push(r); });
    const groups = Object.keys(byT).map(function (t) {
      return { label: THINKING_LABELS[t] || t, counts: _groupCounts(byT[t]), n: byT[t].length };
    }).sort(function (a, b) { return b.n - a.n; });
    return '<figure class="chart-card chart-card-wide"><figcaption>Result mix by thinking mode</figcaption>' +
      renderProportionBars(groups, "thinking", "Result distribution by thinking mode.") +
      '<p class="chart-note">Each bar is one reasoning setting, normalized to 100% (count at right). The mode names are vendor branding for the same underlying control — whether the model deliberates before answering:</p>' +
      '<ul class="chart-legend-list">' +
        '<li><strong>On / Off</strong> — user-toggled reasoning (Anthropic Extended Thinking, OpenAI extended thinking, Google Gemini Thinking, DeepSeek DeepThink, Kimi).</li>' +
        '<li><strong>Adaptive On / Off</strong> — the model decides whether to reason (Anthropic Sonnet 4.6, Opus 4.7).</li>' +
        '<li><strong>Auto</strong> — a vendor picker that selects a reasoning depth (xAI Grok 4.3, Qwen).</li>' +
        '<li><strong>Fast</strong> — reasoning suppressed for latency (xAI Grok 4.3, Qwen 3.6 / 3.7).</li>' +
        '<li><strong>Balanced / Think / Research</strong> — Mistral Le Chat\'s mode picker (everyday / extended reasoning / multi-source deep analysis).</li>' +
        '<li><strong>Expert</strong> — maximum-deliberation tier (xAI Grok 4.3).</li>' +
        '<li><strong>Contemplating</strong> — multi-chain parallel reasoning (Meta Muse Spark).</li>' +
        '<li><strong>N/A</strong> — no user-facing reasoning control exposed.</li>' +
      '</ul>' +
      '<p class="chart-note">Reasoning does not uniformly help — it lifts some systems and breaks others. Full definitions on the <a href="methodology.html#thinking-conventions">methodology page</a>.</p></figure>';
  }

  // #8 — per-family comparison (sorted by fewest fails, then most clean passes).
  function renderVendorComparison(runs, families) {
    const byF = {};
    runs.forEach(function (r) { (byF[r.model_family] = byF[r.model_family] || []).push(r); });
    const groups = Object.keys(byF).map(function (slug) {
      const c = _groupCounts(byF[slug]), n = byF[slug].length;
      return { label: (families[slug] && families[slug].display_name) || slug, counts: c, n: n,
        failShare: (c.fail || 0) / n, passShare: (c.pass || 0) / n };
    }).sort(function (a, b) {
      if (a.failShare !== b.failShare) return a.failShare - b.failShare;
      return b.passShare - a.passShare;
    });
    return '<figure class="chart-card chart-card-wide"><figcaption>Result mix by model family</figcaption>' +
      renderProportionBars(groups, "family", "Result distribution by model family, sorted by fewest failures.") +
      '<p class="chart-note">Each bar is one model family, normalized to 100% (run count at right), ordered from fewest failures down. A single-shot snapshot, not a verdict.</p></figure>';
  }

  // ── Language corpora ─────────────────────────────────────────────────
  // Runs without a `language` field are English by convention. The English
  // aggregate views (tally, charts, results table, CSV, family grid) must
  // exclude other-language runs so corpora stay separate.
  function runLang(r) { return r.language || "en"; }
  // Open-weight runs (e.g. Gemma in AI Studio) are a separate deployment
  // class and must NOT merge into the commercial-product corpora.
  function isOpenWeight(r) { return r.deployment_class === "open_weight"; }
  function openWeightRuns(runs) {
    return runs.filter(isOpenWeight);
  }
  function englishRuns(runs) {
    return runs.filter(function (r) { return runLang(r) === "en" && !isOpenWeight(r); });
  }
  function runsByLanguage(runs, lang) {
    return runs.filter(function (r) { return runLang(r) === lang && !isOpenWeight(r); });
  }

  // Filter runs to those whose model family belongs to the given category.
  function runsInCategory(runs, families, category) {
    return runs.filter(function (r) {
      const f = families[r.model_family];
      return f && ((f.category || "general") === category);
    });
  }

  global.CarwashTest = {
    PURPOSE_OPTIMIZED_ICON: PURPOSE_OPTIMIZED_ICON,
    OPEN_WEIGHT_ICON: OPEN_WEIGHT_ICON,
    runsInCategory: runsInCategory,
    englishRuns: englishRuns,
    runsByLanguage: runsByLanguage,
    openWeightRuns: openWeightRuns,
    buildResultsCSV: buildResultsCSV,
    loadData: loadData,
    formatDate: formatDate,
    formatThinking: formatThinking,
    escapeHTML: escapeHTML,
    tally: tally,
    renderTallyRow: renderTallyRow,
    renderCharts: renderCharts,
    renderChartsMini: renderChartsMini,
    renderCumulativeArea: renderCumulativeArea,
    renderVerbosityTrend: renderVerbosityTrend,
    renderCostRatioTrend: renderCostRatioTrend,
    renderHoldRateByDate: renderHoldRateByDate,
    renderStatStrip: renderStatStrip,
    renderResultByThinking: renderResultByThinking,
    renderVendorComparison: renderVendorComparison,
    renderResultsTable: renderResultsTable,
    renderResultsTableForFamily: renderResultsTableForFamily,
    makeSortable: makeSortable,
    renderLegend: renderLegend,
    renderFamilyGrid: renderFamilyGrid,
    renderTitleLogo: renderTitleLogo,
    familyTitleHTML: familyTitleHTML,
    renderVendorRail: renderVendorRail,
    renderVendorPagination: renderVendorPagination,
    renderTranscriptEntry: renderTranscriptEntry,
    renderVendorLanguageRuns: renderVendorLanguageRuns,
    renderChangeLog: renderChangeLog,
    showError: showError
  };

  // ── Theme toggle ─────────────────────────────────────────────────────
  // Three states cycling System → Light → Dark. An explicit choice stamps
  // data-theme on <html> (the CSS override blocks pick it up) and persists
  // in localStorage; System clears both. The early restore in each page's
  // head applies the stored theme before first paint, so there is no flash.
  // The button installs itself into the cross-site top rail on every page.
  (function () {
    const KEY = "carwash-theme";
    function stored() {
      try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }
    function apply(theme) {
      if (theme === "light" || theme === "dark") {
        document.documentElement.setAttribute("data-theme", theme);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    }
    function label(theme) {
      return "Theme: " + (theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System");
    }
    function install() {
      const rail = document.querySelector(".page-header-nav");
      if (!rail) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "theme-toggle";
      btn.setAttribute("aria-label", "Switch color theme");
      let current = stored();
      btn.textContent = label(current);
      btn.addEventListener("click", function () {
        current = current === null ? "light" : current === "light" ? "dark" : null;
        try {
          if (current) localStorage.setItem(KEY, current);
          else localStorage.removeItem(KEY);
        } catch (e) { /* private mode: theme still applies for this page view */ }
        apply(current);
        btn.textContent = label(current);
      });
      rail.appendChild(btn);
    }
    apply(stored());
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", install);
    } else {
      install();
    }
  })();
})(window);
