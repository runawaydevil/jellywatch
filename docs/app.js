(function () {
  "use strict";

  var PER_PAGE = 50;

  var TYPE_CFG = {
    movie:        { label: "Movies",       cols: ["Title","Year","Runtime","Genres"] },
    series:       { label: "Series",       cols: ["Title","Year","Genres"] },
    episode:      { label: "Episodes",     cols: ["Series","Ep","Title","Runtime"] },
    audio:        { label: "Tracks",       cols: ["Title","Artist","Album","Runtime"] },
    music_album:  { label: "Albums",       cols: ["Title","Artist","Year"] },
    music_artist: { label: "Artists",      cols: ["Name"] },
    book:         { label: "Books",        cols: ["Title","Year","Genres"] },
    music_video:  { label: "Music Videos", cols: ["Title","Artist","Year","Runtime"] },
    audiobook:    { label: "Audiobooks",   cols: ["Title","Year","Runtime"] },
  };

  var TYPE_ORDER = ["movie","series","episode","audio","music_album","music_artist","book","music_video","audiobook"];

  var state = {
    allItems: [],
    byType: {},
    activeTab: "",
    sort: "date_desc",
    page: 1,
    searchMode: false,
    searchResults: [],
  };

  var els = {
    q:        document.getElementById("q"),
    hint:     document.getElementById("search-hint"),
    stats:    document.getElementById("stats"),
    tabs:     document.getElementById("tabs"),
    toolbar:  document.getElementById("toolbar"),
    pageInfo: document.getElementById("page-info"),
    sort:     document.getElementById("sort"),
    main:     document.getElementById("main"),
    pag:      document.getElementById("pagination"),
    overlay:  document.getElementById("detail-overlay"),
    detBody:  document.getElementById("detail-body"),
    updated:  document.getElementById("updated"),
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
  fetch("catalog.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function (data) {
      state.allItems = Array.isArray(data.items) ? data.items : [];

      for (var i = 0; i < state.allItems.length; i++) {
        var t = state.allItems[i].type || "unknown";
        if (!state.byType[t]) state.byType[t] = [];
        state.byType[t].push(state.allItems[i]);
      }

      if (data.generated_at) {
        els.updated.textContent = "Updated " + fmtDate(data.generated_at);
      }

      if (data.counts) {
        var total = 0;
        var keys = Object.keys(data.counts);
        for (var k = 0; k < keys.length; k++) total += data.counts[keys[k]];
        els.stats.textContent = total.toLocaleString() + " items";
      }

      buildTabs();
      render();
    })
    .catch(function (err) {
      document.getElementById("skeleton").style.display = "none";
      els.main.innerHTML = "<div id='error-msg'>Failed to load catalog.json: " + esc(err.message) + "</div>";
    });

  // ── Tabs ─────────────────────────────────────────────────────────────────
  function buildTabs() {
    var html = "";
    var first = "";
    for (var i = 0; i < TYPE_ORDER.length; i++) {
      var key = TYPE_ORDER[i];
      var items = state.byType[key];
      if (!items || !items.length) continue;
      if (!first) first = key;
      var cfg = TYPE_CFG[key] || { label: key };
      html += "<button class='tab' data-type='" + key + "'>" +
        esc(cfg.label) +
        "<span class='tab-count'>" + items.length.toLocaleString() + "</span>" +
        "</button>";
    }
    els.tabs.innerHTML = html;
    state.activeTab = first;

    var btns = els.tabs.querySelectorAll(".tab");
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener("click", function (e) {
        state.activeTab = this.dataset.type;
        state.page = 1;
        state.searchMode = false;
        els.q.value = "";
        els.hint.textContent = "";
        updateTabActive();
        render();
      });
    }
    updateTabActive();
  }

  function updateTabActive() {
    var btns = els.tabs.querySelectorAll(".tab");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].dataset.type === state.activeTab);
    }
  }

  // ── Sort ─────────────────────────────────────────────────────────────────
  els.sort.addEventListener("change", function () {
    state.sort = this.value;
    state.page = 1;
    render();
  });

  // ── Search ───────────────────────────────────────────────────────────────
  var searchTimer;
  els.q.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var q = els.q.value.trim();
      if (q) {
        state.searchMode = true;
        state.page = 1;
        var ql = q.toLowerCase();
        state.searchResults = state.allItems.filter(function (r) {
          return matches(r.title, ql) || matches(r.artist, ql) ||
                 matches(r.album, ql) || matches(r.series_name, ql) ||
                 matches(r.album_artist, ql);
        });
        els.hint.textContent = state.searchResults.length + " result" +
          (state.searchResults.length !== 1 ? "s" : "");
      } else {
        state.searchMode = false;
        els.hint.textContent = "";
      }
      render();
    }, 130);
  });

  els.q.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && els.q.value) {
      els.q.value = "";
      state.searchMode = false;
      els.hint.textContent = "";
      render();
    }
  });

  // ── Render ───────────────────────────────────────────────────────────────
  function render() {
    document.getElementById("skeleton").style.display = "none";

    var items = state.searchMode ? state.searchResults : (state.byType[state.activeTab] || []);
    var sorted = sortItems(items.slice(), state.sort);
    var total  = sorted.length;
    var pages  = Math.max(1, Math.ceil(total / PER_PAGE));
    if (state.page > pages) state.page = pages;
    var start  = (state.page - 1) * PER_PAGE;
    var slice  = sorted.slice(start, start + PER_PAGE);

    var from = total === 0 ? 0 : start + 1;
    var to   = Math.min(start + PER_PAGE, total);
    els.pageInfo.textContent = total === 0 ? "No items" :
      from + "-" + to + " of " + total.toLocaleString();

    els.toolbar.style.display = "";

    if (!total) {
      els.main.innerHTML = "<div id='no-results'>" +
        (state.searchMode ? "No results for &ldquo;" + esc(els.q.value.trim()) + "&rdquo;" : "No items.") +
        "</div>";
      els.pag.innerHTML = "";
      return;
    }

    var type = state.searchMode ? "search" : state.activeTab;
    els.main.innerHTML = "<div class='tbl-wrap'>" + buildTable(type, slice) + "</div>";

    // row click
    var rows = els.main.querySelectorAll("tbody tr");
    for (var i = 0; i < rows.length; i++) {
      rows[i].addEventListener("click", (function (item) {
        return function () { openDetail(item); };
      })(slice[i]));
    }

    renderPagination(pages);
  }

  // ── Table builder ────────────────────────────────────────────────────────
  function buildTable(type, items) {
    var cols = type === "search"
      ? ["Type","Title","Info","Year"]
      : (TYPE_CFG[type] || { cols: ["Title"] }).cols;

    var thead = "<thead><tr>" +
      cols.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead>";

    var rows = "";
    for (var i = 0; i < items.length; i++) {
      var r = items[i];
      var cells = type === "search" ? searchCells(r) : typeCells(type, r);
      rows += "<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    }

    return "<table>" + thead + "<tbody>" + rows + "</tbody></table>";
  }

  function searchCells(r) {
    var cfg = TYPE_CFG[r.type] || { label: r.type || "?" };
    var info = r.series_name || r.artist || r.album_artist || "";
    return [
      "<span class='c-muted' style='font-size:11px;text-transform:uppercase;letter-spacing:.3px'>" + esc(cfg.label) + "</span>",
      "<span class='c-title'>" + esc(r.title || "") + "</span>",
      "<span class='c-muted'>" + esc(info) + "</span>",
      "<span class='c-num'>" + (r.year != null ? r.year : "") + "</span>",
    ];
  }

  function typeCells(type, r) {
    switch (type) {
      case "movie":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-num'>"   + (r.year != null ? r.year : "") + "</span>",
          "<span class='c-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
          genreTags(r.genres, 2),
        ];
      case "series":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-num'>"   + (r.year != null ? r.year : "") + "</span>",
          genreTags(r.genres, 2),
        ];
      case "episode":
        return [
          "<span class='c-muted'>" + esc(r.series_name || "") + "</span>",
          "<span class='c-ep'>"    + epNum(r.season, r.episode) + "</span>",
          "<span class='c-title'>" + esc(r.title || "") + "</span>",
          "<span class='c-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
        ];
      case "audio":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-muted'>" + esc(r.artist || "") + "</span>",
          "<span class='c-muted'>" + esc(r.album || "") + "</span>",
          "<span class='c-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
        ];
      case "music_album":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-muted'>" + esc(r.album_artist || "") + "</span>",
          "<span class='c-num'>"   + (r.year != null ? r.year : "") + "</span>",
        ];
      case "music_artist":
        return ["<span class='c-title'>" + esc(r.title) + "</span>"];
      case "book":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-num'>"   + (r.year != null ? r.year : "") + "</span>",
          genreTags(r.genres, 2),
        ];
      case "music_video":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-muted'>" + esc(r.artist || "") + "</span>",
          "<span class='c-num'>"   + (r.year != null ? r.year : "") + "</span>",
          "<span class='c-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
        ];
      case "audiobook":
        return [
          "<span class='c-title'>" + esc(r.title) + "</span>",
          "<span class='c-num'>"   + (r.year != null ? r.year : "") + "</span>",
          "<span class='c-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
        ];
      default:
        return ["<span class='c-title'>" + esc(r.title || "") + "</span>"];
    }
  }

  // ── Detail panel ─────────────────────────────────────────────────────────
  function openDetail(item) {
    var cfg = TYPE_CFG[item.type] || { label: item.type || "?" };
    var html = "";

    html += "<div class='det-type'>" + esc(cfg.label) + "</div>";
    html += "<div class='det-title'>" + esc(item.title || "") + "</div>";

    function row(label, value) {
      if (value == null || value === "") return "";
      return "<div class='det-row'><span class='det-label'>" + label +
             "</span><span class='det-value'>" + value + "</span></div>";
    }

    switch (item.type) {
      case "movie":
        html += row("Year", item.year);
        html += row("Runtime", fmtRuntime(item.runtime_seconds));
        html += row("Genres", (item.genres || []).join(", "));
        html += row("Added", fmtDate(item.date_added));
        break;
      case "series":
        html += row("Year", item.year);
        html += row("Genres", (item.genres || []).join(", "));
        html += row("Added", fmtDate(item.date_added));
        break;
      case "episode":
        html += row("Series", esc(item.series_name || ""));
        html += row("Episode", epNum(item.season, item.episode));
        html += row("Year", item.year);
        html += row("Runtime", fmtRuntime(item.runtime_seconds));
        html += row("Added", fmtDate(item.date_added));
        break;
      case "audio":
        html += row("Artist", esc(item.artist || ""));
        html += row("Album", esc(item.album || ""));
        html += row("Track", item.track_number != null ? "#" + item.track_number : "");
        html += row("Year", item.year);
        html += row("Runtime", fmtRuntime(item.runtime_seconds));
        html += row("Genres", (item.genres || []).join(", "));
        break;
      case "music_album":
        html += row("Artist", esc(item.album_artist || ""));
        html += row("Year", item.year);
        html += row("Genres", (item.genres || []).join(", "));
        html += row("Added", fmtDate(item.date_added));
        break;
      case "music_artist":
        html += row("Added", fmtDate(item.date_added));
        break;
      case "book":
        html += row("Year", item.year);
        html += row("Genres", (item.genres || []).join(", "));
        html += row("Added", fmtDate(item.date_added));
        break;
      case "music_video":
        html += row("Artist", esc(item.artist || ""));
        html += row("Year", item.year);
        html += row("Runtime", fmtRuntime(item.runtime_seconds));
        html += row("Genres", (item.genres || []).join(", "));
        break;
      case "audiobook":
        html += row("Year", item.year);
        html += row("Runtime", fmtRuntime(item.runtime_seconds));
        html += row("Genres", (item.genres || []).join(", "));
        html += row("Added", fmtDate(item.date_added));
        break;
    }

    // external links
    var links = "";
    if (item.imdb_id) {
      links += "<a class='det-link' href='https://www.imdb.com/title/" + esc(item.imdb_id) +
               "/' target='_blank' rel='noopener'>IMDb</a>";
    }
    if (item.tmdb_id && (item.type === "movie" || item.type === "series")) {
      var tmdbPath = item.type === "movie" ? "movie" : "tv";
      links += "<a class='det-link' href='https://www.themoviedb.org/" + tmdbPath + "/" + esc(item.tmdb_id) +
               "' target='_blank' rel='noopener'>TMDb</a>";
    }
    if (item.tvdb_id) {
      links += "<a class='det-link' href='https://www.thetvdb.com/?id=" + esc(item.tvdb_id) +
               "&tab=series' target='_blank' rel='noopener'>TVDb</a>";
    }
    if (links) {
      html += "<hr class='det-divider'><div class='det-links'>" + links + "</div>";
    }

    els.detBody.innerHTML = html;
    els.overlay.hidden = false;
    document.body.style.overflow = "hidden";
  }

  document.getElementById("detail-close").addEventListener("click", closeDetail);
  els.overlay.addEventListener("click", function (e) {
    if (e.target === els.overlay) closeDetail();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !els.overlay.hidden) closeDetail();
  });

  function closeDetail() {
    els.overlay.hidden = true;
    document.body.style.overflow = "";
  }

  // ── Pagination ───────────────────────────────────────────────────────────
  function renderPagination(pages) {
    if (pages <= 1) { els.pag.innerHTML = ""; return; }

    var cur = state.page;
    var html = "";

    html += "<button class='pg-btn'" + (cur === 1 ? " disabled" : "") + " data-p='" + (cur - 1) + "'>&lsaquo;</button>";

    var lo = Math.max(1, cur - 2);
    var hi = Math.min(pages, cur + 2);
    if (lo > 1) { html += pgBtn(1); if (lo > 2) html += "<span style='color:var(--muted);padding:0 4px'>...</span>"; }
    for (var p = lo; p <= hi; p++) html += pgBtn(p);
    if (hi < pages) { if (hi < pages - 1) html += "<span style='color:var(--muted);padding:0 4px'>...</span>"; html += pgBtn(pages); }

    html += "<button class='pg-btn'" + (cur === pages ? " disabled" : "") + " data-p='" + (cur + 1) + "'>&rsaquo;</button>";

    els.pag.innerHTML = html;

    var btns = els.pag.querySelectorAll(".pg-btn[data-p]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function () {
        state.page = parseInt(this.dataset.p, 10);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function pgBtn(p) {
    var active = p === state.page ? " active" : "";
    return "<button class='pg-btn" + active + "' data-p='" + p + "'>" + p + "</button>";
  }

  // ── Sort ─────────────────────────────────────────────────────────────────
  function sortItems(arr, key) {
    return arr.sort(function (a, b) {
      switch (key) {
        case "date_desc": return (b.date_added || "").localeCompare(a.date_added || "");
        case "date_asc":  return (a.date_added || "").localeCompare(b.date_added || "");
        case "title_asc": return (a.title || "").localeCompare(b.title || "");
        case "title_desc":return (b.title || "").localeCompare(a.title || "");
        case "year_desc": return (b.year || 0) - (a.year || 0);
        case "year_asc":  return (a.year || 0) - (b.year || 0);
        default: return 0;
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c];
    });
  }

  function matches(val, q) {
    return val && String(val).toLowerCase().indexOf(q) !== -1;
  }

  function fmtRuntime(s) {
    if (!s) return "";
    var m = Math.round(s / 60);
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return h ? h + "h " + (mm ? mm + "m" : "") : mm + "m";
  }

  function epNum(s, e) {
    var out = "";
    if (s != null) out += "S" + String(s).padStart(2, "0");
    if (e != null) out += "E" + String(e).padStart(2, "0");
    return out;
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch (ex) { return iso; }
  }

  function genreTags(genres, max) {
    if (!genres || !genres.length) return "";
    return genres.slice(0, max).map(function (g) {
      return "<span class='genre-tag'>" + esc(g) + "</span>";
    }).join("");
  }

})();
