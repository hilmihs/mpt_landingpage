import { GraduationCap } from "lucide-react";

export default function CohortsPage() {
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
          Tahsin Al-Fatihah
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
          Cohort Saya
        </h1>
      </header>

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
          <GraduationCap size={24} strokeWidth={2.2} />
        </div>
        <h2
          className="font-display"
          style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}
        >
          Belum ada cohort terdaftar
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
          Cohort Tahsin (4 sesi × 90 menit) dibuat oleh admin dan akan muncul
          di sini setelah Anda di-assign sebagai pengajar cohort.
        </p>
      </div>
    </div>
  );
}
