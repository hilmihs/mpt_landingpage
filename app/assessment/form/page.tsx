"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAssessmentStore } from "@/lib/store";
import { formSchema } from "@/lib/validation";

function fmt(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Strip any leading +62 / 62 / 0 to display "raw" 8-13 digit body.
function stripPrefix(raw: string): string {
  if (raw.startsWith("+62")) return raw.slice(3);
  if (raw.startsWith("62")) return raw.slice(2);
  if (raw.startsWith("0")) return raw.slice(1);
  return raw;
}

export default function FormPage() {
  const router = useRouter();
  const audioBlob = useAssessmentStore((s) => s.audioBlob);
  const audioDurationSec = useAssessmentStore((s) => s.audioDurationSec);
  const formData = useAssessmentStore((s) => s.formData);
  const setFormData = useAssessmentStore((s) => s.setFormData);
  const setSubmission = useAssessmentStore((s) => s.setSubmission);

  const [nama, setNama] = useState(formData.nama ?? "");
  const [jk, setJk] = useState<"ikhwan" | "akhwat" | "">(
    formData.jenis_kelamin ?? "",
  );
  const [wa, setWa] = useState(stripPrefix(formData.nomor_wa ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!audioBlob) router.replace("/assessment/record");
  }, [audioBlob, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const fullWa = wa ? `+62${wa}` : "";
    const parsed = formSchema.safeParse({
      nama,
      jenis_kelamin: jk,
      nomor_wa: fullWa,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Form tidak valid");
      return;
    }
    if (!audioBlob) {
      setError("Audio tidak ditemukan, mohon rekam ulang.");
      return;
    }

    setFormData(parsed.data);
    setSubmitting(true);

    const fd = new FormData();
    fd.append("audio", audioBlob, "recording.webm");
    fd.append("nama", parsed.data.nama);
    fd.append("jenis_kelamin", parsed.data.jenis_kelamin);
    fd.append("nomor_wa", parsed.data.nomor_wa);
    fd.append("audio_duration_sec", String(audioDurationSec));

    try {
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setSubmission(json.submission_id, json.rapot_slug);
      router.push(`/assessment/loading/${json.rapot_slug}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="screen-enter"
      style={{
        maxWidth: 540,
        margin: "0 auto",
        padding: "32px 20px 80px",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(28px, 4.5vw, 44px)",
            margin: "0 0 10px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          Data <span style={{ color: "var(--accent-deep)" }}>Peserta</span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-soft)", margin: 0 }}>
          Untuk pengiriman hasil rapot ke WhatsApp Anda.
        </p>
      </div>

      {/* Audio chip */}
      <div
        className="card-mpt"
        style={{
          padding: "14px 16px",
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background:
              "color-mix(in oklab, var(--primary), transparent 90%)",
            color: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}
          >
            Rekaman tersimpan
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
            Durasi {fmt(audioDurationSec)} · siap dikirim
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/assessment/record")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--accent-deep)",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-nunito), system-ui, sans-serif",
          }}
        >
          Ganti
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <div>
          <label
            htmlFor="nama"
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 8,
            }}
          >
            Nama lengkap
          </label>
          <input
            id="nama"
            className="input-mpt"
            placeholder="Nama Anda"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            autoComplete="name"
            required
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 8,
            }}
          >
            Jenis kelamin
          </label>
          <div
            role="radiogroup"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <button
              type="button"
              role="radio"
              aria-checked={jk === "ikhwan"}
              className={`pill-btn ${jk === "ikhwan" ? "active" : ""}`}
              onClick={() => setJk("ikhwan")}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid currentColor",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {jk === "ikhwan" && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "currentColor",
                    }}
                  />
                )}
              </span>
              Laki-laki
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={jk === "akhwat"}
              className={`pill-btn ${jk === "akhwat" ? "active" : ""}`}
              onClick={() => setJk("akhwat")}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "2px solid currentColor",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {jk === "akhwat" && (
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "currentColor",
                    }}
                  />
                )}
              </span>
              Perempuan
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="wa"
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--ink)",
              marginBottom: 8,
            }}
          >
            Nomor WhatsApp
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                width: 92,
                padding: "14px 12px",
                background: "var(--paper)",
                border: "1.5px solid var(--line-strong)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 15,
                fontWeight: 700,
                flexShrink: 0,
              }}
              aria-hidden
            >
              <span style={{ fontSize: 18 }}>🇮🇩</span>
              +62
            </div>
            <input
              id="wa"
              className="input-mpt"
              placeholder="81234567890"
              value={wa}
              onChange={(e) => setWa(e.target.value.replace(/\D/g, ""))}
              inputMode="tel"
              autoComplete="tel-national"
              style={{ flex: 1, minWidth: 0 }}
              required
            />
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--ink-mute)",
              margin: "8px 0 0",
            }}
          >
            Hasil rapot akan dikirim ke nomor ini.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background:
                "color-mix(in oklab, var(--danger), transparent 88%)",
              border:
                "1px solid color-mix(in oklab, var(--danger), transparent 70%)",
              color: "var(--danger)",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
            }}
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-mpt btn-mpt-primary"
          style={{ minHeight: 56, fontSize: 16, marginTop: 4 }}
        >
          {submitting ? "Mengirim..." : "Kirim & Mulai Analisis"}
          {!submitting && (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
