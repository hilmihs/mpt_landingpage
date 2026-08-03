import { GraduationCap, CheckCircle2, ArrowUpCircle } from "lucide-react";
import type { TeacherAssessmentResult } from "@/lib/teacher-assessment";

/**
 * Renders a teacher (pengajar) assessment on its own 1–10 scale, with a visual identity
 * distinct from the AI rapot (uses --primary, not --accent). Server-component-safe.
 */
export function TeacherReport({ data }: { data: TeacherAssessmentResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + score */}
      <div className="card-mpt" style={{ padding: "22px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: "var(--primary)",
              color: "var(--primary-ink)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <GraduationCap size={22} strokeWidth={2} />
          </div>
          <div>
            <h2
              className="font-display"
              style={{
                fontSize: "clamp(18px, 3.4vw, 22px)",
                margin: 0,
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Penilaian Pengajar
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
              {data.pengajar}
              {data.tanggal ? ` · ${data.tanggal}` : ""}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            gap: 6,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: "var(--primary)",
              lineHeight: 1,
            }}
          >
            {data.skor}
          </span>
          <span style={{ fontSize: 18, color: "var(--ink-mute)", fontWeight: 600 }}>
            / 10
          </span>
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--ink-soft)",
          }}
        >
          {data.label}
        </div>
      </div>

      {/* Aspek penilaian */}
      {data.aspek.length > 0 && (
        <div className="card-mpt" style={{ padding: "18px 18px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>
            Aspek Penilaian
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.aspek.map((a) => (
              <div
                key={a.nama}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{a.nama}</span>
                  {a.nilai !== null && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--primary)",
                        flexShrink: 0,
                      }}
                    >
                      {a.nilai}
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--ink-mute)",
                          fontWeight: 500,
                        }}
                      >
                        /10
                      </span>
                    </span>
                  )}
                </div>
                {a.catatan && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-mute)",
                      marginTop: 4,
                      lineHeight: 1.5,
                    }}
                  >
                    {a.catatan}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kelebihan & Perbaikan */}
      {(data.kelebihan.length > 0 || data.perbaikan.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
          }}
        >
          {data.kelebihan.length > 0 && (
            <div
              className="card-mpt"
              style={{
                padding: "16px 16px",
                background: "color-mix(in oklab, var(--success), transparent 93%)",
                borderColor: "color-mix(in oklab, var(--success), transparent 70%)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <CheckCircle2 size={16} color="var(--success)" strokeWidth={2.4} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Kelebihan</span>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12.5,
                  color: "var(--ink-soft)",
                  lineHeight: 1.7,
                }}
              >
                {data.kelebihan.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}

          {data.perbaikan.length > 0 && (
            <div
              className="card-mpt"
              style={{
                padding: "16px 16px",
                background: "color-mix(in oklab, var(--warning), transparent 93%)",
                borderColor: "color-mix(in oklab, var(--warning), transparent 70%)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <ArrowUpCircle size={16} color="var(--warning)" strokeWidth={2.4} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Perlu Diperbaiki</span>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: 12.5,
                  color: "var(--ink-soft)",
                  lineHeight: 1.7,
                }}
              >
                {data.perbaikan.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Catatan pengajar */}
      {(data.ringkasan || data.rekomendasi) && (
        <div className="card-mpt" style={{ padding: "16px 18px" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>
            Catatan Pengajar
          </h3>
          {data.ringkasan && (
            <p
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                margin: "0 0 8px",
                lineHeight: 1.6,
              }}
            >
              {data.ringkasan}
            </p>
          )}
          {data.rekomendasi && (
            <p
              style={{
                fontSize: 13,
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.6,
                fontWeight: 500,
              }}
            >
              {data.rekomendasi}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
