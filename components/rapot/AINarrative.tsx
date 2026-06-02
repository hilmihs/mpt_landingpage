import { Sparkles } from "lucide-react";

interface Props {
  narrative: string;
}

export function AINarrative({ narrative }: Props) {
  return (
    <div
      className="card-mpt"
      style={{
        padding: "28px 26px",
        marginBottom: 26,
        position: "relative",
        background:
          "color-mix(in oklab, var(--accent), var(--surface-soft) 80%)",
        borderColor: "color-mix(in oklab, var(--accent), transparent 65%)",
      }}
    >
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
            width: 36,
            height: 36,
            borderRadius: 10,
            background:
              "color-mix(in oklab, var(--accent), transparent 60%)",
            color: "var(--accent)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Sparkles size={18} strokeWidth={2.2} />
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              marginBottom: 2,
            }}
          >
            Catatan Pendamping
          </div>
          <h3
            className="font-display"
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Penjelasan untuk Anda
          </h3>
        </div>
      </div>

      <p
        style={{
          fontSize: 15.5,
          lineHeight: 1.75,
          color: "var(--ink)",
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {narrative}
      </p>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid color-mix(in oklab, var(--accent), transparent 75%)",
          fontSize: 11,
          color: "var(--ink-mute)",
          lineHeight: 1.5,
        }}
      >
        Catatan ini dibuat otomatis oleh asisten AI berdasarkan output AI Mu&apos;alim,
        sebagai referensi awal sebelum konsultasi langsung dengan pengajar.
      </div>
    </div>
  );
}
