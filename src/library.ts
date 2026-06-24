import type { CategoryKey } from "./types";

/**
 * Quick-comment library — professionally phrased presets the teacher can tap
 * into a comment. In this prototype they live in session state and are freely
 * editable (add / edit / remove); in Solmido they move to a per-teacher saved
 * library. The seed wording here is just the starting set, not fixed values.
 */

export interface LibraryPreset {
  id: string;
  /** Optional sub-group label inside a category (e.g. "Rhythm" inside Score-study). */
  group?: string;
  text: string;
}

export interface QuickLibrary {
  technique: LibraryPreset[];
  tempo: LibraryPreset[];
  "score-study": LibraryPreset[];
  enunciation: LibraryPreset[];
}

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  technique: "Technique",
  tempo: "Tempo",
  "score-study": "Score-study",
  enunciation: "Enunciation",
};

export const CATEGORY_HINTS: Record<CategoryKey, string> = {
  technique: "Posture, tension, balance",
  tempo: "Pacing and pulse",
  "score-study": "Accuracy to the printed page",
  enunciation: "Diction and text clarity",
};

let counter = 0;
const pid = () => `p_${Date.now().toString(36)}_${(counter++).toString(36)}`;

const p = (text: string, group?: string): LibraryPreset => ({
  id: pid(),
  text,
  group,
});

export const DEFAULT_LIBRARY: QuickLibrary = {
  technique: [
    p("Keep your shoulders relaxed and down."),
    p("Stand/sit tall — align your posture without stiffening."),
    p("Release the tension in your wrists and arms."),
    p("Watch your hand position — stay supported, don't collapse."),
    p("Let arm weight do the work instead of gripping."),
    p("Keep your neck and jaw free of tension."),
    p("Breathe naturally; don't lock up while you play."),
    p("Keep your motion efficient — no wasted movement."),
    p("Stay balanced and grounded."),
  ],
  tempo: [
    p("This passage is too slow."),
    p("This passage is too fast."),
    p("Don't slow down here."),
    p("Don't rush here."),
    p("Keep a steadier pulse."),
    p("Try some rubato here."),
  ],
  "score-study": [
    p("Check these pitches against the score.", "Notes"),
    p("Wrong note here — review the score.", "Notes"),
    p("Count carefully — the rhythm is uneven here.", "Rhythm"),
    p("Give this note its full value.", "Rhythm"),
    p("Subdivide to keep the rhythm precise.", "Rhythm"),
    p("Observe the articulation marked here (slur / staccato / accent).", "Articulation"),
    p("This should be connected, not detached.", "Articulation"),
    p("This should be detached, not connected.", "Articulation"),
    p("Follow the phrasing marked in the score.", "Expression"),
    p("Shape the phrase toward its high point.", "Expression"),
    p("Watch the dynamic marking here.", "Dynamics"),
    p("More contrast between the dynamic levels.", "Dynamics"),
    p("Bring out the crescendo / diminuendo.", "Dynamics"),
  ],
  enunciation: [
    p("Crisp, clear consonants."),
    p("Sustain on the vowel, not the consonant."),
    p("Open the vowel more."),
    p("Keep your vowel shapes consistent."),
    p("Place the final consonant precisely on the beat."),
    p("Don't swallow the word endings."),
    p("Watch your diction — the text isn't coming through."),
  ],
};

export function newPresetId(): string {
  return pid();
}
