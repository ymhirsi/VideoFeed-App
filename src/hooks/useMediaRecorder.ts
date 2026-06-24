import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderPhase =
  | "idle"
  | "requesting"
  | "countdown"
  | "recording"
  | "error";

interface UseMediaRecorderOptions {
  maxSeconds: number;
  onComplete: (blob: Blob, mimeType: string) => void;
}

/** Choose the best supported recording container for this browser. */
function pickMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4", // Safari
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

/**
 * In-app demonstration recording: camera + mic, brief countdown, live preview,
 * soft length cap. The live MediaStream is exposed for preview; the finished
 * clip is handed back as a Blob.
 */
export function useMediaRecorder({
  maxSeconds,
  onComplete,
}: UseMediaRecorderOptions) {
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [countdown, setCountdown] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("");
  const timersRef = useRef<number[]>([]);
  const startedAtRef = useRef<number>(0);
  const elapsedRafRef = useRef<number | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (elapsedRafRef.current) cancelAnimationFrame(elapsedRafRef.current);
    elapsedRafRef.current = null;
  };

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    clearTimers();
    stopStream();
    recorderRef.current = null;
    chunksRef.current = [];
  }, [stopStream]);

  // Tear down on unmount.
  useEffect(() => () => cleanup(), [cleanup]);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    mimeRef.current = mimeType;
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = mimeRef.current || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      cleanup();
      setPhase("idle");
      setElapsedMs(0);
      setCountdown(0);
      if (blob.size > 0) onComplete(blob, type);
    };

    recorder.start();
    setPhase("recording");
    startedAtRef.current = performance.now();

    const tick = () => {
      const ms = performance.now() - startedAtRef.current;
      setElapsedMs(ms);
      if (ms >= maxSeconds * 1000) {
        recorder.state !== "inactive" && recorder.stop();
        return;
      }
      elapsedRafRef.current = requestAnimationFrame(tick);
    };
    elapsedRafRef.current = requestAnimationFrame(tick);
  }, [cleanup, maxSeconds, onComplete]);

  const start = useCallback(async () => {
    setError(null);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      // 3-2-1 countdown before recording starts.
      setPhase("countdown");
      setCountdown(3);
      let n = 3;
      const step = () => {
        n -= 1;
        if (n <= 0) {
          setCountdown(0);
          beginRecording();
        } else {
          setCountdown(n);
          timersRef.current.push(window.setTimeout(step, 1000));
        }
      };
      timersRef.current.push(window.setTimeout(step, 1000));
    } catch (err) {
      stopStream();
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera/microphone permission was denied."
          : "Couldn't access the camera or microphone."
      );
      setPhase("error");
    }
  }, [beginRecording, stopStream]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const cancel = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null as unknown as MediaRecorder["onstop"];
      rec.stop();
    }
    cleanup();
    setPhase("idle");
    setElapsedMs(0);
    setCountdown(0);
    setError(null);
  }, [cleanup]);

  return {
    phase,
    countdown,
    elapsedMs,
    error,
    stream: streamRef,
    start,
    stop,
    cancel,
  };
}
