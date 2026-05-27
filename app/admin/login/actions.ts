"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase";
import { headers } from "next/headers";

const schema = z.object({
  email: z.string().email(),
});

export interface MagicLinkState {
  error?: string;
  sent?: boolean;
}

export async function sendMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Format email tidak valid." };
  }

  const { email } = parsed.data;
  const lowerEmail = email.toLowerCase();

  // Allowlist: only emails registered in admins table can request magic link
  const svc = supabaseService();
  const { data: admin } = await svc
    .from("admins")
    .select("is_active")
    .eq("email", lowerEmail)
    .maybeSingle();

  if (!admin) {
    // Don't disclose whether the email is registered — return generic OK
    return { sent: true };
  }
  if (!admin.is_active) {
    return { error: "Akun admin dinonaktifkan. Hubungi super admin." };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email: lowerEmail,
    options: {
      // We already verified admins row exists above; never create a fresh
      // auth user from this endpoint (defense in depth against accidental
      // signups via this code path).
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=/admin/overview`,
    },
  });

  if (error) {
    return { error: "Gagal mengirim magic link. Coba lagi nanti." };
  }

  return { sent: true };
}
