import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { uploadAudio } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const audio = form.get("audio");
  const slug = form.get("slug");
  const durationStr = form.get("duration_sec");

  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "missing_audio", message: "File audio diperlukan." },
      { status: 400 },
    );
  }
  if (!slug || typeof slug !== "string" || slug.length < 6) {
    return NextResponse.json(
      { error: "missing_slug", message: "Slug tidak valid." },
      { status: 400 },
    );
  }
  if (audio.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "too_large", message: "File terlalu besar (maks 25MB)." },
      { status: 400 },
    );
  }

  const durationSec = durationStr ? Number(durationStr) : null;

  // Look up submission by rapot_slug
  let submission: { id: string; jenis_kelamin: string } | null = null;
  try {
    const rows = await sql<{ id: string; jenis_kelamin: string }[]>`
      SELECT id, jenis_kelamin
        FROM submissions
       WHERE rapot_slug = ${slug}
       LIMIT 1
    `;
    submission = rows[0] ?? null;
  } catch {
    submission = null;
  }

  if (!submission) {
    return NextResponse.json(
      { error: "submission_not_found", message: "Peserta tidak ditemukan." },
      { status: 404 },
    );
  }

  // Check for existing pending/classified recording
  const existingRows = await sql<{ id: string; status: string }[]>`
    SELECT id, status
      FROM hits_recordings
     WHERE submission_id = ${submission.id}
       AND status IN ('pending', 'classified')
     LIMIT 1
  `;
  const existing = existingRows[0] ?? null;

  if (existing) {
    return NextResponse.json(
      {
        error: "already_submitted",
        message: "Anda sudah mengirim rekaman. Mohon tunggu hasil review pengajar.",
      },
      { status: 409 },
    );
  }

  // Upload ke object storage
  const timestamp = Date.now();
  const audioPath = `hits-recordings/${slug}/${timestamp}.webm`;
  const buf = Buffer.from(await audio.arrayBuffer());

  try {
    await uploadAudio(audioPath, buf, audio.type || "audio/webm");
  } catch {
    return NextResponse.json(
      { error: "upload_failed", message: "Gagal mengunggah file." },
      { status: 500 },
    );
  }

  // Insert recording row
  try {
    await sql`
      INSERT INTO hits_recordings (submission_id, audio_path, audio_duration_sec)
      VALUES (${submission.id}, ${audioPath}, ${durationSec})
    `;
  } catch {
    return NextResponse.json(
      { error: "db_error", message: "Gagal menyimpan data rekaman." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
