import { useCallback, useEffect, useRef, useState } from "react";
import { drawShapes, drawShape } from "../lib/render.js";
import type { AnnotationShape, AnnotationTool, Point } from "../types";
import { clamp } from "../lib/util";

interface AnnotationCanvasProps {
  shapes: AnnotationShape[];
  onChange: (shapes: AnnotationShape[]) => void;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  /** When false the canvas only renders existing shapes (no input). */
  editable: boolean;
}

interface PendingText {
  point: Point; // normalized
  cssLeft: number;
  cssTop: number;
}

/**
 * Overlay drawing surface. Uses Pointer Events so mouse, touch and stylus all
 * work. All committed coordinates are normalized 0–1 against the frame, so the
 * drawing scales with the video at any display size.
 */
export function AnnotationCanvas({
  shapes,
  onChange,
  tool,
  color,
  strokeWidth,
  editable,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<AnnotationShape | null>(null);
  const drawingRef = useRef(false);
  const [pendingText, setPendingText] = useState<PendingText | null>(null);
  const [textValue, setTextValue] = useState("");

  // Match the backing store to the displayed size. Done inside redraw (not only
  // via ResizeObserver) so the overlay is always correct even if RO is delayed.
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W) canvas.width = W; // assignment also clears the bitmap
    if (canvas.height !== H) canvas.height = H;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    drawShapes(ctx, shapes, w, h);
    if (draftRef.current) drawShape(ctx, draftRef.current, w, h);
  }, [shapes]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    window.addEventListener("resize", redraw);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", redraw);
    };
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw, shapes]);

  const toNorm = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    if (pendingText) return; // finish the text input first
    e.preventDefault();
    const p = toNorm(e);

    if (tool === "text") {
      const rect = wrapRef.current!.getBoundingClientRect();
      setPendingText({
        point: p,
        cssLeft: e.clientX - rect.left,
        cssTop: e.clientY - rect.top,
      });
      setTextValue("");
      return;
    }

    drawingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    draftRef.current = {
      tool,
      color,
      strokeWidth,
      points: [p, p],
    };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current || !draftRef.current) return;
    e.preventDefault();
    const p = toNorm(e);
    const draft = draftRef.current;
    if (draft.tool === "pen") {
      draft.points.push(p);
    } else {
      // arrow / circle: first point fixed, second tracks the pointer
      draft.points[1] = p;
    }
    redraw();
  };

  const finishStroke = () => {
    if (!drawingRef.current || !draftRef.current) return;
    drawingRef.current = false;
    const draft = draftRef.current;
    draftRef.current = null;
    // Discard degenerate (tap-with-no-drag) shapes.
    const [a, b] = [draft.points[0], draft.points[draft.points.length - 1]];
    const moved = Math.hypot(b.x - a.x, b.y - a.y) > 0.005 || draft.tool === "pen";
    if (moved) onChange([...shapes, draft]);
    redraw();
  };

  const commitText = () => {
    if (!pendingText) return;
    const value = textValue.trim();
    if (value) {
      onChange([
        ...shapes,
        {
          tool: "text",
          color,
          strokeWidth,
          points: [pendingText.point],
          label: value,
        },
      ]);
    }
    setPendingText(null);
    setTextValue("");
  };

  return (
    <div
      ref={wrapRef}
      className={"annot" + (editable ? " annot--editable" : "")}
      data-tool={tool}
    >
      <canvas
        ref={canvasRef}
        className="annot__canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
        style={{ pointerEvents: editable && !pendingText ? "auto" : "none" }}
      />
      {pendingText && (
        <input
          className="annot__text-input"
          style={{
            left: pendingText.cssLeft,
            top: pendingText.cssTop,
            color,
          }}
          autoFocus
          value={textValue}
          placeholder="Label…"
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitText();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setPendingText(null);
              setTextValue("");
            }
            e.stopPropagation();
          }}
          onBlur={commitText}
        />
      )}
    </div>
  );
}
