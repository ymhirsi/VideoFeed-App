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
  /** Gates the Enunciation quick-comment category. Default is "instrument". */
  mode: "instrument" | "voice";
  createdAt: number;
  comments: Comment[];
}

/**
 * Quick-comment library category keys. Score-study has internal sub-groups
 * (Notes / Rhythm / Articulation / Expression / Dynamics) tagged under one
 * top-level category so Solmido can filter on it later.
 */
export type CategoryKey = "technique" | "tempo" | "score-study" | "enunciation";

export interface Comment {
  id: string;
  timestampMs: number;
  /**
   * Canonical comment text — the single source of truth. Every editor surface
   * (composer textarea, on-frame label, side list) reads and writes THIS value;
   * there are no independent copies.
   */
  text?: string;
  /**
   * Normalized 0–1 position of the on-frame label. The label renders whenever
   * `text` is non-empty — there is no separate show/hide flag. Position is
   * still draggable and re-editable; only its coordinates live in the model.
   */
  textLabel?: Point;
  /**
   * How this comment plays back in Watch mode. Defaults (when omitted) to
   * `{ kind: "duration", durationMs: 4000, repeat: 1 }` so legacy data
   * (saved before this field existed) still plays sensibly.
   */
  playback?: Playback;
  /** Frame annotation; all coordinates normalized 0–1 relative to the video frame. */
  annotation?: AnnotationShape[];
  /** At most one demonstration clip per comment. */
  demo?: Demo;
  /** Quick-comment categories whose presets the teacher tapped while composing. */
  categories?: CategoryKey[];
}

export type PlaybackKind = "pause" | "duration";

export interface Playback {
  kind: PlaybackKind;
  /**
   * For "duration": how long (ms) the comment stays visible while the video
   * keeps playing. Ignored for "pause" (which holds until the student
   * continues).
   */
  durationMs?: number;
  /**
   * For "duration": how many times to play the span. 1 = play once;
   * 2 = play, seek back, play again. Ignored for "pause".
   */
  repeat?: number;
}

export interface Demo {
  source: "recorded" | "uploaded";
  /** object URL during a session; rewritten to a data URL at export. */
  src: string;
  /** MIME type, kept so the exported <video> gets the right type hint. */
  mimeType?: string;
}

/**
 * Visual annotation tools. The on-frame text *label* is NOT an annotation —
 * it's a separate movable display surface bound to the comment's canonical
 * `text`. So the toolbar only offers shape tools.
 */
export type AnnotationTool = "arrow" | "circle" | "pen";

export interface AnnotationShape {
  tool: AnnotationTool;
  color: string;
  /** Stroke width relative to a 1000px-wide reference frame; scaled at draw time. */
  strokeWidth: number;
  /** Normalized 0–1 points. Semantics depend on tool (see lib/render). */
  points: Point[];
}

export interface Point {
  x: number;
  y: number;
}
