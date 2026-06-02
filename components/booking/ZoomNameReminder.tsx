import { UserCheck, AlertCircle } from "lucide-react";

interface Props {
  nama: string;
  variant?: "info" | "warning";
}

export function ZoomNameReminder({ nama, variant = "info" }: Props) {
  const isWarning = variant === "warning";
  return (
    <div
      style={{
        padding: "18px 20px",
        borderRadius: 14,
        background: isWarning
          ? "color-mix(in oklab, var(--warning), transparent 88%)"
          : "color-mix(in oklab, var(--accent), transparent 88%)",
        border: `1px solid ${
          isWarning
            ? "color-mix(in oklab, var(--warning), transparent 60%)"
            : "color-mix(in oklab, var(--accent), transparent 65%)"
        }`,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isWarning ? "var(--warning)" : "var(--accent)",
          color: "white",
          display: "grid",
          placeItems: "center",
        }}
      >
        {isWarning ? (
          <AlertCircle size={16} strokeWidth={2.4} />
        ) : (
          <UserCheck size={16} strokeWidth={2.4} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink)",
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          Penting: nama di Zoom = nama saat daftar
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.55,
          }}
        >
          Saat join meeting, pastikan nama Anda <strong>“{nama}”</strong>{" "}
          (sama persis seperti saat daftar). Ini penting supaya kehadiran Anda
          ter-record otomatis. Cara ubah: di Zoom klik tombol{" "}
          <strong>Participants → More → Rename</strong>.
        </div>
      </div>
    </div>
  );
}
