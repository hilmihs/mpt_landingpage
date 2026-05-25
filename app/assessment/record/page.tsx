"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAssessmentStore } from "@/lib/store";
import { AL_FATIHAH } from "@/lib/arabic";

function fmt(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

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
    start,
    pause,
    resume,
    stop,
    reset,
  } = useAudioRecorder();
  const [showTr, setShowTr] = useState(false);

  useEffect(() => {
    if (!consent) router.replace("/assessment/consent");
  }, [consent, router]);

  const handleContinue = () => {
    if (!audioBlob) return;
    setAudio(audioBlob, durationSec);
    router.push("/assessment/form");
  };

  const seeds = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const h = 0.3 + Math.abs(Math.sin(i * 0.4) * 0.5) + ((i * 37) % 30) / 100;
        const delay = (i * 0.03) % 1.4;
        const duration = 1.2 + ((i * 53) % 80) / 100;
        return {
          height: `${(h * 100).toFixed(2)}%`,
          delay: `${delay.toFixed(2)}s`,
          duration: `${duration.toFixed(2)}s`,
        };
      }),
    [],
  );

  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isStopped = status === "stopped";
  const isErrored = status === "denied" || status === "error";

  return (
    <div
      className="screen-enter"
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(28px, 4.5vw, 44px)",
            margin: "0 0 10px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          Rekam Bacaan{" "}
          <span style={{ color: "var(--accent-deep)" }}>Al-Fatihah</span>
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--ink-soft)",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Tarik napas. Baca dengan tenang. Anda bisa rekam ulang jika perlu.
        </p>
      </div>

      {/* Al-Fatihah panel */}
      <div
        className="card-mpt"
        style={{ padding: "20px 22px", marginBottom: 24 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            gap: 8,
          }}
        >
          <span
            className="pill"
            style={{
              background:
                "color-mix(in oklab, var(--primary), transparent 90%)",
              color: "var(--primary)",
            }}
          >
            Surah Al-Fatihah
          </span>
          <button
            type="button"
            onClick={() => setShowTr((s) => !s)}
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--ink-soft)",
              cursor: "pointer",
              textTransform: "uppercase",
              fontFamily: "var(--font-nunito), system-ui, sans-serif",
            }}
            aria-pressed={showTr}
          >
            {showTr ? "Sembunyikan" : "Terjemahan"}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxHeight: 300,
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
          {AL_FATIHAH.map((a) => (
            <div
              key={a.number}
              style={{
                display: "flex",
                gap: 12,
                paddingBottom: 12,
                borderBottom:
                  a.number < 7 ? "1px solid var(--line)" : "none",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "var(--bg-deep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--ink-soft)",
                }}
              >
                {a.number}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  dir="rtl"
                  className="font-arabic"
                  style={{
                    fontSize: 22,
                    lineHeight: 1.9,
                    color: "var(--ink)",
                    textAlign: "right",
                  }}
                >
                  {a.arabic}
                </div>
                {showTr && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ink-mute)",
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {a.terjemahan}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isErrored && errorMessage && (
        <div
          className="card-mpt"
          style={{
            padding: "14px 18px",
            marginBottom: 18,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            background:
              "color-mix(in oklab, var(--danger), transparent 90%)",
            border:
              "1px solid color-mix(in oklab, var(--danger), transparent 70%)",
          }}
          role="alert"
        >
          <AlertTriangle
            className="size-5"
            style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                color: "var(--danger)",
                marginBottom: 2,
              }}
            >
              Tidak bisa mulai rekam
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
              {errorMessage}
            </div>
          </div>
        </div>
      )}

      {/* Recorder card */}
      <div
        className="card-mpt"
        style={{
          padding: "28px 20px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Idle */}
        {(status === "idle" || status === "requesting") && (
          <>
            <button
              type="button"
              onClick={start}
              disabled={status === "requesting"}
              className="mic-button-big"
              style={{
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "var(--primary)",
                color: "var(--primary-ink)",
                border: "none",
                cursor: status === "requesting" ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 24px 50px -20px rgba(26,31,42,0.5)",
                transition: "transform 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <svg
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="3" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </button>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              {status === "requesting"
                ? "Meminta akses mikrofon..."
                : "Tekan untuk mulai merekam"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>
              Maksimal 5 menit · Izinkan akses mikrofon
            </div>
          </>
        )}

        {/* Recording / Paused */}
        {(isRecording || isPaused) && (
          <>
            <div className="status-pill" style={{ marginBottom: 18 }}>
              <span className="dot" />
              {isRecording ? "MEREKAM" : "DIJEDA"}
            </div>

            <div
              className="mic-ring-container"
              style={{
                position: "relative",
                width: 180,
                height: 180,
                margin: "0 auto 18px",
              }}
            >
              {isRecording &&
                [0, 0.7, 1.4].map((d, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      inset: 24,
                      borderRadius: "50%",
                      border: "1.5px solid var(--primary)",
                      animation: `pulse-ring 3.2s cubic-bezier(0.16,1,0.3,1) ${d}s infinite`,
                      opacity: 0,
                    }}
                  />
                ))}
              <div
                style={{
                  position: "absolute",
                  inset: 36,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 20px 40px -20px rgba(26,31,42,0.5)",
                  animation: isRecording
                    ? "float 3s ease-in-out infinite"
                    : "none",
                }}
              >
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary-ink)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </div>
            </div>

            <div
              className="font-display"
              style={{
                fontSize: 56,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginBottom: 6,
              }}
            >
              {fmt(durationSec)}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                marginBottom: 22,
              }}
            >
              Maksimal 5:00
            </div>

            {isRecording && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  height: 60,
                  margin: "0 auto 22px",
                  maxWidth: 420,
                }}
              >
                {seeds.map((s, i) => (
                  <div
                    key={i}
                    className="wave-bar"
                    style={{
                      height: s.height,
                      animationDelay: s.delay,
                      animationDuration: s.duration,
                    }}
                  />
                ))}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                maxWidth: 420,
                margin: "0 auto",
                flexWrap: "wrap",
              }}
            >
              {isRecording ? (
                <button
                  type="button"
                  className="btn-mpt btn-mpt-outline"
                  onClick={pause}
                  style={{ flex: 1, minHeight: 52, minWidth: 130 }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Jeda
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-mpt btn-mpt-outline"
                  onClick={resume}
                  style={{ flex: 1, minHeight: 52, minWidth: 130 }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Lanjutkan
                </button>
              )}
              <button
                type="button"
                className="btn-mpt btn-mpt-danger"
                onClick={stop}
                style={{ flex: 1.3, minHeight: 52, minWidth: 140 }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
                Selesai
              </button>
            </div>
          </>
        )}

        {/* Stopped */}
        {isStopped && (
          <>
            <div
              className="pill"
              style={{
                background:
                  "color-mix(in oklab, var(--success), transparent 80%)",
                color: "var(--success)",
                marginBottom: 14,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Rekaman selesai
            </div>
            <h3
              className="font-display"
              style={{
                fontSize: 22,
                margin: "0 0 6px",
                fontWeight: 800,
              }}
            >
              Durasi: {fmt(durationSec)}
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                margin: "0 0 18px",
              }}
            >
              Dengarkan kembali rekaman Anda sebelum mengirim.
            </p>

            {audioUrl && (
              <audio
                src={audioUrl}
                controls
                style={{ width: "100%", marginBottom: 20 }}
              />
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                maxWidth: 420,
                margin: "0 auto",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn-mpt btn-mpt-outline"
                onClick={reset}
                style={{ flex: 1, minHeight: 52, minWidth: 140 }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Rekam Ulang
              </button>
              <button
                type="button"
                className="btn-mpt btn-mpt-primary"
                onClick={handleContinue}
                style={{ flex: 1.3, minHeight: 52, minWidth: 160 }}
              >
                Lanjut ke Form
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
