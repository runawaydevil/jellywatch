// JellyWatch viewer. Vanilla JS, no build step.
// Fetches catalog.json, shows 20 most recent per type and a global search.

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const RECENT_COUNT = 20;

  const TYPE_CONFIG = {
    movie:        { label: "Filmes",       cols: ["Titulo", "Ano", "Duracao", "Generos", "Adicionado"] },
    series:       { label: "Series",       cols: ["Titulo", "Ano", "Generos", "Adicionado"] },
    episode:      { label: "Episodios",    cols: ["Serie", "Ep.", "Titulo", "Duracao", "Adicionado"] },
    audio:        { label: "Musicas",      cols: ["Titulo", "Artista", "Album", "Duracao", "Adicionado"] },
    music_album:  { label: "Albuns",       cols: ["Titulo", "Artista", "Ano", "Adicionado"] },
    music_artist: { label: "Artistas",     cols: ["Nome", "Adicionado"] },
    book:         { label: "Livros",       cols: ["Titulo", "Ano", "Generos", "Adicionado"] },
    music_video:  { label: "Music Videos", cols: ["Titulo", "Artista", "Ano", "Duracao", "Adicionado"] },
    audiobook:    { label: "Audiobooks",   cols: ["Titulo", "Ano", "Duracao", "Adicionado"] },
  };

  const TYPE_ORDER = ["movie", "series", "episode", "audio", "music_album",
                      "music_artist", "book", "music_video", "audiobook"];

  let allItems = [];

  fetch("catalog.json", { cache: "no-cache" })
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((data) => {
      allItems = Array.isArray(data.items) ? data.items : [];
      if (data.generated_at) {
        $("#meta").textContent = "Atualizado: " + fmtDate(data.generated_at);
      }
      if (data.counts) {
        const parts = Object.entries(data.counts)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => v + " " + (TYPE_CONFIG[k] ? TYPE_CONFIG[k].label : k));
        $("#summary").textContent = parts.join(" · ");
      }
      renderSections();
    })
    .catch((err) => {
      $("#content").innerHTML = '<p class="error">Erro ao carregar catalog.json: ' + esc(err.message) + "</p>";
    });

  $("#q").addEventListener("input", function () {
    const q = $("#q").value.trim();
    if (q) {
      renderSearch(q);
    } else {
      renderSections();
      $("#search-count").textContent = "";
    }
  });

  $("#q").addEventListener("keydown", function (e) {
    if (e.key === "Escape" && $("#q").value !== "") {
      $("#q").value = "";
      renderSections();
      $("#search-count").textContent = "";
      e.preventDefault();
    }
  });

  function renderSections() {
    const byType = {};
    for (const item of allItems) {
      const t = item.type || "unknown";
      if (!byType[t]) byType[t] = [];
      byType[t].push(item);
    }

    let html = "";
    for (const type of TYPE_ORDER) {
      const items = byType[type];
      if (!items || items.length === 0) continue;

      const sorted = items.slice().sort(function (a, b) {
        return (b.date_added || "").localeCompare(a.date_added || "");
      });
      const recent = sorted.slice(0, RECENT_COUNT);
      const config = TYPE_CONFIG[type] || { label: type };
      const subtitle = items.length > RECENT_COUNT
        ? recent.length + " mais recentes de " + items.length + " total"
        : items.length + " total";

      html += '<section class="media-section">';
      html += '<h2 class="section-title">' + esc(config.label) +
              ' <span class="section-count">' + esc(subtitle) + "</span></h2>";
      html += renderTypeTable(type, recent, config.cols);
      html += "</section>";
    }

    if (!html) {
      html = '<p class="empty">Nenhum item encontrado. Verifique se o plugin sincronizou.</p>';
    }

    $("#content").innerHTML = html;
  }

  function renderSearch(q) {
    const ql = q.toLowerCase();
    const filtered = allItems.filter(function (item) {
      return (item.title || "").toLowerCase().includes(ql) ||
             (item.artist || "").toLowerCase().includes(ql) ||
             (item.album || "").toLowerCase().includes(ql) ||
             (item.series_name || "").toLowerCase().includes(ql) ||
             (item.album_artist || "").toLowerCase().includes(ql);
    });

    let html = '<table class="media-table"><thead><tr>' +
      "<th>Tipo</th><th>Titulo</th><th>Info</th><th>Ano</th><th>Adicionado</th>" +
      "</tr></thead><tbody>";

    if (filtered.length === 0) {
      html += '<tr><td colspan="5" class="empty">Nenhum resultado para "' + esc(q) + '".</td></tr>';
    } else {
      for (const r of filtered) {
        html += renderSearchRow(r);
      }
    }
    html += "</tbody></table>";

    $("#content").innerHTML = html;
    $("#search-count").textContent = filtered.length + " de " + allItems.length;
  }

  function renderTypeTable(type, items, cols) {
    let thead = "<thead><tr>" + cols.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr></thead>";
    let rows = "";

    for (const r of items) {
      let cells = [];
      switch (type) {
        case "movie":
          cells = [esc(r.title), r.year != null ? r.year : "", fmtRuntime(r.runtime_seconds), esc((r.genres || []).join(", ")), fmtShortDate(r.date_added)];
          break;
        case "series":
          cells = [esc(r.title), r.year != null ? r.year : "", esc((r.genres || []).join(", ")), fmtShortDate(r.date_added)];
          break;
        case "episode":
          cells = [
            esc(r.series_name || ""),
            (r.season != null ? "S" + r.season : "") + (r.episode != null ? "E" + r.episode : ""),
            esc(r.title),
            fmtRuntime(r.runtime_seconds),
            fmtShortDate(r.date_added),
          ];
          break;
        case "audio":
          cells = [esc(r.title), esc(r.artist || ""), esc(r.album || ""), fmtRuntime(r.runtime_seconds), fmtShortDate(r.date_added)];
          break;
        case "music_album":
          cells = [esc(r.title), esc(r.album_artist || ""), r.year != null ? r.year : "", fmtShortDate(r.date_added)];
          break;
        case "music_artist":
          cells = [esc(r.title), fmtShortDate(r.date_added)];
          break;
        case "book":
          cells = [esc(r.title), r.year != null ? r.year : "", esc((r.genres || []).join(", ")), fmtShortDate(r.date_added)];
          break;
        case "music_video":
          cells = [esc(r.title), esc(r.artist || ""), r.year != null ? r.year : "", fmtRuntime(r.runtime_seconds), fmtShortDate(r.date_added)];
          break;
        case "audiobook":
          cells = [esc(r.title), r.year != null ? r.year : "", fmtRuntime(r.runtime_seconds), fmtShortDate(r.date_added)];
          break;
        default:
          cells = [esc(r.title || ""), fmtShortDate(r.date_added)];
      }
      rows += "<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    }

    return '<table class="media-table">' + thead + "<tbody>" + rows + "</tbody></table>";
  }

  function renderSearchRow(r) {
    const typeLabel = TYPE_CONFIG[r.type] ? TYPE_CONFIG[r.type].label : (r.type || "");
    let info = "";
    if (r.series_name) info = esc(r.series_name);
    else if (r.artist) info = esc(r.artist);
    else if (r.album_artist) info = esc(r.album_artist);
    else if (r.genres && r.genres.length) info = esc(r.genres[0]);
    return "<tr>" +
      '<td><span class="type-badge type-' + esc(r.type || "") + '">' + esc(typeLabel) + "</span></td>" +
      "<td>" + esc(r.title || "") + "</td>" +
      "<td>" + info + "</td>" +
      "<td>" + (r.year != null ? r.year : "") + "</td>" +
      "<td>" + fmtShortDate(r.date_added) + "</td>" +
      "</tr>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function fmtRuntime(s) {
    if (s == null || s === 0) return "";
    const m = Math.round(s / 60);
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? h + "h " + mm + "m" : mm + "m";
  }

  function fmtShortDate(iso) {
    if (!iso) return "";
    return iso.slice(0, 10);
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
    } catch (e) {
      return iso;
    }
  }
})();
