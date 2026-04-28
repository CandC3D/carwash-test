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
    "balanced": "Balanced"
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
    "perplexity": "perplexity.svg"
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
      return '<div class="tally-card">' +
        '<span class="count">' + t[k] + '</span>' +
        '<span class="label">' + RESULT_LABELS[k] + '</span>' +
        '</div>';
    }).join("") + '</div>';
  }

  function renderResultsTable(runs, families) {
    const rows = runs.map(function (r) {
      const slug = r.model_family;
      const link = (families && families[slug])
        ? "transcripts/" + slug + ".html#run-" + r.id
        : null;
      const idCell = link
        ? '<a href="' + link + '">#' + r.id + '</a>'
        : '#' + r.id;
      const modelCell = link
        ? '<a href="' + link + '">' + escapeHTML(r.model) + '</a>'
        : escapeHTML(r.model);
      return '<tr>' +
        '<td class="col-id">' + idCell + '</td>' +
        '<td>' + escapeHTML(r.vendor) + '</td>' +
        '<td>' + modelCell + '</td>' +
        '<td class="col-thinking">' + escapeHTML(formatThinking(r.thinking)) + '</td>' +
        '<td class="col-date">' + escapeHTML(formatDate(r.date)) + '</td>' +
        '<td><span class="badge ' + r.result + '">' + RESULT_LABELS[r.result] + '</span></td>' +
        '</tr>';
    }).join("");
    return '<table class="results-table">' +
      '<thead><tr>' +
      '<th class="col-id">#</th>' +
      '<th>Company</th>' +
      '<th>Model</th>' +
      '<th class="col-thinking">Thinking</th>' +
      '<th class="col-date">Date</th>' +
      '<th>Result</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  function renderResultsTableForFamily(runs) {
    // Used on transcript pages — link to in-page anchors
    const rows = runs.map(function (r) {
      return '<tr>' +
        '<td class="col-id"><a href="#run-' + r.id + '">#' + r.id + '</a></td>' +
        '<td>' + escapeHTML(r.vendor) + '</td>' +
        '<td><a href="#run-' + r.id + '">' + escapeHTML(r.model) + '</a></td>' +
        '<td class="col-thinking">' + escapeHTML(formatThinking(r.thinking)) + '</td>' +
        '<td class="col-date">' + escapeHTML(formatDate(r.date)) + '</td>' +
        '<td><span class="badge ' + r.result + '">' + RESULT_LABELS[r.result] + '</span></td>' +
        '</tr>';
    }).join("");
    return '<table class="results-table">' +
      '<thead><tr>' +
      '<th class="col-id">#</th>' +
      '<th>Company</th>' +
      '<th>Model</th>' +
      '<th class="col-thinking">Thinking</th>' +
      '<th class="col-date">Date</th>' +
      '<th>Result</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>';
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
    const slugs = Object.keys(families);
    return '<div class="family-grid">' + slugs.map(function (slug) {
      const f = families[slug];
      const c = counts[slug] || 0;
      const logo = LOGO_FILES[slug]
        ? '<span class="family-logo" style="--logo-url: url(' + basePath + 'assets/logos/' + LOGO_FILES[slug] + ')"></span>'
        : '';
      return '<a class="family-card" href="' + basePath + 'transcripts/' + slug + '.html">' +
        logo +
        '<span class="family-name">' + escapeHTML(f.display_name) + '</span>' +
        '<span class="family-count">' + c + ' run' + (c === 1 ? '' : 's') + '</span>' +
        '</a>';
    }).join("") + '</div>';
  }

  function renderTranscriptEntry(run) {
    const notesBlock = run.notes && run.notes.trim()
      ? '<div class="transcript-notes">' + escapeHTML(run.notes) + '</div>'
      : '';
    return '<div class="transcript-entry" id="run-' + run.id + '">' +
      '<div class="transcript-header">' +
        '<span class="transcript-id">#' + run.id + '</span>' +
        '<span class="transcript-model">' + escapeHTML(run.model) + '</span>' +
        '<span class="transcript-meta">' +
          '<span>' + escapeHTML(run.vendor) + '</span>' +
          '<span>Thinking: ' + escapeHTML(formatThinking(run.thinking)) + '</span>' +
          '<span>' + escapeHTML(formatDate(run.date)) + '</span>' +
          '<span><span class="badge ' + run.result + '">' + RESULT_LABELS[run.result] + '</span></span>' +
        '</span>' +
      '</div>' +
      '<details>' +
        '<summary>Verbatim response</summary>' +
        '<div>' + escapeHTML(run.response) + '</div>' +
      '</details>' +
      notesBlock +
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

  global.CarwashTest = {
    loadData: loadData,
    formatDate: formatDate,
    formatThinking: formatThinking,
    escapeHTML: escapeHTML,
    tally: tally,
    renderTallyRow: renderTallyRow,
    renderResultsTable: renderResultsTable,
    renderResultsTableForFamily: renderResultsTableForFamily,
    renderLegend: renderLegend,
    renderFamilyGrid: renderFamilyGrid,
    renderTranscriptEntry: renderTranscriptEntry,
    renderChangeLog: renderChangeLog,
    showError: showError
  };
})(window);
