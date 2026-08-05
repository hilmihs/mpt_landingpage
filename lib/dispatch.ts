import { sql } from "@/lib/db";
import {
  normalizeWaNumber,
  sendWhatsApp,
  tplTeacherNewRecording,
} from "@/lib/whatsapp";
import { siteUrl } from "@/lib/site-url";

/**
 * Penugasan rekaman peserta ke pengajar.
 *
 * Aturan dari rapat 3 Agustus 2026:
 *   - Gender KETAT: ikhwan dinilai pengajar ikhwan, akhwat oleh akhwat.
 *     Tidak ada pengecualian, jadi kalau tidak ada yang cocok kita TIDAK
 *     menyeberang gender — jatuh ke superadmin.
 *   - Rotasi: yang paling lama tidak kebagian dapat giliran duluan.
 *   - Awalnya semua rekaman jatuh ke superadmin, karena daftar pengajar
 *     memang belum diisi.
 */

export interface DispatchTarget {
  teacherId: string | null;
  nama: string;
  nomorWa: string;
  isFallback: boolean;
}

/**
 * SEMENTARA — satu nomor peserta dipesan untuk uji coba.
 *
 * Kalau rekaman datang dari nomor uji di bawah, tautan penilaiannya diarahkan
 * ke Hilmi, bukan dirotasi ke asatidah. Rekaman dari nomor lain tetap lewat
 * rotasi seperti biasa — jadi peserta sungguhan tidak terpengaruh.
 *
 * `teacherId: null` disengaja, bukan kelalaian. Baris assignment dengan
 * teacher_id kosong bisa dibuka pengajar mana pun yang login (lihat
 * app/portal-mpt-x7/(authed)/nilai/[id]/page.tsx dan tugas/page.tsx) — itulah
 * yang membuat tautan di WhatsApp bisa dibuka tanpa perlu mendaftarkan
 * penerimanya sebagai pengajar lebih dulu.
 *
 * CARA MENCABUT: hapus konstanta ini beserta pemakaiannya di
 * dispatchSubmission(). pickTeacher() dan fallbackTarget() tidak diubah sama
 * sekali, jadi tidak ada yang perlu dipulihkan.
 */
const UJI_COBA = {
  /** Nomor peserta yang memicu pengalihan. Disimpan apa adanya; pembandingan
   *  dilakukan setelah dinormalkan, supaya "0822…", "62822…", dan "+62822…"
   *  sama-sama dikenali. */
  nomorPeserta: "082298693789",
  penerima: {
    teacherId: null,
    nama: "Hilmi Hanif Sobandi",
    nomorWa: "081399741809",
    isFallback: false,
  } satisfies DispatchTarget,
} as const;

/** Benar kalau rekaman ini datang dari nomor uji coba. */
function adalahPesertaUji(nomorWaPeserta: string | null): boolean {
  if (!nomorWaPeserta) return false;
  const a = normalizeWaNumber(nomorWaPeserta);
  const b = normalizeWaNumber(UJI_COBA.nomorPeserta);
  return a !== null && a === b;
}

/**
 * Pilih pengajar berikutnya untuk gender tertentu.
 *
 * Rotasinya berdasarkan penugasan terakhir tiap pengajar: yang belum pernah
 * ditugaskan didahulukan (NULLS FIRST), lalu yang paling lama menganggur.
 * Ini menyebar beban tanpa perlu menyimpan penunjuk giliran yang bisa basi.
 */
export async function pickTeacher(
  jenisKelamin: "ikhwan" | "akhwat",
): Promise<DispatchTarget | null> {
  const rows = await sql<
    { id: string; nama: string; nomor_wa: string }[]
  >`
    SELECT t.id, t.nama, t.nomor_wa
    FROM teachers t
    LEFT JOIN LATERAL (
      SELECT max(a.assigned_at) AS last_assigned
      FROM assignments a
      WHERE a.teacher_id = t.id
    ) la ON true
    WHERE t.status = 'active'
      AND t.jenis_kelamin = ${jenisKelamin}
    ORDER BY la.last_assigned ASC NULLS FIRST, t.created_at ASC
    LIMIT 1
  `;

  const t = rows[0];
  if (!t) return null;
  return {
    teacherId: t.id,
    nama: t.nama,
    nomorWa: t.nomor_wa,
    isFallback: false,
  };
}

/**
 * Superadmin sebagai penampung terakhir supaya tidak ada rekaman menggantung.
 *
 * Dipakai juga oleh route admin: kalau tidak ada pengajar segender yang aktif,
 * admin masih bisa melempar rekaman ke superadmin ketimbang membiarkannya diam.
 */
export function fallbackTarget(): DispatchTarget | null {
  const wa = process.env.SUPERADMIN_WA;
  if (!wa) return null;
  return {
    teacherId: null,
    nama: process.env.SUPERADMIN_NAMA ?? "Superadmin",
    nomorWa: wa,
    isFallback: true,
  };
}

