"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Calendar, Clock, Users, Video } from "lucide-react";

interface Slot {
  id: string;
  teacher_id: string;
  teacher_nama: string;
  kind: string;
  scheduled_at: string;
  duration_min: number;
  capacity: number;
  reserved_count: number;
  gender_target: string;
  status: string;
  zoom_join_url: string | null;
}

interface Props {
  initialSlots: Slot[];
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: "var(--success)",
  in_progress: "var(--accent)",
  completed: "var(--ink-mute)",
  cancelled: "var(--danger)",
};

export function JadwalView({ initialSlots }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generateAll() {
    if (!confirm("Generate slot 4 minggu ke depan untuk SEMUA pengajar aktif?")) return;
    setError(null);
    setInfo(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/slots/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks_ahead: 4 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Gagal generate slot.");
        return;
      }
      const s = data.summary;
      setInfo(
        `Selesai untuk ${s.teachers} pengajar: ${s.total_created} slot baru, ${s.total_skipped} sudah ada.`,
      );
      startTransition(() => router.refresh());
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {initialSlots.length} slot terdaftar dalam 4 minggu ke depan
        </div>
        <button
          type="button"
          onClick={generateAll}
          disabled={generating || pending}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 38,
            fontSize: 12,
            padding: "6px 14px",
            opacity: generating || pending ? 0.6 : 1,
          }}
        >
          <Sparkles size={13} strokeWidth={2.4} />
          {generating ? "Generating..." : "Generate Slot Semua Pengajar"}
        </button>
      </div>

      {error && <Banner color="danger">{error}</Banner>}
      {info && <Banner color="success">{info}</Banner>}

      {initialSlots.length === 0 ? (
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
            <Calendar size={24} strokeWidth={2.2} />
          </div>
          <h2
            className="font-display"
            style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}
          >
            Belum ada slot terjadwal
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            Setelah pengajar mengatur ketersediaan mingguan di portal, klik
            tombol di atas untuk generate slot konkret.
          </p>
        </div>
      ) : (
        <SlotsList slots={initialSlots} />
      )}
    </>
  );
}

function SlotsList({ slots }: { slots: Slot[] }) {
  // Group by date
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = new Date(s.scheduled_at).toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const entries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {entries.map(([dateKey, daySlots]) => {
        const d = new Date(dateKey);
        const label = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        return (
          <div key={dateKey}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-mute)",
                marginBottom: 8,
              }}
            >
              {label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {daySlots.map((s) => (
                <SlotRow key={s.id} slot={s} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SlotRow({ slot }: { slot: Slot }) {
  const d = new Date(slot.scheduled_at);
  const start = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  const end = new Date(d.getTime() + slot.duration_min * 60_000);
  const endStr = `${String(end.getHours()).padStart(2, "0")}.${String(end.getMinutes()).padStart(2, "0")}`;
  const statusColor = STATUS_COLOR[slot.status] ?? "var(--ink-mute)";

  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 14,
        alignItems: "center",
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
        <Clock size={16} strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>
          {start} – {endStr}
          <span
            style={{
              marginLeft: 10,
              padding: "2px 8px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              borderRadius: 5,
              background:
                slot.kind === "assessment"
                  ? "color-mix(in oklab, var(--accent), transparent 85%)"
                  : "color-mix(in oklab, var(--success), transparent 85%)",
              color: slot.kind === "assessment" ? "var(--accent)" : "var(--success)",
            }}
          >
            {slot.kind}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 12,
            color: "var(--ink-soft)",
            flexWrap: "wrap",
          }}
        >
          <span>{slot.teacher_nama}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Users size={11} strokeWidth={2.2} />
            {slot.reserved_count}/{slot.capacity} {slot.gender_target}
          </span>
        </div>
      </div>
      {slot.zoom_join_url && (
        <a
          href={slot.zoom_join_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Zoom"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "color-mix(in oklab, var(--accent), transparent 85%)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Video size={14} strokeWidth={2.2} />
        </a>
      )}
      <span
        style={{
          padding: "3px 8px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          borderRadius: 5,
          background: `color-mix(in oklab, ${statusColor}, transparent 85%)`,
          color: statusColor,
        }}
      >
        {slot.status}
      </span>
    </div>
  );
}

function Banner({
  color,
  children,
}: {
  color: "danger" | "success";
  children: React.ReactNode;
}) {
  const c = color === "danger" ? "var(--danger)" : "var(--success)";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: `color-mix(in oklab, ${c}, transparent 88%)`,
        color: c,
        fontSize: 13,
        marginBottom: 14,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
