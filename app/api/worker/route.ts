import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { signedAudioUrl } from "@/lib/storage";
import { drainJobs, type MLJob } from "@/lib/queue";
import { mockMLPredict } from "@/lib/mock-ml";
import { mlPredict } from "@/lib/ml-client";
import { computeScore } from "@/lib/scoring";
import { generateRapotNarrative } from "@/lib/ai/explain-rapot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_JOBS_PER_INVOCATION = 10;

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
    UPDATE submissions SET status = ${"processing"} WHERE id = ${job.submission_id}
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

    const score = computeScore(result);

    // Generate AI narrative (Phase 1 — optional, only if DEEPSEEK_API_KEY set)
    const narrative = await generateRapotNarrative({
      skor: score.skor,
      status_label: score.status_label,
      total_errors_major: score.total_errors_major,
      total_errors_minor: score.total_errors_minor,
      errors: {
        harakat: result.errors_harakat,
        huruf: result.errors_huruf,
        panjang_pendek: result.errors_panjang_pendek,
        syaddah: result.errors_syaddah,
      },
    });

    try {
      await sql`
        INSERT INTO rapot (
          slug, submission_id, skor, status_label,
          errors_harakat, errors_huruf, errors_panjang_pendek, errors_syaddah,
          total_errors_major, total_errors_minor, weighted_score,
          ml_model_version, ml_confidence, ml_raw_output,
          ai_narrative, ai_narrative_model
        ) VALUES (
          ${job.rapot_slug},
          ${job.submission_id},
          ${score.skor},
          ${score.status_label},
          ${jsonb(result.errors_harakat)},
          ${jsonb(result.errors_huruf)},
          ${jsonb(result.errors_panjang_pendek)},
          ${jsonb(result.errors_syaddah)},
          ${score.total_errors_major},
          ${score.total_errors_minor},
          ${score.weighted_score},
          ${result.ml_model_version},
          ${result.ml_confidence},
          ${result.ml_raw_output == null ? null : jsonb(result.ml_raw_output)},
          ${narrative?.narrative ?? null},
          ${narrative?.model ?? null}
        )
      `;
    } catch (err) {
      throw new Error(`rapot insert: ${(err as Error).message}`);
    }

    await sql`
      UPDATE submissions SET
        status = ${"completed"},
        processed_at = ${new Date()},
        ai_narrative_generated_at = ${narrative ? new Date() : null}
      WHERE id = ${job.submission_id}
    `;

    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    await sql`
      UPDATE submissions SET
        status = ${"failed"},
        error_message = ${msg.slice(0, 500)},
        processed_at = ${new Date()}
      WHERE id = ${job.submission_id}
    `;
    return { ok: false, error: msg };
  }
}

async function handleRun(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = await drainJobs(MAX_JOBS_PER_INVOCATION);

  // Fallback: also pick up orphaned pending submissions (queue lost / no enqueue)
  if (jobs.length < MAX_JOBS_PER_INVOCATION) {
    let pending: {
      id: string;
      rapot_slug: string | null;
      audio_path: string;
    }[] = [];
    try {
      pending = await sql`
        SELECT id, rapot_slug, audio_path
        FROM submissions
        WHERE status = ${"pending"}
          AND created_at < ${new Date(Date.now() - 2 * 60_000)}
        LIMIT ${MAX_JOBS_PER_INVOCATION - jobs.length}
      `;
    } catch (err) {
      console.error("pending scan error", err);
    }
    for (const p of pending) {
      if (!p.rapot_slug) continue;
      jobs.push({
        submission_id: p.id,
        rapot_slug: p.rapot_slug,
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
