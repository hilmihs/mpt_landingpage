import { CalendarDays } from "lucide-react";

export default function JadwalPage() {
  return (
    <PlaceholderPage
      title="Semua Jadwal Slot"
      eyebrow="Manajemen Jadwal"
      icon={<CalendarDays size={24} strokeWidth={2.2} />}
      body="Halaman untuk melihat semua slot Assessment & Tahsin lintas pengajar, override capacity, dan batalkan slot. Tersedia di Phase 2B."
    />
  );
}

function PlaceholderPage({
  title,
  eyebrow,
  icon,
  body,
}: {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  body: string;
}) {
  return (
    <div style={{ maxWidth: 720 }}>
      <header style={{ marginBottom: 24 }}>
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
          {eyebrow}
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
          {title}
        </h1>
      </header>
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
          {icon}
        </div>
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
    </div>
  );
}
