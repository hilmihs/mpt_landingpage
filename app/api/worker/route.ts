import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { buildAiEvaluationRow } from "@/lib/ai-eval/store";
import type { ErrorItem, MLPredictResult } from "@/types";

/**
 * Worker penilaian mesin — memproyeksikan temuan mentah jadi penilaian.
 *
 * TIDAK memanggil ML server. GPU dinyalakan seperlunya, tidak jalan terus
 * (~$125/bulan untuk pekerjaan beberapa menit sehari), jadi sebagian besar
 * waktu tidak ada yang bisa dipanggil — dan alamat VM berubah tiap kali
 * dinyalakan. VM menulis temuan mentah ke `ai_inference_raw` lalu mati; worker
 * ini membacanya kapan saja setelahnya.
 *
 * Pembagiannya mengikuti bahasa masing-masing: Python mengubah audio jadi
 * temuan, TypeScript memproyeksikan temuan ke instrumen pengajar. Logika
 * proyeksi itu memakai computeEvaluation milik pengajar; menuliskannya ulang
 * dalam Python berarti dua implementasi yang akan menyimpang diam-diam.
 *
 * Lihat docs/BATCH_INFERENSI.md.
 *
 * Worker ini TIDAK menyentuh `submissions.status` — kolom itu milik alur
 * pengajar. Statusnya sendiri ada di `submissions.ai_status`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_JOBS_PER_INVOCATION = 10;

/**
 * Mock sudah tidak punya peran di sini.
 *
 * Worker ini tidak lagi memanggil model — ia cuma memproyeksikan temuan yang
 * sudah ada di ai_inference_raw. Tidak ada lagi jalur yang bisa diam-diam
 * jatuh ke bilangan acak lalu menyimpannya sebagai penilaian. `lib/mock-ml.ts`
 * kini hanya dipakai pintasan demo di app/api/bypass.
 */

/**
 * Bungkus nilai untuk kolom jsonb. Tipe JSONValue milik postgres.js menolak
 * interface dengan properti opsional (mis. ErrorItem.note), padahal di runtime
 * nilainya JSON valid — jadi cast-nya dipusatkan di sini.
 */
