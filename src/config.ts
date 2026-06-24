/**
 * Single config point for the performance video source.
 *
 * In this prototype the "student performance" is the demo video sitting in the
 * main code folder (copied to /public/demo.mov and served statically). In
 * Solmido this becomes an uploaded/stored video URL — swap DEFAULT_VIDEO_SRC
 * (or pass a different `videoSrc` into the app) and nothing else changes.
 */
export const DEFAULT_VIDEO_SRC = "/demo.mov";

/** Soft cap for in-app demonstration recordings (keeps clips tight). */
export const MAX_DEMO_SECONDS = 60;

/** Restrained annotation palette — Solmido stone/black house style, not a rainbow. */
export const ANNOTATION_COLORS = [
  "#dc2626", // red — the default pointer color
  "#0a0a0a", // near-black
  "#2563eb", // blue
  "#16a34a", // green
  "#f5f5f4", // stone-100 (for marking on dark frames)
];

export const STROKE_WIDTHS = [3, 5, 8];

/** Reference frame width the stored strokeWidth is relative to (see render). */
export const STROKE_REFERENCE_WIDTH = 1000;
