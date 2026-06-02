"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface Session {
  scheduled_at: string;
  duration_min: number;
}

interface Cohort {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  teacher_nama: string;
  sessions: Session[];
}

interface Props {
  rapotSlug: string;
  cohorts: Cohort[];
}

export function CohortPicker({ rapotSlug, cohorts }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enroll() {
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/tahsin/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rapot_slug: rapotSlug, cohort_id: selected }),
      });
      const data = await res.json();
      if (!res.ok && !data.already_enrolled) {
        setError(data.message ?? "Gagal mendaftar. Coba lagi.");
        return;
      }
      router.push(`/rapot/${rapotSlug}?enrolled=1`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (cohorts.length === 0) {
    return (
      <div
        className="card-mpt"
        style={{ padding: "48px 28px", textAlign: "center" }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 12px",
            letterSpacing: "-0.02em",
          }}
        >
          Belum ada cohort yang dibuka
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            lineHeight: 1.65,
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          Saat ini belum ada cohort Tahsin Al-Fatihah yang sesuai dengan gender Anda
          dan masih membuka pendaftaran. Tim kami akan menghubungi via WhatsApp
          begitu cohort baru tersedia.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "color-mix(in oklab, var(--danger), transparent 88%)",
            color: "var(--danger)",
            fontSize: 13,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cohorts.map((c) => (
          <CohortCard
            key={c.id}
            cohort={c}
            selected={selected === c.id}
            onSelect={() => setSelected(c.id)}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 22,
          position: "sticky",
          bottom: 16,
        }}
      >
        <button
          type="button"
          onClick={enroll}
          disabled={!selected || submitting}
          className="btn-mpt btn-mpt-accent"
          style={{
            minHeight: 50,
            fontSize: 14,
            fontWeight: 700,
            padding: "10px 24px",
            opacity: !selected || submitting ? 0.5 : 1,
            boxShadow: selected ? "0 8px 24px rgba(0,0,0,0.18)" : undefined,
          }}
        >
          {submitting ? "Mendaftarkan..." : "Daftarkan Saya"}
          <ArrowRight size={16} strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}

function CohortCard({
  cohort,
  selected,
  onSelect,
}: {
  cohort: Cohort;
  selected: boolean;
  onSelect: () => void;
}) {
  const startStr = fmtDate(cohort.start_date);
  const endStr = fmtDate(cohort.end_date);
  const seatsLeft = cohort.capacity - cohort.enrolled_count;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="card-mpt"
      style={{
        width: "100%",
        padding: "20px 22px",
        background: selected
          ? "color-mix(in oklab, var(--accent), transparent 92%)"
          : "var(--surface)",
        border: `2px solid ${selected ? "var(--accent)" : "var(--line)"}`,
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: 17,
                fontWeight: 700,
                margin: 0,
                color: "var(--ink)",
                letterSpacing: "-0.015em",
              }}
            >
              {cohort.name}
            </h3>
            {selected && (
              <CheckCircle2
                size={18}
                strokeWidth={2.4}
                color="var(--accent)"
              />
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
            <span>{cohort.teacher_nama}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Calendar size={11} strokeWidth={2.2} />
              {startStr} – {endStr}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Users size={11} strokeWidth={2.2} />
              {seatsLeft} kursi tersisa
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--surface-soft)",
          padding: "12px 14px",
          borderRadius: 8,
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 8,
          }}
        >
          4 Sesi · 90 Menit per Sesi
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 8,
          }}
        >
          {cohort.sessions.map((s, i) => (
            <SessionPill key={i} number={i + 1} session={s} />
          ))}
        </div>
      </div>
    </button>
  );
}

function SessionPill({
  number,
  session,
}: {
  number: number;
  session: Session;
}) {
  const d = new Date(session.scheduled_at);
  const dateLabel = d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        background: "var(--surface)",
        borderRadius: 6,
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: "color-mix(in oklab, var(--accent), transparent 85%)",
          color: "var(--accent)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {number}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
          {dateLabel}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--ink-mute)",
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Clock size={9} strokeWidth={2.2} />
          {time}
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
