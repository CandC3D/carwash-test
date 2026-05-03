(function (global) {
  "use strict";

  const RESULT_LABELS = {
    "pass": "Pass",
    "pass-adjacent": "Pass-adjacent",
    "verbose": "Verbose",
    "fail": "Fail"
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
    const order = ["pass", "pass-adjacent", "verbose", "fail"];
    return '<div class="tally-row">' + order.map(function (k) {
      return '<div class="tally-card tally-' + k + '">' +
        '<span class="count">' + t[k] + '</span>' +
        '<span class="label">' + RESULT_LABELS[k] + '</span>' +
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
      '<th class="col-id sortable" data-sort-type="number" data-default-dir="asc">#</th>' +
      '<th class="sortable" data-sort-type="string" data-default-dir="asc">Company</th>' +
      '<th class="sortable" data-sort-type="string" data-default-dir="asc">Model</th>' +
      '<th class="col-thinking sortable" data-sort-type="number" data-default-dir="asc">Thinking</th>' +
      '<th class="col-date sortable" data-sort-type="string" data-default-dir="desc">Date</th>' +
      '<th class="sortable" data-sort-type="number" data-default-dir="asc">Result</th>' +
      '<th class="col-tokens sortable" data-sort-type="number" data-default-dir="desc" title="Approximate token count, computed as round(characters / 4)">Tokens</th>' +
      '</tr></thead>';
  }

  function renderResultsTable(runs, families) {
    const rows = runs.map(function (r) {
      const link = (families && families[r.model_family])
        ? "transcripts/" + r.model_family + ".html#run-" + r.id
        : null;
      return buildRow(r, link);
    }).join("");
    return '<table class="results-table">' + buildHeader() + '<tbody>' + rows + '</tbody></table>';
  }

  function renderResultsTableForFamily(runs) {
    const rows = runs.map(function (r) {
      return buildRow(r, "#run-" + r.id);
    }).join("");
    return '<table class="results-table">' + buildHeader() + '<tbody>' + rows + '</tbody></table>';
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

  function renderFamilyGrid(runs, families, basePath) {
    basePath = basePath || "";
    const counts = {};
    runs.forEach(function (r) {
      counts[r.model_family] = (counts[r.model_family] || 0) + 1;
    });
    const slugs = Object.keys(families).sort(function (a, b) {
      const an = (families[a].display_name || a).toLowerCase();
      const bn = (families[b].display_name || b).toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
    return '<div class="family-grid">' + slugs.map(function (slug) {
      const f = families[slug];
      const c = counts[slug] || 0;
      const logo = LOGO_FILES[slug]
        ? '<span class="family-logo" style="--logo-url: url(assets/logos/' + LOGO_FILES[slug] + ')"></span>'
        : '';
      return '<a class="family-card" href="' + basePath + 'transcripts/' + slug + '.html">' +
        logo +
        '<span class="family-name">' + escapeHTML(f.display_name) + '</span>' +
        '<span class="family-count">' + c + ' run' + (c === 1 ? '' : 's') + '</span>' +
        '</a>';
    }).join("") + '</div>';
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

  global.CarwashTest = {
    loadData: loadData,
    formatDate: formatDate,
    formatThinking: formatThinking,
    escapeHTML: escapeHTML,
    tally: tally,
    renderTallyRow: renderTallyRow,
    renderResultsTable: renderResultsTable,
    renderResultsTableForFamily: renderResultsTableForFamily,
    makeSortable: makeSortable,
    renderLegend: renderLegend,
    renderFamilyGrid: renderFamilyGrid,
    renderTitleLogo: renderTitleLogo,
    renderTranscriptEntry: renderTranscriptEntry,
    renderChangeLog: renderChangeLog,
    showError: showError
  };
})(window);
