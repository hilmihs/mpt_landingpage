import { auth } from "@/auth";
import { sql } from "@/lib/db";

export interface TeacherSession {
  authUserId: string;
  teacherId: string;
  nama: string;
  jenisKelamin: "ikhwan" | "akhwat";
  status: string;
}

/**
 * Pengajar yang sedang login, atau null kalau tidak ada sesi / bukan pengajar
 * aktif. Panggil ini di setiap layout dan route handler yang dilindungi.
 *
 * Sejak RLS dibuang (lihat docs/MIGRATION_SUPABASE_TO_GCP.md 4.2), fungsi inilah
 * satu-satunya penegak otorisasi pengajar. Tidak ada jaring pengaman di database.
 * Sesi yang sah pun tetap ditolak kalau baris pengajarnya tidak aktif.
 */
export async function getCurrentTeacher(): Promise<TeacherSession | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session.user.role !== "teacher") return null;

  const rows = await sql<
    { id: string; nama: string; jenis_kelamin: string; status: string }[]
  >`
    SELECT id, nama, jenis_kelamin, status
    FROM teachers
    WHERE auth_user_id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row || row.status !== "active") return null;

  return {
    authUserId: userId,
    teacherId: row.id,
    nama: row.nama,
    jenisKelamin: row.jenis_kelamin as "ikhwan" | "akhwat",
    status: row.status,
  };
}
