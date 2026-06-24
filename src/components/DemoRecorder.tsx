import { useEffect, useRef, useState } from "react";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { MAX_DEMO_SECONDS } from "../config";
import { formatTime } from "../lib/util";

export interface DraftDemo {
  source: "recorded" | "uploaded";
  /** Present for freshly recorded/uploaded clips; absent when re-loaded from a saved comment. */
  blob?: Blob;
  url: string;
  mimeType: string;
}

interface DemoRecorderProps {
  demo: DraftDemo | null;
  onAttach: (demo: DraftDemo) => void;
  onRemove: () => void;
}

/** Records (camera+mic) or uploads a single demonstration clip for a comment. */
export function DemoRecorder({ demo, onAttach, onRemove }: DemoRecorderProps) {
  const [mode, setMode] = useState<"choose" | "recording">("choose");
  const previewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const recorder = useMediaRecorder({
    maxSeconds: MAX_DEMO_SECONDS,
    onComplete: (blob, mimeType) => {
      onAttach({
        source: "recorded",
        blob,
        url: URL.createObjectURL(blob),
        mimeType,
      });
      setMode("choose");
    },
  });

  // Bind the live camera stream to the preview element while it's active.
  useEffect(() => {
    const v = previewRef.current;
    if (!v) return;
    if (
      (recorder.phase === "countdown" || recorder.phase === "recording") &&
      recorder.stream.current
    ) {
      v.srcObject = recorder.stream.current;
      void v.play().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [recorder.phase, recorder.stream]);

  const startRecording = () => {
    setUploadError(null);
    setMode("recording");
    void recorder.start();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadError("Please choose a video file.");
      return;
    }
    setUploadError(null);
    onAttach({
      source: "uploaded",
      blob: file,
      url: URL.createObjectURL(file),
      mimeType: file.type,
    });
  };

  // --- Recording in progress ---
  if (mode === "recording") {
    return (
      <div className="demo demo--live">
        <div className="demo__stage">
          <video ref={previewRef} className="demo__preview" muted playsInline />
          {recorder.phase === "countdown" && (
            <div className="demo__countdown">{recorder.countdown}</div>
          )}
          {recorder.phase === "recording" && (
            <div className="demo__rec-badge">
              <span className="demo__rec-dot" />
              {formatTime(recorder.elapsedMs)} / {formatTime(MAX_DEMO_SECONDS * 1000)}
            </div>
          )}
          {recorder.phase === "requesting" && (
            <div className="demo__hint">Requesting camera…</div>
          )}
        </div>
        <div className="demo__actions">
          {recorder.phase === "recording" ? (
            <button type="button" className="btn btn--primary" onClick={recorder.stop}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={() => {
                recorder.cancel();
                setMode("choose");
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- A clip is attached: review with keep / re-record ---
  if (demo) {
    return (
      <div className="demo demo--attached">
        <video className="demo__preview" src={demo.url} controls playsInline />
        <div className="demo__actions">
          <span className="demo__tag">
            {demo.source === "recorded" ? "Recorded clip" : "Uploaded clip"}
          </span>
          <button type="button" className="btn btn--ghost" onClick={startRecording}>
            Re-record
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            Replace
          </button>
          <button type="button" className="btn btn--danger-ghost" onClick={onRemove}>
            Remove
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={handleUpload}
        />
      </div>
    );
  }

  // --- No clip yet: choose record or upload ---
  return (
    <div className="demo demo--empty">
      <button type="button" className="btn" onClick={startRecording}>
        ● Record demonstration
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => fileInputRef.current?.click()}
      >
        ↑ Upload clip
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={handleUpload}
      />
      {recorder.error && <p className="demo__error">{recorder.error}</p>}
      {uploadError && <p className="demo__error">{uploadError}</p>}
    </div>
  );
}
