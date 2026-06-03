import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { supabaseService } from "@/lib/supabase";
import { createMeeting, isMeetConfigured } from "@/lib/google-meet/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Backfill Google Meet meetings for slots that don't have one yet.
 * POST body: { slot_ids?: string[] }
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isMeetConfigured()) {
    return NextResponse.json(
      {
        error: "meet_not_configured",
        message:
          "GOOGLE_SERVICE_ACCOUNT_KEY belum di-set. Set di Vercel project settings dulu.",
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
      `id, kind, scheduled_at, duration_min, meet_calendar_event_id,
       teachers:teacher_id(nama, email_meet)`,
    )
    .is("meet_calendar_event_id", null)
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
    meet_calendar_event_id: string | null;
    teachers: { nama: string; email_meet: string | null } | null;
  }[];

  const summary = {
    total: slots.length,
    created: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const s of slots) {
    if (!s.teachers?.email_meet) {
      summary.failed++;
      summary.errors.push(`${s.id.slice(0, 8)}: teacher email_meet kosong`);
      continue;
    }
    try {
      const meeting = await createMeeting({
        teacher_email: s.teachers.email_meet,
        topic: `${s.kind === "assessment" ? "Assessment" : "Tahsin"} Al-Fatihah — ${s.teachers.nama}`,
        start_time: s.scheduled_at,
        duration_min: s.duration_min,
      });

      await sb
        .from("slots")
        .update({
          meet_calendar_event_id: meeting.calendar_event_id,
          meet_join_url: meeting.join_url,
          meet_conference_id: meeting.conference_id,
          meet_host_email: meeting.host_email,
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
