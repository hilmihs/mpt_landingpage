import { NextResponse } from "next/server";
import { supabaseService, STORAGE_BUCKET } from "@/lib/supabase";
import { drainJobs, type MLJob } from "@/lib/queue";
import { mockMLPredict } from "@/lib/mock-ml";
import { computeScore } from "@/lib/scoring";
import { generateRapotNarrative } from "@/lib/ai/explain-rapot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_JOBS_PER_INVOCATION = 10;

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
  const sb = supabaseService();

  await sb
    .from("submissions")
    .update({ status: "processing" })
    .eq("id", job.submission_id);

  try {
    // Signed URL for ML server (mock doesn't use it, but real client will)
    const { data: signed } = await sb.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(job.audio_path, 60 * 10);

    const result = mockMLPredict({
      submission_id: job.submission_id,
      audio_url: signed?.signedUrl ?? "",
    });

    const score = computeScore(result);

    // Generate AI narrative (Phase 1 — optional, only if ANTHROPIC_API_KEY set)
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

    const { error: rapotErr } = await sb.from("rapot").insert({
      slug: job.rapot_slug,
      submission_id: job.submission_id,
      skor: score.skor,
      status_label: score.status_label,
      errors_harakat: result.errors_harakat,
      errors_huruf: result.errors_huruf,
      errors_panjang_pendek: result.errors_panjang_pendek,
      errors_syaddah: result.errors_syaddah,
      total_errors_major: score.total_errors_major,
      total_errors_minor: score.total_errors_minor,
      weighted_score: score.weighted_score,
      ml_model_version: result.ml_model_version,
      ml_confidence: result.ml_confidence,
      ml_raw_output: result.ml_raw_output ?? null,
      ai_narrative: narrative?.narrative ?? null,
      ai_narrative_model: narrative?.model ?? null,
    });
    if (rapotErr) throw new Error(`rapot insert: ${rapotErr.message}`);

    await sb
      .from("submissions")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        ai_narrative_generated_at: narrative ? new Date().toISOString() : null,
      })
      .eq("id", job.submission_id);

    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    await sb
      .from("submissions")
      .update({
        status: "failed",
        error_message: msg.slice(0, 500),
        processed_at: new Date().toISOString(),
      })
      .eq("id", job.submission_id);
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
    const sb = supabaseService();
    const { data: pending } = await sb
      .from("submissions")
      .select("id, rapot_slug, audio_path")
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 2 * 60_000).toISOString())
      .limit(MAX_JOBS_PER_INVOCATION - jobs.length);
    for (const p of pending ?? []) {
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
