"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
  ok?: boolean;
}

/**
 * Login pengajar dengan nomor WhatsApp + password.
 *
 * Semua kegagalan — nomor tidak dikenal, password salah, akun belum aktif —
 * dijawab pesan yang sama. Membedakannya akan membocorkan nomor mana yang
 * terdaftar. Pengecekan status aktif ada di provider "teacher" pada auth.ts.
 */
export async function teacherLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phone || !password) {
    return { error: "Nomor WhatsApp dan password wajib diisi." };
  }

  try {
    await signIn("teacher", { phone, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        error:
          "Nomor WhatsApp atau password tidak cocok, atau akun Anda belum aktif. Hubungi admin bila perlu.",
      };
    }
    throw err;
  }

  redirect("/portal-mpt-x7/dashboard");
}
