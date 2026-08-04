import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
import { EVALUATION_OPTIONS, SEGMENT_KEYS } from "@/lib/teacher-eval/catalog";
import { computeEvaluation } from "@/lib/teacher-eval/scoring";
import type { AyatPayload, SegmentKey } from "@/lib/teacher-eval/types";
import { sendWhatsApp, tplPesertaRapotReady } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const temuanSchema = z.object({
  jaliy: z.array(z.string()),
  khafiy: z.array(z.string()),
});

// Bentuk objek ayat diturunkan dari SEGMENT_KEYS supaya penambahan segmen di
// katalog tidak perlu disusul perubahan di sini.
const ayatSchema = z.object(
  Object.fromEntries(SEGMENT_KEYS.map((k) => [k, temuanSchema])) as Record<
    SegmentKey,
    typeof temuanSchema
  >,
);

const schema = z.object({
  assignment_id: z.string().uuid(),
  kegiatan: z.string().min(1).max(200),
  // nullish, bukan optional: rekomendasi adalah <select> yang selalu ikut
  // terkirim, dan pilihan "belum ditentukan" mengirimkan null — bukan
  // menghilangkan kuncinya.
  rekomendasi_program: z.enum(["HITS Dasar", "HITS Lanjutan"]).nullish(),
  ayat: ayatSchema,
});

const patchSchema = z.object({
  assignment_id: z.string().uuid(),
});

/**
 * Temuan yang tidak ada di katalog segmennya.
 *
 * Katalog adalah satu-satunya sumber kebenaran kategori kesalahan: skoring,
 * tampilan rapot, dan rekap semuanya membaca dari sana. Menerima string bebas
 * berarti membiarkan klien mengarang kategori yang tidak punya bobot, tidak
 * punya penjelasan untuk peserta, dan diam-diam hilang dari rekap.
 */
function temuanTakDikenal(ayat: AyatPayload): string[] {
  const asing: string[] = [];
  for (const key of SEGMENT_KEYS) {
    const opsi = EVALUATION_OPTIONS[key];
    for (const t of ayat[key].jaliy) {
      if (!opsi.jaliy.includes(t)) asing.push(`${key}.jaliy: ${t}`);
    }
    for (const t of ayat[key].khafiy) {
      if (!opsi.khafiy.includes(t)) asing.push(`${key}.khafiy: ${t}`);
    }
  }
  return asing;
}

interface AssignmentRow {
  submission_id: string;
  teacher_id: string | null;
  nama: string;
  nomor_wa: string;
  rapot_slug: string | null;
}

/**
 * Ambil penugasan beserta pesertanya, sekaligus pastikan pengajar yang login
 * memang berhak atasnya.
 *
 * Tanpa RLS, pengecekan kepemilikan di sini adalah satu-satunya penjaga: sesi
 * yang sah tidak dengan sendirinya berhak atas penugasan orang lain.
 * teacher_id null berarti rekaman jatuh ke superadmin — dibiarkan lewat supaya
 * tidak ada rekaman yang terkunci saat daftar pengajar belum terisi.
 */
