"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, User } from "lucide-react";

interface Recording {
  id: string;
  audio_url: string;
  audio_duration_sec: number | null;
  created_at: string;
  peserta_nama: string;
  peserta_gender: string;
  peserta_slug: string | null;
}

const TIER_OPTIONS = [
  { value: "lanjutan_awal", label: "Lanjutan Awal" },
  { value: "lanjutan_menengah", label: "Lanjutan Menengah" },
  { value: "lanjutan_expert", label: "Lanjutan Expert" },
];

export function RecordingReviewList({
  recordings,
}: {
  recordings: Recording[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {recordings.map((r) => (
        <ReviewCard key={r.id} recording={r} />
      ))}
    </div>
  );
}

function ReviewCard({ recording }: { recording: Recording }) {
  const router = useRouter();
  const [tier, setTier] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClassify() {
    if (!tier) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/recordings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_id: recording.id,
          assigned_tier: tier,
          reviewer_notes: notes || undefined,
        }),
      });
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.refresh(), 800);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="card-mpt"
        style={{
          padding: "20px 22px",
          textAlign: "center",
          background: "color-mix(in oklab, var(--success), var(--surface) 92%)",
          borderColor: "color-mix(in oklab, var(--success), transparent 60%)",
        }}
      >
        <CheckCircle2
          size={24}
          strokeWidth={2.4}
          color="var(--success)"
          style={{ marginBottom: 4 }}
        />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>
          Klasifikasi tersimpan
        </div>
      </div>
    );
  }

  return (
    <div className="card-mpt" style={{ padding: "20px 22px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "color-mix(in oklab, var(--accent), transparent 85%)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <User size={18} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {recording.peserta_nama}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
              {recording.peserta_gender === "ikhwan" ? "Ikhwan" : "Akhwat"} ·{" "}
              {new Date(recording.created_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {recording.audio_duration_sec
                ? ` · ${Math.round(recording.audio_duration_sec)}s`
                : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Audio player */}
      <audio
        controls
        src={recording.audio_url}
        style={{ width: "100%", borderRadius: 8, marginBottom: 14 }}
      />

      {/* Classification form */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 16px",
          borderRadius: 10,
          background: "var(--surface-soft)",
          border: "1px solid var(--line)",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Tingkat Kemampuan
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTier(opt.value)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: tier === opt.value ? 700 : 500,
                  border: `2px solid ${tier === opt.value ? "var(--accent)" : "var(--line)"}`,
                  background:
                    tier === opt.value
                      ? "color-mix(in oklab, var(--accent), transparent 88%)"
                      : "var(--surface)",
                  color:
                    tier === opt.value ? "var(--accent)" : "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--ink-mute)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Catatan (opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan untuk peserta atau catatan internal..."
            rows={2}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
              fontSize: 13,
              resize: "vertical",
              fontFamily: "inherit",
              color: "var(--ink)",
            }}
          />
        </div>

        <button
          className="btn-mpt btn-mpt-accent"
          onClick={handleClassify}
          disabled={!tier || submitting}
          style={{
            minHeight: 42,
            fontSize: 13,
            fontWeight: 700,
            border: "none",
            cursor: !tier || submitting ? "not-allowed" : "pointer",
            opacity: !tier || submitting ? 0.5 : 1,
          }}
        >
          {submitting ? "Menyimpan..." : "Simpan Klasifikasi"}
        </button>
      </div>
    </div>
  );
}
