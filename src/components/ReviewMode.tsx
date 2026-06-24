import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoStage } from "./VideoStage";
import { TransportControls } from "./TransportControls";
import { Timeline } from "./Timeline";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { CommentComposer } from "./CommentComposer";
import { CommentList } from "./CommentList";
import { type DraftDemo } from "./DemoRecorder";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { ANNOTATION_COLORS, STROKE_WIDTHS } from "../config";
import { uid } from "../lib/util";
import type {
  AnnotationShape,
  AnnotationTool,
  Comment,
  Review,
} from "../types";

interface ReviewModeProps {
  review: Review;
  onChange: (review: Review) => void;
}

interface Composing {
  editingId: string | null;
  timestampMs: number;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function ReviewMode({ review, onChange }: ReviewModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, controls] = useVideoPlayer(videoRef);

  const [composing, setComposing] = useState<Composing | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftAnnotation, setDraftAnnotation] = useState<AnnotationShape[]>([]);
  const [draftDemo, setDraftDemo] = useState<DraftDemo | null>(null);

  const [tool, setTool] = useState<AnnotationTool>("arrow");
  const [color, setColor] = useState(ANNOTATION_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1]);

  const [activeId, setActiveId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...review.comments].sort((a, b) => a.timestampMs - b.timestampMs),
    [review.comments]
  );

  const activeComment = activeId
    ? review.comments.find((c) => c.id === activeId) ?? null
    : null;

  // Shapes shown on the frame: the live draft while composing, otherwise the
  // selected comment's annotation (read-only) for quick review.
  const displayShapes = composing
    ? draftAnnotation
    : activeComment?.annotation ?? [];

  const resetDraft = useCallback(() => {
    setDraftText("");
    setDraftAnnotation([]);
    setDraftDemo(null);
  }, []);

  const startNewComment = useCallback(() => {
    controls.pause();
    resetDraft();
    setComposing({ editingId: null, timestampMs: state.currentMs });
  }, [controls, resetDraft, state.currentMs]);

  const startEdit = useCallback(
    (c: Comment) => {
      controls.pause();
      controls.seek(c.timestampMs);
      setActiveId(c.id);
      setDraftText(c.text ?? "");
      setDraftAnnotation(c.annotation ? [...c.annotation] : []);
      setDraftDemo(
        c.demo
          ? { source: c.demo.source, url: c.demo.src, mimeType: c.demo.mimeType ?? "" }
          : null
      );
      setComposing({ editingId: c.id, timestampMs: c.timestampMs });
    },
    [controls]
  );

  const cancelComposing = useCallback(() => {
    setComposing(null);
    resetDraft();
  }, [resetDraft]);

  const saveComment = useCallback(() => {
    if (!composing) return;
    const hasSomething =
      draftText.trim().length > 0 ||
      draftAnnotation.length > 0 ||
      draftDemo !== null;
    if (!hasSomething) return;

    const demo = draftDemo
      ? {
          source: draftDemo.source,
          src: draftDemo.url,
          mimeType: draftDemo.mimeType,
        }
      : undefined;

    const base: Comment = {
      id: composing.editingId ?? uid("c_"),
      timestampMs: composing.timestampMs,
      text: draftText.trim() || undefined,
      annotation: draftAnnotation.length > 0 ? draftAnnotation : undefined,
      demo,
    };

    const comments = composing.editingId
      ? review.comments.map((c) => (c.id === composing.editingId ? base : c))
      : [...review.comments, base];

    onChange({ ...review, comments });
    setActiveId(base.id);
    setComposing(null);
    resetDraft();
  }, [composing, draftText, draftAnnotation, draftDemo, review, onChange, resetDraft]);

  const deleteComment = useCallback(
    (id: string) => {
      onChange({ ...review, comments: review.comments.filter((c) => c.id !== id) });
      if (activeId === id) setActiveId(null);
      if (composing?.editingId === id) cancelComposing();
    },
    [review, onChange, activeId, composing, cancelComposing]
  );

  const seekToComment = useCallback(
    (c: Comment) => {
      controls.pause();
      controls.seek(c.timestampMs);
      setActiveId(c.id);
    },
    [controls]
  );

  // Keyboard shortcuts (Review mode).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTyping(e.target);

      // Composing-only shortcuts.
      if (composing) {
        if (e.key === "Escape") {
          e.preventDefault();
          cancelComposing();
          return;
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          saveComment();
          return;
        }
        if (!typing) {
          const map: Record<string, AnnotationTool> = {
            a: "arrow",
            c: "circle",
            p: "pen",
            t: "text",
          };
          const t = map[e.key.toLowerCase()];
          if (t) {
            e.preventDefault();
            setTool(t);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            saveComment();
            return;
          }
        }
      }

      if (typing) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          controls.toggle();
          break;
        case "ArrowLeft":
          e.preventDefault();
          controls.skip(e.shiftKey ? -1 : -5);
          break;
        case "ArrowRight":
          e.preventDefault();
          controls.skip(e.shiftKey ? 1 : 5);
          break;
        case ",":
          e.preventDefault();
          controls.frameStep(-1);
          break;
        case ".":
          e.preventDefault();
          controls.frameStep(1);
          break;
        case "n":
        case "N":
          if (!composing) {
            e.preventDefault();
            startNewComment();
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [composing, controls, cancelComposing, saveComment, startNewComment]);

  const annotationEditable = composing !== null && !state.playing;

  return (
    <div className="review">
      <div className="review__main">
        <div className="review__stage-wrap">
          <VideoStage ref={videoRef} src={review.videoSrc}>
            <AnnotationCanvas
              shapes={displayShapes}
              onChange={setDraftAnnotation}
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              editable={annotationEditable}
            />
            {composing && state.playing && (
              <div className="stage__pausehint">Pause to annotate the frame</div>
            )}
          </VideoStage>

          {composing && (
            <AnnotationToolbar
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              strokeWidth={strokeWidth}
              setStrokeWidth={setStrokeWidth}
              onUndo={() => setDraftAnnotation((s) => s.slice(0, -1))}
              onClear={() => setDraftAnnotation([])}
              canUndo={draftAnnotation.length > 0}
            />
          )}

          <Timeline
            currentMs={state.currentMs}
            durationMs={state.durationMs}
            markers={sorted.map((c) => ({
              id: c.id,
              timestampMs: c.timestampMs,
              active: c.id === activeId,
            }))}
            onSeek={controls.seek}
            onMarkerClick={(id) => {
              const c = review.comments.find((x) => x.id === id);
              if (c) seekToComment(c);
            }}
          />

          <div className="review__transport">
            <TransportControls state={state} controls={controls} showFrameStep />
            {!composing && (
              <button
                type="button"
                className="btn btn--primary review__add"
                onClick={startNewComment}
              >
                + Comment <kbd>N</kbd>
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="review__side">
        {composing ? (
          <CommentComposer
            timestampMs={composing.timestampMs}
            text={draftText}
            setText={setDraftText}
            demo={draftDemo}
            onAttachDemo={setDraftDemo}
            onRemoveDemo={() => setDraftDemo(null)}
            annotationCount={draftAnnotation.length}
            onSave={saveComment}
            onCancel={cancelComposing}
            isEditing={composing.editingId !== null}
          />
        ) : (
          <>
            <div className="review__side-head">
              <h2>Comments</h2>
              <span className="review__count">{review.comments.length}</span>
            </div>
            <CommentList
              comments={review.comments}
              activeId={activeId}
              onSeek={seekToComment}
              onEdit={startEdit}
              onDelete={deleteComment}
            />
          </>
        )}
      </aside>
    </div>
  );
}
