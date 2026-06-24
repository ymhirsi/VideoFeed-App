// @ts-nocheck
/**
 * Standalone Watch-mode runtime for the exported review player.
 *
 * Runs in a bare browser with no framework and no server. It is concatenated
 * into a single <script type="module"> after (a) the shared annotation renderer
 * (so `drawShapes` is in scope) and (b) `const REVIEW = {...}` with all media
 * already inlined as data URLs. Behaviour mirrors the in-app Watch mode:
 * auto-pause at each comment, frozen frame + annotation overlay, calm note
 * panel, on-demand demonstration, and a comment index — one thing at a time.
 */
(function () {
  var review = REVIEW;
  var comments = (review.comments || [])
    .slice()
    .sort(function (a, b) {
      return a.timestampMs - b.timestampMs;
    });

  function fmt(ms) {
    if (!isFinite(ms) || ms < 0) ms = 0;
    var t = Math.floor(ms / 1000);
    var h = Math.floor(t / 3600);
    var m = Math.floor((t % 3600) / 60);
    var s = t % 60;
    var p = function (n) {
      return n < 10 ? "0" + n : "" + n;
    };
    return h > 0 ? h + ":" + p(m) + ":" + p(s) : m + ":" + p(s);
  }
  function clamp(n, a, b) {
    return Math.min(b, Math.max(a, n));
  }
  function el(id) {
    return document.getElementById(id);
  }

  var root = el("app");
  root.innerHTML = [
    '<div class="pv">',
    '  <header class="pv-top">',
    '    <div class="pv-brand">Solmido</div>',
    '    <div class="pv-subtitle">Performance review</div>',
    "  </header>",
    '  <div class="pv-body">',
    '    <div class="pv-main">',
    '      <div class="pv-stage">',
    '        <video id="pv-video" class="pv-video" playsinline preload="metadata"></video>',
    '        <canvas id="pv-canvas" class="pv-canvas"></canvas>',
    '        <div id="pv-note" class="pv-note" hidden></div>',
    '        <div id="pv-demo" class="pv-demo" hidden></div>',
    "      </div>",
    '      <div id="pv-track" class="pv-track">',
    '        <div id="pv-fill" class="pv-fill"></div>',
    '        <div id="pv-head" class="pv-head"></div>',
    "      </div>",
    '      <div class="pv-transport">',
    '        <button id="pv-play" class="pv-btn pv-btn-primary" aria-label="Play">▶</button>',
    '        <button id="pv-back" class="pv-btn" aria-label="Back 5 seconds">«5</button>',
    '        <button id="pv-fwd" class="pv-btn" aria-label="Forward 5 seconds">5»</button>',
    '        <div class="pv-time"><span id="pv-cur">0:00</span> / <span id="pv-dur">0:00</span></div>',
    "      </div>",
    "    </div>",
    '    <aside class="pv-side">',
    '      <div class="pv-side-head"><h2>Notes</h2><span id="pv-count" class="pv-count">0</span></div>',
    '      <ul id="pv-index" class="pv-index"></ul>',
    "    </aside>",
    "  </div>",
    "</div>",
  ].join("\n");

  var video = el("pv-video");
  var canvas = el("pv-canvas");
  var ctx = canvas.getContext("2d");
  var track = el("pv-track");
  var fill = el("pv-fill");
  var head = el("pv-head");
  var playBtn = el("pv-play");
  var noteEl = el("pv-note");
  var demoEl = el("pv-demo");

  video.src = review.videoSrc;

  var activeId = null;
  var demoPlaying = false;
  var prevMs = 0;
  var size = { w: 0, h: 0 };

  function activeComment() {
    if (!activeId) return null;
    for (var i = 0; i < comments.length; i++)
      if (comments[i].id === activeId) return comments[i];
    return null;
  }

  // --- Annotation overlay ---
  // Match the backing store to the displayed size. Done inside redraw (not only
  // via ResizeObserver) so the overlay is always correct even if RO is delayed.
  function syncSize() {
    var r = canvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    size = { w: r.width, h: r.height };
    var W = Math.max(1, Math.round(r.width * dpr));
    var H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W) canvas.width = W; // assignment also clears the bitmap
    if (canvas.height !== H) canvas.height = H;
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
  }
  function redraw() {
    syncSize();
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    var c = activeComment();
    var shapes = c && !demoPlaying ? c.annotation || [] : [];
    drawShapes(ctx, shapes, size.w, size.h);
  }
  var ro = new ResizeObserver(redraw);
  ro.observe(canvas.parentElement);
  window.addEventListener("resize", redraw);
  video.addEventListener("loadedmetadata", redraw);

  // --- Note / demo panels ---
  function renderPanels() {
    var c = activeComment();
    if (c && !demoPlaying) {
      var html =
        '<div class="pv-note-card">' +
        '<span class="pv-note-ts">' +
        fmt(c.timestampMs) +
        "</span>" +
        (c.text ? '<p class="pv-note-text"></p>' : "") +
        '<div class="pv-note-actions">' +
        (c.demo
          ? '<button id="pv-watch" class="pv-btn pv-btn-primary">▶ Watch demonstration</button>'
          : "") +
        '<button id="pv-continue" class="pv-btn">Continue ▸</button>' +
        "</div></div>";
      noteEl.innerHTML = html;
      if (c.text) noteEl.querySelector(".pv-note-text").textContent = c.text;
      noteEl.hidden = false;
      var w = el("pv-watch");
      if (w) w.onclick = function () {
        demoPlaying = true;
        renderPanels();
        redraw();
      };
      el("pv-continue").onclick = resume;
    } else {
      noteEl.hidden = true;
      noteEl.innerHTML = "";
    }

    if (c && c.demo && demoPlaying) {
      demoEl.innerHTML =
        '<video id="pv-demovid" class="pv-demo-video" autoplay controls playsinline></video>' +
        '<button id="pv-democlose" class="pv-btn pv-demo-close">Close & continue</button>';
      demoEl.hidden = false;
      var dv = el("pv-demovid");
      dv.src = c.demo.src;
      dv.onended = resume;
      el("pv-democlose").onclick = resume;
    } else {
      demoEl.hidden = true;
      demoEl.innerHTML = "";
    }
  }

  function setActive(id) {
    activeId = id;
    renderPanels();
    redraw();
    refreshMarkers();
  }

  function resume() {
    activeId = null;
    demoPlaying = false;
    prevMs = video.currentTime * 1000;
    renderPanels();
    redraw();
    refreshMarkers();
    video.play().catch(function () {});
  }

  function jumpTo(c) {
    video.pause();
    video.currentTime = c.timestampMs / 1000;
    prevMs = c.timestampMs;
    demoPlaying = false;
    setActive(c.id);
  }

  // --- Timeline ---
  function refreshMarkers() {
    var marks = track.querySelectorAll(".pv-marker");
    for (var i = 0; i < marks.length; i++) {
      var id = marks[i].getAttribute("data-id");
      if (id === activeId) marks[i].classList.add("is-active");
      else marks[i].classList.remove("is-active");
    }
  }
  function buildMarkers() {
    comments.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "pv-marker";
      b.setAttribute("data-id", c.id);
      b.title = "Jump to note";
      b.onclick = function (e) {
        e.stopPropagation();
        jumpTo(c);
      };
      track.appendChild(b);
    });
  }
  function positionMarkers() {
    var dur = video.duration * 1000;
    if (!isFinite(dur) || dur <= 0) return;
    var marks = track.querySelectorAll(".pv-marker");
    for (var i = 0; i < marks.length; i++) {
      var id = marks[i].getAttribute("data-id");
      var c = comments.filter(function (x) {
        return x.id === id;
      })[0];
      marks[i].style.left = clamp(c.timestampMs / dur, 0, 1) * 100 + "%";
    }
  }
  function seekFromClient(clientX) {
    var dur = video.duration * 1000;
    if (!isFinite(dur) || dur <= 0) return;
    var r = track.getBoundingClientRect();
    var ratio = clamp((clientX - r.left) / r.width, 0, 1);
    activeId = null;
    demoPlaying = false;
    renderPanels();
    redraw();
    video.currentTime = (ratio * dur) / 1000;
    prevMs = ratio * dur;
  }
  var dragging = false;
  track.addEventListener("pointerdown", function (e) {
    if (e.target.classList.contains("pv-marker")) return;
    dragging = true;
    track.setPointerCapture(e.pointerId);
    seekFromClient(e.clientX);
  });
  track.addEventListener("pointermove", function (e) {
    if (dragging) seekFromClient(e.clientX);
  });
  track.addEventListener("pointerup", function (e) {
    dragging = false;
    track.releasePointerCapture(e.pointerId);
  });

  // --- Comment index ---
  function buildIndex() {
    var ul = el("pv-index");
    el("pv-count").textContent = comments.length;
    if (comments.length === 0) {
      ul.innerHTML = '<li class="pv-muted">This review has no comments.</li>';
      return;
    }
    comments.forEach(function (c, i) {
      var li = document.createElement("li");
      var hasA = (c.annotation || []).length > 0;
      var hasD = !!c.demo;
      li.innerHTML =
        '<button class="pv-index-item" data-id="' +
        c.id +
        '">' +
        '<span class="pv-index-num">' +
        (i + 1) +
        "</span>" +
        '<span class="pv-index-ts">' +
        fmt(c.timestampMs) +
        "</span>" +
        '<span class="pv-index-text"></span>' +
        '<span class="pv-index-badges">' +
        (hasA ? '<span class="pv-dot pv-dot-a"></span>' : "") +
        (hasD ? '<span class="pv-dot pv-dot-d"></span>' : "") +
        "</span></button>";
      li.querySelector(".pv-index-text").textContent = c.text
        ? c.text
        : "Annotation";
      li.querySelector("button").onclick = function () {
        jumpTo(c);
      };
      ul.appendChild(li);
    });
  }

  // --- Transport ---
  playBtn.onclick = function () {
    if (video.paused) video.play().catch(function () {});
    else video.pause();
  };
  el("pv-back").onclick = function () {
    video.currentTime = Math.max(0, video.currentTime - 5);
    prevMs = video.currentTime * 1000;
  };
  el("pv-fwd").onclick = function () {
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    prevMs = video.currentTime * 1000;
  };
  video.addEventListener("play", function () {
    playBtn.textContent = "❚❚";
  });
  video.addEventListener("pause", function () {
    playBtn.textContent = "▶";
  });
  video.addEventListener("loadedmetadata", function () {
    el("pv-dur").textContent = fmt(video.duration * 1000);
    positionMarkers();
  });

  function updateScrubber() {
    var cur = video.currentTime * 1000;
    el("pv-cur").textContent = fmt(cur);
    var dur = video.duration * 1000;
    if (isFinite(dur) && dur > 0) {
      var p = clamp(cur / dur, 0, 1) * 100;
      fill.style.width = p + "%";
      head.style.left = p + "%";
    }
  }

  function checkCrossing() {
    var cur = video.currentTime * 1000;
    if (!video.paused && !activeId && !demoPlaying) {
      for (var i = 0; i < comments.length; i++) {
        var c = comments[i];
        if (prevMs < c.timestampMs && c.timestampMs <= cur) {
          video.pause();
          setActive(c.id);
          break;
        }
      }
    }
    prevMs = cur;
  }

  function tick() {
    updateScrubber();
    checkCrossing();
  }

  // Drive both from `timeupdate` (event-based, always fires during playback)
  // and rAF (smoother where available). Auto-pause is robust either way.
  video.addEventListener("timeupdate", tick);
  function raf() {
    tick();
    requestAnimationFrame(raf);
  }

  buildMarkers();
  buildIndex();
  renderPanels();
  requestAnimationFrame(raf);
})();
