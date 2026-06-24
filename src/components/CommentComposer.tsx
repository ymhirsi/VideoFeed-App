import { DemoRecorder, type DraftDemo } from "./DemoRecorder";
import { formatTime } from "../lib/util";

interface CommentComposerProps {
  timestampMs: number;
  text: string;
  setText: (t: string) => void;
  demo: DraftDemo | null;
  onAttachDemo: (d: DraftDemo) => void;
  onRemoveDemo: () => void;
  annotationCount: number;
  onSave: () => void;
  onCancel: () => void;
  isEditing: boolean;
}

/**
 * Fast comment entry: any combination of text, frame annotation and one demo
 * clip. Annotation is drawn directly on the frame (toolbar + canvas on the
 * stage); this panel owns the text and demonstration, plus save/cancel.
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
}: CommentComposerProps) {
  const canSave = text.trim().length > 0 || annotationCount > 0 || demo !== null;

  return (
    <div className="composer">
      <div className="composer__head">
        <h2 className="composer__title">
          {isEditing ? "Edit comment" : "New comment"}
        </h2>
        <span className="composer__ts">@ {formatTime(timestampMs)}</span>
      </div>

      <textarea
        className="composer__text"
        placeholder="Write a note for the student…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
      />

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
        <DemoRecorder demo={demo} onAttach={onAttachDemo} onRemove={onRemoveDemo} />
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
          title={canSave ? "Save comment (Enter)" : "Add text, an annotation, or a demo"}
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
