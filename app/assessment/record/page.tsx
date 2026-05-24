"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { AudioVisualizer } from "@/components/recording/AudioVisualizer";
import { RecordingControls } from "@/components/recording/RecordingControls";
import { useAssessmentStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { AlFatihahDisplay } from "@/components/shared/AlFatihahDisplay";

export default function RecordPage() {
  const router = useRouter();
  const consent = useAssessmentStore((s) => s.consentGiven);
  const setAudio = useAssessmentStore((s) => s.setAudio);
  const {
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
  } = useAudioRecorder();

  useEffect(() => {
    if (!consent) router.replace("/assessment/consent");
  }, [consent, router]);

  const handleContinue = () => {
    if (!audioBlob) return;
    setAudio(audioBlob, durationSec);
    router.push("/assessment/form");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="text-center">
        <h1 className="text-2xl md:text-3xl font-bold">Rekam Bacaan Al-Fatihah</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Tarik napas, baca dengan tenang. Anda bisa rekam ulang jika perlu.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Surah Al-Fatihah</CardTitle>
        </CardHeader>
        <CardContent>
          <AlFatihahDisplay
            defaultShowLatin
            defaultShowTerjemahan={false}
          />
        </CardContent>
      </Card>

      {(status === "denied" || status === "error") && errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Tidak bisa mulai rekam</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-6 pt-6">
          <AudioVisualizer
            analyser={analyser}
            active={status === "recording"}
          />
          <RecordingControls
            status={status}
            durationSec={durationSec}
            onStart={start}
            onPause={pause}
            onResume={resume}
            onStop={stop}
            onReset={reset}
          />

          {status === "stopped" && audioUrl && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Pratinjau rekaman:</p>
              <audio src={audioUrl} controls className="w-full" />
              <Button
                onClick={handleContinue}
                size="lg"
                className="w-full min-h-12"
              >
                Lanjut ke Form
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
