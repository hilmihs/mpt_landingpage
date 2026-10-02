/**
 * Pengiriman WhatsApp lewat kirimi.id.
 *
 * Kontrak (dari https://kirimi.id/docs, diperiksa 3 Agustus 2026):
 *   POST https://api.kirimi.id/v1/send-message
 *   body: { user_code, device_id, receiver, message, secret, media_url? }
 *   receiver harus format 62xxxxxxxxxx — tanpa "+", tanpa "0" di depan.
 *   Rate limit default 60 request/menit. Perangkat harus sudah dipasangkan.
 *
 * Kalau kredensial belum diisi, fungsi ini TIDAK melempar error: pesannya
 * dicatat ke log lalu mengembalikan ok:false. Alur perekaman peserta tidak
 * boleh gagal cuma karena notifikasi tidak terkirim.
 */

const ENDPOINT =
  process.env.KIRIMI_ENDPOINT ?? "https://api.kirimi.id/v1/send-message";
const TIMEOUT_MS = 20_000;

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** true kalau tidak dikirim karena kredensial belum diisi, bukan karena gagal. */
  skipped?: boolean;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.KIRIMI_USER_CODE &&
      process.env.KIRIMI_DEVICE_ID &&
      process.env.KIRIMI_SECRET,
  );
}

/**
 * Ubah nomor Indonesia ke format yang kirimi.id minta: 62 tanpa plus.
 *
 * Database kita menerima "+62…", "62…" dan "0…" (lihat CONSTRAINT valid_wa),
 * jadi ketiganya harus ditangani. Mengembalikan null kalau tidak dikenali,
 * supaya pemanggil bisa membedakan "nomor rusak" dari "gagal kirim".
 */
export function normalizeWaNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let n = digits.startsWith("+") ? digits.slice(1) : digits;

  if (n.startsWith("0")) n = `62${n.slice(1)}`;
  else if (!n.startsWith("62")) return null;

  // 62 + 8-13 digit, sejalan dengan CONSTRAINT valid_wa di 0001_init.sql.
  if (!/^62\d{8,13}$/.test(n)) return null;
  return n;
}

export async function sendWhatsApp(
  to: string,
  message: string,
  mediaUrl?: string,
): Promise<SendResult> {
  const receiver = normalizeWaNumber(to);
  if (!receiver) {
    return { ok: false, error: `nomor tidak valid: ${to}` };
  }

  if (!isWhatsAppConfigured()) {
    console.warn(
      `[whatsapp] kredensial kirimi.id belum diisi — pesan ke ${receiver} tidak dikirim:\n${message}`,
    );
    return { ok: false, skipped: true, error: "kirimi_not_configured" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_code: process.env.KIRIMI_USER_CODE,
        device_id: process.env.KIRIMI_DEVICE_ID,
        secret: process.env.KIRIMI_SECRET,
        receiver,
        message,
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Sebagian error dijawab HTML; teks mentahnya tetap berguna di log.
    }

    if (!res.ok) {
      const msg =
        (typeof body.message === "string" && body.message) ||
        text.slice(0, 200) ||
        `HTTP ${res.status}`;
      console.error(`[whatsapp] gagal kirim ke ${receiver}: ${msg}`);
      return { ok: false, error: msg };
    }

    const data = body.data as Record<string, unknown> | undefined;
    const messageId =
      (typeof body.message_id === "string" && body.message_id) ||
      (typeof data?.message_id === "string" && data.message_id) ||
      undefined;

    return { ok: true, messageId };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[whatsapp] error kirim ke ${receiver}: ${msg}`);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Template pesan
// ---------------------------------------------------------------------------

/** Pemberitahuan ke pengajar bahwa ada rekaman baru untuk dinilai. */
export function tplTeacherNewRecording(args: {
  teacherNama: string;
  pesertaNama: string;
  jenisKelamin: string;
  durasiDetik: number | null;
  reviewUrl: string;
}): string {
  const durasi =
    args.durasiDetik != null
      ? `${Math.floor(args.durasiDetik / 60)}m ${Math.round(args.durasiDetik % 60)}d`
      : "-";

  return [
    `Assalamu'alaikum ${args.teacherNama},`,
    ``,
    `Ada rekaman Al-Fatihah baru yang menunggu penilaian.`,
    ``,
    `Peserta : ${args.pesertaNama}`,
    `Gender  : ${args.jenisKelamin}`,
    `Durasi  : ${durasi}`,
    ``,
    `Buka di sini untuk mendengarkan dan menilai:`,
    args.reviewUrl,
    ``,
    `Jazakumullahu khairan.`,
  ].join("\n");
}

