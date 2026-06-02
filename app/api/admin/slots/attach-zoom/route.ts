import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { supabaseService } from "@/lib/supabase";
import { createMeeting, isZoomConfigured } from "@/lib/zoom/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Backfill zoom_meeting_id for slots that don't have one yet.
 * Useful after enabling Zoom credentials post-hoc, or to retry slots
 * whose Zoom creation failed.
 *
 * POST body: { slot_ids?: string[] }
 *   - If omitted, processes ALL future scheduled slots missing zoom_meeting_id.
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isZoomConfigured()) {
    return NextResponse.json(
      {
        error: "zoom_not_configured",
        message:
          "ZOOM_* env vars belum di-set. Set di Vercel project settings dulu.",
      },
      { status: 503 },
    );
  }

  let body: { slot_ids?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  const sb = supabaseService();
  let query = sb
    .from("slots")
    .select(
      `id, kind, scheduled_at, duration_min, zoom_meeting_id,
       teachers:teacher_id(nama, email_zoom)`,
    )
    .is("zoom_meeting_id", null)
    .eq("status", "scheduled")
    .gt("scheduled_at", new Date().toISOString());

  if (body.slot_ids && body.slot_ids.length > 0) {
    query = query.in("id", body.slot_ids);
  }

  const { data: slotsRaw } = await query;
  const slots = (slotsRaw ?? []) as unknown as {
    id: string;
    kind: "assessment" | "tahsin";
    scheduled_at: string;
    duration_min: number;
    zoom_meeting_id: string | null;
    teachers: { nama: string; email_zoom: string | null } | null;
  }[];

  const summary = {
    total: slots.length,
    created: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const s of slots) {
    if (!s.teachers) continue;
    try {
      const meeting = await createMeeting({
        topic: `${s.kind === "assessment" ? "Assessment" : "Tahsin"} Al-Fatihah — ${s.teachers.nama}`,
        start_time: s.scheduled_at,
        duration_min: s.duration_min,
        alternative_hosts: s.teachers.email_zoom ? [s.teachers.email_zoom] : [],
      });

      await sb
        .from("slots")
        .update({
          zoom_meeting_id: meeting.meeting_id,
          zoom_join_url: meeting.join_url,
          zoom_password: meeting.password,
          zoom_host_email: meeting.host_email,
        })
        .eq("id", s.id);

      summary.created++;
    } catch (err) {
      summary.failed++;
      summary.errors.push(
        `${s.id.slice(0, 8)}: ${err instanceof Error ? err.message.slice(0, 120) : "failed"}`,
      );
    }
  }

  return NextResponse.json({ ok: true, summary });
}
