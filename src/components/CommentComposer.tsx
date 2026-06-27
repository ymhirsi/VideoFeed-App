import { useRef } from "react";
import { DemoRecorder, type DraftDemo } from "./DemoRecorder";
import { QuickLibrary } from "./QuickLibrary";
import { formatTime } from "../lib/util";
import type { CategoryKey, Playback } from "../types";
import {
  CATEGORY_LABELS,
  type LibraryPreset,
  type QuickLibrary as QuickLibraryShape,
} from "../library";

interface CommentComposerProps {
  timestampMs: number;
  text: string;
  /** Functional setter so library inserts can stack without losing earlier taps. */
  setText: React.Dispatch<React.SetStateAction<string>>;
  demo: DraftDemo | null;
  onAttachDemo: (d: DraftDemo) => void;
  onRemoveDemo: () => void;
  annotationCount: number;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
  /** Active category tags accumulated as the teacher taps library presets. */
  categories: CategoryKey[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryKey[]>>;
  /** The teacher's editable library + the mode that gates Enunciation. */
  library: QuickLibraryShape;
  setLibrary: (next: QuickLibraryShape) => void;
  reviewMode: "instrument" | "voice";
  /** Per-comment playback behavior for Watch mode. */
  playback: Playback;
  setPlayback: React.Dispatch<React.SetStateAction<Playback>>;
}

/**
 * Fast comment entry: any combination of text, frame annotation and one demo
 * clip. The quick-comment library is rendered inline beneath the textarea —
 * always visible, never hidden behind a focus trigger. Preset taps stack
 * into the textarea so the teacher can keep, edit, or chain lines.
 */
export function CommentComposer({
  timestampMs,
  text,
  setText,
  demo,
  onAttachDemo,
  onRemoveDemo,
  annotationCount,
  onSave,
  onCancel,
  isEditing,
  categories,
  setCategories,
  library,
  setLibrary,
  reviewMode,
  playback,
  setPlayback,
}: CommentComposerProps) {
  const canSave =
    text.trim().length > 0 || annotationCount > 0 || demo !== null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleCategories: CategoryKey[] = [
    "technique",
    "tempo",
    "score-study",
    ...(reviewMode === "voice" ? (["enunciation"] as CategoryKey[]) : []),
  ];

  const insertPreset = (preset: LibraryPreset, category: CategoryKey) => {
    // Functional updates so two rapid preset taps stack instead of overwriting.
    setText((prev) => {
      const joiner =
        prev.length === 0
          ? ""
          : prev.endsWith("\n") || prev.endsWith(" ")
            ? ""
            : prev.endsWith(".") || prev.endsWith("!") || prev.endsWith("?")
              ? "\n"
              : " ";
      return prev + joiner + preset.text;
    });
    setCategories((prev) =>
      prev.includes(category) ? prev : [...prev, category],
    );
    // Focus the textarea so the teacher can keep editing without a second tap.
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <div className="composer">
      <div className="composer__head">
        <h2 className="composer__title">
          {isEditing ? "Edit comment" : "New comment"}
        </h2>
        <span className="composer__ts">@ {formatTime(timestampMs)}</span>
      </div>

      <textarea
        ref={textareaRef}
        className="composer__text"
        placeholder="Write a note for the student…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
      />

      {/* On-frame label is automatic — no show/hide toggle. Text appears as a
          draggable, re-editable label whenever there is text. */}
      <div className="composer__pb">
        <span className="composer__label">Playback in Watch mode</span>
        <label
          className={
            "composer__pb-opt" +
            (playback.kind === "duration" ? " is-active" : "")
          }
        >
          <input
            type="radio"
            name="composer-playback"
            checked={playback.kind === "duration"}
            onChange={() =>
              setPlayback((p) => ({
                kind: "duration",
                durationMs: p.durationMs ?? 4000,
                repeat: p.repeat ?? 1,
              }))
            }
          />
          <span className="composer__pb-opt-text">
            Show for
            <input
              type="number"
              min={1}
              max={60}
              step={1}
              className="composer__pb-num"
              disabled={playback.kind !== "duration"}
              value={Math.round((playback.durationMs ?? 4000) / 1000)}
              onChange={(e) => {
                const s = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                setPlayback((p) => ({ ...p, kind: "duration", durationMs: s * 1000 }));
              }}
            />
            s, repeat
            <input
              type="number"
              min={1}
              max={9}
              step={1}
              className="composer__pb-num"
              disabled={playback.kind !== "duration"}
              value={playback.repeat ?? 1}
              onChange={(e) => {
                const n = Math.max(1, Math.min(9, Number(e.target.value) || 1));
                setPlayback((p) => ({ ...p, kind: "duration", repeat: n }));
              }}
            />
            ×
          </span>
        </label>
        <label
          className={
            "composer__pb-opt" + (playback.kind === "pause" ? " is-active" : "")
          }
        >
          <input
            type="radio"
            name="composer-playback"
            checked={playback.kind === "pause"}
            onChange={() => setPlayback((p) => ({ ...p, kind: "pause" }))}
          />
          <span className="composer__pb-opt-text">Pause until continue</span>
        </label>
      </div>

      <QuickLibrary
        library={library}
        setLibrary={setLibrary}
        visible={visibleCategories}
        onInsert={insertPreset}
      />

      {categories.length > 0 && (
        <div className="composer__tags">
          {categories.map((c) => (
            <span key={c} className="ctag">
              {CATEGORY_LABELS[c]}
              <button
                type="button"
                className="ctag__x"
                aria-label={`Remove ${CATEGORY_LABELS[c]} tag`}
                onClick={() =>
                  setCategories(categories.filter((x) => x !== c))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="composer__row">
        <span className="composer__label">Frame annotation</span>
        <span className="composer__status">
          {annotationCount > 0
            ? `${annotationCount} mark${annotationCount > 1 ? "s" : ""} on frame`
            : "Draw on the paused frame above"}
        </span>
      </div>

      <div className="composer__demo">
        <span className="composer__label">Demonstration</span>
        <DemoRecorder
          demo={demo}
          onAttach={onAttachDemo}
          onRemove={onRemoveDemo}
        />
      </div>

      <div className="composer__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSave}
          disabled={!canSave}
          title={
            canSave
              ? "Save comment (Enter)"
              : "Add text, an annotation, or a demo"
          }
        >
          {isEditing ? "Save changes" : "Save comment"}
        </button>
      </div>
      {!canSave && (
        <p className="composer__hint">
          A comment needs at least one of: text, annotation, or demonstration.
        </p>
      )}
    </div>
  );
}
