/**
 * Serializable, portable review data model.
 *
 * Everything a review needs lives in a single `Review` object so it can be
 * JSON-serialized today (export / localStorage) and persisted to Solmido's
 * backend later without reshaping. Nothing UI-specific lives in here.
 */

export interface Review {
  id: string;
  /** Demo file now (object URL / static path); an uploaded/stored video in Solmido. */
  videoSrc: string;
  /** Optional label used to name the exported file, e.g. "Jane Doe". */
  studentName?: string;
  createdAt: number;
  comments: Comment[];
}

export interface Comment {
  id: string;
  timestampMs: number;
  text?: string;
  /** Frame annotation; all coordinates normalized 0–1 relative to the video frame. */
  annotation?: AnnotationShape[];
  /** At most one demonstration clip per comment. */
  demo?: Demo;
}

export interface Demo {
  source: "recorded" | "uploaded";
  /** object URL during a session; rewritten to a data URL at export. */
  src: string;
  /** MIME type, kept so the exported <video> gets the right type hint. */
  mimeType?: string;
}

export type AnnotationTool = "arrow" | "circle" | "pen" | "text";

export interface AnnotationShape {
  tool: AnnotationTool;
  color: string;
  /** Stroke width relative to a 1000px-wide reference frame; scaled at draw time. */
  strokeWidth: number;
  /** Normalized 0–1 points. Semantics depend on tool (see lib/render). */
  points: Point[];
  /** Text content for the "text" tool. */
  label?: string;
}

export interface Point {
  x: number;
  y: number;
}
