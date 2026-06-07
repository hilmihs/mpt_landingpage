"use client";

import { useState } from "react";
import { Upload, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { ASY_SYURA_1_6 } from "@/lib/arabic";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { AudioVisualizer } from "@/components/recording/AudioVisualizer";
import { RecordingControls } from "@/components/recording/RecordingControls";

type UploadStatus = "idle" | "uploading" | "success" | "error";

interface Props {
  slug: string;
  onBack: () => void;
}

export function RecordingStep({ slug, onBack }: Props) {
  const recorder = useAudioRecorder();
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload() {
    if (!recorder.audioBlob) return;
    setUploadStatus("uploading");
    setUploadError(null);

    try {
      const form = new FormData();
      form.append("audio", recorder.audioBlob, "recording.webm");
      form.append("slug", slug);
      form.append("duration_sec", String(Math.round(recorder.durationSec)));

      const res = await fetch("/api/hits/upload-recording", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.message ?? "Gagal mengunggah rekaman.");
        setUploadStatus("error");
        return;
      }
      setUploadStatus("success");
    } catch {
      setUploadError("Terjadi kesalahan jaringan. Coba lagi.");
      setUploadStatus("error");
    }
  }

  if (uploadStatus === "success") {
    return (
      <div style={{ marginTop: 20 }}>
        <div
          className="card-mpt"
          style={{
            padding: "32px 24px",
            textAlign: "center",
            background: "color-mix(in oklab, var(--success), var(--surface) 92%)",
            borderColor: "color-mix(in oklab, var(--success), transparent 60%)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 16px",
              borderRadius: 14,
              background: "var(--success)",
              color: "white",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CheckCircle2 size={28} strokeWidth={2.4} />
          </div>
          <h2
            className="font-display"
            style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}
          >
            Rekaman Berhasil Dikirim!
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              lineHeight: 1.65,
              margin: "0 0 8px",
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Pengajar akan mendengarkan rekaman Anda dan menentukan kelas yang
            sesuai dengan kemampuan Anda.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              background: "color-mix(in oklab, var(--accent), transparent 88%)",
              color: "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
              marginTop: 8,
            }}
          >
            <Clock size={13} strokeWidth={2.4} />
            Estimasi review: 1×24 jam
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-mute)",
              marginTop: 14,
              lineHeight: 1.5,
            }}
          >
            Kami akan menghubungi Anda via WhatsApp setelah pengajar selesai
            mereview.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent)",
          fontSize: 13,
          cursor: "pointer",
          padding: 0,
          marginBottom: 14,
        }}
      >
        &larr; Ganti tingkat
      </button>

      <div className="card-mpt" style={{ padding: "22px 20px", marginBottom: 16 }}>
        <h2
          className="font-display"
          style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}
        >
          Rekam Bacaan Anda
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Untuk menentukan kelas HITS Lanjutan yang sesuai, silakan rekam
          bacaan <strong>Surat Asy-Syura (42) ayat 1–6</strong> di bawah ini.
          Bacalah dengan tenang dan sebaik mungkin.
        </p>
      </div>

      {/* Arabic text display */}
      <div
        className="card-mpt"
        dir="rtl"
        lang="ar"
        style={{
          padding: "24px 20px",
          marginBottom: 16,
          maxHeight: 360,
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 16,
            direction: "ltr",
            textAlign: "left",
          }}
        >
          Surat Asy-Syura (42) Ayat 1–6
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {ASY_SYURA_1_6.map((ayat) => (
            <div key={ayat.number}>
              <div
                style={{
                  fontSize: "clamp(22px, 5vw, 30px)",
                  fontFamily: "'Amiri', 'Scheherazade New', serif",
                  lineHeight: 2,
                  textAlign: "right",
                  color: "var(--ink)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "color-mix(in oklab, var(--accent), transparent 85%)",
                    color: "var(--accent)",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "system-ui, sans-serif",
                    marginLeft: 8,
                    direction: "ltr",
                  }}
                >
                  {ayat.number}
                </span>
                {ayat.arabic}
              </div>
              <div
                dir="ltr"
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  marginTop: 4,
                  fontStyle: "italic",
                  textAlign: "left",
                }}
              >
                {ayat.transliterasi}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recording UI */}
      <div className="card-mpt" style={{ padding: "24px 20px" }}>
        <AudioVisualizer
          analyser={recorder.analyser}
          active={recorder.status === "recording"}
        />

        <div style={{ marginTop: 16 }}>
          <RecordingControls
            status={recorder.status}
            durationSec={recorder.durationSec}
            onStart={recorder.start}
            onPause={recorder.pause}
            onResume={recorder.resume}
            onStop={recorder.stop}
            onReset={recorder.reset}
          />
        </div>

        {recorder.errorMessage && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "color-mix(in oklab, var(--danger), transparent 88%)",
              color: "var(--danger)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={14} strokeWidth={2.2} />
            {recorder.errorMessage}
          </div>
        )}

        {recorder.status === "stopped" && recorder.audioUrl && (
          <div style={{ marginTop: 16 }}>
            <audio
              controls
              src={recorder.audioUrl}
              style={{ width: "100%", borderRadius: 8 }}
            />

            {uploadError && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "color-mix(in oklab, var(--danger), transparent 88%)",
                  color: "var(--danger)",
                  fontSize: 13,
                }}
              >
                {uploadError}
              </div>
            )}

            <button
              className="btn-mpt btn-mpt-accent"
              onClick={handleUpload}
              disabled={uploadStatus === "uploading"}
              style={{
                width: "100%",
                minHeight: 48,
                fontSize: 15,
                fontWeight: 700,
                marginTop: 14,
                border: "none",
                cursor: uploadStatus === "uploading" ? "not-allowed" : "pointer",
                opacity: uploadStatus === "uploading" ? 0.6 : 1,
              }}
            >
              {uploadStatus === "uploading" ? (
                "Mengunggah..."
              ) : (
                <>
                  <Upload size={16} strokeWidth={2.4} />
                  Kirim Rekaman
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
