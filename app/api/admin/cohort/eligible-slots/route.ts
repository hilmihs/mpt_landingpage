import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns Tahsin slots eligible for cohort binding, for a given teacher.
 * Filters:
 *   - kind = 'tahsin'
 *   - teacher_id = ?teacher_id
 *   - status = 'scheduled'
 *   - scheduled_at > now
 *   - not already bound to any cohort_session
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const teacherId = searchParams.get("teacher_id");
  if (!teacherId) {
    return NextResponse.json({ error: "missing_teacher_id" }, { status: 400 });
  }

  const sb = supabaseService();

  // 1. Get all bound slot_ids
  const { data: boundRaw } = await sb
    .from("cohort_sessions")
    .select("slot_id");
  const boundSlotIds = new Set(
    (boundRaw ?? []).map((r) => (r as { slot_id: string }).slot_id),
  );

  // 2. Fetch eligible slots
  const { data: slots } = await sb
    .from("slots")
    .select("id, scheduled_at, duration_min, gender_target, zoom_join_url")
    .eq("teacher_id", teacherId)
    .eq("kind", "tahsin")
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  const eligible = (slots ?? []).filter(
    (s) => !boundSlotIds.has((s as { id: string }).id),
  );

  return NextResponse.json({ slots: eligible });
}
