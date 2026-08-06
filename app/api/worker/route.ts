import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import { drainJobs, type MLJob } from "@/lib/queue";
import { mockMLPredict } from "@/lib/mock-ml";
import { mlPredict } from "@/lib/ml-client";
import { buildAiEvaluationRow } from "@/lib/ai-eval/store";

/**
 * Worker penilaian mesin.
 *
 * Hasilnya masuk ke `ai_evaluations` dalam instrumen yang sama dengan pengajar
 * (delapan segmen, lima indikator, skala 1-10), bukan ke `rapot` dengan skala
 * 1-5 seperti sebelumnya. Alasannya ada di db/migrations/0010_ai_evaluation.sql.
 *
 * Worker ini TIDAK menyentuh `submissions.status` — kolom itu milik alur
 * pengajar. Statusnya sendiri ada di `submissions.ai_status`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_JOBS_PER_INVOCATION = 10;

/**
 * Mock hanya boleh hidup di luar produksi.
 *
 * Sebelumnya worker diam-diam jatuh ke `mockMLPredict` begitu `ML_SERVER_URL`
 * kosong, lalu menyimpan hasilnya seperti penilaian sungguhan. Nilai-nilai itu
 * bilangan acak. Karena mesin ini ada semata untuk dibandingkan dengan
 * pengajar, satu baris acak yang lolos ke basis data akan membuat kesimpulan
 * perbandingannya salah — dan tidak ada yang akan menyadarinya, karena
 * bentuknya sama persis dengan penilaian nyata.
 */
function mockDiizinkan(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Bungkus nilai untuk kolom jsonb. Tipe JSONValue milik postgres.js menolak
 * interface dengan properti opsional (mis. ErrorItem.note), padahal di runtime
 * nilainya JSON valid — jadi cast-nya dipusatkan di sini.
 */
function jsonb(value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

function authorized(req: Request): boolean {
  // Vercel cron uses Bearer token; manual trigger uses x-worker-secret
  const secret = process.env.WORKER_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-worker-secret");
  if (x === secret) return true;
  return false;
}

async function processJob(job: MLJob): Promise<{
  ok: boolean;
  error?: string;
}> {
  await sql`
    UPDATE submissions SET ai_status = ${"processing"} WHERE id = ${job.submission_id}
  `;

  try {
    // Signed URL for ML server (mock doesn't use it, but real client will)
    let signedUrl = "";
    try {
      signedUrl = await signedAudioUrl(job.audio_path, 60 * 10);
    } catch {
      // Gagal menandatangani bukan alasan menggagalkan job — mock tidak
      // memakainya, dan ml-client yang akan mengeluh kalau URL kosong.
    }

    const mlInput = {
      submission_id: job.submission_id,
      audio_url: signedUrl,
    };

    const result = process.env.ML_SERVER_URL
      ? await mlPredict(mlInput)
      : mockMLPredict(mlInput);

    const row = buildAiEvaluationRow(job.submission_id, result);

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

  // Tanpa ML server, tidak ada yang bisa dikerjakan. Rekaman sengaja dibiarkan
  // 'pending' — bukan ditandai gagal — supaya ikut terproses begitu model
  // menyala, selama audionya belum kena retensi 7 hari.
  if (!process.env.ML_SERVER_URL && !mockDiizinkan()) {
    return NextResponse.json({
      processed: 0,
      results: [],
      skipped: "ML_SERVER_URL belum diset; mock tidak dijalankan di produksi",
    });
  }

  // Antrean Redis adalah jalur cepat, bukan sumber kebenaran. Kalau Upstash
  // tidak terjangkau, jangan menjatuhkan seluruh run — justru untuk keadaan
  // inilah pemindaian basis data di bawah ada. Sebelumnya galat di sini
  // melempar keluar dan fallback-nya tidak pernah sempat jalan.
  let jobs: MLJob[] = [];
  try {
    jobs = await drainJobs(MAX_JOBS_PER_INVOCATION);
  } catch (err) {
    console.error("[worker] antrean tidak terbaca:", (err as Error).message);
  }

  // Fallback: also pick up orphaned pending submissions (queue lost / no enqueue)
  if (jobs.length < MAX_JOBS_PER_INVOCATION) {
    let pending: {
      id: string;
      rapot_slug: string | null;
      audio_path: string;
    }[] = [];
    try {
      // Antre berdasarkan ai_status, bukan status: rekaman yang sudah dinilai
      // pengajar (status = 'completed') tetap perlu dinilai mesin — justru
      // itulah pasangan yang dicari untuk perbandingan.
      pending = await sql`
        SELECT id, rapot_slug, audio_path
        FROM submissions
        WHERE ai_status = ${"pending"}
          AND created_at < ${new Date(Date.now() - 2 * 60_000)}
        LIMIT ${MAX_JOBS_PER_INVOCATION - jobs.length}
      `;
    } catch (err) {
      console.error("pending scan error", err);
    }
    for (const p of pending) {
      jobs.push({
        submission_id: p.id,
        rapot_slug: p.rapot_slug ?? "",
        audio_path: p.audio_path,
        enqueued_at: Date.now(),
      });
    }
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const job of jobs) {
    const r = await processJob(job);
    results.push({ id: job.submission_id, ...r });
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
