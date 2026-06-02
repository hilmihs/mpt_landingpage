import {
  Eye,
  CheckCheck,
  Heart,
  Calendar,
  Users,
  GraduationCap,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { supabaseService } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface FunnelMetrics {
  total_submissions: number;
  completed_assessments: number;
  gate1_yes: number;
  total_bookings: number;
  attended_assessments: number;
  tahsin_enrollments: number;
  tahsin_completed: number;
  hits_clicked: number;
}

async function fetchMetrics(): Promise<FunnelMetrics> {
  const sb = supabaseService();
  try {
    const { data } = await sb
      .from("v_funnel_metrics")
      .select("*")
      .maybeSingle();
    if (data) return data as FunnelMetrics;
  } catch {
    // view not present — fall through to zeros
  }
  return {
    total_submissions: 0,
    completed_assessments: 0,
    gate1_yes: 0,
    total_bookings: 0,
    attended_assessments: 0,
    tahsin_enrollments: 0,
    tahsin_completed: 0,
    hits_clicked: 0,
  };
}

function pct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

export default async function OverviewPage() {
  const m = await fetchMetrics();

  const kpis = [
    {
      icon: <Eye size={18} strokeWidth={2.2} />,
      label: "Submission Masuk",
      value: m.total_submissions,
      sub: "total peserta mulai assessment",
      color: "var(--accent)",
    },
    {
      icon: <CheckCheck size={18} strokeWidth={2.2} />,
      label: "Assessment Selesai",
      value: m.completed_assessments,
      sub: `${pct(m.completed_assessments, m.total_submissions)} completion rate`,
      color: "var(--success)",
    },
    {
      icon: <Heart size={18} strokeWidth={2.2} />,
      label: "Gate 1 — Tertarik",
      value: m.gate1_yes,
      sub: `${pct(m.gate1_yes, m.completed_assessments)} dari yang selesai`,
      color: "var(--accent)",
    },
    {
      icon: <Calendar size={18} strokeWidth={2.2} />,
      label: "Booking Dibuat",
      value: m.total_bookings,
      sub: `${pct(m.total_bookings, m.gate1_yes)} konversi dari gate 1`,
      color: "var(--accent)",
    },
    {
      icon: <Users size={18} strokeWidth={2.2} />,
      label: "Hadir Assessment",
      value: m.attended_assessments,
      sub: `${pct(m.attended_assessments, m.total_bookings)} show rate`,
      color: "var(--success)",
    },
    {
      icon: <GraduationCap size={18} strokeWidth={2.2} />,
      label: "Daftar Tahsin",
      value: m.tahsin_enrollments,
      sub: `${pct(m.tahsin_enrollments, m.attended_assessments)} dari yang hadir`,
      color: "var(--warning)",
    },
    {
      icon: <Trophy size={18} strokeWidth={2.2} />,
      label: "Lulus Tahsin",
      value: m.tahsin_completed,
      sub: "≥ 3 dari 4 sesi attended",
      color: "var(--warning)",
    },
    {
      icon: <ExternalLink size={18} strokeWidth={2.2} />,
      label: "HITS Click-through",
      value: m.hits_clicked,
      sub: "lulus Tahsin → klik linktree",
      color: "var(--danger)",
    },
  ];

  return (
    <div style={{ maxWidth: 1180 }}>
      <header style={{ marginBottom: 28 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 6,
          }}
        >
          Overview
        </div>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Funnel Metrics
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "6px 0 0",
            maxWidth: 600,
          }}
        >
          Konversi setiap tahap dari assessment landing hingga HITS click-through.
          Data refresh otomatis setiap kali halaman dibuka.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 32,
        }}
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <section className="card-mpt" style={{ padding: "24px 22px" }}>
        <h2
          className="font-display"
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 6px",
            letterSpacing: "-0.02em",
          }}
        >
          Funnel Drop-off
        </h2>
        <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "0 0 18px" }}>
          Visualisasi konversi step-by-step.
        </p>

        <FunnelBars metrics={m} />
      </section>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="card-mpt"
      style={{ padding: "20px 20px", position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: color,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: `color-mix(in oklab, ${color}, transparent 88%)`,
            color,
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
          }}
        >
          {label}
        </div>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          color: "var(--ink)",
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value.toLocaleString("id-ID")}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.5 }}>
        {sub}
      </div>
    </div>
  );
}

function FunnelBars({ metrics }: { metrics: FunnelMetrics }) {
  const steps = [
    { label: "Submission Masuk", value: metrics.total_submissions },
    { label: "Assessment Selesai", value: metrics.completed_assessments },
    { label: "Gate 1 — Tertarik", value: metrics.gate1_yes },
    { label: "Booking Dibuat", value: metrics.total_bookings },
    { label: "Hadir Assessment", value: metrics.attended_assessments },
    { label: "Daftar Tahsin", value: metrics.tahsin_enrollments },
    { label: "Lulus Tahsin", value: metrics.tahsin_completed },
    { label: "HITS Click", value: metrics.hits_clicked },
  ];
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((s, i) => {
        const width = (s.value / max) * 100;
        const prev = i > 0 ? steps[i - 1]!.value : null;
        const dropPct =
          prev !== null && prev > 0
            ? Math.round(((prev - s.value) / prev) * 100)
            : null;

        return (
          <div key={s.label}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  color: "var(--ink-soft)",
                  fontWeight: 600,
                }}
              >
                {s.label}
              </span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {dropPct !== null && dropPct > 0 && (
                  <span style={{ color: "var(--danger)", fontSize: 10 }}>
                    −{dropPct}%
                  </span>
                )}
                <span style={{ color: "var(--ink)", fontWeight: 700 }}>
                  {s.value.toLocaleString("id-ID")}
                </span>
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "var(--line)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, var(--accent), color-mix(in oklab, var(--accent), white 20%))",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
