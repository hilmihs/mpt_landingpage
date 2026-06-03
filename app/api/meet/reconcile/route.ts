import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { reconcileSlotAttendance } from "@/lib/google-meet/reconcile";
import { isMeetConfigured } from "@/lib/google-meet/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.WORKER_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const x = req.headers.get("x-worker-secret");
  if (x === secret) return true;
  return false;
}

/**
 * Cron-driven attendance reconciliation for Google Meet.
 *
 * Finds slots where the meeting should have ended (scheduled_at + duration
 * has passed) but status is still 'scheduled' or 'in_progress', and runs
 * the attendance reconciliation pipeline.
 *
 * Replaces the Zoom webhook-driven approach — no real-time notification
 * needed; we poll on a schedule.
 */
async function handleReconcile(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isMeetConfigured()) {
    return NextResponse.json({ ok: true, skipped: "meet_not_configured" });
  }

  const sb = supabaseService();

  // Find slots where the meeting should have ended:
  // scheduled_at + duration_min + 15min buffer < now()
  // AND status is not yet 'completed'
  // AND has a Google Meet conference ID
  const { data: slotsRaw } = await sb
    .from("slots")
    .select("id, kind, scheduled_at, duration_min, meet_conference_id, status")
    .not("meet_conference_id", "is", null)
    .in("status", ["scheduled", "in_progress"])
    .lt("scheduled_at", new Date(Date.now() - 15 * 60_000).toISOString());

  const slots = (slotsRaw ?? []) as {
    id: string;
    kind: "assessment" | "tahsin";
    scheduled_at: string;
    duration_min: number;
    meet_conference_id: string;
    status: string;
  }[];

  // Filter: only process slots where scheduled_at + duration + 15min buffer has passed
  const now = Date.now();
  const eligible = slots.filter((s) => {
    const endTime =
      new Date(s.scheduled_at).getTime() + s.duration_min * 60_000;
    return endTime + 15 * 60_000 < now;
  });

  const results: {
    slot_id: string;
    kind: string;
    attended: number;
    no_show: number;
    errors: string[];
  }[] = [];

  for (const s of eligible) {
    // Mark slot as completed (meeting has ended based on schedule)
    await sb
      .from("slots")
      .update({
        status: "completed",
        meeting_ended_at: new Date(
          new Date(s.scheduled_at).getTime() + s.duration_min * 60_000,
        ).toISOString(),
      })
      .eq("id", s.id);

    const r = await reconcileSlotAttendance(s.id);
    results.push({
      slot_id: s.id,
      kind: s.kind,
      attended: r.attended_auto + r.attended_review,
      no_show: r.no_show,
      errors: r.errors,
    });
  }

  return NextResponse.json({
    ok: true,
    checked: slots.length,
    reconciled: results.length,
    results,
  });
}

export async function GET(req: Request) {
  return handleReconcile(req);
}

export async function POST(req: Request) {
  return handleReconcile(req);
}
