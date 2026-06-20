(function () {
  "use strict";

  var RECENT = 20;

  var TYPES = [
    { key: "movie",        label: "Filmes",       cols: ["Titulo","Ano","Duracao","Generos"] },
    { key: "series",       label: "Series",       cols: ["Titulo","Ano","Generos"] },
    { key: "episode",      label: "Episodios",    cols: ["Serie","Ep.","Titulo","Duracao"] },
    { key: "audio",        label: "Musicas",      cols: ["Titulo","Artista","Album","Duracao"] },
    { key: "music_album",  label: "Albums",       cols: ["Titulo","Artista","Ano"] },
    { key: "music_artist", label: "Artistas",     cols: ["Nome"] },
    { key: "book",         label: "Livros",       cols: ["Titulo","Ano","Generos"] },
    { key: "music_video",  label: "Music Videos", cols: ["Titulo","Artista","Ano","Duracao"] },
    { key: "audiobook",    label: "Audiobooks",   cols: ["Titulo","Ano","Duracao"] },
  ];

  var byType = {};
  var allItems = [];
  var qEl = document.getElementById("q");
  var mainEl = document.getElementById("main");
  var statsEl = document.getElementById("stats");
  var hintEl = document.getElementById("search-hint");
  var updEl = document.getElementById("updated");

  fetch("catalog.json", { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      allItems = Array.isArray(data.items) ? data.items : [];

      for (var i = 0; i < allItems.length; i++) {
        var t = allItems[i].type || "unknown";
        if (!byType[t]) byType[t] = [];
        byType[t].push(allItems[i]);
      }

      if (data.generated_at) {
        updEl.textContent = "atualizado " + fmtDate(data.generated_at);
      }

      if (data.counts) {
        var parts = [];
        var keys = Object.keys(data.counts);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (data.counts[key] > 0) {
            var cfg = typeConfig(key);
            parts.push(data.counts[key].toLocaleString() + " " + cfg.label.toLowerCase());
          }
        }
        statsEl.textContent = parts.join("  ·  ");
      }

      renderSections();
    })
    .catch(function (err) {
      document.getElementById("skeleton").style.display = "none";
      mainEl.innerHTML = "<div id='error'>Erro ao carregar catalog.json: " + esc(err.message) + "</div>";
    });

  var searchTimer;
  qEl.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      var q = qEl.value.trim();
      if (q) renderSearch(q);
      else { hintEl.textContent = ""; renderSections(); }
    }, 120);
  });

  qEl.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && qEl.value) {
      qEl.value = "";
      hintEl.textContent = "";
      renderSections();
    }
  });

  function renderSections() {
    var skeleton = document.getElementById("skeleton");
    if (skeleton) skeleton.style.display = "none";

    var html = "";
    for (var i = 0; i < TYPES.length; i++) {
      var t = TYPES[i];
      var items = byType[t.key];
      if (!items || !items.length) continue;

      var sorted = items.slice().sort(function (a, b) {
        return (b.date_added || "").localeCompare(a.date_added || "");
      });
      var recent = sorted.slice(0, RECENT);
      var countText = items.length > RECENT
        ? RECENT + " de " + items.length.toLocaleString()
        : items.length.toLocaleString();

      html += "<div class='section'>";
      html += "<div class='section-head'>";
      html += "<div class='section-dot'></div>";
      html += "<span class='section-title'>" + esc(t.label) + "</span>";
      html += "<span class='section-count'>" + countText + "</span>";
      html += "</div>";
      html += renderTable(t.key, recent, t.cols);
      html += "</div>";
    }

    if (!html) {
      html = "<div id='no-results'>Nenhum item encontrado.</div>";
    }

    mainEl.innerHTML = html;
  }

  function renderSearch(q) {
    var skeleton = document.getElementById("skeleton");
    if (skeleton) skeleton.style.display = "none";

    var ql = q.toLowerCase();
    var results = [];
    for (var i = 0; i < allItems.length; i++) {
      var r = allItems[i];
      if (
        matches(r.title, ql) ||
        matches(r.artist, ql) ||
        matches(r.album, ql) ||
        matches(r.series_name, ql) ||
        matches(r.album_artist, ql)
      ) results.push(r);
    }

    hintEl.textContent = results.length + " resultado" + (results.length !== 1 ? "s" : "");

    if (!results.length) {
      mainEl.innerHTML = "<div id='no-results'>Nenhum resultado para &ldquo;" + esc(q) + "&rdquo;</div>";
      return;
    }

    var rows = "";
    for (var j = 0; j < results.length; j++) {
      var item = results[j];
      var cfg = typeConfig(item.type);
      var info = item.series_name || item.artist || item.album_artist || (item.genres && item.genres[0]) || "";
      rows += "<tr>";
      rows += "<td><span class='type-chip chip-" + esc(item.type || "") + "'>" + esc(cfg.label) + "</span></td>";
      rows += "<td class='t-primary'>" + esc(item.title || "") + "</td>";
      rows += "<td class='t-muted'>" + esc(info) + "</td>";
      rows += "<td class='t-num'>" + (item.year != null ? item.year : "") + "</td>";
      rows += "</tr>";
    }

    mainEl.innerHTML =
      "<div class='section'>" +
      "<div class='section-head'><div class='section-dot'></div>" +
      "<span class='section-title'>Resultados</span></div>" +
      "<table class='tbl'><thead><tr>" +
      "<th>Tipo</th><th>Titulo</th><th>Info</th><th>Ano</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  function renderTable(type, items, cols) {
    var thead = "<thead><tr>" + cols.map(function (h) {
      return "<th>" + h + "</th>";
    }).join("") + "</tr></thead>";

    var rows = "";
    for (var i = 0; i < items.length; i++) {
      var r = items[i];
      var cells;
      switch (type) {
        case "movie":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-num'>" + (r.year != null ? r.year : "") + "</span>",
            "<span class='t-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
            "<span class='t-muted'>" + esc((r.genres || []).slice(0,2).join(", ")) + "</span>",
          ]; break;
        case "series":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-num'>" + (r.year != null ? r.year : "") + "</span>",
            "<span class='t-muted'>" + esc((r.genres || []).slice(0,2).join(", ")) + "</span>",
          ]; break;
        case "episode":
          cells = [
            "<span class='t-muted'>" + esc(r.series_name || "") + "</span>",
            "<span class='t-ep'>" + epNum(r.season, r.episode) + "</span>",
            "<span class='t-primary'>" + esc(r.title || "") + "</span>",
            "<span class='t-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
          ]; break;
        case "audio":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-muted'>" + esc(r.artist || "") + "</span>",
            "<span class='t-muted'>" + esc(r.album || "") + "</span>",
            "<span class='t-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
          ]; break;
        case "music_album":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-muted'>" + esc(r.album_artist || "") + "</span>",
            "<span class='t-num'>" + (r.year != null ? r.year : "") + "</span>",
          ]; break;
        case "music_artist":
          cells = ["<span class='t-primary'>" + esc(r.title) + "</span>"]; break;
        case "book":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-num'>" + (r.year != null ? r.year : "") + "</span>",
            "<span class='t-muted'>" + esc((r.genres || []).slice(0,2).join(", ")) + "</span>",
          ]; break;
        case "music_video":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-muted'>" + esc(r.artist || "") + "</span>",
            "<span class='t-num'>" + (r.year != null ? r.year : "") + "</span>",
            "<span class='t-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
          ]; break;
        case "audiobook":
          cells = [
            "<span class='t-primary'>" + esc(r.title) + "</span>",
            "<span class='t-num'>" + (r.year != null ? r.year : "") + "</span>",
            "<span class='t-muted'>" + fmtRuntime(r.runtime_seconds) + "</span>",
          ]; break;
        default:
          cells = ["<span class='t-primary'>" + esc(r.title || "") + "</span>"];
      }
      rows += "<tr>" + cells.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>";
    }

    return "<table class='tbl'>" + thead + "<tbody>" + rows + "</tbody></table>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"})[c];
    });
  }

  function matches(val, q) {
    return val && String(val).toLowerCase().indexOf(q) !== -1;
  }

  function typeConfig(key) {
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].key === key) return TYPES[i];
    }
    return { label: key || "?" };
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
    if (s != null) out += "S" + String(s).padStart(2,"0");
    if (e != null) out += "E" + String(e).padStart(2,"0");
    return out;
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    } catch(ex) { return iso; }
  }

})();
