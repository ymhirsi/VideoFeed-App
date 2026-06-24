import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/util";

/** Assumed frame duration for frame-stepping (HTML video exposes no exact frame API). */
const FRAME_SECONDS = 1 / 30;

export interface PlayerState {
  ready: boolean;
  playing: boolean;
  currentMs: number;
  durationMs: number;
}

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Seek to an absolute time in ms. */
  seek: (ms: number) => void;
  /** Skip relative seconds (negative = back). */
  skip: (seconds: number) => void;
  /** Step one frame while paused. dir = +1 forward, -1 back. */
  frameStep: (dir: number) => void;
}

/**
 * Drives an HTMLVideoElement through a ref and exposes its state + controls.
 * Uses rAF for a smooth current-time readout while playing, and falls back to
 * the element's own events otherwise.
 */
export function useVideoPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>
): [PlayerState, PlayerControls] {
  const [state, setState] = useState<PlayerState>({
    ready: false,
    playing: false,
    currentMs: 0,
    durationMs: 0,
  });
  const rafRef = useRef<number | null>(null);

  const sync = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setState((s) => ({
      ...s,
      currentMs: v.currentTime * 1000,
      durationMs: isFinite(v.duration) ? v.duration * 1000 : s.durationMs,
    }));
  }, [videoRef]);

  // rAF loop for smooth scrubber motion during playback.
  useEffect(() => {
    if (!state.playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const tick = () => {
      sync();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state.playing, sync]);

  // Wire element events.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () =>
      setState((s) => ({
        ...s,
        ready: true,
        durationMs: isFinite(v.duration) ? v.duration * 1000 : s.durationMs,
      }));
    const onPlay = () => setState((s) => ({ ...s, playing: true }));
    const onPause = () => setState((s) => ({ ...s, playing: false }));
    const onTime = () => sync();
    const onEnded = () => setState((s) => ({ ...s, playing: false }));

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("durationchange", onLoaded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeked", onTime);
    v.addEventListener("ended", onEnded);
    if (v.readyState >= 1) onLoaded();

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("durationchange", onLoaded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeked", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoRef, sync]);

  const play = useCallback(() => {
    void videoRef.current?.play().catch(() => {});
  }, [videoRef]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, [videoRef]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) play();
    else pause();
  }, [videoRef, play, pause]);

  const seek = useCallback(
    (ms: number) => {
      const v = videoRef.current;
      if (!v) return;
      const dur = isFinite(v.duration) ? v.duration : Infinity;
      v.currentTime = clamp(ms / 1000, 0, dur);
      sync();
    },
    [videoRef, sync]
  );

  const skip = useCallback(
    (seconds: number) => {
      const v = videoRef.current;
      if (!v) return;
      seek((v.currentTime + seconds) * 1000);
    },
    [videoRef, seek]
  );

  const frameStep = useCallback(
    (dir: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.pause();
      seek((v.currentTime + dir * FRAME_SECONDS) * 1000);
    },
    [videoRef, seek]
  );

  return [state, { play, pause, toggle, seek, skip, frameStep }];
}
