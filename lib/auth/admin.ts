import { auth } from "@/auth";
import { sql } from "@/lib/db";

export interface AdminSession {
  authUserId: string;
  nama: string;
  email: string;
  role: "super" | "staff";
}

/**
 * Admin yang sedang login, atau null kalau tidak ada sesi / bukan admin aktif.
 *
 * Sama seperti getCurrentTeacher(): sejak RLS dibuang, fungsi ini satu-satunya
 * penegak otorisasi admin. Wajib dipanggil di awal setiap route /admin dan
 * /api/admin.
 */
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || session.user.role !== "admin") return null;

  const rows = await sql<
    { nama: string; email: string; role: string; is_active: boolean }[]
  >`
    SELECT nama, email, role, is_active
    FROM admins
    WHERE auth_user_id = ${userId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row || !row.is_active) return null;

  return {
    authUserId: userId,
    nama: row.nama,
    email: row.email,
    role: row.role as "super" | "staff",
  };
}
