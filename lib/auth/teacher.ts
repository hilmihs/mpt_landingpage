import { supabaseServer } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase";

export interface TeacherSession {
  authUserId: string;
  teacherId: string;
  nama: string;
  jenisKelamin: "ikhwan" | "akhwat";
  status: string;
}

/**
 * Returns the current authenticated teacher, or null if no session / not a
 * registered active teacher. Use this in protected layouts.
 */
export async function getCurrentTeacher(): Promise<TeacherSession | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  // Use service client to look up teacher row (RLS may not allow self-read
  // until row is created; service-role bypasses RLS but still scoped to auth_user_id).
  const svc = supabaseService();
  const { data, error } = await svc
    .from("teachers")
    .select("id, nama, jenis_kelamin, status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status !== "active") return null;

  return {
    authUserId: user.id,
    teacherId: data.id as string,
    nama: data.nama as string,
    jenisKelamin: data.jenis_kelamin as "ikhwan" | "akhwat",
    status: data.status as string,
  };
}

export async function signOutTeacher(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
}
