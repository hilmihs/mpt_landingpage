"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "denied"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

const MAX_DURATION_SEC = 300; // 5 menit

interface UseAudioRecorderResult {
  status: RecorderStatus;
  errorMessage: string | null;
  durationSec: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  analyser: AnalyserNode | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAnalyser(null);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = accumulatedRef.current + (now - startedAtRef.current) / 1000;
    setDurationSec(elapsed);
    if (elapsed >= MAX_DURATION_SEC) {
      stop();
    }
  }, []);

  const start = useCallback(async () => {
    setErrorMessage(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const mimeType =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setStatus("stopped");
        cleanup();
      };

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      source.connect(an);
      setAnalyser(an);

      accumulatedRef.current = 0;
      setDurationSec(0);
      startedAtRef.current = performance.now();
      timerRef.current = window.setInterval(tick, 100);

      recorder.start(250);
      setStatus("recording");
    } catch (err) {
      const e = err as Error;
      setErrorMessage(
        e.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Mohon izinkan akses mic di browser."
          : `Gagal mulai rekam: ${e.message}`,
      );
      setStatus(e.name === "NotAllowedError" ? "denied" : "error");
      cleanup();
    }
  }, [cleanup, tick]);

  const pause = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state !== "recording") return;
    r.pause();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    accumulatedRef.current += (performance.now() - startedAtRef.current) / 1000;
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (!r || r.state !== "paused") return;
    r.resume();
    startedAtRef.current = performance.now();
    timerRef.current = window.setInterval(tick, 100);
    setStatus("recording");
  }, [tick]);

  function stop() {
    const r = mediaRecorderRef.current;
    if (!r) return;
    if (r.state === "recording" || r.state === "paused") r.stop();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  const reset = useCallback(() => {
    cleanup();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationSec(0);
    setErrorMessage(null);
    setStatus("idle");
    accumulatedRef.current = 0;
    chunksRef.current = [];
  }, [audioUrl, cleanup]);

  return {
    status,
    errorMessage,
    durationSec,
    audioBlob,
    audioUrl,
    analyser,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
