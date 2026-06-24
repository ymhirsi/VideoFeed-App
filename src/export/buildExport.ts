import renderSource from "../lib/render.js?raw";
import runtimeSource from "./playerRuntime.js?raw";
import playerStyles from "./playerStyles.css?raw";
import type { Review } from "../types";
import { blobToDataURL } from "../lib/util";

export interface ExportProgress {
  (step: string): void;
}

/**
 * Fetch a same-document URL (a blob: object URL or the static /demo path) and
 * return it as a base64 data URL so it can be inlined into the exported file.
 */
async function urlToDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return blobToDataURL(blob);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "student"
  );
}

/**
 * Build a Review whose media (performance video + each demo clip) is inlined as
 * data URLs, ready to drop straight into a self-contained HTML file.
 */
async function inlineReview(review: Review, onProgress?: ExportProgress): Promise<Review> {
  onProgress?.("Inlining performance video…");
  const videoSrc = await urlToDataURL(review.videoSrc);

  const comments = [];
  for (let i = 0; i < review.comments.length; i++) {
    const c = review.comments[i];
    let demo = c.demo;
    if (demo) {
      onProgress?.(`Inlining demonstration ${i + 1}…`);
      demo = { ...demo, src: await urlToDataURL(demo.src) };
    }
    comments.push({ ...c, demo });
  }
  return { ...review, videoSrc, comments };
}

/**
 * Assemble the final self-contained HTML document.
 *
 * NOTE ON SIZE: the performance video and every demo clip are base64-inlined as
 * data URLs, which makes the .html large (~1.37x the raw media size). That is an
 * accepted tradeoff for this prototype's short demo video — it gives the student
 * a single file that opens offline with zero dependencies and no server. If file
 * size becomes a problem later, the fallback is a .zip (player + /media folder)
 * with the media referenced by relative path instead of inlined.
 */
function assembleHTML(inlined: Review): string {
  // Escape `<` so nothing in the data can prematurely close the module script.
  const reviewJson = JSON.stringify(inlined).replace(/</g, "\\u003c");
  const title = inlined.studentName
    ? `${inlined.studentName} — Performance Review`
    : "Performance Review — Solmido";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${title}</title>
<style>
${playerStyles}
</style>
</head>
<body>
<div id="app"></div>
<script type="module">
// --- shared annotation renderer (single source of truth) ---
${renderSource}

// --- review data with all media inlined as data URLs ---
const REVIEW = ${reviewJson};

// --- standalone Watch-mode runtime ---
${runtimeSource}
</script>
</body>
</html>`;
}

/** Produce and download the self-contained review player. */
export async function exportReview(
  review: Review,
  onProgress?: ExportProgress
): Promise<void> {
  const inlined = await inlineReview(review, onProgress);
  onProgress?.("Assembling player…");
  const html = assembleHTML(inlined);

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(review.studentName ?? "student")}-review.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  onProgress?.("Done");
}