/** Pemberitahuan ke peserta bahwa rapotnya sudah siap. */
export function tplPesertaRapotReady(args: {
  pesertaNama: string;
  rapotUrl: string;
}): string {
  return [
    `Assalamu'alaikum ${args.pesertaNama},`,
    ``,
    `Alhamdulillah, hasil Assessment Al-Fatihah Anda sudah siap.`,
    ``,
    `Lihat rapot Anda di sini:`,
    args.rapotUrl,
    ``,
    `Barakallahu fiikum.`,
  ].join("\n");
}

/** Konfirmasi ke peserta segera setelah rekaman terkirim. */
export function tplPesertaSubmitted(args: {
  pesertaNama: string;
  statusUrl: string;
}): string {
  return [
    `Assalamu'alaikum ${args.pesertaNama},`,
    ``,
    `Rekaman Al-Fatihah Anda sudah kami terima dan sedang diperiksa oleh pengajar.`,
    `Mohon ditunggu — hasilnya akan kami kirim lewat WhatsApp ini.`,
    ``,
    `Cek status kapan saja di:`,
    args.statusUrl,
    ``,
    `Jazakumullahu khairan.`,
  ].join("\n");
}

/**
 * Konfirmasi pendaftaran HITS Darsyafii. Isinya petunjuk teknis yang dulu
 * tampil di halaman "terima kasih" Google Form dan diminta di-screenshot —
 * lewat WhatsApp peserta tidak perlu menyimpannya sendiri.
 */
export function tplHitsPendaftaranDiterima(args: {
  pesertaNama: string;
  programNama: string;
  angkatanLabel: string;
  jadwal: string;
  adminWaLabel: string;
  /** false untuk level yang mendaftar tanpa setoran rekaman. */
  denganRekaman?: boolean;
  /** Aturan penempatan untuk pendaftar berekaman (CATATAN_PENEMPATAN). */
  catatanRekaman?: string;
}): string {
  const diterima = args.denganRekaman === false ? "" : " beserta rekaman ujian masuk";
  return [
    `Assalamu'alaikum ${args.pesertaNama},`,
    ``,
    `Pendaftaran ${args.programNama} angkatan ${args.angkatanLabel}${diterima} Anda sudah kami terima.`,
    `Jam belajar pilihan: ${args.jadwal}`,
    ...(args.catatanRekaman && args.denganRekaman !== false ? [``, args.catatanRekaman] : []),
    ``,
    `Supaya pesan admin tidak tertolak, mohon:`,
    `1. WhatsApp → Setelan → Privasi → Grup → "Siapa yang dapat menambahkan saya ke grup" pilih "Semua Orang".`,
    `2. Simpan nomor Admin Muhajir Project Tilawah: ${args.adminWaLabel}.`,
    ``,
    `Peserta yang terpilih maupun tidak, insya Allah dikabari admin sebelum hari pertama KBM. Peserta terpilih akan menerima link grup WhatsApp.`,
    ``,
    `Jazakumullahu khairan.`,
  ].join("\n");
}

/**
 * Kabar ke penanya bahwa pertanyaannya tentang program HITS sudah dijawab.
 * Isi jawaban sengaja tidak ikut: tautan itu satu-satunya tempat jawaban,
 * jadi admin bisa memperbaikinya tanpa pesan lama yang keliru beredar.
 */
export function tplHitsPertanyaanDijawab(args: {
  penanyaNama: string;
  programNama: string;
  jawabanUrl: string;
}): string {
  return [
    `Assalamu'alaikum ${args.penanyaNama},`,
    ``,
    `Pertanyaan Anda tentang ${args.programNama} sudah dijawab admin Muhajir Project Tilawah.`,
    ``,
    `Baca jawabannya di sini:`,
    args.jawabanUrl,
    ``,
    `Barakallahu fiikum.`,
  ].join("\n");
}
