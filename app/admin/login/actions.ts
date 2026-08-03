"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface AdminLoginState {
  error?: string;
}

/**
 * Login admin dengan email + password.
 *
 * Dulu ini mengirim magic link lewat Supabase Auth. Magic link butuh penyedia
 * SMTP, yang sampai sekarang belum ada, jadi sementara memakai password.
 * Lihat docs/MIGRATION_SUPABASE_TO_GCP.md bagian 7.
 *
 * Pengecekan admins.is_active ada di provider "admin" pada auth.ts, dan semua
 * kegagalan dijawab pesan yang sama supaya tidak membocorkan email terdaftar.
 */
export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  try {
    await signIn("admin", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Email atau password tidak cocok, atau akun tidak aktif." };
    }
    throw err;
  }

  redirect("/admin/overview");
}