function jsonb(value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

function authorized(req: Request): boolean {
  // Spasi dan newline dipangkas di KEDUA sisi.
  //
  // Rahasia di Secret Manager sering tersimpan dengan newline di ujung — cukup
  // menekan Enter sekali saat membuatnya. Cloud Run menyuntikkannya apa adanya,
  // sehingga nilai di container tidak pernah sama dengan yang dikirim
  // pemanggil, dan worker menolak SEMUA permintaan dengan 401 yang terlihat
  // seperti salah rahasia. Terjadi di produksi; ditemukan saat uji asap.
  const secret = process.env.WORKER_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim();
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-worker-secret")?.trim();
  if (x === secret) return true;
  return false;
}

/** Satu baris temuan mentah yang menunggu diproyeksikan. */
interface BarisMentah {
  id: string;
  submission_id: string;
  findings: ErrorItem[] | null;
  ml_model_version: string;
  ml_confidence: number | null;
  ml_raw_output: unknown;
}

const FIELD_KATEGORI: Record<string, keyof MLPredictResult> = {
  harakat: "errors_harakat",
  ketepatan_huruf: "errors_ketepatan_huruf",
  panjang_pendek: "errors_panjang_pendek",
  tasydid: "errors_tasydid",
  hukum_tajwid: "errors_hukum_tajwid",
};

/**
 * Kembalikan temuan datar ke bentuk MLPredictResult.
 *
 * `ai_inference_raw.findings` menyimpan kelima indikator sebagai satu daftar,
 * jadi kategorinya dibaca dari tiap temuan. Tanpa pengelompokan ini, aturan
 * pencocokan katalog yang menyaring berdasarkan kategori tidak akan cocok.
 */
function keHasilML(baris: BarisMentah): MLPredictResult {
  const hasil: MLPredictResult = {
    errors_harakat: [],
    errors_ketepatan_huruf: [],
    errors_panjang_pendek: [],
    errors_tasydid: [],
    errors_hukum_tajwid: [],
    ml_model_version: baris.ml_model_version,
    ml_confidence: baris.ml_confidence ?? 0,
    ml_raw_output: baris.ml_raw_output,
  };
  for (const f of baris.findings ?? []) {
    const kunci = FIELD_KATEGORI[f.kategori ?? ""] ?? "errors_ketepatan_huruf";
    (hasil[kunci] as ErrorItem[]).push(f);
  }
  return hasil;
}

async function processJob(baris: BarisMentah): Promise<{
  ok: boolean;
  error?: string;
}> {
  const job = { submission_id: baris.submission_id };
  await sql`
    UPDATE submissions SET ai_status = ${"processing"} WHERE id = ${job.submission_id}
  `;

  try {
    const row = buildAiEvaluationRow(job.submission_id, keHasilML(baris));

    try {
      await sql`
        INSERT INTO ai_evaluations (
          submission_id, ayat, score_ayat, score_min, label_min,
          score_harakat, label_harakat,
          score_ketepatan_huruf, label_ketepatan_huruf,
          score_panjang_pendek, label_panjang_pendek,
          score_tasydid, label_tasydid,
          score_hukum_tajwid, label_hukum_tajwid,
          total_jaliy, total_khafiy, findings,
          ml_model_version, ml_confidence, ml_raw_output
        ) VALUES (
          ${job.submission_id},
          ${jsonb(row.ayat)},
          ${jsonb(row.score_ayat)},
          ${row.score_min},
          ${row.label_min},
          ${row.score_harakat}, ${row.label_harakat},
          ${row.score_ketepatan_huruf}, ${row.label_ketepatan_huruf},
          ${row.score_panjang_pendek}, ${row.label_panjang_pendek},
          ${row.score_tasydid}, ${row.label_tasydid},
          ${row.score_hukum_tajwid}, ${row.label_hukum_tajwid},
          ${row.total_jaliy},
          ${row.total_khafiy},
          ${jsonb(row.findings)},
          ${row.ml_model_version},
          ${row.ml_confidence},
          ${row.ml_raw_output == null ? null : jsonb(row.ml_raw_output)}
        )
        ON CONFLICT (submission_id) DO UPDATE SET
          ayat = EXCLUDED.ayat,
          score_ayat = EXCLUDED.score_ayat,
          score_min = EXCLUDED.score_min,
          label_min = EXCLUDED.label_min,
          score_harakat = EXCLUDED.score_harakat,
          label_harakat = EXCLUDED.label_harakat,
          score_ketepatan_huruf = EXCLUDED.score_ketepatan_huruf,
          label_ketepatan_huruf = EXCLUDED.label_ketepatan_huruf,
          score_panjang_pendek = EXCLUDED.score_panjang_pendek,
          label_panjang_pendek = EXCLUDED.label_panjang_pendek,
          score_tasydid = EXCLUDED.score_tasydid,
          label_tasydid = EXCLUDED.label_tasydid,
          score_hukum_tajwid = EXCLUDED.score_hukum_tajwid,
          label_hukum_tajwid = EXCLUDED.label_hukum_tajwid,
          total_jaliy = EXCLUDED.total_jaliy,
          total_khafiy = EXCLUDED.total_khafiy,
          findings = EXCLUDED.findings,
          ml_model_version = EXCLUDED.ml_model_version,
          ml_confidence = EXCLUDED.ml_confidence,
          ml_raw_output = EXCLUDED.ml_raw_output
      `;
    } catch (err) {
      throw new Error(`ai_evaluations insert: ${(err as Error).message}`);
    }

    await sql`
      UPDATE submissions SET
        ai_status = ${"completed"},
        ai_error_message = NULL,
        ai_processed_at = ${new Date()}
      WHERE id = ${job.submission_id}
    `;

    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    // Kegagalan mesin tidak boleh terlihat oleh peserta maupun mengubah alur
    // pengajar — karena itu hanya kolom ai_* yang disentuh.
    await sql`
      UPDATE submissions SET
        ai_status = ${"failed"},
        ai_error_message = ${msg.slice(0, 500)},
        ai_processed_at = ${new Date()}
      WHERE id = ${job.submission_id}
    `;
    return { ok: false, error: msg };
  }
}

async function handleRun(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Antreannya adalah tabel, bukan Redis: temuan mentah ditulis VM GPU yang
  // sudah mati saat worker ini jalan, jadi tidak ada yang bisa mengirim pesan
  // ke mana pun. `diproses_at IS NULL` adalah satu-satunya penanda antrean.
  let antrean: BarisMentah[] = [];
  try {
    antrean = await sql<BarisMentah[]>`
      SELECT id, submission_id, findings, ml_model_version,
             ml_confidence::float8 AS ml_confidence, ml_raw_output
      FROM ai_inference_raw
      WHERE diproses_at IS NULL
      ORDER BY created_at
      LIMIT ${MAX_JOBS_PER_INVOCATION}
    `;
  } catch (err) {
    console.error("[worker] gagal membaca ai_inference_raw:", (err as Error).message);
    return NextResponse.json(
      { error: "queue_unreadable", message: (err as Error).message },
      { status: 500 },
    );
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const baris of antrean) {
    const r = await processJob(baris);
    results.push({ id: baris.submission_id, ...r });
    // Ditandai selesai apa pun hasilnya. Baris yang gagal diproyeksikan akan
    // gagal lagi dengan cara yang sama pada putaran berikutnya — mencobanya
    // terus hanya memblokir antrean. Sebabnya tercatat di
    // submissions.ai_error_message.
    await sql`
      UPDATE ai_inference_raw SET diproses_at = ${new Date()} WHERE id = ${baris.id}
    `;
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(req: Request) {
  // Vercel cron sends GET
  return handleRun(req);
}

export async function POST(req: Request) {
  return handleRun(req);
}
