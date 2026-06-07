import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

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

  const sb = supabaseService();

  // Look up submission by rapot_slug
  const { data: submission, error: subErr } = await sb
    .from("submissions")
    .select("id, jenis_kelamin")
    .eq("rapot_slug", slug)
    .maybeSingle();

  if (subErr || !submission) {
    return NextResponse.json(
      { error: "submission_not_found", message: "Peserta tidak ditemukan." },
      { status: 404 },
    );
  }

  // Check for existing pending/classified recording
  const { data: existing } = await sb
    .from("hits_recordings")
    .select("id, status")
    .eq("submission_id", submission.id)
    .in("status", ["pending", "classified"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: "already_submitted",
        message: "Anda sudah mengirim rekaman. Mohon tunggu hasil review pengajar.",
      },
      { status: 409 },
    );
  }

  // Upload to Supabase Storage
  const timestamp = Date.now();
  const audioPath = `hits-recordings/${slug}/${timestamp}.webm`;
  const buf = Buffer.from(await audio.arrayBuffer());

  const { error: uploadErr } = await sb.storage
    .from("audio-submissions")
    .upload(audioPath, buf, {
      contentType: audio.type || "audio/webm",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "upload_failed", message: "Gagal mengunggah file." },
      { status: 500 },
    );
  }

  // Insert recording row
  const { error: insertErr } = await sb.from("hits_recordings").insert({
    submission_id: submission.id,
    audio_path: audioPath,
    audio_duration_sec: durationSec,
  });

  if (insertErr) {
    return NextResponse.json(
      { error: "db_error", message: "Gagal menyimpan data rekaman." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
