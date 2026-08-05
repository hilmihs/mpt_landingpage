import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import {
  fetchAssessment,
  sinceLabel,
  TAHAP_LABEL,
  TAHAP_COLOR,
  type AssessmentRow,
} from "@/lib/admin/assessment-query";
import {
  normalizeAyat,
  normalizeSegmentScores,
} from "@/lib/teacher-eval/normalize";
import {
  EvaluationDetail,
  type EvaluationDetailData,
} from "@/components/admin/EvaluationDetail";
import { AssessmentActions } from "@/components/admin/AssessmentActions";
import { INDICATOR_KEYS, type IndicatorKey } from "@/lib/teacher-eval/types";

/**
 * Riwayat lengkap satu rekaman: perjalanannya dari masuk sampai dinilai.
 *
 * `[id]` adalah submission_id, bukan assignment_id — satu rekaman bisa berpindah
 * tangan beberapa kali, dan yang ingin ditelusuri admin adalah rekamannya,
 * bukan salah satu penugasannya.
 */

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AssignmentRow {
  id: string;
  teacher_id: string | null;
  teacher_nama: string | null;
  teacher_wa: string | null;
  status: string;
  assigned_at: Date;
  wa_sent_at: Date | null;
  wa_message_id: string | null;
  wa_error: string | null;
  wa_attempts: number;
  opened_at: Date | null;
  completed_at: Date | null;
  teacher_nama_kini: string | null;
  teacher_status_kini: string | null;
  aktif: boolean;
}

interface EvalRow {
  source: string;
  pemeriksa: string | null;
  kegiatan: string | null;
  created_at: Date | null;
  rekomendasi_program: string | null;
  ayat: unknown;
  score_ayat: unknown;
  score_min: number | null;
  label_min: string | null;
  teacher_nama: string | null;
  score_harakat: number | null;
  label_harakat: string | null;
  score_ketepatan_huruf: number | null;
  label_ketepatan_huruf: string | null;
  score_panjang_pendek: number | null;
  label_panjang_pendek: string | null;
  score_tasydid: number | null;
  label_tasydid: string | null;
  score_hukum_tajwid: number | null;
  label_hukum_tajwid: string | null;
}

interface AiRow {
  skor: number;
  status_label: string;
  total_errors_major: number;
  total_errors_minor: number;
  weighted_score: number | null;
  ml_model_version: string | null;
  ml_confidence: number | null;
  created_at: Date | null;
}

export interface TeacherPick {
  id: string;
  nama: string;
  nomor_wa: string;
  antrean: number;
  terakhir_ditugaskan: Date | null;
}

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Tanpa penyaringan ini postgres.js melempar "invalid input syntax for type
  // uuid", dan try/catch di bawah mengubah salah ketik jadi halaman kosong
  // yang membingungkan alih-alih 404 yang jujur.
  if (!UUID_RE.test(id)) notFound();

  const row = await fetchAssessment(id).catch((err) => {
    console.error("[admin.assessment] detail gagal:", (err as Error).message);
    return null;
  });
  if (!row) notFound();

  const [assignments, evaluasi, ai] = await Promise.all([
    fetchAssignments(id).catch(() => [] as AssignmentRow[]),
    fetchEvaluation(id).catch(() => null),
    fetchAi(row.rapot_slug).catch(() => null),
  ]);

  // Gender baru diketahui setelah baris utama terbaca, jadi daftar pengajar
  // tidak bisa ikut Promise.all di atas.
  const kandidat = await fetchTeacherPicks(row.jenis_kelamin).catch(
    () => [] as TeacherPick[],
  );

  // Lifecycle GCS menghapus objek setelah 7 hari, jadi rekaman lama memang
  // sudah tidak ada. Tampilkan keterangannya, bukan <audio> yang mati.
  let audioUrl: string | null = null;
  try {
    if (row.audio_path) audioUrl = await signedAudioUrl(row.audio_path, 3600);
  } catch {
    audioUrl = null;
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <Link
        href="/admin/assessment"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--ink-soft)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={15} strokeWidth={2.2} />
        Kembali ke daftar
      </Link>

      <Header row={row} />

      {/* Aksi ditaruh tinggi: kalau rekaman ini macet, itulah alasan admin
          membuka halaman. */}
      <div style={{ marginBottom: 18 }}>
        <AssessmentActions
          submissionId={row.submission_id}
          tahap={row.tahap}
          pengajarSekarang={row.pengajar_nama}
          jenisKelamin={row.jenis_kelamin}
          kandidat={kandidat.map((t) => ({
            id: t.id,
            nama: t.nama,
            antrean: t.antrean,
          }))}
        />
      </div>

      <Card title="Rekaman">
        {audioUrl ? (
          <>
            <audio controls preload="metadata" src={audioUrl} style={{ width: "100%" }} />
            <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 8 }}>
              Durasi {durasiLabel(row.durasi_sec)} · {row.audio_path}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Rekaman tidak tersedia. Audio peserta dihapus otomatis setelah 7
            hari, jadi ini wajar untuk submission lama.
          </p>
        )}
      </Card>

      <Card title="Linimasa Penugasan">
        {assignments.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Rekaman ini belum pernah ditugaskan ke pengajar mana pun. Kemungkinan
            besar tidak ada pengajar {row.jenis_kelamin} yang aktif saat rekaman
            masuk, dan SUPERADMIN_WA juga kosong.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {assignments.map((a) => (
              <AssignmentBlock key={a.id} a={a} />
            ))}
          </div>
        )}
      </Card>

      {evaluasi ? (
        <div style={{ marginBottom: 16 }}>
          <EvaluationDetail data={evaluasi} />
        </div>
      ) : (
        <Card title="Nilai Pengajar">
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Belum ada penilaian yang masuk untuk rekaman ini.
          </p>
        </Card>
      )}

      <AiComparator ai={ai} teacherScore={row.score_min} aiStatus={row.ai_status} />

      <Card title="Jejak WhatsApp">
        <WaTrace row={row} assignments={assignments} />
      </Card>
    </div>
  );
}