export interface DispatchInput {
  submissionId: string;
  pesertaNama: string;
  /** Nomor WhatsApp peserta — dipakai untuk mengenali rekaman uji coba. */
  pesertaWa: string;
  jenisKelamin: "ikhwan" | "akhwat";
  durasiDetik: number | null;
}

export interface DispatchResult {
  assignmentId: string | null;
  target: DispatchTarget | null;
  waSent: boolean;
  error?: string;
}

/**
 * Catat satu penugasan baru.
 *
 * Melempar kalau gagal — termasuk saat indeks unik parsial
 * `idx_assignments_one_active` menolak karena submission ini sudah punya
 * penugasan aktif (SQLSTATE 23505). Pemanggil yang menentukan apa artinya:
 * dispatchSubmission menelannya jadi hasil bergalat, route admin memetakannya
 * jadi 409.
 */
export async function createAssignment(
  submissionId: string,
  target: DispatchTarget,
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO assignments (submission_id, teacher_id, teacher_nama, teacher_wa)
    VALUES (${submissionId}, ${target.teacherId}, ${target.nama}, ${target.nomorWa})
    RETURNING id
  `;
  if (!row) throw new Error("insert assignment tidak mengembalikan baris");
  return row.id;
}

export interface NotifyInput {
  assignmentId: string;
  target: DispatchTarget;
  pesertaNama: string;
  jenisKelamin: "ikhwan" | "akhwat";
  durasiDetik: number | null;
}

export interface NotifyResult {
  waSent: boolean;
  error?: string;
}

/**
 * Kabari pengajar lewat WhatsApp, lalu catat hasil kirimnya di baris penugasan.
 *
 * Tidak pernah melempar: `sendWhatsApp` sudah menelan galatnya sendiri, dan
 * kegagalan kirim memang harus tercatat di baris — bukan membatalkan
 * penugasannya. Rekaman yang punya pengajar tapi belum dikabari masih bisa
 * diselamatkan; rekaman tanpa pengajar sama sekali tidak.
 */
export async function notifyAssignment(
  input: NotifyInput,
): Promise<NotifyResult> {
  const reviewUrl = `${siteUrl()}/portal-mpt-x7/nilai/${input.assignmentId}`;

  const send = await sendWhatsApp(
    input.target.nomorWa,
    tplTeacherNewRecording({
      teacherNama: input.target.nama,
      pesertaNama: input.pesertaNama,
      jenisKelamin: input.jenisKelamin,
      durasiDetik: input.durasiDetik,
      reviewUrl,
    }),
  );

  // Syarat status penting: panggilan kirimi.id bisa sampai 20 detik, dan dalam
  // rentang itu pengajar yang keburu mengklik tautannya sudah membuat PATCH
  // menyetel 'opened'. Tanpa syarat ini, UPDATE di bawah menyeretnya balik ke
  // 'notified' dan penugasan yang sedang dikerjakan terlihat belum dibuka.
  await sql`
    UPDATE assignments
    SET status = ${send.ok ? "notified" : "assigned"},
        wa_sent_at = ${send.ok ? new Date() : null},
        wa_message_id = ${send.messageId ?? null},
        wa_error = ${send.ok ? null : (send.error ?? null)},
        wa_attempts = wa_attempts + 1
    WHERE id = ${input.assignmentId}
      AND status IN ('assigned', 'notified')
  `;

  return { waSent: send.ok, error: send.ok ? undefined : send.error };
}

/**
 * Tugaskan satu rekaman, catat penugasannya, lalu kirim notifikasi WhatsApp.
 *
 * Tidak pernah melempar error: kegagalan notifikasi dicatat di baris assignment
 * supaya bisa dikirim ulang, tanpa menggagalkan submit peserta.
 */
export async function dispatchSubmission(
  input: DispatchInput,
): Promise<DispatchResult> {
  const target = adalahPesertaUji(input.pesertaWa)
    ? UJI_COBA.penerima
    : ((await pickTeacher(input.jenisKelamin)) ?? fallbackTarget());

  if (!target) {
    console.error(
      `[dispatch] tidak ada pengajar ${input.jenisKelamin} aktif dan SUPERADMIN_WA kosong — submission ${input.submissionId} tidak tertugaskan`,
    );
    return {
      assignmentId: null,
      target: null,
      waSent: false,
      error: "no_target",
    };
  }

  let assignmentId: string;
  try {
    assignmentId = await createAssignment(input.submissionId, target);
  } catch (err) {
    // Indeks unik parsial menjaga hanya ada satu penugasan aktif per submission,
    // jadi pemanggilan ganda tidak membuat pengajar dinotifikasi dua kali.
    const msg = (err as Error).message;
    console.error(`[dispatch] gagal membuat assignment: ${msg}`);
    return { assignmentId: null, target, waSent: false, error: msg };
  }

  const notify = await notifyAssignment({
    assignmentId,
    target,
    pesertaNama: input.pesertaNama,
    jenisKelamin: input.jenisKelamin,
    durasiDetik: input.durasiDetik,
  });

  return {
    assignmentId,
    target,
    waSent: notify.waSent,
    error: notify.error,
  };
}
