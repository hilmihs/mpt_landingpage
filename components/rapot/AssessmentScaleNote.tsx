import { Info } from "lucide-react";

/**
 * Framer that explains why the AI assessment (1–5) and the teacher assessment (1–10)
 * are separate instruments and must NOT be compared directly.
 */
export function AssessmentScaleNote() {
  return (
    <div
      className="card-mpt"
      style={{
        padding: "14px 16px",
        marginBottom: 16,
        background: "color-mix(in oklab, var(--accent), transparent 94%)",
        borderColor: "color-mix(in oklab, var(--accent), transparent 78%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Info
          size={18}
          strokeWidth={2.2}
          color="var(--accent)"
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)" }}>
            Dua penilaian yang berbeda.
          </strong>{" "}
          Penilaian <strong>AI</strong> hanya mendeteksi kesalahan fatal (lahn jaliy)
          dengan skala <strong>1–5</strong>. Penilaian <strong>Pengajar</strong> bersifat
          menyeluruh (makhraj, sifat, mad, kelancaran, dll) dengan skala{" "}
          <strong>1–10</strong>. Keduanya mengukur hal berbeda dan{" "}
          <strong>tidak bisa dibandingkan langsung</strong>.
        </div>
      </div>
    </div>
  );
}
