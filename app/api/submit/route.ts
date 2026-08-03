import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sql } from "@/lib/db";
import { uploadAudio, removeAudio } from "@/lib/storage";
import { submitRatelimit } from "@/lib/redis";
import { enqueueJob } from "@/lib/queue";
import { formSchema } from "@/lib/validation";
import { dispatchSubmission } from "@/lib/dispatch";
import { sendWhatsApp, tplPesertaSubmitted } from "@/lib/whatsapp";

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

  // Tugaskan ke pengajar (rotasi, gender ketat) lalu kirim notifikasi WhatsApp.
  // Nilai yang dilihat peserta berasal dari pengajar, bukan AI — AI jalan
  // paralel sebagai pembanding internal. Lihat docs/INTEGRASI_PENILAIAN_PENGAJAR.md.
  //
  // Kegagalan di sini TIDAK menggagalkan submit: rekamannya sudah aman
  // tersimpan, dan penugasan bisa diulang dari portal admin.
  try {
    const d = await dispatchSubmission({
      submissionId,
      pesertaNama: parsed.data.nama,
      jenisKelamin: parsed.data.jenis_kelamin,
      durasiDetik: audioDuration,
    });
    if (!d.waSent) {
      console.warn(`[submit] notifikasi pengajar belum terkirim: ${d.error}`);
    }
  } catch (err) {
    console.error("dispatch error", err);
  }

  // Konfirmasi ke peserta bahwa rekamannya diterima dan sedang diperiksa.
  // Mas Agil menekankan ini di rapat: pesertanya tidak boleh dibiarkan menunggu
  // tanpa kabar, karena pemeriksaan pengajar makan waktu berhari-hari.
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const send = await sendWhatsApp(
      parsed.data.nomor_wa,
      tplPesertaSubmitted({
        pesertaNama: parsed.data.nama,
        statusUrl: `${base}/rapot/${rapotSlug}`,
      }),
    );
    if (send.ok) {
      await sql`
        UPDATE submissions SET peserta_wa_sent_at = ${new Date()} WHERE id = ${submissionId}
      `;
    } else if (!send.skipped) {
      await sql`
        UPDATE submissions SET peserta_wa_error = ${send.error ?? null} WHERE id = ${submissionId}
      `;
    }
  } catch (err) {
    console.error("peserta wa error", err);
  }

  return NextResponse.json({
    submission_id: submissionId,
    rapot_slug: rapotSlug,
    estimated_wait_seconds: 30,
  });
}
