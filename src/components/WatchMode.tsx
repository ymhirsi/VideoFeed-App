import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VideoStage } from "./VideoStage";
import { TransportControls } from "./TransportControls";
import { Timeline } from "./Timeline";
import { AnnotationCanvas } from "./AnnotationCanvas";
import { TextLabelOverlay } from "./TextLabelOverlay";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import { formatTime } from "../lib/util";
import type { Comment, Review } from "../types";

interface WatchModeProps {
  review: Review;
}

/**
 * Student playback. The performance plays with clean controls; when it reaches
 * a comment it auto-pauses, freezes the frame with the annotation on top, and
 * shows the note. A demonstration plays on demand and then playback resumes.
 * One thing at a time — text, annotation and demo never stack.
 */
export function WatchMode({ review }: WatchModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, controls] = useVideoPlayer(videoRef);
  const prevMsRef = useRef(0);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);

  const sorted = useMemo(
    () => [...review.comments].sort((a, b) => a.timestampMs - b.timestampMs),
    [review.comments]
  );
  const active = activeId ? sorted.find((c) => c.id === activeId) ?? null : null;

  // Auto-pause when playback crosses a comment's timestamp.
  useEffect(() => {
    const cur = state.currentMs;
    const prev = prevMsRef.current;
    if (state.playing && !activeId && !demoPlaying) {
      const hit = sorted.find((c) => prev < c.timestampMs && c.timestampMs <= cur);
      if (hit) {
        controls.pause();
        setActiveId(hit.id);
      }
    }
    prevMsRef.current = cur;
  }, [state.currentMs, state.playing, activeId, demoPlaying, sorted, controls]);

  const resume = useCallback(() => {
    setActiveId(null);
    setDemoPlaying(false);
    prevMsRef.current = state.currentMs;
    controls.play();
  }, [controls, state.currentMs]);

  const jumpTo = useCallback(
    (c: Comment) => {
      controls.pause();
      controls.seek(c.timestampMs);
      prevMsRef.current = c.timestampMs;
      setDemoPlaying(false);
      setActiveId(c.id);
    },
    [controls]
  );

  const overlayShapes = active && !demoPlaying ? active.annotation ?? [] : [];

  return (
    <div className="watch">
      <div className="watch__main">
        <div className="watch__stage-wrap">
          <VideoStage
            ref={videoRef}
            src={review.videoSrc}
            onVideoClick={() => (active ? undefined : controls.toggle())}
          >
            <AnnotationCanvas
              shapes={overlayShapes}
              onChange={() => {}}
              tool="arrow"
              color="#dc2626"
              strokeWidth={5}
              editable={false}
            />

            {active && !demoPlaying && active.textLabel && active.text && (
              <TextLabelOverlay
                text={active.text}
                position={active.textLabel}
                editable={false}
              />
            )}

            {active && !demoPlaying && (
              <div className="watch__note">
                <div className="watch__note-card">
                  <span className="watch__note-ts">{formatTime(active.timestampMs)}</span>
                  {/* If the comment has an on-frame label, the text already
                      lives on the frame — don't repeat it here. */}
                  {active.text && !active.textLabel && (
                    <p className="watch__note-text">{active.text}</p>
                  )}
                  <div className="watch__note-actions">
                    {active.demo && (
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setDemoPlaying(true)}
                      >
                        ▶ Watch demonstration
                      </button>
                    )}
                    <button type="button" className="btn" onClick={resume}>
                      Continue ▸
                    </button>
                  </div>
                </div>
              </div>
            )}

            {demoPlaying && active?.demo && (
              <div className="watch__demo">
                <video
                  className="watch__demo-video"
                  src={active.demo.src}
                  autoPlay
                  controls
                  playsInline
                  onEnded={resume}
                />
                <button type="button" className="btn watch__demo-close" onClick={resume}>
                  Close & continue
                </button>
              </div>
            )}
          </VideoStage>

          <Timeline
            currentMs={state.currentMs}
            durationMs={state.durationMs}
            markers={sorted.map((c) => ({
              id: c.id,
              timestampMs: c.timestampMs,
              active: c.id === activeId,
            }))}
            onSeek={(ms) => {
              setActiveId(null);
              prevMsRef.current = ms;
              controls.seek(ms);
            }}
            onMarkerClick={(id) => {
              const c = sorted.find((x) => x.id === id);
              if (c) jumpTo(c);
            }}
          />

          <div className="watch__transport">
            <TransportControls state={state} controls={controls} />
          </div>
        </div>
      </div>

      <aside className="watch__side">
        <div className="watch__side-head">
          <h2>Notes</h2>
          <span className="review__count">{sorted.length}</span>
        </div>
        {sorted.length === 0 ? (
          <p className="clist__muted watch__empty">This review has no comments.</p>
        ) : (
          <ul className="windex">
            {sorted.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={"windex__item" + (c.id === activeId ? " is-active" : "")}
                  onClick={() => jumpTo(c)}
                >
                  <span className="windex__num">{i + 1}</span>
                  <span className="windex__ts">{formatTime(c.timestampMs)}</span>
                  <span className="windex__text">
                    {c.text?.trim() || <em className="clist__muted">Annotation</em>}
                  </span>
                  <span className="windex__badges">
                    {(c.annotation?.length ?? 0) > 0 && <span className="dot dot--a" />}
                    {c.demo && <span className="dot dot--d" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
