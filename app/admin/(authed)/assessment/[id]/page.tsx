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
import {
  INDICATOR_KEYS,
  INDICATOR_LABEL,
  SEGMENT_KEYS,
  type IndicatorKey,
} from "@/lib/teacher-eval/types";
import { AL_FATIHAH_SEGMENTS } from "@/lib/arabic";

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

/**
 * Penilaian mesin, kini dalam instrumen yang sama dengan pengajar: delapan
 * segmen, lima indikator, skala 1-10. Lihat 0010_ai_evaluation.sql.
 */
interface AiRow {
  score_min: number;
  label_min: string;
  score_ayat: unknown;
  score_harakat: number | null;
  score_ketepatan_huruf: number | null;
  score_panjang_pendek: number | null;
  score_tasydid: number | null;
  score_hukum_tajwid: number | null;
  total_jaliy: number;
  total_khafiy: number;
  ml_model_version: string | null;
  ml_confidence: number | null;
  ml_raw_output: unknown;
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
    fetchAi(id).catch(() => null),
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

      <AiComparator ai={ai} pengajar={evaluasi} aiStatus={row.ai_status} />

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

/** Satu baris perbandingan: label, nilai mesin, nilai pengajar, selisih. */
function BarisBanding({
  label,
  mesin,
  pengajar,
}: {
  label: string;
  mesin: number | null | undefined;
  pengajar: number | null | undefined;
}) {
  const adaKeduanya = mesin != null && pengajar != null;
  const selisih = adaKeduanya ? mesin - pengajar : null;
  const beda = selisih != null && selisih !== 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: 10,
        alignItems: "baseline",
        fontSize: 12,
        padding: "5px 0",
        borderTop: "1px solid var(--line)",
      }}
    >
      <span style={{ color: beda ? "var(--ink)" : "var(--ink-mute)" }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right" }}>
        {mesin ?? "—"}
      </span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          minWidth: 34,
          textAlign: "right",
          color: "var(--ink-soft)",
        }}
      >
        {pengajar ?? "—"}
      </span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          minWidth: 34,
          textAlign: "right",
          fontWeight: beda ? 700 : 400,
          color: beda ? "var(--warning, var(--ink))" : "var(--ink-mute)",
        }}
      >
        {selisih == null ? "—" : selisih > 0 ? `+${selisih}` : selisih}
      </span>
    </div>
  );
}

/**
 * Skor mesin berdampingan dengan skor pengajar, khusus mata admin.
 *
 * Sejak Agustus 2026 keduanya memakai instrumen yang sama — delapan segmen,
 * lima indikator, skala 1-10, skor kepala dari segmen terlemah — dan angkanya
 * dihitung fungsi yang sama. Karena itu peringatan "beda skala" yang dulu ada
 * di sini sudah dicabut: sekarang dua angka ini memang boleh disandingkan.
 *
 * Yang tidak berubah: ini tetap tidak pernah sampai ke peserta maupun pengajar.
 */
