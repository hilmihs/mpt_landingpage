import { ClipboardCheck } from "lucide-react";

export default function AttendancePage() {
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
          Kehadiran
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
          Review Kehadiran
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
          <ClipboardCheck size={24} strokeWidth={2.2} />
        </div>
        <h2
          className="font-display"
          style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}
        >
          Belum ada data kehadiran untuk direview
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
          Setelah sesi Zoom Anda berlangsung, kehadiran peserta akan tercatat
          otomatis lewat webhook. Hanya kasus ambigu (nama tidak match) yang
          muncul di sini untuk Anda review manual.
        </p>
      </div>
    </div>
  );
}
