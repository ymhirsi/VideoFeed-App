import { useCallback, useRef } from "react";
import { clamp } from "../lib/util";

export interface TimelineMarker {
  id: string;
  timestampMs: number;
  active?: boolean;
}

interface TimelineProps {
  currentMs: number;
  durationMs: number;
  markers: TimelineMarker[];
  onSeek: (ms: number) => void;
  onMarkerClick?: (id: string) => void;
}

/** Scrub track with comment markers. Pointer-driven, so touch/stylus work. */
export function Timeline({
  currentMs,
  durationMs,
  markers,
  onSeek,
  onMarkerClick,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const pct = durationMs > 0 ? clamp(currentMs / durationMs, 0, 1) * 100 : 0;

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || durationMs <= 0) return;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      onSeek(ratio * durationMs);
    },
    [durationMs, onSeek]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    seekFromEvent(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (draggingRef.current) seekFromEvent(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="timeline">
      <div
        ref={trackRef}
        className="timeline__track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs)}
        aria-valuenow={Math.round(currentMs)}
        tabIndex={0}
      >
        <div className="timeline__fill" style={{ width: `${pct}%` }} />
        <div className="timeline__head" style={{ left: `${pct}%` }} />
        {markers.map((m) => {
          const left =
            durationMs > 0 ? clamp(m.timestampMs / durationMs, 0, 1) * 100 : 0;
          return (
            <button
              key={m.id}
              type="button"
              className={
                "timeline__marker" + (m.active ? " timeline__marker--active" : "")
              }
              style={{ left: `${left}%` }}
              title="Jump to comment"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onMarkerClick) onMarkerClick(m.id);
                else onSeek(m.timestampMs);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