function AiComparator({
  ai,
  pengajar,
  aiStatus,
}: {
  ai: AiRow | null;
  pengajar: EvaluationDetailData | null;
  aiStatus: string;
}) {
  const segmenMesin = normalizeSegmentScores(ai?.score_ayat);
  const segmenPengajar = pengajar?.scoreAyat;

  const indikatorMesin: Record<IndicatorKey, number | null> = {
    harakat: ai?.score_harakat ?? null,
    ketepatanHuruf: ai?.score_ketepatan_huruf ?? null,
    panjangPendek: ai?.score_panjang_pendek ?? null,
    tasydid: ai?.score_tasydid ?? null,
    hukumTajwid: ai?.score_hukum_tajwid ?? null,
  };

  const raw = (ai?.ml_raw_output ?? {}) as Record<string, unknown>;
  const sifaJalan = raw.sifa_available === true;
  const diBuang = typeof raw.temuan_di_luar_jangkauan === "number"
    ? raw.temuan_di_luar_jangkauan
    : 0;
  const mock = (ai?.ml_model_version ?? "").startsWith("mock");

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
            {mock && (
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--danger)",
                  border: "1px solid var(--danger)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  margin: "0 0 14px",
                  lineHeight: 1.5,
                }}
              >
                DATA PALSU — model <code>{ai.ml_model_version}</code>. Angka di
                bawah ini bilangan acak dari mock, bukan penilaian mesin. Jangan
                dipakai sebagai bahan perbandingan.
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 22, fontSize: 12 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>
                  {ai.score_min}/10
                </div>
                <div style={{ color: "var(--ink-soft)", marginTop: 3 }}>Mesin</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: "var(--ink-soft)",
                  }}
                >
                  {pengajar?.scoreMin != null ? `${pengajar.scoreMin}/10` : "—"}
                </div>
                <div style={{ color: "var(--ink-soft)", marginTop: 3 }}>Pengajar</div>
              </div>
              <Meta
                label="Temuan mesin"
                value={`${ai.total_jaliy} fatal · ${ai.total_khafiy} ringan`}
              />
              <Meta label="Model" value={ai.ml_model_version ?? "—"} />
              <Meta
                label="Confidence"
                value={ai.ml_confidence != null ? ai.ml_confidence.toFixed(2) : "—"}
              />
            </div>

            <Kolom label="Per segmen" mesin="Mesin" pengajar="Pengajar" />
            {SEGMENT_KEYS.map((k) => (
              <BarisBanding
                key={k}
                label={AL_FATIHAH_SEGMENTS[k]?.nomor ?? k}
                mesin={segmenMesin?.[k] ?? null}
                pengajar={segmenPengajar?.[k] ?? null}
              />
            ))}

            <Kolom label="Per indikator" mesin="Mesin" pengajar="Pengajar" />
            {INDICATOR_KEYS.map((k) => (
              <BarisBanding
                key={k}
                label={INDICATOR_LABEL[k]}
                mesin={indikatorMesin[k]}
                pengajar={pengajar?.skorIndikator?.[k]?.score ?? null}
              />
            ))}

            {/* Hanya berlaku untuk penilaian sungguhan. Mock mengarang angka
                khafiy sendiri, jadi menampilkan "khafiy selalu nol" di sebelah
                baris mock yang memuat khafiy justru saling menyangkal. */}
            {!sifaJalan && !mock && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  margin: "14px 0 0",
                  lineHeight: 1.6,
                }}
              >
                Head <em>sifa</em> model belum jalan, jadi mesin sama sekali tidak
                bisa melihat lahn khafiy dan angkanya selalu nol. Akibatnya skor
                mesin cenderung LEBIH TINGGI daripada pengajar. Selisih positif di
                atas belum tentu berarti mesin longgar — sebagian pasti berasal
                dari kebutaan ini.
              </p>
            )}
            {diBuang > 0 && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ink-mute)",
                  margin: "8px 0 0",
                  lineHeight: 1.6,
                }}
              >
                {diBuang} temuan dibuang karena koordinat katanya di luar
                Al-Fatihah. Kalau angka ini besar, alignment sedang meleset dan
                skor di atas tidak layak dipakai.
              </p>
            )}
            <p
              style={{
                fontSize: 12,
                color: "var(--ink-mute)",
                margin: "8px 0 0",
                lineHeight: 1.6,
              }}
            >
              Dikumpulkan sebagai bahan perbandingan sampai keputusan Januari.
              Tidak pernah ditampilkan ke peserta maupun pengajar.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.6 }}>
            Belum ada hasil mesin untuk rekaman ini (status pipeline:{" "}
            <code style={{ fontSize: 12 }}>{aiStatus}</code>).{" "}
            {aiStatus === "pending"
              ? "Worker belum menjalankannya — cek ML_SERVER_URL."
              : "Lihat kolom ai_error_message di tabel submissions."}
          </p>
        )}
      </div>
    </details>
  );
}

/** Kepala kolom untuk blok perbandingan. */
function Kolom({
  label,
  mesin,
  pengajar,
}: {
  label: string;
  mesin: string;
  pengajar: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: 10,
        marginTop: 16,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--ink-mute)",
      }}
    >
      <span>{label}</span>
      <span style={{ minWidth: 34, textAlign: "right" }}>{mesin}</span>
      <span style={{ minWidth: 34, textAlign: "right" }}>{pengajar}</span>
      <span style={{ minWidth: 34, textAlign: "right" }}>Δ</span>
    </div>
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

async function fetchAi(submissionId: string): Promise<AiRow | null> {
  const rows = await sql<AiRow[]>`
    SELECT score_min, label_min, score_ayat,
           score_harakat, score_ketepatan_huruf, score_panjang_pendek,
           score_tasydid, score_hukum_tajwid,
           total_jaliy, total_khafiy,
           ml_model_version,
           ml_confidence::float8 AS ml_confidence,
           ml_raw_output,
           created_at
    FROM ai_evaluations
    WHERE submission_id = ${submissionId}
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
