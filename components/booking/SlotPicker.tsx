"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, Users, ChevronRight } from "lucide-react";

interface Slot {
  id: string;
  scheduled_at: string;
  duration_min: number;
  capacity: number;
  reserved_count: number;
  available_capacity: number;
  teacher_nama: string;
}

interface Props {
  rapotSlug: string;
  gender: "ikhwan" | "akhwat";
  initialSlots: Slot[];
  systemReady: boolean;
}

const HARI_LONG = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

function fmtTimeRange(start: Date, durationMin: number): string {
  const end = new Date(start.getTime() + durationMin * 60_000);
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function groupByDate(slots: Slot[]) {
  const groups = new Map<string, Slot[]>();
  for (const s of slots) {
    const d = new Date(s.scheduled_at);
    const key = d.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function SlotPicker({ rapotSlug, initialSlots, systemReady }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => groupByDate(initialSlots), [initialSlots]);

  useEffect(() => {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_name: "booking_calendar_viewed",
        metadata: { rapot_slug: rapotSlug },
      }),
    }).catch(() => {});
  }, [rapotSlug]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rapot_slug: rapotSlug, slot_id: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Gagal memesan slot. Silakan coba lagi.");
        setSubmitting(false);
        return;
      }
      router.push(`/booking/confirm/${data.booking_id}`);
    } catch {
      setError("Koneksi terputus. Silakan coba lagi.");
      setSubmitting(false);
    }
  }

  if (!systemReady) {
    return (
      <EmptyState
        title="Sistem booking sedang disiapkan"
        body="Tim kami sedang menyiapkan jadwal pengajar untuk minggu ini. Kembali lagi besok atau hubungi kami via WhatsApp untuk reservasi manual."
      />
    );
  }

  if (initialSlots.length === 0) {
    return (
      <EmptyState
        title="Belum ada slot tersedia"
        body="Semua slot pekan ini sudah penuh, atau jadwal baru belum dibuka. Silakan kembali besok — jadwal di-update setiap pagi."
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {grouped.map(([dateKey, daySlots]) => {
          const d = new Date(dateKey);
          const dayLabel = `${HARI_LONG[d.getDay()]}, ${d.getDate()} ${
            [
              "Januari", "Februari", "Maret", "April", "Mei", "Juni",
              "Juli", "Agustus", "September", "Oktober", "November", "Desember",
            ][d.getMonth()]
          }`;
          return (
            <div key={dateKey}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ink-soft)",
                  letterSpacing: "0.02em",
                }}
              >
                <Calendar size={14} strokeWidth={2.2} />
                {dayLabel}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 10,
                }}
              >
                {daySlots.map((s) => {
                  const start = new Date(s.scheduled_at);
                  const isSelected = selected === s.id;
                  const slotsLeft = s.available_capacity;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelected(s.id)}
                      className="card-mpt"
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        cursor: "pointer",
                        border: `2px solid ${
                          isSelected
                            ? "var(--accent)"
                            : "var(--line)"
                        }`,
                        background: isSelected
                          ? "color-mix(in oklab, var(--accent), transparent 88%)"
                          : "var(--surface)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--ink)",
                          marginBottom: 6,
                        }}
                      >
                        <Clock size={14} strokeWidth={2.4} />
                        {fmtTimeRange(start, s.duration_min)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ink-soft)",
                          marginBottom: 8,
                          lineHeight: 1.5,
                        }}
                      >
                        Pengajar: {s.teacher_nama}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color:
                            slotsLeft <= 3 ? "var(--warning)" : "var(--success)",
                          fontWeight: 600,
                        }}
                      >
                        <Users size={12} strokeWidth={2.4} />
                        {slotsLeft} dari {s.capacity} kursi tersisa
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            marginTop: 18,
            padding: "10px 14px",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--danger), transparent 90%)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          position: "sticky",
          bottom: 16,
          marginTop: 24,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={!selected || submitting}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 54,
            fontSize: 15,
            fontWeight: 700,
            paddingInline: 28,
            opacity: !selected || submitting ? 0.55 : 1,
            cursor: !selected || submitting ? "not-allowed" : "pointer",
            boxShadow: "0 10px 30px -10px color-mix(in oklab, var(--accent), transparent 50%)",
          }}
        >
          {submitting ? "Memesan slot..." : "Pesan Slot Ini"}
          <ChevronRight size={16} strokeWidth={2.4} />
        </button>
      </div>

      <Helper />
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="card-mpt"
      style={{
        padding: "40px 28px",
        textAlign: "center",
      }}
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
        style={{
          fontSize: 22,
          fontWeight: 700,
          margin: "0 0 10px",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--ink-soft)",
          lineHeight: 1.6,
          maxWidth: 460,
          margin: "0 auto",
        }}
      >
        {body}
      </p>
    </div>
  );
}

function Helper() {
  return (
    <div
      style={{
        marginTop: 18,
        fontSize: 12,
        color: "var(--ink-mute)",
        lineHeight: 1.6,
        textAlign: "center",
      }}
    >
      Hari/jam ditampilkan sesuai zona waktu lokal Anda · Sesi berlangsung 60
      menit · Maksimal 12 peserta per slot, pengajar gender-matched
    </div>
  );
}
