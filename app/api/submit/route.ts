import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { uploadAudio, removeAudio } from "@/lib/storage";
import { submitRatelimit } from "@/lib/redis";
import { enqueueJob } from "@/lib/queue";
import { formSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB safety cap (~5 min Opus)

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  // Rate limit
  try {
    const rl = await submitRatelimit().limit(ip);
    if (!rl.success) {
      return NextResponse.json(
        { error: "rate_limited", details: "Terlalu banyak request. Coba lagi sebentar." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("ratelimit error", err);
    // fail-open: kalau Redis down jangan block submission
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "validation_failed", details: "FormData tidak valid" },
      { status: 400 },
    );
  }

  const audio = form.get("audio");
  const audioDurationRaw = form.get("audio_duration_sec");
  const fields = {
    nama: String(form.get("nama") ?? ""),
    jenis_kelamin: String(form.get("jenis_kelamin") ?? ""),
    nomor_wa: String(form.get("nomor_wa") ?? ""),
  };

  const parsed = formSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "Audio kosong" },
      { status: 400 },
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "validation_failed", details: "Audio terlalu besar (max 25MB)" },
      { status: 400 },
    );
  }

  const audioDuration = audioDurationRaw ? Number(audioDurationRaw) : null;
  if (audioDuration !== null && (audioDuration < 0 || audioDuration > 320)) {
    return NextResponse.json(
      { error: "validation_failed", details: "Durasi audio tidak valid" },
      { status: 400 },
    );
  }

  const submissionId = crypto.randomUUID();
  const rapotSlug = nanoid(12);
  const audioPath = `${submissionId}.webm`;

  // Upload audio
  const arrayBuf = await audio.arrayBuffer();
  try {
    await uploadAudio(
      audioPath,
      Buffer.from(arrayBuf),
      audio.type || "audio/webm",
    );
  } catch (err) {
    console.error("storage upload error", err);
    return NextResponse.json(
      { error: "storage_failed", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Insert row
  try {
    await sql`
      INSERT INTO submissions
        (id, nama, jenis_kelamin, nomor_wa, audio_path, audio_duration_sec, status, rapot_slug)
      VALUES (
        ${submissionId},
        ${parsed.data.nama},
        ${parsed.data.jenis_kelamin},
        ${parsed.data.nomor_wa},
        ${audioPath},
        ${audioDuration},
        ${"pending"},
        ${rapotSlug}
      )
    `;
  } catch (err) {
    console.error("submission insert error", err);
    // cleanup uploaded audio
    await removeAudio([audioPath]);
    return NextResponse.json(
      { error: "db_failed", details: (err as Error).message },
      { status: 500 },
    );
  }

  // Enqueue
  try {
    await enqueueJob({
      submission_id: submissionId,
      rapot_slug: rapotSlug,
      audio_path: audioPath,
      enqueued_at: Date.now(),
    });
  } catch (err) {
    console.error("enqueue error", err);
    // Worker will retry by scanning pending submissions
  }

  return NextResponse.json({
    submission_id: submissionId,
    rapot_slug: rapotSlug,
    estimated_wait_seconds: 30,
  });
}
