"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Zap } from "lucide-react";
import { useRapotPolling } from "@/hooks/useRapotPolling";
import { MPTLogo } from "@/components/shared/MPTLogo";

const BYPASS_ENABLED = process.env.NEXT_PUBLIC_ALLOW_BYPASS === "1";

const PHASE_LABELS = [
  "Audio diterima",
  "Mendengarkan 4 indikator",
  "Menyusun rapot",
  "Hampir selesai",
];

export default function LoadingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, networkError } = useRapotPolling(id);
  const [bypassing, setBypassing] = useState(false);
  const [bypassError, setBypassError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Slow tick so visual phase advances even before status changes server-side.
  useEffect(() => {
    if (data?.status === "completed" || data?.status === "failed") return;
    const t1 = window.setTimeout(() => setTick(1), 1400);
    const t2 = window.setTimeout(() => setTick(2), 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [data?.status]);

  useEffect(() => {
    if (data?.status === "completed") {
      router.replace(`/rapot/${id}`);
    }
  }, [data, id, router]);

  const phase = useMemo(() => {
    if (data?.status === "completed") return 4;
    if (data?.status === "processing") return Math.max(tick, 3);
    if (data?.status === "pending") return Math.max(tick, 1);
    return tick;
  }, [data?.status, tick]);

  const isFailed = data?.status === "failed";

  const handleBypass = async () => {
    setBypassError(null);
    setBypassing(true);
    try {
      const res = await fetch(`/api/bypass/${id}`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      setBypassError((err as Error).message);
      setBypassing(false);
    }
  };

  if (isFailed) {
    return (
      <div
        className="screen-enter"
        style={{
          maxWidth: 540,
          margin: "0 auto",
          padding: "60px 20px 80px",
          textAlign: "center",
        }}
      >
        <div
          className="card-mpt"
          style={{
            padding: "32px 24px",
            background:
              "color-mix(in oklab, var(--danger), transparent 92%)",
            border:
              "1px solid color-mix(in oklab, var(--danger), transparent 70%)",
          }}
        >
          <AlertTriangle
            className="size-10 mx-auto"
            style={{ color: "var(--danger)" }}
          />
          <h2
            className="font-display"
            style={{
              fontSize: 24,
              margin: "16px 0 8px",
              color: "var(--danger)",
              fontWeight: 800,
            }}
          >
            Analisis gagal
          </h2>
          <p style={{ color: "var(--ink-soft)", marginBottom: 20 }}>
            {data?.error_message ?? "Terjadi kesalahan saat memproses."}{" "}
            Silakan rekam ulang dan coba lagi.
          </p>
          <button
            type="button"
            className="btn-mpt btn-mpt-primary"
            onClick={() => router.push("/assessment/record")}
            style={{ minHeight: 52 }}
          >
            Rekam Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="screen-enter"
      style={{
        maxWidth: 540,
        margin: "0 auto",
        padding: "48px 20px 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        minHeight: "calc(100vh - 100px)",
        justifyContent: "center",
      }}
    >
      {/* Animated logo with dashed rings */}
      <div
        style={{
          position: "relative",
          width: 200,
          height: 200,
          marginBottom: 32,
        }}
      >
        <svg
          width="200"
          height="200"
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: 0,
            animation: "spinSlow 8s linear infinite",
          }}
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="0.7"
            strokeDasharray="2 8"
            opacity="0.7"
          />
        </svg>
        <svg
          width="200"
          height="200"
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: 0,
            animation: "spinSlowReverse 14s linear infinite",
          }}
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="0.6"
            strokeDasharray="1 12"
            opacity="0.5"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "float 4s ease-in-out infinite",
          }}
        >
          <MPTLogo size={140} priority />
        </div>
      </div>

      <div
        className="pill"
        style={{
          background: "color-mix(in oklab, var(--accent), transparent 80%)",
          color: "var(--accent-deep)",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent-deep)",
            animation: "glowPulse 1.4s ease-in-out infinite",
          }}
        />
        Sistem sedang bekerja
      </div>
      <h1
        className="font-display"
        style={{
          fontSize: "clamp(26px, 4vw, 38px)",
          margin: "0 0 12px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
        }}
      >
        Menganalisis{" "}
        <span style={{ color: "var(--accent-deep)" }}>bacaan Anda</span>
      </h1>
      <p
        style={{
          fontSize: 15,
          color: "var(--ink-soft)",
          margin: "0 0 32px",
          maxWidth: 380,
          lineHeight: 1.6,
        }}
      >
        Sistem memproses rekaman dan menyiapkan umpan balik dari 4 indikator.
        Kurang dari 30 detik.
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {PHASE_LABELS.map((l, i) => {
          const state = i < phase ? "done" : i === phase ? "active" : "pending";
          return (
            <div
              key={i}
              style={{
                padding: "14px 18px",
                borderRadius: 12,
                background: state === "active" ? "var(--paper)" : "transparent",
                border: `1px solid ${
                  state === "active" ? "var(--line-strong)" : "var(--line)"
                }`,
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                transition: "all 0.4s",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background:
                    state === "done"
                      ? "var(--success)"
                      : state === "active"
                        ? "color-mix(in oklab, var(--accent), transparent 70%)"
                        : "transparent",
                  border:
                    state === "pending"
                      ? "1.5px dashed var(--line-strong)"
                      : "none",
                  color: state === "done" ? "white" : "var(--accent-deep)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.4s",
                }}
                aria-hidden
              >
                {state === "done" && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {state === "active" && (
                  <div style={{ display: "flex", gap: 2 }}>
                    {[0, 0.15, 0.3].map((d) => (
                      <span
                        key={d}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          background: "currentColor",
                          animation: `dotPulse 1.2s ease-in-out ${d}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: state === "active" ? 700 : 500,
                  color:
                    state === "pending" ? "var(--ink-mute)" : "var(--ink)",
                }}
              >
                {l}
              </span>
            </div>
          );
        })}
      </div>

      {networkError && (
        <p
          style={{
            marginTop: 16,
            fontSize: 12,
            color: "var(--warning)",
          }}
        >
          Koneksi terganggu, mencoba ulang...
        </p>
      )}

      {BYPASS_ENABLED && (
        <div
          style={{
            marginTop: 28,
            width: "100%",
            maxWidth: 440,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
          }}
        >
          <button
            type="button"
            onClick={handleBypass}
            disabled={bypassing}
            className="btn-mpt btn-mpt-outline"
            style={{ width: "100%", minHeight: 44, fontSize: 13 }}
          >
            <Zap className="size-4" />
            {bypassing
              ? "Menyiapkan rapot acak..."
              : "Lewati & buat rapot acak (dev)"}
          </button>
          {bypassError && (
            <p
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "var(--danger)",
              }}
            >
              {bypassError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
