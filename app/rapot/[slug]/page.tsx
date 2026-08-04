import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { ScoreCircle } from "@/components/assessment/ScoreCircle";
import { AyatCard } from "@/components/rapot/AyatCard";
import { IndikatorCard } from "@/components/rapot/IndikatorCard";
import { NextStepsGate } from "@/components/rapot/NextStepsGate";
import { AINarrative } from "@/components/rapot/AINarrative";
import { getParticipantEligibility } from "@/lib/eligibility";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  TeacherEvaluationReport,
  type TeacherEvaluationView,
} from "@/components/rapot/TeacherEvaluationReport";
import {
  NativeEvaluationReport,
  type NativeEvaluationView,
} from "@/components/rapot/NativeEvaluationReport";
import { WaitingForTeacher } from "@/components/rapot/WaitingForTeacher";
import { ShareButtons } from "@/components/rapot/ShareButtons";
import { PrintButton } from "@/components/rapot/PrintButton";
import {
  AssessmentHistory,
  type HistoryItem,
} from "@/components/rapot/AssessmentHistory";
import {
  INDICATOR_KEYS,
  SEGMENT_KEYS,
  type EvaluationAyat,
  type SegmentKey,
} from "@/lib/teacher-eval/types";
import { MountainGlyph } from "@/components/shared/MPTLogo";
import { INDIKATOR_META } from "@/lib/scoring";
import { AL_FATIHAH } from "@/lib/arabic";
import type { RapotRow, IndikatorKey, ErrorItem } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

interface RapotWithSubmission extends RapotRow {
  submissions: {
    id: string;
    nama: string;
    jenis_kelamin: "ikhwan" | "akhwat";
    nomor_wa: string;
    audio_duration_sec: number | null;
  } | null;
}

async function getRapot(slug: string): Promise<RapotWithSubmission | null> {
  try {
    // Relasi rapot -> submissions dulu di-embed PostgREST; di SQL cukup LEFT
    // JOIN lalu dirakit jadi objek bersarang seperti bentuk lamanya.
    // Kolom numeric di-cast ke float8 supaya driver mengembalikan number.
    const rows = await sql`
      SELECT
        r.slug, r.submission_id, r.created_at, r.skor, r.status_label,
        r.errors_harakat, r.errors_huruf, r.errors_panjang_pendek, r.errors_syaddah,
        r.total_errors_major, r.total_errors_minor,
        r.weighted_score::float8 AS weighted_score,
        r.ml_model_version,
        r.ml_confidence::float8 AS ml_confidence,
        r.ai_narrative, r.ai_narrative_model,
        s.id AS sub_id,
        s.nama AS sub_nama,
        s.jenis_kelamin AS sub_jenis_kelamin,
        s.nomor_wa AS sub_nomor_wa,
        s.audio_duration_sec::float8 AS sub_audio_duration_sec
      FROM rapot r
      LEFT JOIN submissions s ON s.id = r.submission_id
      WHERE r.slug = ${slug}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      slug: row.slug,
      submission_id: row.submission_id,
      created_at: (row.created_at as Date | null)?.toISOString() ?? "",
      skor: row.skor,
      status_label: row.status_label,
      errors_harakat: row.errors_harakat ?? [],
      errors_huruf: row.errors_huruf ?? [],
      errors_panjang_pendek: row.errors_panjang_pendek ?? [],
      errors_syaddah: row.errors_syaddah ?? [],
      total_errors_major: row.total_errors_major,
      total_errors_minor: row.total_errors_minor,
      weighted_score: row.weighted_score,
      ml_model_version: row.ml_model_version,
      ml_confidence: row.ml_confidence,
      ai_narrative: row.ai_narrative,
      ai_narrative_model: row.ai_narrative_model,
      submissions: row.sub_id
        ? {
            id: row.sub_id,
            nama: row.sub_nama,
            jenis_kelamin: row.sub_jenis_kelamin,
            nomor_wa: row.sub_nomor_wa,
            audio_duration_sec: row.sub_audio_duration_sec,
          }
        : null,
    };
  } catch {
    return null;
  }
}

/** Nilai pengajar untuk satu submission, kalau sudah masuk. */
async function getTeacherEvaluation(
  submissionId: string,
): Promise<TeacherEvaluationView | null> {
  try {
    const rows = await sql`
      SELECT kode_unik, pemeriksa, kegiatan, score_min, label_min,
             score_harakat, label_harakat,
             score_panjang_pendek, label_panjang_pendek,
             score_tasydid, label_tasydid,
             score_hukum_tajwid, label_hukum_tajwid,
             score_ketepatan_huruf, label_ketepatan_huruf
      FROM teacher_evaluations
      WHERE submission_id = ${submissionId}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) return null;

    const indikator = [
      ["Harakat", r.score_harakat, r.label_harakat],
      ["Ketepatan Huruf", r.score_ketepatan_huruf, r.label_ketepatan_huruf],
      ["Panjang Pendek", r.score_panjang_pendek, r.label_panjang_pendek],
      ["Tasydid", r.score_tasydid, r.label_tasydid],
      ["Hukum Tajwid", r.score_hukum_tajwid, r.label_hukum_tajwid],
    ] as const;

    return {
      kodeUnik: r.kode_unik as string,
      pemeriksa: (r.pemeriksa as string | null) ?? null,
      kegiatan: (r.kegiatan as string | null) ?? null,
      scoreMin: (r.score_min as number | null) ?? null,
      labelMin: (r.label_min as string | null) ?? null,
      // Aspek yang tidak dinilai disembunyikan, bukan ditampilkan sebagai nol.
      indikator: indikator
        .filter(([, score]) => score != null)
        .map(([label, score, mutu]) => ({
          label,
          score: score as number | null,
          mutu: (mutu as string | null) ?? null,
        })),
    };
  } catch (err) {
    console.error("[rapot] gagal ambil nilai pengajar:", (err as Error).message);
    return null;
  }
}

