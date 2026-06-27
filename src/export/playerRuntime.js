// @ts-nocheck
/**
 * Standalone Watch-mode runtime for the exported review player.
 *
 * Runs in a bare browser with no framework and no server. It is concatenated
 * into a single <script type="module"> after (a) the shared annotation renderer
 * (so `drawShapes` is in scope) and (b) `const REVIEW = {...}` with all media
 * already inlined as data URLs.
 *
 * Behaviour mirrors the in-app Watch mode:
 *   - On-frame labels render for every active comment at their stored 0–1
 *     position. Up to MAX_ACTIVE (5) comments can be active simultaneously.
 *   - Each comment carries its own `playback`:
 *       "pause"    — hold the video at its timestamp until the student clicks
 *                    Continue.
 *       "duration" — stay visible across [start, start+durationMs] while the
 *                    video keeps playing; if `repeat > 1`, seek back and play
 *                    the span again up to `repeat` times.
 *   - If any active comment is pause-kind, the video pauses and other active
 *     labels stay visible alongside it until Continue.
 */
(function () {
  var MAX_ACTIVE = 5;
  var SEEK_JUMP_MS = 500;

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
  function kindOf(c) {
    return (c.playback && c.playback.kind) || "duration";
  }
  function durationOf(c) {
    return kindOf(c) === "pause" ? 0 : (c.playback && c.playback.durationMs) || 4000;
  }
  function repeatOf(c) {
    return kindOf(c) === "pause" ? 1 : Math.max(1, (c.playback && c.playback.repeat) || 1);
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
    '        <div id="pv-labels" class="pv-labels"></div>',
    '        <div id="pv-note" class="pv-note" hidden></div>',
    '        <div id="pv-demobar" class="pv-demobar" hidden></div>',
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
  var labelsEl = el("pv-labels");
  var noteEl = el("pv-note");
  var demoBarEl = el("pv-demobar");
  var demoEl = el("pv-demo");

  video.src = review.videoSrc;

  // Per-comment runtime state. Same shape as WatchMode's runtimeRef.
  // { active: bool, loopsCount: int }
  var runtime = {};
  var prevMs = 0;
  var suppressSeekReset = false;
  var demoForId = null;
  var activeIds = [];
  var size = { w: 0, h: 0 };

  function getRt(id) {
    if (!runtime[id]) runtime[id] = { active: false, loopsCount: 0 };
    return runtime[id];
  }
  function resetRuntime() {
    runtime = {};
  }
  function commentById(id) {
    for (var i = 0; i < comments.length; i++)
      if (comments[i].id === id) return comments[i];
    return null;
  }
  function activeComments() {
    return activeIds.map(commentById).filter(Boolean);
  }
  function pauseActiveComments() {
    return activeComments().filter(function (c) {
      return kindOf(c) === "pause";
    });
  }

  // --- Annotation overlay ---
  function syncSize() {
    var r = canvas.parentElement.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    size = { w: r.width, h: r.height };
    var W = Math.max(1, Math.round(r.width * dpr));
    var H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    canvas.style.width = r.width + "px";
    canvas.style.height = r.height + "px";
  }
  function redraw() {
    syncSize();
    var dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    if (demoForId) {
      drawShapes(ctx, [], size.w, size.h);
      return;
    }
    // Union of all active comments' annotation shapes.
    var shapes = [];
    var acs = activeComments();
    for (var i = 0; i < acs.length; i++) {
      var a = acs[i].annotation || [];
      for (var j = 0; j < a.length; j++) shapes.push(a[j]);
    }
    drawShapes(ctx, shapes, size.w, size.h);
  }
  var ro = new ResizeObserver(redraw);
  ro.observe(canvas.parentElement);
  window.addEventListener("resize", redraw);
  video.addEventListener("loadedmetadata", redraw);

  // --- Render on-frame labels for all active comments ---
  function renderLabels() {
    labelsEl.innerHTML = "";
    if (demoForId) return;
    var acs = activeComments();
    for (var i = 0; i < acs.length; i++) {
      var c = acs[i];
      if (!c.text || !c.textLabel) continue;
      var node = document.createElement("div");
      node.className = "pv-label";
      node.style.left = c.textLabel.x * 100 + "%";
      node.style.top = c.textLabel.y * 100 + "%";
      node.textContent = c.text;
      labelsEl.appendChild(node);
    }
  }

  // --- Pause card (only visible while a pause-kind comment is holding) ---
  function renderNoteCard() {
    var paused = pauseActiveComments();
    if (paused.length === 0 || demoForId) {
      noteEl.hidden = true;
      noteEl.innerHTML = "";
      return;
    }
    var acs = activeComments();
    var withDemos = acs.filter(function (c) { return !!c.demo; });
    var pausedNoLabel = paused.filter(function (c) { return c.text && !c.textLabel; });

    var html = '<div class="pv-note-card">';
    html += '<span class="pv-note-ts">';
    html += paused.map(function (c) { return fmt(c.timestampMs); }).join(" · ");
    html += "</span>";
    if (pausedNoLabel.length > 0) {
      html += '<ul class="pv-note-list">';
      for (var i = 0; i < pausedNoLabel.length; i++) {
        html += '<li class="pv-note-text" data-i="' + i + '"></li>';
      }
      html += "</ul>";
    }
    html += '<div class="pv-note-actions">';
    for (var k = 0; k < withDemos.length; k++) {
      html +=
        '<button class="pv-btn pv-btn-primary" data-demo="' +
        withDemos[k].id +
        '">▶ Demonstration · ' +
        fmt(withDemos[k].timestampMs) +
        "</button>";
    }
    html += '<button id="pv-continue" class="pv-btn">Continue ▸</button>';
    html += "</div></div>";
    noteEl.innerHTML = html;

    if (pausedNoLabel.length > 0) {
      var items = noteEl.querySelectorAll(".pv-note-text");
      for (var n = 0; n < items.length; n++) {
        items[n].textContent = pausedNoLabel[n].text;
      }
    }
    noteEl.hidden = false;

    var btns = noteEl.querySelectorAll("[data-demo]");
    for (var b = 0; b < btns.length; b++) {
      (function (id) {
        btns[b].onclick = function () { openDemo(id); };
      })(btns[b].getAttribute("data-demo"));
    }
    el("pv-continue").onclick = continueFromPause;
  }

  // --- Demo bar (shown when active duration comments have demos and no pause) ---
  function renderDemoBar() {
    if (demoForId) { demoBarEl.hidden = true; demoBarEl.innerHTML = ""; return; }
    var paused = pauseActiveComments();
    if (paused.length > 0) { demoBarEl.hidden = true; demoBarEl.innerHTML = ""; return; }
    var withDemos = activeComments().filter(function (c) { return !!c.demo; });
    if (withDemos.length === 0) {
      demoBarEl.hidden = true;
      demoBarEl.innerHTML = "";
      return;
    }
    var html = "";
    for (var i = 0; i < withDemos.length; i++) {
      html +=
        '<button class="pv-btn pv-btn-primary pv-demobar-btn" data-demo="' +
        withDemos[i].id +
        '">▶ Demo · ' +
        fmt(withDemos[i].timestampMs) +
        "</button>";
    }
    demoBarEl.innerHTML = html;
    demoBarEl.hidden = false;
    var btns = demoBarEl.querySelectorAll("[data-demo]");
    for (var j = 0; j < btns.length; j++) {
      (function (id) {
        btns[j].onclick = function () {
          video.pause();
          openDemo(id);
        };
      })(btns[j].getAttribute("data-demo"));
    }
  }

  // --- Demo overlay (full-stage video for one comment's demo) ---
  function openDemo(id) {
    demoForId = id;
    var c = commentById(id);
    if (!c || !c.demo) { demoForId = null; return; }
    demoEl.innerHTML =
      '<video id="pv-demovid" class="pv-demo-video" autoplay controls playsinline></video>' +
      '<button id="pv-democlose" class="pv-btn pv-demo-close">Close demonstration</button>';
    demoEl.hidden = false;
    var dv = el("pv-demovid");
    dv.src = c.demo.src;
    dv.onended = closeDemo;
    el("pv-democlose").onclick = closeDemo;
    renderLabels();
    renderNoteCard();
    renderDemoBar();
    redraw();
  }
  function closeDemo() {
    demoForId = null;
    demoEl.hidden = true;
    demoEl.innerHTML = "";
    renderLabels();
    renderNoteCard();
    renderDemoBar();
    redraw();
  }

  // --- Continue (clear pause-kind active comments and resume video) ---
  function continueFromPause() {
    var paused = pauseActiveComments();
    for (var i = 0; i < paused.length; i++) {
      var s = getRt(paused[i].id);
      s.active = false;
      s.loopsCount = 1; // consumed → don't re-fire on next tick
    }
    activeIds = activeIds.filter(function (id) {
      return !paused.some(function (c) { return c.id === id; });
    });
    renderLabels();
    renderNoteCard();
    renderDemoBar();
    redraw();
    video.play().catch(function () {});
  }

  function refreshMarkers() {
    var marks = track.querySelectorAll(".pv-marker");
    for (var i = 0; i < marks.length; i++) {
      var id = marks[i].getAttribute("data-id");
      if (activeIds.indexOf(id) >= 0) marks[i].classList.add("is-active");
      else marks[i].classList.remove("is-active");
    }
  }

  function jumpTo(c) {
    video.pause();
    resetRuntime();
    activeIds = [];
    demoForId = null;
    suppressSeekReset = true;
    video.currentTime = c.timestampMs / 1000;
    prevMs = c.timestampMs;
    renderLabels();
    renderNoteCard();
    renderDemoBar();
    redraw();
    refreshMarkers();
  }

  // --- Tick: same span logic as WatchMode ---
  function tickPlayback() {
    var cur = video.currentTime * 1000;
    var prev = prevMs;

    if (!suppressSeekReset && Math.abs(cur - prev) > SEEK_JUMP_MS) {
      resetRuntime();
    }
    suppressSeekReset = false;

    var activeCount = 0;
    for (var k in runtime) if (runtime[k].active) activeCount++;
    var scheduledSeekMs = null;

    // Activation
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      var s = getRt(c.id);
      if (s.active) continue;
      if (cur < c.timestampMs) continue;
      var kind = kindOf(c);
      if (kind === "pause") {
        if (s.loopsCount === 0 && activeCount < MAX_ACTIVE) {
          s.active = true;
          activeCount++;
        }
      } else {
        var dur = durationOf(c);
        var reps = repeatOf(c);
        if (
          cur < c.timestampMs + dur &&
          s.loopsCount < reps &&
          activeCount < MAX_ACTIVE
        ) {
          s.active = true;
          activeCount++;
        }
      }
    }

    // End-of-span
    for (var j = 0; j < comments.length; j++) {
      var cc = comments[j];
      var st = getRt(cc.id);
      if (!st.active) continue;
      if (kindOf(cc) !== "duration") continue;
      var d = durationOf(cc);
      var r = repeatOf(cc);
      if (cur >= cc.timestampMs + d) {
        st.loopsCount += 1;
        if (st.loopsCount < r && scheduledSeekMs === null) {
          scheduledSeekMs = cc.timestampMs;
        } else {
          st.active = false;
          activeCount--;
        }
      }
    }

    var anyPause = pauseActiveComments().length > 0;
    var newActiveIds = [];
    var cap = 0;
    for (var p = 0; p < comments.length && cap < MAX_ACTIVE; p++) {
      var st2 = getRt(comments[p].id);
      if (st2.active) { newActiveIds.push(comments[p].id); cap++; }
    }
    var changed =
      newActiveIds.length !== activeIds.length ||
      newActiveIds.some(function (id, idx) { return activeIds[idx] !== id; });
    activeIds = newActiveIds;

    // After computing the active set, anyPause may have changed; recompute.
    anyPause = pauseActiveComments().length > 0;
    if (anyPause && !video.paused) {
      video.pause();
    }
    if (scheduledSeekMs !== null && !anyPause) {
      suppressSeekReset = true;
      video.currentTime = scheduledSeekMs / 1000;
      prevMs = scheduledSeekMs;
    } else {
      prevMs = cur;
    }

    if (changed) {
      renderLabels();
      renderNoteCard();
      renderDemoBar();
      redraw();
      refreshMarkers();
    } else if (anyPause) {
      // Make sure the card stays in sync if it wasn't initially rendered.
      if (noteEl.hidden) renderNoteCard();
    }
  }

  // --- Timeline ---
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
      var c = comments.filter(function (x) { return x.id === id; })[0];
      marks[i].style.left = clamp(c.timestampMs / dur, 0, 1) * 100 + "%";
    }
  }
  function seekFromClient(clientX) {
    var dur = video.duration * 1000;
    if (!isFinite(dur) || dur <= 0) return;
    var r = track.getBoundingClientRect();
    var ratio = clamp((clientX - r.left) / r.width, 0, 1);
    resetRuntime();
    activeIds = [];
    demoForId = null;
    video.currentTime = (ratio * dur) / 1000;
    prevMs = ratio * dur;
    renderLabels();
    renderNoteCard();
    renderDemoBar();
    redraw();
    refreshMarkers();
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
      li.querySelector(".pv-index-text").textContent = c.text ? c.text : "Annotation";
      li.querySelector("button").onclick = function () { jumpTo(c); };
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
  video.addEventListener("play", function () { playBtn.textContent = "❚❚"; });
  video.addEventListener("pause", function () { playBtn.textContent = "▶"; });
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

  function tick() {
    updateScrubber();
    tickPlayback();
  }

  video.addEventListener("timeupdate", tick);
  function raf() {
    tick();
    requestAnimationFrame(raf);
  }

  buildMarkers();
  buildIndex();
  requestAnimationFrame(raf);
})();