function Header({ row }: { row: AssessmentRow }) {
  return (
    <header style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          {row.nama}
        </h1>
        <Pill color={TAHAP_COLOR[row.tahap]}>{TAHAP_LABEL[row.tahap]}</Pill>
        {row.macet && <Pill color="var(--danger)">macet</Pill>}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 18,
          marginTop: 10,
          fontSize: 13,
          color: "var(--ink-soft)",
        }}
      >
        <span>{row.jenis_kelamin === "ikhwan" ? "Ikhwan" : "Akhwat"}</span>
        <a
          href={`https://wa.me/${row.nomor_wa.replace(/^0/, "62").replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          {row.nomor_wa}
        </a>
        <span>
          Masuk{" "}
          {row.created_at.toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Jakarta",
          })}
        </span>
        {row.tahap !== "selesai" && <span>Menunggu {sinceLabel(row.menunggu_sec)}</span>}
        {row.rapot_slug && (
          <Link
            href={`/rapot/${row.rapot_slug}`}
            target="_blank"
            style={{
              color: "var(--accent)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            Rapot peserta
            <ExternalLink size={13} strokeWidth={2.2} />
          </Link>
        )}
      </div>
    </header>
  );
}

function AssignmentBlock({ a }: { a: AssignmentRow }) {
  const dipensiunkan = a.status === "failed";
  const nonaktif =
    a.teacher_id != null &&
    a.teacher_status_kini != null &&
    a.teacher_status_kini !== "active";

  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "12px 14px",
        opacity: dipensiunkan ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {a.teacher_nama_kini ?? a.teacher_nama ?? "—"}
          {a.teacher_wa && (
            <span style={{ fontWeight: 400, color: "var(--ink-mute)" }}> · {a.teacher_wa}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {a.teacher_id === null && (
            <Pill color="var(--warning)" small>
              fallback
            </Pill>
          )}
          {nonaktif && (
            <Pill color="var(--danger)" small>
              {a.teacher_status_kini}
            </Pill>
          )}
          {dipensiunkan ? (
            <Pill color="var(--ink-mute)" small>
              dialihkan
            </Pill>
          ) : (
            <Pill color={a.aktif ? "var(--accent)" : "var(--success)"} small>
              {a.status}
            </Pill>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Step label="Ditugaskan" at={a.assigned_at} />
        <Step
          label={a.wa_error ? `WA gagal — ${a.wa_error}` : "WA terkirim"}
          at={a.wa_sent_at}
          gagal={Boolean(a.wa_error)}
          extra={a.wa_attempts > 1 ? `${a.wa_attempts} percobaan` : undefined}
        />
        <Step label="Dibuka pengajar" at={a.opened_at} />
        <Step label="Penilaian dikirim" at={a.completed_at} />
      </div>
    </div>
  );
}

function Step({
  label,
  at,
  gagal = false,
  extra,
}: {
  label: string;
  at: Date | null;
  gagal?: boolean;
  extra?: string;
}) {
  const warna = gagal ? "var(--danger)" : at ? "var(--success)" : "var(--line-strong)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: warna,
          flexShrink: 0,
        }}
      />
      <span style={{ color: at || gagal ? "var(--ink)" : "var(--ink-mute)" }}>{label}</span>
      <span style={{ color: "var(--ink-mute)", marginLeft: "auto" }}>
        {at
          ? at.toLocaleString("id-ID", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Asia/Jakarta",
            })
          : "—"}
        {extra ? ` · ${extra}` : ""}
      </span>
    </div>
  );
}

/**
 * Skor mesin, khusus mata admin.
 *
 * Ditutup dalam <details> dan diberi peringatan skala secara terang-terangan:
 * 1-10 milik pengajar dan 1-5 milik mesin bukan dua angka yang bisa
 * disandingkan, dan sekali seseorang membandingkannya langsung, kesimpulannya
 * salah tanpa ada yang mengoreksi.
 */
function AiComparator({
  ai,
  teacherScore,
  aiStatus,
}: {
  ai: AiRow | null;
  teacherScore: number | null;
  aiStatus: string;
}) {
  return (
    <details className="card-mpt" style={{ padding: "16px 20px", marginBottom: 16 }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        Pembanding Mesin — internal
      </summary>

      <div style={{ marginTop: 14 }}>
        {ai ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                  {ai.skor}/5
                </div>
                <div style={{ color: "var(--ink-soft)", marginTop: 3 }}>
                  {ai.status_label}
                </div>
              </div>
              <Meta label="Pengajar" value={teacherScore != null ? `${teacherScore}/10` : "—"} />
              <Meta
                label="Catatan"
                value={`${ai.total_errors_major} major · ${ai.total_errors_minor} minor`}
              />
              <Meta label="Model" value={ai.ml_model_version ?? "—"} />
              <Meta
                label="Confidence"
                value={ai.ml_confidence != null ? ai.ml_confidence.toFixed(2) : "—"}
              />
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                margin: "14px 0 0",
                lineHeight: 1.6,
              }}
            >
              Dua angka di atas berbeda skala dan tidak boleh dibandingkan
              langsung — mesin memakai 1-5, pengajar 1-10. Keduanya dikumpulkan
              sebagai bahan perbandingan sampai keputusan Januari, dan tidak
              pernah ditampilkan ke peserta maupun pengajar.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Belum ada hasil mesin untuk rekaman ini (status pipeline:{" "}
            <code style={{ fontSize: 12 }}>{aiStatus}</code>). Worker belum
            dijalankan, jadi tabel rapot memang masih kosong.
          </p>
        )}
      </div>
    </details>
  );
}

function WaTrace({
  row,
  assignments,
}: {
  row: AssessmentRow;
  assignments: AssignmentRow[];
}) {
  const baris: { arah: string; tujuan: string; at: Date | null; error: string | null; id: string | null }[] =
    assignments.map((a) => ({
      arah: "Ke pengajar",
      tujuan: a.teacher_nama ?? "—",
      at: a.wa_sent_at,
      error: a.wa_error,
      id: a.wa_message_id,
    }));

  baris.push({
    arah: "Ke peserta",
    tujuan: row.nama,
    at: row.peserta_wa_sent_at,
    error: row.peserta_wa_error,
    id: null,
  });

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ color: "var(--ink-mute)", textAlign: "left" }}>
          <th style={{ padding: "4px 8px 8px 0", fontWeight: 700 }}>Arah</th>
          <th style={{ padding: "4px 8px 8px 0", fontWeight: 700 }}>Tujuan</th>
          <th style={{ padding: "4px 8px 8px 0", fontWeight: 700 }}>Waktu</th>
          <th style={{ padding: "4px 0 8px 0", fontWeight: 700 }}>Hasil</th>
        </tr>
      </thead>
      <tbody>
        {baris.map((b, i) => (
          <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
            <td style={{ padding: "8px 8px 8px 0" }}>{b.arah}</td>
            <td style={{ padding: "8px 8px 8px 0" }}>{b.tujuan}</td>
            <td style={{ padding: "8px 8px 8px 0", color: "var(--ink-mute)" }}>
              {b.at
                ? b.at.toLocaleString("id-ID", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  })
                : "—"}
            </td>
            <td style={{ padding: "8px 0" }}>
              {b.error ? (
                <span style={{ color: "var(--danger)" }}>{b.error}</span>
              ) : b.at ? (
                <span style={{ color: "var(--success)" }}>terkirim{b.id ? ` · ${b.id}` : ""}</span>
              ) : (
                <span style={{ color: "var(--ink-mute)" }}>belum</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function fetchAssignments(submissionId: string): Promise<AssignmentRow[]> {
  return await sql<AssignmentRow[]>`
    SELECT a.id, a.teacher_id, a.teacher_nama, a.teacher_wa, a.status,
           a.assigned_at, a.wa_sent_at, a.wa_message_id, a.wa_error, a.wa_attempts,
           a.opened_at, a.completed_at,
           t.nama   AS teacher_nama_kini,
           t.status AS teacher_status_kini,
           (a.status NOT IN ('completed','failed')) AS aktif
    FROM assignments a
    LEFT JOIN teachers t ON t.id = a.teacher_id
    WHERE a.submission_id = ${submissionId}
    ORDER BY a.assigned_at ASC
  `;
}

async function fetchEvaluation(
  submissionId: string,
): Promise<EvaluationDetailData | null> {
  const rows = await sql<EvalRow[]>`
    SELECT e.source, e.pemeriksa, e.kegiatan, e.created_at, e.rekomendasi_program,
           e.ayat, e.score_ayat, e.score_min, e.label_min,
           e.score_harakat, e.label_harakat,
           e.score_ketepatan_huruf, e.label_ketepatan_huruf,
           e.score_panjang_pendek, e.label_panjang_pendek,
           e.score_tasydid, e.label_tasydid,
           e.score_hukum_tajwid, e.label_hukum_tajwid,
           t.nama AS teacher_nama
    FROM teacher_evaluations e
    LEFT JOIN teachers t ON t.id = e.teacher_id
    WHERE e.submission_id = ${submissionId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;

  const perIndikator: Record<
    IndicatorKey,
    { score: number | null; label: string | null }
  > = {
    harakat: { score: r.score_harakat, label: r.label_harakat },
    ketepatanHuruf: { score: r.score_ketepatan_huruf, label: r.label_ketepatan_huruf },
    panjangPendek: { score: r.score_panjang_pendek, label: r.label_panjang_pendek },
    tasydid: { score: r.score_tasydid, label: r.label_tasydid },
    hukumTajwid: { score: r.score_hukum_tajwid, label: r.label_hukum_tajwid },
  };
  const skorIndikator: Partial<
    Record<IndicatorKey, { score: number | null; label: string | null }>
  > = {};
  for (const k of INDICATOR_KEYS) skorIndikator[k] = perIndikator[k];

  return {
    source: r.source,
    pemeriksa: r.pemeriksa,
    kegiatan: r.kegiatan,
    createdAt: r.created_at,
    rekomendasiProgram: r.rekomendasi_program,
    scoreMin: r.score_min,
    labelMin: r.label_min,
    teacherNama: r.teacher_nama,
    // Baris salinan dari panel luar tidak membawa temuan mentah; komponen
    // detail yang memutuskan apa yang ditampilkan saat ini null.
    ayat: r.source === "native" ? normalizeAyat(r.ayat) : null,
    scoreAyat: normalizeSegmentScores(r.score_ayat),
    skorIndikator,
  };
}

async function fetchAi(rapotSlug: string | null): Promise<AiRow | null> {
  if (!rapotSlug) return null;
  const rows = await sql<AiRow[]>`
    SELECT skor, status_label, total_errors_major, total_errors_minor,
           weighted_score::float8 AS weighted_score,
           ml_model_version,
           ml_confidence::float8 AS ml_confidence,
           created_at
    FROM rapot
    WHERE slug = ${rapotSlug}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Kandidat pengajar untuk penugasan, gender KETAT.
 *
 * Diurut menurut antrean yang masih terbuka, bukan sekadar rotasi terakhir:
 * admin yang memindahkan rekaman macet tidak boleh menumpuknya ke pengajar
 * yang justru sedang paling penuh.
 */
async function fetchTeacherPicks(
  gender: "ikhwan" | "akhwat",
): Promise<TeacherPick[]> {
  return await sql<TeacherPick[]>`
    SELECT t.id, t.nama, t.nomor_wa,
           count(a.id) FILTER (WHERE a.status NOT IN ('completed','failed'))::int AS antrean,
           max(a.assigned_at) AS terakhir_ditugaskan
    FROM teachers t
    LEFT JOIN assignments a ON a.teacher_id = t.id
    WHERE t.status = ${"active"} AND t.jenis_kelamin = ${gender}
    GROUP BY t.id, t.nama, t.nomor_wa
    ORDER BY antrean ASC, terakhir_ditugaskan ASC NULLS FIRST, t.nama ASC
  `;
}

function durasiLabel(sec: number | null): string {
  if (sec == null) return "—";
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}d`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-mpt" style={{ padding: "16px 20px", marginBottom: 16 }}>
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
        {title}
      </div>
      {children}
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

function Pill({
  children,
  color,
  small = false,
}: {
  children: React.ReactNode;
  color: string;
  small?: boolean;
}) {
  return (
    <span
      style={{
        padding: small ? "2px 6px" : "3px 8px",
        fontSize: small ? 9 : 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        borderRadius: 6,
        whiteSpace: "nowrap",
        background: `color-mix(in oklab, ${color}, transparent 85%)`,
        color,
      }}
    >
      {children}
    </span>
  );
}
