import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { uploadAudio, removeAudio } from "@/lib/storage";
import { getClientIp, hitsDaftarRatelimit } from "@/lib/redis";
import {
  normalizeWaNumber,
  sendWhatsApp,
  tplHitsPendaftaranDiterima,
} from "@/lib/whatsapp";
import {
  DAR_SYAFII,
  daftarSchema,
  findJadwal,
  jadwalLabel,
} from "@/lib/hits-dar-syafii";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
// Rekaman di halaman dibatasi 5 menit oleh useAudioRecorder; berkas unggahan
// dari aplikasi perekam HP diberi kelonggaran untuk salam dan jeda.
const MAX_DURATION_SEC = 600;

/** Ekstensi berkas dari tipe MIME, lalu dari nama berkas unggahan. */
function extFor(audio: Blob): string {
  const type = audio.type.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("3gp")) return "3gp";
  const name = audio instanceof File ? audio.name.toLowerCase() : "";
  const m = name.match(/\.([a-z0-9]{2,4})$/);
  return m?.[1] ?? "bin";
}

function isAudioLike(audio: Blob): boolean {
  // Sebagian browser HP mengirim tipe kosong untuk .m4a; itu ditangani lewat
  // nama berkas. Yang ditolak hanya tipe yang jelas bukan suara.
  const t = audio.type.toLowerCase();
  return t === "" || t.startsWith("audio/") || /^video\/(mp4|webm|3gpp|ogg)/.test(t);
}

