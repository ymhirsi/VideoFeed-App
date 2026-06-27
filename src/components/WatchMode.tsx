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

/** Maximum number of comments rendered on the frame at the same moment. */
const MAX_ACTIVE = 5;

/** A seek-position jump larger than this counts as a "manual seek" and resets
 *  all per-comment runtime state. Natural rAF advance is ~16ms; loop seeks are
 *  flagged explicitly with `suppressSeekResetRef`. */
const SEEK_JUMP_MS = 500;

interface Runtime {
  /** Whether the comment is currently shown on the frame. */
  active: boolean;
  /**
   * For duration-kind: how many times we've already played the span (0 = none
   * yet; 1 = finished once; …). When `loopsCount >= repeat`, the comment is
   * done and won't re-activate until a manual seek resets state.
   * For pause-kind: 0 = not yet shown; 1 = already shown and consumed (via
   * Continue) so we don't re-fire on the next tick.
   */
  loopsCount: number;
}

function effectiveDurationMs(c: Comment): number {
  return c.playback?.kind === "pause" ? 0 : c.playback?.durationMs ?? 4000;
}
function effectiveRepeat(c: Comment): number {
  return c.playback?.kind === "pause" ? 1 : Math.max(1, c.playback?.repeat ?? 1);
}

/**
 * Student playback.
 *
 * Each comment carries its own playback behavior:
 *   - "pause"    holds the video at its timestamp until the student clicks
 *                Continue;
 *   - "duration" stays visible for a span [start, start+durationMs] while the
 *                video keeps playing; if `repeat > 1` the span is seeked back
 *                and replayed up to `repeat` times.
 *
 * Multiple comments can be active simultaneously, capped at MAX_ACTIVE.
 * Every active comment renders its on-frame label at its own position.
 * If ANY active comment is pause-kind the video pauses and the others stay
 * visible alongside it until Continue.
 */
