import { useState } from "react";
import { ReviewMode } from "./components/ReviewMode";
import { WatchMode } from "./components/WatchMode";
import { exportReview } from "./export/buildExport";
import { DEFAULT_VIDEO_SRC } from "./config";
import { uid } from "./lib/util";
import type { Review } from "./types";

type Mode = "review" | "watch";

/**
 * App shell. Owns the single serializable `Review` and switches between the two
 * experiences (teacher authoring / student playback) plus the export step. The
 * video source is injected from a single config point so Solmido can supply a
 * stored/uploaded video later without touching the UI.
 */
export default function App() {
  const [review, setReview] = useState<Review>(() => ({
    id: uid("r_"),
    videoSrc: DEFAULT_VIDEO_SRC,
    studentName: "",
    createdAt: Date.now(),
    comments: [],
  }));
  const [mode, setMode] = useState<Mode>("review");
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setExporting("Preparing…");
      await exportReview(review, (step) => setExporting(step));
    } catch (err) {
      console.error(err);
      setExporting(null);
      alert(
        "Export failed: " +
          (err instanceof Error ? err.message : "unknown error")
      );
      return;
    }
    setExporting(null);
  };

  const commentCount = review.comments.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__logo">Solmido</span>
          <span className="topbar__sep">/</span>
          <span className="topbar__page">Performance Review</span>
        </div>

        <div className="topbar__center">
          <div className="seg" role="tablist" aria-label="Mode">
            <button
              role="tab"
              aria-selected={mode === "review"}
              className={"seg__btn" + (mode === "review" ? " is-active" : "")}
              onClick={() => setMode("review")}
            >
              Review
            </button>
            <button
              role="tab"
              aria-selected={mode === "watch"}
              className={"seg__btn" + (mode === "watch" ? " is-active" : "")}
              onClick={() => setMode("watch")}
            >
              Watch
            </button>
          </div>
        </div>

        <div className="topbar__actions">
          <input
            className="topbar__name"
            placeholder="Student name"
            value={review.studentName ?? ""}
            onChange={(e) =>
              setReview((r) => ({ ...r, studentName: e.target.value }))
            }
            aria-label="Student name"
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleExport}
            disabled={commentCount === 0 || exporting !== null}
            title={
              commentCount === 0
                ? "Add a comment before exporting"
                : "Export the interactive review player"
            }
          >
            Export player
          </button>
        </div>
      </header>

      <main className="content">
        {mode === "review" ? (
          <ReviewMode review={review} onChange={setReview} />
        ) : (
          <WatchMode review={review} />
        )}
      </main>

      {exporting && (
        <div className="export-overlay" role="status" aria-live="polite">
          <div className="export-overlay__card">
            <div className="spinner" />
            <p className="export-overlay__step">{exporting}</p>
            <p className="export-overlay__hint">
              Inlining media into a single offline file — this can take a moment
              for large videos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
