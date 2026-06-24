import { forwardRef, type ReactNode } from "react";

interface VideoStageProps {
  src: string;
  /** Overlay layers (annotation canvas, frozen-frame panel) stacked over the video. */
  children?: ReactNode;
  onVideoClick?: () => void;
  muted?: boolean;
}

/**
 * The video frame and any overlay layers, kept in a single box so overlays
 * line up exactly with the rendered video. The video fills the box width;
 * height follows its aspect ratio, so the displayed rect equals the full frame
 * (no letterboxing) and normalized annotation coords map cleanly.
 */
export const VideoStage = forwardRef<HTMLVideoElement, VideoStageProps>(
  function VideoStage({ src, children, onVideoClick, muted }, ref) {
    return (
      <div className="stage">
        <video
          ref={ref}
          src={src}
          className="stage__video"
          playsInline
          muted={muted}
          onClick={onVideoClick}
          preload="metadata"
        />
        <div className="stage__overlay">{children}</div>
      </div>
    );
  }
);
