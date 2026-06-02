"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock, User } from "lucide-react";

interface AttendanceRow {
  booking_id: string;
  participant_nama: string;
  participant_wa: string;
  scheduled_at: string;
  duration_min: number;
  kind: string;
  attended: boolean | null;
  source: string | null;
  need_review: boolean;
}

interface Props {
  initial: AttendanceRow[];
}

export function AttendanceManager({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(bookingId: string, attended: boolean) {
    setError(null);
    setUpdating(bookingId);
    try {
      const res = await fetch("/api/portal/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId, attended }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Gagal menyimpan.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setUpdating(null);
    }
  }

  if (initial.length === 0) {
    return (
      <div
        className="card-mpt"
        style={{ padding: "48px 28px", textAlign: "center" }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 16px",
            borderRadius: 14,
            background: "color-mix(in oklab, var(--accent), transparent 85%)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Clock size={24} strokeWidth={2.2} />
        </div>
        <h2
          className="font-display"
          style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}
        >
          Belum ada sesi yang perlu direview
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          Daftar booking dari sesi yang sudah lewat akan muncul di sini.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--danger), transparent 88%)",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {initial.map((row) => (
          <Row
            key={row.booking_id}
            row={row}
            onMark={mark}
            updating={updating === row.booking_id || pending}
          />
        ))}
      </div>
    </>
  );
}

function Row({
  row,
  onMark,
  updating,
}: {
  row: AttendanceRow;
  onMark: (id: string, attended: boolean) => void;
  updating: boolean;
}) {
  const d = new Date(row.scheduled_at);
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const dateLabel = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 14,
        alignItems: "center",
        borderColor: row.need_review
          ? "color-mix(in oklab, var(--warning), transparent 60%)"
          : undefined,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "color-mix(in oklab, var(--accent), transparent 88%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <User size={16} strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
          {row.participant_nama}
          {row.need_review && (
            <span
              style={{
                marginLeft: 8,
                padding: "2px 6px",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                borderRadius: 4,
                background: "color-mix(in oklab, var(--warning), transparent 80%)",
                color: "var(--warning)",
              }}
            >
              Perlu Review
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span>
            {dateLabel} · {start}
          </span>
          <span>{row.participant_wa}</span>
          {row.source && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
              source: {row.source}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => onMark(row.booking_id, true)}
          disabled={updating}
          aria-label="Tandai hadir"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: `1.5px solid ${row.attended === true ? "var(--success)" : "var(--line)"}`,
            background:
              row.attended === true
                ? "color-mix(in oklab, var(--success), transparent 80%)"
                : "transparent",
            color: row.attended === true ? "var(--success)" : "var(--ink-mute)",
            cursor: updating ? "not-allowed" : "pointer",
            display: "grid",
            placeItems: "center",
            opacity: updating ? 0.5 : 1,
          }}
        >
          <Check size={14} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => onMark(row.booking_id, false)}
          disabled={updating}
          aria-label="Tidak hadir"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: `1.5px solid ${row.attended === false ? "var(--danger)" : "var(--line)"}`,
            background:
              row.attended === false
                ? "color-mix(in oklab, var(--danger), transparent 80%)"
                : "transparent",
            color: row.attended === false ? "var(--danger)" : "var(--ink-mute)",
            cursor: updating ? "not-allowed" : "pointer",
            display: "grid",
            placeItems: "center",
            opacity: updating ? 0.5 : 1,
          }}
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
