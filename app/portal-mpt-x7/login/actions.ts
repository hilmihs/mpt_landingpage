"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase";

function normalizeIndonesianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `+62${digits}`;
  return null;
}

export interface LoginState {
  error?: string;
  ok?: boolean;
}

export async function teacherLogin(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phoneRaw || !password) {
    return { error: "Nomor WhatsApp dan password wajib diisi." };
  }

  const phone = normalizeIndonesianPhone(phoneRaw);
  if (!phone) {
    return { error: "Format nomor WhatsApp tidak valid. Contoh: 0812..." };
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({
    phone,
    password,
  });

  if (error || !data.user) {
    return {
      error:
        "Kombinasi nomor WhatsApp dan password tidak cocok. Periksa kembali atau hubungi admin.",
    };
  }

  // Verify there is an active teacher row tied to this auth user
  const svc = supabaseService();
  const { data: teacher } = await svc
    .from("teachers")
    .select("status")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!teacher || teacher.status !== "active") {
    await sb.auth.signOut();
    return {
      error:
        "Akun pengajar Anda belum aktif. Hubungi admin untuk aktivasi.",
    };
  }

  // Touch last_login_at
  await svc
    .from("teachers")
    .update({ last_login_at: new Date().toISOString() })
    .eq("auth_user_id", data.user.id);

  redirect("/portal-mpt-x7/dashboard");
}
