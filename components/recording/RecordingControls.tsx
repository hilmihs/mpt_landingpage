"use client";

import { Button } from "@/components/ui/button";
import type { RecorderStatus } from "@/hooks/useAudioRecorder";
import { Mic, Pause, Play, Square, RotateCcw } from "lucide-react";

interface Props {
  status: RecorderStatus;
  durationSec: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function RecordingControls({
  status,
  durationSec,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
}: Props) {
  const showWarning = durationSec >= 270 && status === "recording";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`text-3xl font-mono tabular-nums ${
          showWarning ? "text-destructive" : ""
        }`}
        aria-live="polite"
      >
        {fmt(durationSec)} / 5:00
      </div>
      {showWarning && (
        <p className="text-xs text-destructive">
          Rekaman akan otomatis berhenti di 5:00
        </p>
      )}

      <div className="flex gap-2 flex-wrap justify-center">
        {(status === "idle" || status === "denied" || status === "error") && (
          <Button onClick={onStart} size="lg" className="min-h-11 min-w-32">
            <Mic className="size-4 mr-2" />
            Mulai Rekam
          </Button>
        )}
        {status === "recording" && (
          <>
            <Button onClick={onPause} variant="outline" size="lg" className="min-h-11">
              <Pause className="size-4 mr-2" />
              Jeda
            </Button>
            <Button onClick={onStop} variant="destructive" size="lg" className="min-h-11">
              <Square className="size-4 mr-2" />
              Selesai
            </Button>
          </>
        )}
        {status === "paused" && (
          <>
            <Button onClick={onResume} size="lg" className="min-h-11">
              <Play className="size-4 mr-2" />
              Lanjut
            </Button>
            <Button onClick={onStop} variant="destructive" size="lg" className="min-h-11">
              <Square className="size-4 mr-2" />
              Selesai
            </Button>
          </>
        )}
        {status === "stopped" && (
          <Button onClick={onReset} variant="outline" size="lg" className="min-h-11">
            <RotateCcw className="size-4 mr-2" />
            Rekam Ulang
          </Button>
        )}
      </div>
    </div>
  );
}
