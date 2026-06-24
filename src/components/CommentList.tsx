import type { Comment } from "../types";
import { formatTime } from "../lib/util";

interface CommentListProps {
  comments: Comment[];
  activeId: string | null;
  onSeek: (comment: Comment) => void;
  onEdit: (comment: Comment) => void;
  onDelete: (id: string) => void;
}

/** Chronological side list of comments with badges, seek, edit and delete. */
export function CommentList({
  comments,
  activeId,
  onSeek,
  onEdit,
  onDelete,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="clist clist--empty">
        <p>No comments yet.</p>
        <p className="clist__muted">
          Scrub to a moment and press <kbd>N</kbd> to add the first one.
        </p>
      </div>
    );
  }

  const sorted = [...comments].sort((a, b) => a.timestampMs - b.timestampMs);

  return (
    <ul className="clist">
      {sorted.map((c, i) => {
        const hasAnnotation = (c.annotation?.length ?? 0) > 0;
        const hasDemo = !!c.demo;
        return (
          <li
            key={c.id}
            className={"citem" + (c.id === activeId ? " citem--active" : "")}
          >
            <button
              type="button"
              className="citem__main"
              onClick={() => onSeek(c)}
              title="Jump to this moment"
            >
              <span className="citem__index">{i + 1}</span>
              <span className="citem__body">
                <span className="citem__ts">{formatTime(c.timestampMs)}</span>
                <span className="citem__text">
                  {c.text?.trim() || <em className="clist__muted">No text</em>}
                </span>
                <span className="citem__badges">
                  {hasAnnotation && <span className="badge">Annotation</span>}
                  {hasDemo && <span className="badge">Demo</span>}
                </span>
              </span>
            </button>
            <div className="citem__tools">
              <button
                type="button"
                className="citem__tool"
                onClick={() => onEdit(c)}
                aria-label="Edit comment"
              >
                Edit
              </button>
              <button
                type="button"
                className="citem__tool citem__tool--danger"
                onClick={() => onDelete(c.id)}
                aria-label="Delete comment"
              >
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