interface NativeEvalRow {
  source: string;
  pemeriksa: string | null;
  kegiatan: string | null;
  created_at: Date | null;
  rekomendasi_program: string | null;
  ayat: unknown;
  score_ayat: unknown;
  score_min: number | null;
  label_min: string | null;
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
 * Kolom jsonb kembali dari driver sebagai nilai bebas, jadi bentuknya dipastikan
 * di sini. Baris lama bisa saja ditulis sebelum katalog segmen selengkap
 * sekarang — segmen yang hilang diisi kosong daripada meruntuhkan halaman.
 */
function normalizeAyat(raw: unknown): EvaluationAyat | null {
  if (raw == null || typeof raw !== "object") return null;
  const src = raw as Record<string, { jaliy?: unknown; khafiy?: unknown }>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return SEGMENT_KEYS.reduce((acc, key) => {
    acc[key] = {
      jaliy: strings(src[key]?.jaliy),
      khafiy: strings(src[key]?.khafiy),
    };
    return acc;
  }, {} as EvaluationAyat);
}

function normalizeSegmentScores(raw: unknown): Partial<Record<SegmentKey, number>> {
  if (raw == null || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Partial<Record<SegmentKey, number>> = {};
  for (const key of SEGMENT_KEYS) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/**
 * Penilaian yang diisi pengajar langsung di portal ini.
 *
 * Hanya baris `source = 'native'` yang punya temuan mentah per segmen; baris
 * salinan dari panel luar cuma membawa lima skor indikator, jadi rapot rincinya
 * tidak bisa dirakit dan pemanggil harus jatuh ke tampilan ringkas.
 */
async function getNativeEvaluation(
  submissionId: string,
): Promise<NativeEvaluationView | null> {
  try {
    const rows = await sql<NativeEvalRow[]>`
      SELECT source, pemeriksa, kegiatan, created_at, rekomendasi_program,
             ayat, score_ayat, score_min, label_min,
             score_harakat, label_harakat,
             score_ketepatan_huruf, label_ketepatan_huruf,
             score_panjang_pendek, label_panjang_pendek,
             score_tasydid, label_tasydid,
             score_hukum_tajwid, label_hukum_tajwid
      FROM teacher_evaluations
      WHERE submission_id = ${submissionId}
      LIMIT 1
    `;
    const r = rows[0];
    if (!r || r.source !== "native") return null;

    const skorIndikator: Record<
      (typeof INDICATOR_KEYS)[number],
      { score: number | null; mutu: string | null }
    > = {
      harakat: { score: r.score_harakat, mutu: r.label_harakat },
      ketepatanHuruf: {
        score: r.score_ketepatan_huruf,
        mutu: r.label_ketepatan_huruf,
      },
      panjangPendek: {
        score: r.score_panjang_pendek,
        mutu: r.label_panjang_pendek,
      },
      tasydid: { score: r.score_tasydid, mutu: r.label_tasydid },
      hukumTajwid: { score: r.score_hukum_tajwid, mutu: r.label_hukum_tajwid },
    };

    return {
      pemeriksa: r.pemeriksa,
      kegiatan: r.kegiatan,
      createdAt: r.created_at?.toISOString() ?? null,
      rekomendasiProgram: r.rekomendasi_program,
      scoreTen: r.score_min,
      labelMin: r.label_min,
      ayat: normalizeAyat(r.ayat),
      perSegment: normalizeSegmentScores(r.score_ayat),
      indikator: INDICATOR_KEYS.map((key) => ({ key, ...skorIndikator[key] })),
    };
  } catch (err) {
    console.error(
      "[rapot] gagal ambil penilaian native:",
      (err as Error).message,
    );
    return null;
  }
}

/**
 * Penilaian lain milik peserta yang sama.
 *
 * Dicocokkan lewat nomor WhatsApp, bukan nama: nama sering ditulis berbeda tiap
 * kali mendaftar, sedangkan nomor jauh lebih stabil. Kalau peserta baru dinilai
 * sekali, komponennya menyembunyikan diri sendiri.
 */
async function getRiwayat(nomorWa: string): Promise<HistoryItem[]> {
  try {
    const rows = await sql<
      {
        rapot_slug: string | null;
        kegiatan: string | null;
        created_at: Date | null;
        score_min: number | null;
      }[]
    >`
      SELECT s.rapot_slug, te.kegiatan, te.created_at, te.score_min
      FROM teacher_evaluations te
      JOIN submissions s ON s.id = te.submission_id
      WHERE s.nomor_wa = ${nomorWa} AND s.rapot_slug IS NOT NULL
      ORDER BY te.created_at DESC
      LIMIT 12
    `;
    return rows
      .filter((r): r is typeof r & { rapot_slug: string } => r.rapot_slug != null)
      .map((r) => ({
        slug: r.rapot_slug,
        kegiatan: r.kegiatan,
        createdAt: r.created_at?.toISOString() ?? "",
        scoreTen: r.score_min,
      }));
  } catch (err) {
    // Riwayat hanyalah pelengkap — rapotnya sendiri tetap harus tampil.
    console.error("[rapot] gagal ambil riwayat:", (err as Error).message);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Judulnya bersandar pada peserta, bukan pada rapot AI: rapot AI baru ada
  // setelah worker jalan, sedangkan tautan ini sudah beredar sejak pengajar
  // selesai menilai.
  const submission = await getSubmissionBySlug(slug);
  if (!submission)
    return { title: "Rapot tidak ditemukan — Muhajir Project Tilawah" };

  // Judul dan preview share TIDAK boleh memuat skor AI. Halaman ini bisa
  // dibagikan ke grup WhatsApp, dan skor AI adalah bahan pembanding internal
  // sampai Januari — bukan angka yang diumumkan ke peserta.
  const ev = await getTeacherEvaluation(submission.id);
  if (!ev || ev.scoreMin == null) {
    return {
      title: "Rapot Assessment Al-Fatihah — Muhajir Project Tilawah",
      description: "Rekaman sedang diperiksa pengajar.",
    };
  }
  return {
    title: `Rapot Bacaan: ${ev.scoreMin}/10 — Muhajir Project Tilawah`,
    description: ev.labelMin ?? "Rapot Assessment Al-Fatihah",
    openGraph: {
      title: `Rapot Assessment Al-Fatihah: ${ev.scoreMin}/10`,
      description: "Dinilai langsung oleh pengajar Muhajir Project Tilawah",
    },
  };
}

function fmt(sec: number | null | undefined): string {
  if (sec == null) return "—";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function scoreColor(skor: number): string {
  if (skor >= 4) return "var(--success)";
  if (skor === 3) return "var(--accent-deep)";
  return "var(--danger)";
}

interface SubmissionBySlug {
  id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  nomor_wa: string;
  audio_duration_sec: number | null;
}

/**
 * Peserta pemilik sebuah slug rapot.
 *
 * Dicari lewat `submissions`, BUKAN lewat tabel `rapot`. Tabel rapot hanya
 * terisi setelah worker AI berjalan, sedangkan yang dilihat peserta adalah
 * penilaian pengajar — dua hal yang tidak saling menunggu. Menggantungkan
 * halaman ini pada baris rapot membuat tautan yang sudah terkirim lewat
 * WhatsApp berakhir di 404 selama worker belum sempat jalan.
 */
async function getSubmissionBySlug(slug: string): Promise<SubmissionBySlug | null> {
  try {
    const rows = await sql<SubmissionBySlug[]>`
      SELECT id, nama, jenis_kelamin, nomor_wa,
             audio_duration_sec::float8 AS audio_duration_sec
      FROM submissions
      WHERE rapot_slug = ${slug}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (err) {
    console.error("[rapot] gagal ambil submission:", (err as Error).message);
    return null;
  }
}

export default async function RapotPage({ params }: Props) {
  const { slug } = await params;
  const submission = await getSubmissionBySlug(slug);
  if (!submission) notFound();

  // Sejak rapat 3 Agustus 2026, nilai yang dilihat peserta berasal dari
  // PENGAJAR. Rapot AI tetap dihitung, tapi jadi bahan pembanding internal
  // sampai Januari — hanya pengajar/admin yang login yang melihatnya.
  const teacherEval = await getTeacherEvaluation(submission.id);
  const internalViewer =
    (await getCurrentTeacher()) ?? (await getCurrentAdmin());

  if (!internalViewer) {
    const sub = submission;
    const namaPeserta = sub.nama;
    // Penilaian yang lahir di portal ini membawa temuan per segmen, jadi peserta
    // bisa diberi rapot rinci. Salinan dari panel luar hanya punya lima skor —
    // untuk baris seperti itu tampilan ringkas tetap yang paling jujur.
    const native = teacherEval
      ? await getNativeEvaluation(submission.id)
      : null;
    const riwayat = teacherEval
      ? await getRiwayat(submission.nomor_wa)
      : [];
    return (
      <div
        className="screen-enter"
        style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px" }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <MountainGlyph size={28} color="var(--accent)" />
        </div>

        {teacherEval ? (
          <>
            {native ? (
              <NativeEvaluationReport nama={namaPeserta} ev={native} />
            ) : (
              <TeacherEvaluationReport nama={namaPeserta} ev={teacherEval} />
            )}
            {riwayat.length > 1 && (
              <div style={{ marginTop: 18 }}>
                <AssessmentHistory items={riwayat} currentSlug={slug} />
              </div>
            )}
            {/* Ajakan lanjut ke program tidak ikut tercetak: di atas kertas
                tautannya tidak bisa diklik dan hanya menyita satu halaman. */}
            {sub && (
              <div className="no-print" style={{ marginTop: 24 }}>
                <NextStepsGate
                  rapotSlug={slug}
                  submissionId={sub.id}
                  jenisKelamin={sub.jenis_kelamin}
                  eligibility={await getParticipantEligibility(sub.id)}
                />
              </div>
            )}
            <div
              className="no-print"
              style={{
                marginTop: 24,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
              }}
            >
              <ShareButtons slug={slug} skor={teacherEval.scoreMin} />
              <PrintButton label="Simpan PDF" />
            </div>
          </>
        ) : (
          <WaitingForTeacher nama={namaPeserta} />
        )}
      </div>
    );
  }

  // Mulai dari sini yang dilayani adalah pengajar/admin: rapot AI sebagai bahan
  // pembanding. Barisnya baru ada setelah worker berjalan, jadi ketiadaannya
  // bukan kesalahan — cukup tampilkan keterangan, jangan 404.
  const rapot = await getRapot(slug);
  if (!rapot) {
    return (
      <div
        className="screen-enter"
        style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}
      >
        <div className="card-mpt" style={{ padding: "28px 24px", textAlign: "center" }}>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>
            Rapot AI belum tersedia
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.65, margin: 0 }}>
            Bacaan <strong>{submission.nama}</strong> belum diproses mesin, jadi
            belum ada pembanding untuk penilaian pengajar. Halaman ini akan terisi
            sendiri setelah pemrosesan berjalan.
          </p>
        </div>
      </div>
    );
  }

  const errorsByCategory: Record<IndikatorKey, ErrorItem[]> = {
    harakat: rapot.errors_harakat,
    huruf: rapot.errors_huruf,
    panjang_pendek: rapot.errors_panjang_pendek,
    syaddah: rapot.errors_syaddah,
  };

  const nama = submission.nama;
  const today = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const bandColor = scoreColor(rapot.skor);

  const indikatorEntries: { kategori: IndikatorKey; errors: ErrorItem[] }[] = [
    { kategori: "harakat", errors: rapot.errors_harakat },
    { kategori: "huruf", errors: rapot.errors_huruf },
    { kategori: "panjang_pendek", errors: rapot.errors_panjang_pendek },
    { kategori: "syaddah", errors: rapot.errors_syaddah },
  ];

  return (
    <div
      className="screen-enter"
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "32px 20px 80px",
      }}
    >
      {/* Hero card */}
      <div
        className="card-mpt"
        style={{
          padding: "32px 24px",
          marginBottom: 22,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 240,
            height: 240,
            background: bandColor,
            opacity: 0.13,
            borderRadius: "50%",
            filter: "blur(44px)",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        <div
          className="pill"
          style={{
            background:
              "color-mix(in oklab, var(--primary), transparent 90%)",
            color: "var(--primary)",
            marginBottom: 18,
            position: "relative",
          }}
        >
          Rapot · {nama} · {today}
        </div>

        <div
          className="rapot-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 28,
            alignItems: "center",
            position: "relative",
          }}
        >
          <ScoreCircle
            score={rapot.skor}
            max={5}
            size={180}
            color={bandColor}
          />
          <div>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(26px, 4vw, 40px)",
                margin: "0 0 10px",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {rapot.status_label}
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "var(--ink-soft)",
                margin: 0,
                lineHeight: 1.6,
                maxWidth: 480,
              }}
            >
              {rapot.total_errors_major + rapot.total_errors_minor === 0
                ? "Masya Allah, bacaan Anda sangat baik. Tidak ada catatan khusus dari sistem."
                : `Ada ${
                    rapot.total_errors_major + rapot.total_errors_minor
                  } catatan kecil. Pelajari rinciannya di bawah untuk perbaikan berikutnya.`}
            </p>
          </div>
        </div>

        <div
          className="rapot-stats-row"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginTop: 28,
            paddingTop: 24,
            borderTop: "1px solid var(--line)",
            position: "relative",
          }}
        >
          {[
            {
              label: "Salah Besar",
              val: String(rapot.total_errors_major),
              unit: "lahn jaliy",
              color: "var(--danger)",
            },
            {
              label: "Salah Kecil",
              val: String(rapot.total_errors_minor),
              unit: "catatan",
              color: "var(--warning)",
            },
            {
              label: "Durasi",
              val: fmt(submission.audio_duration_sec),
              unit: "menit",
              color: "var(--success)",
            },
          ].map((s) => (
            <div key={s.label} className="rapot-stat">
              <div className="rapot-stat-label">
                <span
                  className="rapot-stat-dot"
                  style={{ background: s.color }}
                />
                {s.label}
              </div>
              <div
                className="font-display rapot-stat-val"
                style={{ color: s.color }}
              >
                {s.val}
                <span className="rapot-stat-unit">{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share row */}
      <div style={{ marginBottom: 26 }}>
        {/* Tanpa skor: yang dilihat di sini rapot AI (skala 1-5), sedangkan
            ShareButtons menulis "/10" karena diperuntukkan bagi nilai pengajar.
            Mengoper skor AI ke sini membuat pesan yang dibagikan menyebut angka
            di skala yang salah. */}
        <ShareButtons slug={slug} skor={null} />
      </div>

      {/* AI Narrative — optional, only if generated */}
      {rapot.ai_narrative && <AINarrative narrative={rapot.ai_narrative} />}

      {/* Tinjauan per Ayat */}
      <section style={{ marginBottom: 36 }}>
        <div className="rapot-kicker">Al-Fatihah · 7 Ayat</div>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            margin: "0 0 6px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
          }}
        >
          Tinjauan per Ayat
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "0 0 18px",
          }}
        >
          Kata-kata yang perlu diperhatikan ditandai dengan warna sesuai
          kategori.
        </p>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          {(Object.entries(INDIKATOR_META) as [IndikatorKey, (typeof INDIKATOR_META)[IndikatorKey]][]).map(
            ([k, m]) => (
              <div key={k} className="legend-chip">
                <span
                  className="legend-swatch"
                  style={{
                    background: `color-mix(in oklab, ${m.color}, transparent 70%)`,
                    borderBottom: `2px solid ${m.color}`,
                  }}
                />
                {m.label}
              </div>
            ),
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 12,
          }}
        >
          {AL_FATIHAH.map((a) => (
            <AyatCard
              key={a.number}
              ayatNumber={a.number}
              errorsByCategory={errorsByCategory}
            />
          ))}
        </div>
      </section>

      {/* Detail per Indikator */}
      <section style={{ marginBottom: 36 }}>
        <div className="rapot-kicker">4 Indikator Lahn</div>
        <h2
          className="font-display"
          style={{
            fontSize: "clamp(22px, 3vw, 28px)",
            margin: "0 0 6px",
            fontWeight: 800,
            letterSpacing: "-0.025em",
          }}
        >
          Detail per Indikator
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            margin: "0 0 18px",
          }}
        >
          Catatan lengkap untuk setiap kategori — klik untuk lihat rincian.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {indikatorEntries.map((it) => (
            <IndikatorCard
              key={it.kategori}
              kategori={it.kategori}
              errors={it.errors}
            />
          ))}
        </div>
      </section>

      {/* Brand mark divider */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 18,
        }}
        aria-hidden
      >
        <MountainGlyph size={28} color="var(--accent)" />
      </div>

      {submission && (
        <NextStepsGate
          rapotSlug={slug}
          submissionId={submission.id}
          jenisKelamin={submission.jenis_kelamin}
          eligibility={await getParticipantEligibility(submission.id)}
        />
      )}

      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Link
          href={`/peserta/${slug}`}
          className="btn-mpt btn-mpt-accent"
          style={{ minHeight: 44, padding: "10px 20px", fontSize: 13 }}
        >
          Dashboard Peserta
        </Link>
        <Link
          href="/assessment/consent"
          className="btn-mpt btn-mpt-outline"
          style={{ minHeight: 44, padding: "10px 20px", fontSize: 13 }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          Ulangi Assessment
        </Link>
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-mute)",
            textAlign: "center",
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}
        >
          Model: {rapot.ml_model_version ?? "—"} · Confidence{" "}
          {rapot.ml_confidence
            ? `${(rapot.ml_confidence * 100).toFixed(0)}%`
            : "—"}{" "}
          · Hasil bersifat referensi, bukan pengganti penilaian langsung
        </p>
      </div>
    </div>
  );
}
