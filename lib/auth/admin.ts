import { supabaseServer } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase";

export interface AdminSession {
  authUserId: string;
  nama: string;
  email: string;
  role: "super" | "staff";
}

export async function getCurrentAdmin(): Promise<AdminSession | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const svc = supabaseService();
  const { data, error } = await svc
    .from("admins")
    .select("nama, email, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;

  return {
    authUserId: user.id,
    nama: data.nama as string,
    email: data.email as string,
    role: data.role as "super" | "staff",
  };
}

export async function signOutAdmin(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
}
