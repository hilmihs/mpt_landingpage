import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { normalizeWaNumber } from "@/lib/whatsapp";

/**
 * Auth.js menggantikan Supabase Auth (Fase 4 di docs/MIGRATION_SUPABASE_TO_GCP.md).
 *
 * Dua provider Credentials terpisah supaya pengajar dan admin tidak bisa saling
 * masuk lewat pintu yang salah:
 *   - "teacher" : nomor WhatsApp + password
 *   - "admin"   : email + password
 *
 * CATATAN: rencana awal memakai magic link untuk admin, tapi itu butuh penyedia
 * SMTP yang sampai sekarang belum ada. Sementara admin pakai password. Begitu
 * SMTP tersedia, tambahkan provider Email tanpa mengubah yang lain.
 *
 * Sesi memakai JWT, bukan tabel sesi: provider Credentials memang mengharuskan
 * itu, dan tidak ada baris sesi yang perlu dibersihkan.
 *
 * Otorisasi TIDAK ditegakkan database (RLS sudah dibuang, lihat 4.2 di dokumen
 * migrasi). Berhasil login BUKAN berarti berhak — setiap route wajib memanggil
 * getCurrentTeacher() / getCurrentAdmin() yang mengecek baris + status aktif.
 */

declare module "next-auth" {
  interface User {
    role?: "teacher" | "admin";
  }
  interface Session {
    user: {
      id: string;
      role: "teacher" | "admin";
      name?: string | null;
      email?: string | null;
    };
  }
}

interface AuthUserRow {
  id: string;
  password_hash: string | null;
}

async function verify(
  row: AuthUserRow | undefined,
  password: string,
): Promise<boolean> {
  // Tetap jalankan compare walau baris tidak ada, supaya waktu responsnya
  // tidak membocorkan apakah nomor/email itu terdaftar.
  const hash =
    row?.password_hash ??
    "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidib";
  const ok = await bcrypt.compare(password, hash);
  return Boolean(row?.password_hash) && ok;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  trustHost: true,
  pages: { signIn: "/portal-mpt-x7/login" },

  providers: [
    Credentials({
      id: "teacher",
      name: "Pengajar",
      credentials: { phone: {}, password: {} },
      async authorize(credentials) {
        const phoneRaw = String(credentials?.phone ?? "");
        const password = String(credentials?.password ?? "");
        if (!phoneRaw || !password) return null;

        const phone = normalizeWaNumber(phoneRaw);
        if (!phone) return null;

        const rows = await sql<AuthUserRow[]>`
          SELECT id, password_hash FROM auth_users WHERE phone = ${phone} LIMIT 1
        `;
        if (!(await verify(rows[0], password))) return null;

        // Punya kredensial saja belum cukup — harus ada baris pengajar aktif.
        const teachers = await sql<{ id: string; nama: string }[]>`
          SELECT id, nama FROM teachers
          WHERE auth_user_id = ${rows[0]!.id} AND status = 'active'
          LIMIT 1
        `;
        if (!teachers[0]) return null;

        await sql`UPDATE auth_users SET last_login_at = now() WHERE id = ${rows[0]!.id}`;
        await sql`UPDATE teachers SET last_login_at = now() WHERE id = ${teachers[0].id}`;

        return { id: rows[0]!.id, name: teachers[0].nama, role: "teacher" };
      },
    }),

    Credentials({
      id: "admin",
      name: "Admin",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const rows = await sql<AuthUserRow[]>`
          SELECT id, password_hash FROM auth_users WHERE lower(email) = ${email} LIMIT 1
        `;
        if (!(await verify(rows[0], password))) return null;

        const admins = await sql<{ nama: string }[]>`
          SELECT nama FROM admins
          WHERE auth_user_id = ${rows[0]!.id} AND is_active = true
          LIMIT 1
        `;
        if (!admins[0]) return null;

        await sql`UPDATE auth_users SET last_login_at = now() WHERE id = ${rows[0]!.id}`;
        await sql`UPDATE admins SET last_login_at = now() WHERE auth_user_id = ${rows[0]!.id}`;

        return { id: rows[0]!.id, name: admins[0].nama, email, role: "admin" };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "teacher" | "admin";
      return session;
    },
  },
});

/** Hash password untuk disimpan di auth_users.password_hash. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