async function ambilPenugasan(
  assignmentId: string,
  teacherId: string,
): Promise<{ row: AssignmentRow } | { error: NextResponse }> {
  const rows = await sql<AssignmentRow[]>`
    SELECT a.submission_id, a.teacher_id, s.nama, s.nomor_wa, s.rapot_slug
    FROM assignments a
    JOIN submissions s ON s.id = a.submission_id
    WHERE a.id = ${assignmentId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) {
    return { error: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  if (row.teacher_id && row.teacher_id !== teacherId) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { row };
}

/**
 * Simpan penilaian yang diisi pengajar langsung di portal, lalu kabari peserta.
 *
 * Penilaiannya lahir di sini, bukan disalin dari panel luar: yang tersimpan
 * adalah temuan per ayat apa adanya (kolom `ayat`), sementara skor per indikator
 * hanyalah turunannya. Menyimpan temuan mentah membuat rumus skoring bisa
 * direvisi belakangan tanpa kehilangan penilaian yang sudah masuk.
 */
export async function POST(req: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "Formulir penilaian belum lengkap atau bentuknya tidak dikenali.",
        details: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  }

  const ayat = parsed.data.ayat as AyatPayload;
  const asing = temuanTakDikenal(ayat);
  if (asing.length > 0) {
    return NextResponse.json(
      {
        error: "unknown_options",
        message: "Ada pilihan penilaian yang tidak dikenali.",
        details: asing,
      },
      { status: 400 },
    );
  }

  const found = await ambilPenugasan(parsed.data.assignment_id, teacher.teacherId);
  if ("error" in found) return found.error;
  const row = found.row;

  const hasil = computeEvaluation(ayat);
  const ind = hasil.indicators;

  try {
    await sql`
      INSERT INTO teacher_evaluations (
        submission_id, source, teacher_id, pemeriksa,
        kegiatan, rekomendasi_program,
        ayat, score_ayat,
        score_harakat, label_harakat,
        score_panjang_pendek, label_panjang_pendek,
        score_tasydid, label_tasydid,
        score_hukum_tajwid, label_hukum_tajwid,
        score_ketepatan_huruf, label_ketepatan_huruf,
        score_min, label_min
      ) VALUES (
        ${row.submission_id}, ${"native"}, ${teacher.teacherId}, ${teacher.nama},
        ${parsed.data.kegiatan}, ${parsed.data.rekomendasi_program ?? null},
        ${sql.json(ayat as unknown as Parameters<typeof sql.json>[0])},
        ${sql.json(hasil.perSegment as unknown as Parameters<typeof sql.json>[0])},
        ${ind.harakat.score}, ${ind.harakat.label},
        ${ind.panjangPendek.score}, ${ind.panjangPendek.label},
        ${ind.tasydid.score}, ${ind.tasydid.label},
        ${ind.hukumTajwid.score}, ${ind.hukumTajwid.label},
        ${ind.ketepatanHuruf.score}, ${ind.ketepatanHuruf.label},
        ${hasil.scoreTen}, ${hasil.band.title}
      )
      ON CONFLICT (submission_id) DO UPDATE SET
        source = EXCLUDED.source,
        teacher_id = EXCLUDED.teacher_id,
        pemeriksa = EXCLUDED.pemeriksa,
        kegiatan = EXCLUDED.kegiatan,
        rekomendasi_program = EXCLUDED.rekomendasi_program,
        ayat = EXCLUDED.ayat,
        score_ayat = EXCLUDED.score_ayat,
        score_harakat = EXCLUDED.score_harakat,
        label_harakat = EXCLUDED.label_harakat,
        score_panjang_pendek = EXCLUDED.score_panjang_pendek,
        label_panjang_pendek = EXCLUDED.label_panjang_pendek,
        score_tasydid = EXCLUDED.score_tasydid,
        label_tasydid = EXCLUDED.label_tasydid,
        score_hukum_tajwid = EXCLUDED.score_hukum_tajwid,
        label_hukum_tajwid = EXCLUDED.label_hukum_tajwid,
        score_ketepatan_huruf = EXCLUDED.score_ketepatan_huruf,
        label_ketepatan_huruf = EXCLUDED.label_ketepatan_huruf,
        score_min = EXCLUDED.score_min,
        label_min = EXCLUDED.label_min,
        fetched_at = now()
    `;
  } catch (err) {
    console.error("[evaluation] gagal simpan:", (err as Error).message);
    return NextResponse.json(
      { error: "db_error", message: "Gagal menyimpan hasil penilaian." },
      { status: 500 },
    );
  }

  const now = new Date();
  await sql`
    UPDATE assignments
    SET status = ${"completed"}, completed_at = ${now}
    WHERE id = ${parsed.data.assignment_id}
  `;
  await sql`
    UPDATE submissions
    SET status = ${"completed"}, processed_at = ${now}
    WHERE id = ${row.submission_id}
  `;

  // Kabari peserta. Gagal kirim TIDAK membatalkan penyimpanan — nilainya sudah
  // aman di database, dan WA bisa diulang dari portal admin.
  let waSent = false;
  if (row.rapot_slug) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const send = await sendWhatsApp(
      row.nomor_wa,
      tplPesertaRapotReady({
        pesertaNama: row.nama,
        rapotUrl: `${base}/rapot/${row.rapot_slug}`,
      }),
    );
    waSent = send.ok;
  }

  return NextResponse.json({
    ok: true,
    score: hasil.scoreTen,
    label: hasil.band.title,
    wa_sent: waSent,
  });
}

/**
 * Tandai penugasan sebagai sudah dibuka pengajarnya.
 *
 * Dipanggil saat formulir penilaian pertama kali dirender. Gunanya memisahkan
 * "belum disentuh" dari "sedang dikerjakan" di papan admin, supaya rekaman yang
 * menggantung berhari-hari bisa dialihkan ke pengajar lain.
 */
export async function PATCH(req: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const found = await ambilPenugasan(parsed.data.assignment_id, teacher.teacherId);
  if ("error" in found) return found.error;

  // Dibatasi ke penugasan yang belum berjalan: membuka ulang penugasan yang
  // sudah selesai tidak boleh memutar statusnya mundur, dan opened_at menandai
  // pembukaan PERTAMA sehingga tidak ditimpa kunjungan berikutnya.
  await sql`
    UPDATE assignments
    SET status = ${"opened"}, opened_at = COALESCE(opened_at, now())
    WHERE id = ${parsed.data.assignment_id}
      AND status IN ('assigned', 'notified')
  `;

  return NextResponse.json({ ok: true });
}
