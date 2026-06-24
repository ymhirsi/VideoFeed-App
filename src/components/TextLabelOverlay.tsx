import { useEffect, useRef, useState } from "react";
import { clamp } from "../lib/util";
import type { Point } from "../types";

interface TextLabelOverlayProps {
  /**
   * The canonical text value. The label READS from this and (when editing)
   * WRITES back through `onTextChange`, so editing on the frame updates every
   * other bound editor live.
   */
  text: string;
  /** Normalized 0–1 position of the label anchor (top-left). */
  position: Point;
  /** Read-only in Watch mode and the exported player. */
  editable: boolean;
  onTextChange?: (text: string) => void;
  onPositionChange?: (next: Point) => void;
  /** Remove the on-frame label without deleting the comment's text. */
  onHide?: () => void;
}

/**
 * Movable, re-editable text label rendered on top of the video frame.
 *
 * The label is bound to the comment's canonical `text` — it has NO local copy
 * of the text value. Edits made here flow back through `onTextChange`, so the
 * composer textarea and side list update simultaneously.
 *
 * Position is stored normalized 0–1 against the frame, identical to the
 * annotation-shape convention, so it scales at any display size and renders
 * in the same spot in Watch mode and the exported HTML.
 *
 * Pointer Events drive drag + tap-to-edit so mouse, touch and stylus all work.
 */
export function TextLabelOverlay({
  text,
  position,
  editable,
  onTextChange,
  onPositionChange,
  onHide,
}: TextLabelOverlayProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);

  // Drag state: track pointer offset from label origin so the grab point doesn't jump.
  const dragRef = useRef<{
    pointerId: number;
    parentRect: DOMRect;
    grabDx: number; // px from label left
    grabDy: number; // px from label top
    startX: number; // initial clientX (for moved threshold)
    startY: number; // initial clientY
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editing]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable || editing) return;
    if ((e.target as HTMLElement).closest(".tlabel__hide")) return; // let the hide button handle its own click
    const parent = wrapRef.current?.parentElement;
    const label = labelRef.current;
    if (!parent || !label) return;
    e.preventDefault();
    const parentRect = parent.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      parentRect,
      grabDx: e.clientX - labelRect.left,
      grabDy: e.clientY - labelRect.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.preventDefault();
    const { parentRect, grabDx, grabDy, startX, startY } = drag;
    // Mark as a real drag once the pointer has moved a few pixels so a quick
    // tap isn't mistaken for a drag (and so the double-click can win).
    if (!drag.moved && Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    const nx = clamp((e.clientX - parentRect.left - grabDx) / parentRect.width, 0, 1);
    const ny = clamp((e.clientY - parentRect.top - grabDy) / parentRect.height, 0, 1);
    onPositionChange?.({ x: nx, y: ny });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    (e.target as Element).releasePointerCapture?.(dragRef.current.pointerId);
    dragRef.current = null;
  };

  const beginEdit = () => {
    if (!editable) return;
    setEditing(true);
  };

  const finishEdit = () => {
    setEditing(false);
  };

  const left = `${position.x * 100}%`;
  const top = `${position.y * 100}%`;

  // Empty canonical text + editable → show a placeholder hint so the teacher
  // knows the label exists. In display/Watch mode an empty text shows nothing.
  const displayText = text || (editable ? "Tap to add label text…" : "");

  return (
    <div ref={wrapRef} className="tlabel-layer" aria-hidden={!editable}>
      <div
        ref={labelRef}
        className={
          "tlabel" +
          (editable ? " tlabel--editable" : "") +
          (editing ? " tlabel--editing" : "") +
          (!text && editable ? " tlabel--placeholder" : "")
        }
        style={{ left, top }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={beginEdit}
      >
        {editing ? (
          <textarea
            ref={inputRef}
            className="tlabel__input"
            value={text}
            onChange={(e) => onTextChange?.(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                finishEdit();
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                finishEdit();
              }
              e.stopPropagation();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            rows={Math.min(6, Math.max(1, text.split("\n").length))}
          />
        ) : (
          <span className="tlabel__text">{displayText}</span>
        )}

        {editable && !editing && (
          <button
            type="button"
            className="tlabel__hide"
            title="Hide label (keeps the comment text)"
            aria-label="Hide label from frame"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onHide?.();
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
