import { CheckCircle2 } from "lucide-react";

/**
 * Rapot yang dilihat peserta: nilai dari PENGAJAR, bukan dari AI.
 *
 * Keputusan rapat 3 Agustus 2026 — AI tetap menilai rekaman yang sama, tapi
 * hasilnya disimpan untuk pembanding internal dan tidak ditampilkan ke peserta
 * sampai Januari. Alasannya risiko produk: AI yang meleng dan memberi nilai
 * tinggi ke semua orang membuat peserta merasa tidak perlu belajar lagi.
 *
 * Skalanya 1-10, berbeda dari skor AI (1-5) — jangan disandingkan seolah setara.
 */

export interface TeacherEvaluationView {
  kodeUnik: string;
  pemeriksa: string | null;
  kegiatan: string | null;
  scoreMin: number | null;
  labelMin: string | null;
  indikator: { label: string; score: number | null; mutu: string | null }[];
}

/** Ambang ini mengikuti scoreLabel() di aplikasi peserta muhajirproject. */
function band(score: number): { title: string; desc: string; color: string } {
  if (score <= 2)
    return {
      title: "Belum Memenuhi Standar",
      desc: "Masih banyak yang perlu dibenahi, namun semangat belajar ini langkah awal yang sangat berharga di sisi Allah.",
      color: "var(--danger)",
    };
  if (score <= 4)
    return {
      title: "Perlu Bimbingan",
      desc: "Sudah berusaha dengan baik, hanya perlu lebih teliti agar bacaan makin tepat dan shalat semakin sempurna.",
      color: "var(--warning)",
    };
  if (score <= 6)
    return {
      title: "Sedikit Lagi, Perlu Terus Diperbaiki",
      desc: "Bacaan sudah mulai benar, teruslah berlatih agar makin lancar dan sesuai dengan tuntunan Rasulullah ﷺ.",
      color: "var(--warning)",
    };
  if (score <= 8)
    return {
      title: "Baik",
      desc: "Bacaan jelas dan makna sudah tepat. Tinggal dijaga dan diperindah agar hati makin khusyuk dalam membaca.",
      color: "var(--accent)",
    };
  return {
    title: "Sangat Baik",
    desc: "Bacaan indah, tajwid terjaga, dan makna sempurna. Semoga istiqamah dan menjadi amal yang diridhai Allah.",
    color: "var(--success)",
  };
}

export function TeacherEvaluationReport({
  nama,
  ev,
}: {
  nama: string;
  ev: TeacherEvaluationView;
}) {
  const skor = ev.scoreMin;
  const b = skor != null ? band(skor) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card-mpt" style={{ padding: "28px 24px", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-mute)",
            marginBottom: 14,
          }}
        >
          <CheckCircle2 size={14} strokeWidth={2.4} />
          Dinilai oleh pengajar
        </div>

        <div style={{ fontSize: 15, color: "var(--ink-soft)", marginBottom: 4 }}>{nama}</div>

        {skor != null && b ? (
          <>
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                lineHeight: 1.05,
                color: b.color,
                letterSpacing: "-0.03em",
              }}
            >
              {skor}
              <span style={{ fontSize: 22, color: "var(--ink-mute)", fontWeight: 600 }}>/10</span>
            </div>
            <div
              className="font-display"
              style={{ fontSize: 20, fontWeight: 700, margin: "6px 0 10px" }}
            >
              {b.title}
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--ink-soft)",
                lineHeight: 1.65,
                maxWidth: 480,
                margin: "0 auto",
              }}
            >
              {b.desc}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: "var(--ink-soft)" }}>
            Penilaian sudah masuk, namun skornya belum tersedia.
          </p>
        )}

        {ev.pemeriksa && (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 16 }}>
            Pemeriksa: {ev.pemeriksa}
            {ev.kegiatan ? ` · ${ev.kegiatan}` : ""}
          </div>
        )}
      </div>

      {ev.indikator.length > 0 && (
        <div className="card-mpt" style={{ padding: "22px 20px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-mute)",
              marginBottom: 14,
            }}
          >
            Rincian per Aspek
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ev.indikator.map((i) => (
              <div
                key={i.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  paddingBottom: 12,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{i.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {i.mutu && (
                    <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{i.mutu}</span>
                  )}
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      minWidth: 42,
                      textAlign: "right",
                      color: i.score != null ? band(i.score).color : "var(--ink-mute)",
                    }}
                  >
                    {i.score ?? "—"}
                    <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 600 }}>
                      /10
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