function fail(status: number, error: string, message: string, extra?: object) {
  return NextResponse.json({ error, message, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const rl = await hitsDaftarRatelimit().limit(getClientIp(req));
    if (!rl.success) {
      return fail(429, "rate_limited", "Terlalu banyak percobaan. Coba lagi beberapa menit lagi.");
    }
  } catch (err) {
    // fail-open: Redis mati jangan sampai menutup pendaftaran.
    console.error("[hits-daftar] ratelimit error", err);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "validation_failed", "Data formulir tidak terbaca.");
  }

  const parsed = daftarSchema.safeParse({
    email: form.get("email"),
    nama: form.get("nama"),
    jenis_kelamin: form.get("jenis_kelamin"),
    nomor_wa: form.get("nomor_wa"),
    usia: form.get("usia"),
    kota: form.get("kota"),
    jadwal: form.get("jadwal"),
    level: form.get("level"),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fields[key] ??= issue.message;
    }
    return fail(400, "validation_failed", "Ada isian yang perlu diperbaiki.", { fields });
  }
  const data = parsed.data;

  const nomorWa = normalizeWaNumber(data.nomor_wa);
  if (!nomorWa) {
    return fail(400, "validation_failed", "Nomor WhatsApp tidak dikenali.", {
      fields: { nomor_wa: "Gunakan format 62xxxxxxxxxx" },
    });
  }

  const audio = form.get("audio");
  const sumber = form.get("audio_sumber") === "unggah" ? "unggah" : "rekam";
  if (!(audio instanceof Blob) || audio.size === 0) {
    return fail(400, "audio_missing", "Rekaman bacaan belum ada.");
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail(400, "audio_too_large", "Berkas rekaman terlalu besar (maks. 25 MB).");
  }
  if (!isAudioLike(audio)) {
    return fail(400, "audio_type", "Berkas yang dipilih bukan rekaman suara.");
  }

  const durRaw = form.get("audio_duration_sec");
  const durasi = durRaw ? Number(durRaw) : null;
  if (durasi !== null && (!Number.isFinite(durasi) || durasi < 0 || durasi > MAX_DURATION_SEC)) {
    return fail(400, "audio_duration", "Durasi rekaman tidak wajar (maks. 10 menit).");
  }

  // Penjaga yang sama dengan /api/submit: rekaman browser yang jauh lebih kecil
  // dari durasinya sendiri berarti tidak tersimpan utuh (pernah terjadi — 20.000
  // byte untuk 58 detik, tidak bisa diputar). Hanya untuk rekaman di halaman;
  // berkas unggahan dari aplikasi perekam HP bisa memakai codec yang sangat
  // irit (AMR ~600 B/dtk) dan tetap sah.
  if (sumber === "rekam" && durasi !== null && durasi >= 5 && audio.size / durasi < 1000) {
    console.error(
      `[hits-daftar] audio tidak wajar: ${audio.size} byte untuk ${durasi}s`,
    );
    return fail(
      400,
      "audio_corrupt",
      "Rekaman tidak tersimpan dengan utuh. Mohon rekam ulang, dan jangan tutup halaman sampai selesai terkirim.",
    );
  }

  const jadwal = findJadwal(data.jadwal)!;
  if (jadwal.gender !== data.jenis_kelamin) {
    return fail(400, "validation_failed", "Jadwal tidak sesuai jenis kelamin.", {
      fields: { jadwal: "Pilih jadwal kelas yang sesuai" },
    });
  }

  // Cek duplikat sebelum mengunggah supaya tidak meninggalkan berkas yatim.
  // UNIQUE constraint di bawah tetap jadi penjaga terakhir untuk balapan.
  const dup = await sql<{ id: string }[]>`
    SELECT id FROM hits_pendaftaran
     WHERE program = ${DAR_SYAFII.program}
       AND angkatan = ${DAR_SYAFII.angkatan}
       AND nomor_wa = ${nomorWa}
     LIMIT 1
  `;
  if (dup.length > 0) {
    return fail(
      409,
      "already_registered",
      "Nomor WhatsApp ini sudah terdaftar untuk angkatan ini. Pendaftaran Anda sebelumnya sudah kami terima.",
    );
  }

  const id = crypto.randomUUID();
  const audioPath = `hits-pendaftaran/${DAR_SYAFII.angkatan}/${id}.${extFor(audio)}`;

  try {
    await uploadAudio(
      audioPath,
      Buffer.from(await audio.arrayBuffer()),
      audio.type || "application/octet-stream",
    );
  } catch (err) {
    console.error("[hits-daftar] upload error", err);
    return fail(500, "storage_failed", "Rekaman gagal disimpan. Coba kirim lagi.");
  }

  try {
    await sql`
      INSERT INTO hits_pendaftaran (
        id, program, angkatan, email, nama, jenis_kelamin, nomor_wa, usia, kota,
        jadwal, level, audio_path, audio_duration_sec, audio_sumber
      ) VALUES (
        ${id}, ${DAR_SYAFII.program}, ${DAR_SYAFII.angkatan}, ${data.email},
        ${data.nama}, ${data.jenis_kelamin}, ${nomorWa}, ${data.usia}, ${data.kota},
        ${jadwalLabel(jadwal)}, ${data.level}, ${audioPath},
        ${durasi === null ? null : Math.round(durasi * 10) / 10}, ${sumber}
      )
    `;
  } catch (err) {
    await removeAudio([audioPath]);
    if ((err as { code?: string }).code === "23505") {
      return fail(
        409,
        "already_registered",
        "Nomor WhatsApp ini sudah terdaftar untuk angkatan ini. Pendaftaran Anda sebelumnya sudah kami terima.",
      );
    }
    console.error("[hits-daftar] insert error", err);
    return fail(500, "db_failed", "Pendaftaran gagal disimpan. Coba kirim lagi.");
  }

  // Konfirmasi WA tidak boleh menggagalkan pendaftaran — datanya sudah aman.
  let waTerkirim = false;
  try {
    const send = await sendWhatsApp(
      nomorWa,
      tplHitsPendaftaranDiterima({
        pesertaNama: data.nama,
        programNama: DAR_SYAFII.nama,
        angkatanLabel: DAR_SYAFII.angkatanLabel,
        jadwal: jadwalLabel(jadwal),
        adminWaLabel: DAR_SYAFII.adminWaLabel,
      }),
    );
    waTerkirim = send.ok;
    if (send.ok) {
      await sql`UPDATE hits_pendaftaran SET wa_sent_at = now() WHERE id = ${id}`;
    } else if (!send.skipped) {
      await sql`UPDATE hits_pendaftaran SET wa_error = ${send.error ?? null} WHERE id = ${id}`;
    }
  } catch (err) {
    console.error("[hits-daftar] wa error", err);
  }

  // wa_terkirim menentukan apakah halaman selesai meminta peserta menyimpan
  // petunjuknya sendiri (screenshot), seperti formulir lama.
  return NextResponse.json({ ok: true, id, wa_terkirim: waTerkirim });
}
