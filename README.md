# Solmido — Video Performance Review

A client-side tool for music teachers to review a student's recorded performance by
leaving **time-coded comments** directly on the video. Each comment can carry any
combination of **text**, a **frame annotation** (arrow / circle / pen / text label),
and one **teacher demonstration clip** (recorded in-app or uploaded). The finished
review exports as a single self-contained `.html` file the student opens offline.

This is a standalone prototype that is designed to fold into Solmido later: the video
source and the review data are kept cleanly separable from the UI.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

> Node.js is required. If `node`/`npm` aren't found, install Node LTS (e.g.
> `winget install OpenJS.NodeJS.LTS`) and restart your shell.

Build a production bundle with `npm run build` (runs `tsc` + `vite build`).

## Three experiences

1. **Review** (teacher authoring) — custom player with scrub, frame-step, and a marker
   per comment. Press **N** to pin a comment at the current time, type a note, draw on
   the paused frame, and attach a demonstration.
2. **Watch** (student playback) — plays the performance; auto-pauses at each comment,
   freezes the frame with the annotation on top, shows the note, and offers
   "Watch demonstration" on demand. A comment index lets the student jump around.
3. **Export** — produces `student-name-review.html`: Watch mode with the video, demo
   clips, and review data all inlined as data URLs, so it runs offline with no server.

## Keyboard shortcuts (Review)

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `Space` | play / pause | `N` | new comment at current time |
| `←` / `→` | skip 5s (`Shift` = 1s) | `A` `C` `P` `T` | arrow / circle / pen / text |
| `,` / `.` | frame step (paused) | `Enter` / `Esc` | save / cancel comment |

## Swapping the video source

The performance video is `public/demo.mov` (the demo recording from the project root).
Change the single config point `DEFAULT_VIDEO_SRC` in [`src/config.ts`](src/config.ts) —
in Solmido this becomes an uploaded/stored video URL with no other UI changes.

## Project layout

```
src/
  types.ts                 # serializable Review / Comment / AnnotationShape
  config.ts                # video source + annotation palette (single config point)
  hooks/                   # useVideoPlayer, useMediaRecorder
  components/              # VideoStage, Timeline, AnnotationCanvas, ReviewMode, WatchMode, …
  lib/render.js            # shared annotation renderer (used by app AND export)
  export/                  # buildExport.ts + playerRuntime.js + playerStyles.css
```

## Out of scope (prototype)

Backend/persistence, auth, multi-video projects, real-time collaboration, and burned-in
MP4 rendering. The export is the interactive offline player only.

> **Note on export size:** the video and demo clips are base64-inlined, so the `.html`
> is large (~1.37× the raw media). That's an accepted tradeoff for the short demo video;
> the fallback if size becomes a problem is a `.zip` (player + `/media` folder).
