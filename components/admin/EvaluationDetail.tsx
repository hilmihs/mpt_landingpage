import { AL_FATIHAH_SEGMENTS } from "@/lib/arabic";
import { parseOption } from "@/lib/teacher-eval/catalog";
import { bandFor } from "@/lib/teacher-eval/scoring";
import {
  SEGMENT_KEYS,
  INDICATOR_KEYS,
  INDICATOR_LABEL,
  type EvaluationAyat,
  type SegmentKey,
  type IndicatorKey,
} from "@/lib/teacher-eval/types";

/**
 * Penilaian pengajar sebagaimana adanya, untuk mata admin.
 *
 * Sengaja BUKAN memakai ulang NativeEvaluationReport. Komponen itu menghadap
 * peserta: istilah "jaliy"/"khafiy" disembunyikan di balik kata "fatal", dan
 * kalimatnya orang kedua ("Skor Anda…"). Admin butuh kebalikannya — kosakata
 * aslinya, cacah mentah, dan siapa yang mengisi. Menyamakan keduanya berarti
 * salah satu pihak selalu dapat tampilan yang bukan untuknya.
 */

export interface EvaluationDetailData {
  source: string;
  pemeriksa: string | null;
  kegiatan: string | null;
  createdAt: Date | null;
  rekomendasiProgram: string | null;
  scoreMin: number | null;
  labelMin: string | null;
  teacherNama: string | null;
  /** Hanya terisi untuk source = 'native'. */
  ayat: EvaluationAyat | null;
  scoreAyat: Partial<Record<SegmentKey, number>>;
  skorIndikator: Partial<Record<IndicatorKey, { score: number | null; label: string | null }>>;
}

const TONE_COLOR: Record<string, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  accent: "var(--accent)",
  success: "var(--success)",
};

function scoreColor(score: number | null): string {
  return score == null ? "var(--ink-mute)" : (TONE_COLOR[bandFor(score).tone] ?? "var(--ink-mute)");
}

export function EvaluationDetail({ data }: { data: EvaluationDetailData }) {
  const totalJaliy = data.ayat
    ? SEGMENT_KEYS.reduce((n, k) => n + data.ayat![k].jaliy.length, 0)
    : 0;
  const totalKhafiy = data.ayat
    ? SEGMENT_KEYS.reduce((n, k) => n + data.ayat![k].khafiy.length, 0)
    : 0;

  return (
    <div className="card-mpt" style={{ padding: "20px 22px" }}>
      <SectionTitle>Nilai Pengajar</SectionTitle>

      {/* Ringkasan */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1,
              color: scoreColor(data.scoreMin),
            }}
          >
            {data.scoreMin != null ? `${data.scoreMin}/10` : "—"}
          </div>
          {data.labelMin && (
            <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
              {data.labelMin}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 12 }}>
          <Meta label="Sumber" value={data.source === "native" ? "Portal (native)" : "Panel luar"} />
          <Meta label="Pengajar" value={data.teacherNama ?? data.pemeriksa ?? "—"} />
          <Meta label="Kegiatan" value={data.kegiatan ?? "—"} />
          <Meta
            label="Dinilai"
            value={
              data.createdAt
                ? data.createdAt.toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  })
                : "—"
            }
          />
          {data.ayat && (
            <Meta label="Temuan" value={`${totalJaliy} jaliy · ${totalKhafiy} khafiy`} />
          )}
          {data.rekomendasiProgram && (
            <Meta label="Rekomendasi" value={data.rekomendasiProgram} />
          )}
        </div>
      </div>

      {/* Lima indikator — selalu ada, baik native maupun salinan panel luar. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: data.ayat ? 22 : 0,
        }}
      >
        {INDICATOR_KEYS.map((k) => {
          const v = data.skorIndikator[k];
          return (
            <div
              key={k}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--ink-mute)",
                  marginBottom: 4,
                }}
              >
                {INDICATOR_LABEL[k]}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: scoreColor(v?.score ?? null),
                }}
              >
                {v?.score != null ? `${v.score}/10` : "—"}
              </div>
              {v?.label && (
                <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>
                  {v.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.ayat ? (
        <>
          <SectionTitle>Temuan per Segmen</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SEGMENT_KEYS.map((key) => (
              <SegmentRow
                key={key}
                segmentKey={key}
                sel={data.ayat![key]}
                score={data.scoreAyat[key] ?? null}
              />
            ))}
          </div>
        </>
      ) : (
        /* Baris salinan dari panel muhajirproject tidak membawa temuan mentah,
           cuma lima skor di atas. Dikatakan terus terang supaya kekosongan ini
           tidak terbaca sebagai "pengajar tidak menemukan apa-apa". */
        <p
          style={{
            fontSize: 12,
            color: "var(--ink-mute)",
            margin: "14px 0 0",
            lineHeight: 1.6,
          }}
        >
          Penilaian ini disalin dari panel luar, jadi hanya membawa lima skor
          indikator di atas. Temuan per segmen tidak tersedia untuk baris seperti
          ini.
        </p>
      )}
    </div>
  );
}

function SegmentRow({
  segmentKey,
  sel,
  score,
}: {
  segmentKey: SegmentKey;
  sel: { jaliy: string[]; khafiy: string[] };
  score: number | null;
}) {
  const meta = AL_FATIHAH_SEGMENTS[segmentKey];
  const bersih = sel.jaliy.length === 0 && sel.khafiy.length === 0;

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "12px 14px",
        background: bersih ? undefined : "var(--surface-soft)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: bersih ? 0 : 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {meta?.nomor ?? segmentKey}
          {segmentKey === "ayat_7_part_2" && (
            <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}> · bagian 2</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {bersih && (
            <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>tanpa temuan</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 800, color: scoreColor(score) }}>
            {score != null ? `${score}/10` : "—"}
          </span>
        </div>
      </div>

      {sel.jaliy.length > 0 && (
        <FindingList label="Jaliy" color="var(--danger)" items={sel.jaliy} />
      )}
      {sel.khafiy.length > 0 && (
        <FindingList label="Khafiy" color="var(--warning)" items={sel.khafiy} />
      )}
    </div>
  );
}

function FindingList({
  label,
  color,
  items,
}: {
  label: string;
  color: string;
  items: string[];
}) {
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color,
          marginBottom: 4,
        }}
      >
        {label} · {items.length}
      </div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 3 }}>
        {items.map((raw, i) => {
          const { text, indicator } = parseOption(raw);
          return (
            <li key={i} style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.5 }}>
              {text}
              {indicator && (
                <span style={{ color: "var(--ink-mute)", fontSize: 11 }}>
                  {" "}
                  · {INDICATOR_LABEL[indicator]}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}
