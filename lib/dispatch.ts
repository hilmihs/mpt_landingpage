import { sql } from "@/lib/db";
import { sendWhatsApp, tplTeacherNewRecording } from "@/lib/whatsapp";

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

/** Superadmin sebagai penampung terakhir supaya tidak ada rekaman menggantung. */
function fallbackTarget(): DispatchTarget | null {
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
 * Tugaskan satu rekaman, catat penugasannya, lalu kirim notifikasi WhatsApp.
 *
 * Tidak pernah melempar error: kegagalan notifikasi dicatat di baris assignment
 * supaya bisa dikirim ulang, tanpa menggagalkan submit peserta.
 */
export async function dispatchSubmission(
  input: DispatchInput,
): Promise<DispatchResult> {
  const target = (await pickTeacher(input.jenisKelamin)) ?? fallbackTarget();

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
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO assignments (submission_id, teacher_id, teacher_nama, teacher_wa)
      VALUES (${input.submissionId}, ${target.teacherId}, ${target.nama}, ${target.nomorWa})
      RETURNING id
    `;
    if (!row) throw new Error("insert assignment tidak mengembalikan baris");
    assignmentId = row.id;
  } catch (err) {
    // Indeks unik parsial menjaga hanya ada satu penugasan aktif per submission,
    // jadi pemanggilan ganda tidak membuat pengajar dinotifikasi dua kali.
    const msg = (err as Error).message;
    console.error(`[dispatch] gagal membuat assignment: ${msg}`);
    return { assignmentId: null, target, waSent: false, error: msg };
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const reviewUrl = `${base}/portal-mpt-x7/nilai/${assignmentId}`;

  const send = await sendWhatsApp(
    target.nomorWa,
    tplTeacherNewRecording({
      teacherNama: target.nama,
      pesertaNama: input.pesertaNama,
      jenisKelamin: input.jenisKelamin,
      durasiDetik: input.durasiDetik,
      reviewUrl,
    }),
  );

  await sql`
    UPDATE assignments
    SET status = ${send.ok ? "notified" : "assigned"},
        wa_sent_at = ${send.ok ? new Date() : null},
        wa_message_id = ${send.messageId ?? null},
        wa_error = ${send.ok ? null : (send.error ?? null)},
        wa_attempts = wa_attempts + 1
    WHERE id = ${assignmentId}
  `;

  return {
    assignmentId,
    target,
    waSent: send.ok,
    error: send.ok ? undefined : send.error,
  };
}
