(function (global) {
  "use strict";

  const RESULT_LABELS = {
    "pass": "Pass",
    "pass-adjacent": "Pass-adjacent",
    "verbose": "Verbose",
    "fail": "Fail"
  };

  // Fill + label colors per result, matching the tally cards / badges.
  const RESULT_COLORS = {
    "pass":          { fill: "var(--pass-bg)",    text: "var(--pass-text)" },
    "pass-adjacent": { fill: "var(--passadj-bg)", text: "var(--passadj-text)" },
    "verbose":       { fill: "var(--verbose-bg)", text: "var(--verbose-text)" },
    "fail":          { fill: "var(--fail-bg)",    text: "var(--fail-text)" }
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
    "xai": "x.svg",
    "mistral": "mistralai.svg",
    "perplexity": "perplexity.svg",
    "qwen": "qwen.svg",
    "kimi": "kimi.svg",
    "lumo": "lumo.svg"
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
  const THINKING_SORT_RANK = { "off": 0, "adaptive_off": 1, "n/a": 2, "fast": 3, "balanced": 4, "auto": 5, "contemplating": 6, "expert": 7, "adaptive_on": 8, "on": 9 };

  function tokenEstimate(response) {
    if (!response) return 0;
    return Math.round(String(response).length / 4);
  }

  function runTokens(run) {
    // Use the explicit token_estimate field if present (for runs whose
    // verbatim record is incomplete — e.g. accompanied by a PDF
    // attachment whose content is not in the response field).
    if (typeof run.token_estimate === "number" && run.token_estimate >= 0) {
      return run.token_estimate;
    }
    return tokenEstimate(run.response);
  }

  function buildRow(r, link) {
    const idCell = link ? '<a href="' + link + '">#' + r.id + '</a>' : '#' + r.id;
    const modelCell = link ? '<a href="' + link + '">' + escapeHTML(r.model) + '</a>' : escapeHTML(r.model);
    const tokens = runTokens(r);
    return '<tr>' +
      '<td class="col-id" data-sort="' + r.id + '">' + idCell + '</td>' +
      '<td data-sort="' + escapeHTML(r.vendor.toLowerCase()) + '">' + escapeHTML(r.vendor) + '</td>' +
      '<td data-sort="' + escapeHTML(r.model.toLowerCase()) + '">' + modelCell + '</td>' +
      '<td class="col-thinking" data-sort="' + (THINKING_SORT_RANK[r.thinking] !== undefined ? THINKING_SORT_RANK[r.thinking] : 99) + '">' + escapeHTML(formatThinking(r.thinking)) + '</td>' +
      '<td class="col-date" data-sort="' + escapeHTML(r.date) + '">' + escapeHTML(formatDate(r.date)) + '</td>' +
      '<td data-sort="' + RESULT_SORT_RANK[r.result] + '"><span class="badge ' + r.result + '">' + RESULT_LABELS[r.result] + '</span></td>' +
      '<td class="col-tokens" data-sort="' + tokens + '">' + (tokens > 0 ? '~' + tokens.toLocaleString() : '—') + '</td>' +
      '</tr>';
  }

  function buildHeader() {
    return '<thead><tr>' +
      '<th scope="col" class="col-id sortable" data-sort-type="number" data-default-dir="asc">#</th>' +
      '<th scope="col" class="sortable" data-sort-type="string" data-default-dir="asc">Company</th>' +
      '<th scope="col" class="sortable" data-sort-type="string" data-default-dir="asc">Model</th>' +
      '<th scope="col" class="col-thinking sortable" data-sort-type="number" data-default-dir="asc">Thinking</th>' +
      '<th scope="col" class="col-date sortable" data-sort-type="string" data-default-dir="desc">Date</th>' +
      '<th scope="col" class="sortable" data-sort-type="number" data-default-dir="asc">Result</th>' +
      '<th scope="col" class="col-tokens sortable" data-sort-type="number" data-default-dir="desc" title="Approximate token count, computed as round(characters / 4)">Tokens</th>' +
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

  function renderResultsTable(runs, families) {
    const rows = runs.map(function (r) {
      const link = (families && families[r.model_family])
        ? familyPageHref(r.model_family, families, "") + r.id
        : null;
      return buildRow(r, link);
    }).join("");
    return '<table class="results-table">' + buildCaption(runs) + buildHeader() + '<tbody>' + rows + '</tbody></table>';
  }

  function renderResultsTableForFamily(runs) {
    const rows = runs.map(function (r) {
      return buildRow(r, "#run-" + r.id);
    }).join("");
    return '<table class="results-table">' + buildCaption(runs) + buildHeader() + '<tbody>' + rows + '</tbody></table>';
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
    const counts = {};
    runs.forEach(function (r) {
      counts[r.model_family] = (counts[r.model_family] || 0) + 1;
    });
    const generalSlugs = _slugsByCategory(families, "general");
    const poSlugs = _slugsByCategory(families, "purpose-optimized");

    let html = '<div class="family-grid">' + generalSlugs.map(function (slug) {
      return _familyCard(slug, families, counts, basePath);
    }).join("") + '</div>';

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

  function renderVendorRail(currentSlug, families, runs, basePath) {
    basePath = basePath || "";
    const counts = {};
    runs.forEach(function (r) {
      counts[r.model_family] = (counts[r.model_family] || 0) + 1;
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

    return '<div class="vendor-rail">' +
      '<div class="vendor-rail-inner">' +
        '<a class="vendor-rail-back" href="' + basePath + 'transcripts.html">← All Transcripts</a>' +
        '<div class="vendor-pills">' + pills + poPill + '</div>' +
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
    const tokensSpan = tokens > 0
      ? '<span title="Approximate token count, round(characters / 4)">~' + tokens.toLocaleString() + ' tokens</span>'
      : '';
    return '<div class="transcript-entry" id="run-' + run.id + '">' +
      '<div class="transcript-header">' +
        '<span class="transcript-id">#' + run.id + '</span>' +
        '<span class="transcript-model">' + escapeHTML(run.model) + '</span>' +
        '<span class="transcript-meta">' +
          '<span>' + escapeHTML(run.vendor) + '</span>' +
          '<span>Thinking: ' + escapeHTML(formatThinking(run.thinking)) + '</span>' +
          '<span>' + escapeHTML(formatDate(run.date)) + '</span>' +
          tokensSpan +
          '<span><span class="badge ' + run.result + '">' + RESULT_LABELS[run.result] + '</span></span>' +
        '</span>' +
      '</div>' +
      '<details>' +
        '<summary>Verbatim response</summary>' +
        '<div>' + escapeHTML(run.response) + '</div>' +
      '</details>' +
      notesBlock +
      attachmentBlock +
      '</div>';
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
    // Lift the bars off the baseline by the same gap the pie's bottom leaves
    // (the pie sits plotH/2 - r above the baseline, ≈ 5px), so the two charts'
    // lowest points line up rather than the bars touching the axis.
    const baseGap = plotH / 2 - 90;
    const usableH = plotH - baseGap;
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
      const y = (baseY - baseGap) - bh;
      const c = RESULT_COLORS[k];
      body += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' +
        barW.toFixed(1) + '" height="' + bh.toFixed(1) +
        '" rx="3" style="fill:' + c.fill + ';stroke:' + c.text + ';stroke-width:1"/>';
      body += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (y - 7).toFixed(1) +
        '" text-anchor="middle" class="chart-value" style="fill:' + c.text + '">' + val + '</text>';
    });
    const aria = "Bar chart of run counts: " +
      RESULT_ORDER.map(function (k) { return RESULT_LABELS[k] + " " + (t[k] || 0); }).join(", ");
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      escapeHTML(aria) + '" class="chart-svg">' + body + '</svg>';
  }

  function renderPieChart(t) {
    // Share the bar chart's frame (320×240, same padding/baseline) so the two
    // charts render at identical size — captions top-align and the baselines
    // line up. The pie is centered in the plot area and sits just above the
    // baseline; each slice is outlined in its category color like the bars.
    const W = 320, H = 240, padTop = 26, padBottom = 24, padX = 18;
    const plotH = H - padTop - padBottom;
    const baseY = padTop + plotH;
    const cx = W / 2, cy = padTop + plotH / 2, r = 90;
    const total = RESULT_ORDER.reduce(function (s, k) { return s + (t[k] || 0); }, 0) || 1;
    let angle = -Math.PI / 2; // start at 12 o'clock
    let body = "";
    RESULT_ORDER.forEach(function (k) {
      const val = t[k] || 0;
      if (val <= 0) return;
      const frac = val / total;
      const c = RESULT_COLORS[k];
      let d, lx = cx, ly = cy;
      if (frac >= 0.9999) {
        // Single category at 100%: draw a full circle as two arcs.
        d = "M " + cx + " " + (cy - r) + " A " + r + " " + r + " 0 1 1 " +
          (cx - 0.01).toFixed(2) + " " + (cy - r) + " Z";
      } else {
        const a2 = angle + frac * 2 * Math.PI;
        const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
        const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        const large = frac > 0.5 ? 1 : 0;
        d = "M " + cx + " " + cy + " L " + x1.toFixed(2) + " " + y1.toFixed(2) +
          " A " + r + " " + r + " 0 " + large + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) + " Z";
        const mid = (angle + a2) / 2;
        const lr = r * 0.62;
        lx = cx + lr * Math.cos(mid); ly = cy + lr * Math.sin(mid);
        angle = a2;
      }
      body += '<path d="' + d + '" style="fill:' + c.fill + ';stroke:' + c.text + ';stroke-width:1"/>';
      const pct = Math.round(frac * 100);
      body += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) +
        '" text-anchor="middle" dominant-baseline="central" class="chart-value" style="fill:' +
        c.text + '">' + pct + '%</text>';
    });
    // Baseline matching the bar chart's axis.
    body += '<line x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) +
      '" y2="' + baseY + '" class="chart-axis"/>';
    const aria = "Pie chart of result share: " +
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
      const txt = (med == null) ? "—" : Math.round(med).toLocaleString();
      body += '<text x="' + labelX.toFixed(1) + '" y="' + labelY.toFixed(1) +
        '" dominant-baseline="central" class="chart-value" style="fill:' + c.text + '">' +
        txt + '</text>';
    });
    body += '<line x1="' + padX + '" y1="' + baseY + '" x2="' + (W - padX) +
      '" y2="' + baseY + '" class="chart-axis"/>';

    // Cost ratio: a wrong answer vs. the right answer (Fail vs. Pass median).
    // Drawn in the upper-right — over the space the (always-shortest) Pass
    // bar leaves empty. Only shown when both medians are available.
    const passM = medians["pass"], failM = medians["fail"];
    const ratio = (passM && failM && passM > 0) ? (failM / passM) : null;
    if (ratio != null) {
      const rx = W - padX, ry = padTop + 14;
      body += '<text x="' + rx + '" y="' + ry + '" text-anchor="end" class="chart-annotation">' +
        '<tspan x="' + rx + '" dy="0">A wrong answer costs ' + ratio.toFixed(1) + '× the</tspan>' +
        '<tspan x="' + rx + '" dy="17">cost of the right answer.</tspan>' +
        '</text>';
    }

    const aria = "Median tokens by result: " + RESULT_ORDER.map(function (k) {
      return RESULT_LABELS[k] + " " +
        (medians[k] == null ? "no data" : Math.round(medians[k]) + " tokens");
    }).join(", ");
    const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      escapeHTML(aria) + '" class="chart-svg">' + body + '</svg>';
    const ratioNote = (ratio != null)
      ? '<p class="chart-note">A wrong answer costs ' + ratio.toFixed(1) +
          '× the cost of the right answer — Fail median vs. Pass median.</p>'
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

  // Filter runs to those whose model family belongs to the given category.
  function runsInCategory(runs, families, category) {
    return runs.filter(function (r) {
      const f = families[r.model_family];
      return f && ((f.category || "general") === category);
    });
  }

  global.CarwashTest = {
    PURPOSE_OPTIMIZED_ICON: PURPOSE_OPTIMIZED_ICON,
    runsInCategory: runsInCategory,
    loadData: loadData,
    formatDate: formatDate,
    formatThinking: formatThinking,
    escapeHTML: escapeHTML,
    tally: tally,
    renderTallyRow: renderTallyRow,
    renderCharts: renderCharts,
    renderResultsTable: renderResultsTable,
    renderResultsTableForFamily: renderResultsTableForFamily,
    makeSortable: makeSortable,
    renderLegend: renderLegend,
    renderFamilyGrid: renderFamilyGrid,
    renderTitleLogo: renderTitleLogo,
    renderVendorRail: renderVendorRail,
    renderVendorPagination: renderVendorPagination,
    renderTranscriptEntry: renderTranscriptEntry,
    renderChangeLog: renderChangeLog,
    showError: showError
  };
})(window);