export function WatchMode({ review }: WatchModeProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, controls] = useVideoPlayer(videoRef);

  const sorted = useMemo(
    () => [...review.comments].sort((a, b) => a.timestampMs - b.timestampMs),
    [review.comments]
  );

  // Per-comment playback runtime. Stored as a ref so the tick loop can mutate
  // without re-rendering, then surfaced to React via `setActiveIds`.
  const runtimeRef = useRef<Map<string, Runtime>>(new Map());
  const prevMsRef = useRef(0);
  // When we issue a seek to loop a span we don't want the same tick's
  // jump-detection to reset all runtime — flag it for one frame.
  const suppressSeekResetRef = useRef(false);

  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [demoForId, setDemoForId] = useState<string | null>(null);

  const sameIds = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);

  // --- Tick: drive activation / loop / pause based on current time ---
  const tick = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const cur = video.currentTime * 1000;
    const prev = prevMsRef.current;

    // Manual seek (jumped outside what a natural frame advance produces)
    // → reset all per-comment state so the new position recomputes fresh.
    if (
      !suppressSeekResetRef.current &&
      Math.abs(cur - prev) > SEEK_JUMP_MS
    ) {
      runtimeRef.current = new Map();
    }
    suppressSeekResetRef.current = false;

    const rt = runtimeRef.current;
    let activeCount = Array.from(rt.values()).filter((s) => s.active).length;
    let scheduledSeekMs: number | null = null;

    // 1) Activation pass — comments entering their span (capped at MAX_ACTIVE).
    for (const c of sorted) {
      let s = rt.get(c.id);
      if (!s) {
        s = { active: false, loopsCount: 0 };
        rt.set(c.id, s);
      }
      if (s.active) continue;
      if (cur < c.timestampMs) continue;
      const kind = c.playback?.kind ?? "duration";
      if (kind === "pause") {
        if (s.loopsCount === 0 && activeCount < MAX_ACTIVE) {
          s.active = true;
          activeCount++;
        }
      } else {
        const dur = effectiveDurationMs(c);
        const reps = effectiveRepeat(c);
        if (
          cur < c.timestampMs + dur &&
          s.loopsCount < reps &&
          activeCount < MAX_ACTIVE
        ) {
          s.active = true;
          activeCount++;
        }
      }
    }

    // 2) End-of-span pass — duration comments that have run out (loop or end).
    for (const c of sorted) {
      const s = rt.get(c.id);
      if (!s || !s.active) continue;
      const kind = c.playback?.kind ?? "duration";
      if (kind !== "duration") continue;
      const dur = effectiveDurationMs(c);
      const reps = effectiveRepeat(c);
      if (cur >= c.timestampMs + dur) {
        s.loopsCount += 1;
        if (s.loopsCount < reps && scheduledSeekMs === null) {
          // Loop this span: seek back to its start. We allow only one loop
          // seek per tick so two competing loops don't fight; the second
          // will land in its span on the next tick.
          scheduledSeekMs = c.timestampMs;
        } else {
          s.active = false;
          activeCount--;
        }
      }
    }

    // 3) If a pause comment is active, hold the video. Other active comments
    //    stay visible alongside it.
    const anyPause = sorted.some((c) => {
      const s = rt.get(c.id);
      return s?.active && (c.playback?.kind ?? "duration") === "pause";
    });
    if (anyPause && !video.paused) {
      video.pause();
    }

    // 4) Apply a loop seek if scheduled (skipped while a pause is holding).
    if (scheduledSeekMs !== null && !anyPause) {
      suppressSeekResetRef.current = true;
      video.currentTime = scheduledSeekMs / 1000;
      prevMsRef.current = scheduledSeekMs;
    } else {
      prevMsRef.current = cur;
    }

    // 5) Surface active ids (capped, sorted by start).
    const ids = sorted
      .filter((c) => rt.get(c.id)?.active)
      .slice(0, MAX_ACTIVE)
      .map((c) => c.id);
    setActiveIds((prevIds) => (sameIds(prevIds, ids) ? prevIds : ids));
  }, [sorted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // `timeupdate` is event-based and fires even when rAF is throttled.
    video.addEventListener("timeupdate", tick);
    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("timeupdate", tick);
    };
  }, [tick]);

  const activeComments = useMemo(
    () => activeIds.map((id) => sorted.find((c) => c.id === id)!).filter(Boolean),
    [activeIds, sorted]
  );
  const pauseComments = activeComments.filter(
    (c) => (c.playback?.kind ?? "duration") === "pause"
  );
  const heldByPause = pauseComments.length > 0;

  const continueFromPause = useCallback(() => {
    const rt = runtimeRef.current;
    for (const c of pauseComments) {
      const s = rt.get(c.id);
      if (s) {
        s.active = false;
        s.loopsCount = 1; // mark consumed so we don't re-fire on next tick
      }
    }
    setActiveIds((prev) => prev.filter((id) => !pauseComments.some((c) => c.id === id)));
    controls.play();
  }, [pauseComments, controls]);

  const jumpTo = useCallback(
    (c: Comment) => {
      // Manual jump from the side index: pause, seek, reset runtime so the
      // target comment will activate fresh on the next tick.
      controls.pause();
      runtimeRef.current = new Map();
      setActiveIds([]);
      setDemoForId(null);
      controls.seek(c.timestampMs);
      prevMsRef.current = c.timestampMs;
    },
    [controls]
  );

  // The annotation canvas renders the union of all active comments' shapes —
  // each shape is normalized 0–1, so they coexist correctly on the frame.
  const overlayShapes = useMemo(() => {
    if (demoForId) return [];
    return activeComments.flatMap((c) => c.annotation ?? []);
  }, [activeComments, demoForId]);

  const demoComment = demoForId
    ? sorted.find((c) => c.id === demoForId) ?? null
    : null;

  return (
    <div className="watch">
      <div className="watch__main">
        <div className="watch__stage-wrap">
          <VideoStage
            ref={videoRef}
            src={review.videoSrc}
            onVideoClick={() => (heldByPause ? undefined : controls.toggle())}
          >
            <AnnotationCanvas
              shapes={overlayShapes}
              onChange={() => {}}
              tool="arrow"
              color="#dc2626"
              strokeWidth={5}
              editable={false}
            />

            {!demoForId &&
              activeComments.map((c) =>
                c.textLabel && c.text ? (
                  <TextLabelOverlay
                    key={c.id}
                    text={c.text}
                    position={c.textLabel}
                    editable={false}
                  />
                ) : null
              )}

            {heldByPause && !demoForId && (
              <div className="watch__note">
                <div className="watch__note-card">
                  <span className="watch__note-ts">
                    {pauseComments
                      .map((c) => formatTime(c.timestampMs))
                      .join(" · ")}
                  </span>
                  {/* Comments with no on-frame label still need their text
                      visible somewhere while paused. */}
                  {pauseComments.some((c) => c.text && !c.textLabel) && (
                    <ul className="watch__note-list">
                      {pauseComments
                        .filter((c) => c.text && !c.textLabel)
                        .map((c) => (
                          <li key={c.id} className="watch__note-text">
                            {c.text}
                          </li>
                        ))}
                    </ul>
                  )}
                  <div className="watch__note-actions">
                    {/* Per-comment demo buttons for any active comment with a
                        demonstration (pause or duration alike). */}
                    {activeComments
                      .filter((c) => c.demo)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="btn btn--primary"
                          onClick={() => setDemoForId(c.id)}
                        >
                          ▶ Demonstration · {formatTime(c.timestampMs)}
                        </button>
                      ))}
                    <button type="button" className="btn" onClick={continueFromPause}>
                      Continue ▸
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* When duration-kind active comments have demos and there is no
                pause holding, surface a small button strip so the student can
                still launch their demos without losing the playthrough. */}
            {!heldByPause &&
              !demoForId &&
              activeComments.some((c) => c.demo) && (
                <div className="watch__demobar">
                  {activeComments
                    .filter((c) => c.demo)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="btn btn--primary watch__demobar-btn"
                        onClick={() => {
                          controls.pause();
                          setDemoForId(c.id);
                        }}
                      >
                        ▶ Demo · {formatTime(c.timestampMs)}
                      </button>
                    ))}
                </div>
              )}

            {demoComment?.demo && (
              <div className="watch__demo">
                <video
                  className="watch__demo-video"
                  src={demoComment.demo.src}
                  autoPlay
                  controls
                  playsInline
                  onEnded={() => setDemoForId(null)}
                />
                <button
                  type="button"
                  className="btn watch__demo-close"
                  onClick={() => setDemoForId(null)}
                >
                  Close demonstration
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
              active: activeIds.includes(c.id),
            }))}
            onSeek={(ms) => {
              runtimeRef.current = new Map();
              setActiveIds([]);
              setDemoForId(null);
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
                  className={
                    "windex__item" +
                    (activeIds.includes(c.id) ? " is-active" : "")
                  }
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
