import { formatTime } from "../lib/util";
import type { PlayerControls, PlayerState } from "../hooks/useVideoPlayer";

interface TransportControlsProps {
  state: PlayerState;
  controls: PlayerControls;
  /** Frame-step buttons are author-only; hide them in Watch mode. */
  showFrameStep?: boolean;
}

export function TransportControls({
  state,
  controls,
  showFrameStep,
}: TransportControlsProps) {
  const { playing, currentMs, durationMs } = state;
  return (
    <div className="transport">
      <button
        type="button"
        className="transport__btn transport__btn--primary"
        onClick={controls.toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        className="transport__btn"
        onClick={() => controls.skip(-5)}
        aria-label="Back 5 seconds"
      >
        <span className="transport__skip">5</span>
        <BackIcon />
      </button>
      <button
        type="button"
        className="transport__btn"
        onClick={() => controls.skip(5)}
        aria-label="Forward 5 seconds"
      >
        <ForwardIcon />
        <span className="transport__skip">5</span>
      </button>

      {showFrameStep && (
        <>
          <button
            type="button"
            className="transport__btn transport__btn--ghost"
            onClick={() => controls.frameStep(-1)}
            aria-label="Previous frame"
            title="Previous frame ( , )"
          >
            ‹|
          </button>
          <button
            type="button"
            className="transport__btn transport__btn--ghost"
            onClick={() => controls.frameStep(1)}
            aria-label="Next frame"
            title="Next frame ( . )"
          >
            |›
          </button>
        </>
      )}

      <div className="transport__time" aria-live="off">
        <span className="transport__time-current">{formatTime(currentMs)}</span>
        <span className="transport__time-sep">/</span>
        <span className="transport__time-total">{formatTime(durationMs)}</span>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
    </svg>
  );
}
function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M11 6L4 12l7 6M20 6l-7 6 7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M13 6l7 6-7 6M4 6l7 6-7 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
