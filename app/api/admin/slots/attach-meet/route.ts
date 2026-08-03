import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
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

  const slotIds =
    body.slot_ids && body.slot_ids.length > 0 ? body.slot_ids : null;

  const slotsRaw = await sql<
    {
      id: string;
      kind: "assessment" | "tahsin";
      scheduled_at: Date;
      duration_min: number;
      meet_calendar_event_id: string | null;
      teacher_nama: string | null;
      teacher_email_meet: string | null;
    }[]
  >`
    SELECT s.id, s.kind, s.scheduled_at, s.duration_min,
           s.meet_calendar_event_id,
           t.nama AS teacher_nama, t.email_meet AS teacher_email_meet
    FROM slots s
    LEFT JOIN teachers t ON t.id = s.teacher_id
    WHERE s.meet_calendar_event_id IS NULL
      AND s.status = ${"scheduled"}
      AND s.scheduled_at > ${new Date()}
      ${slotIds ? sql`AND s.id = ANY(${slotIds}::uuid[])` : sql``}
  `;

  const slots = slotsRaw.map((r) => ({
    id: r.id,
    kind: r.kind,
    scheduled_at: r.scheduled_at.toISOString(),
    duration_min: r.duration_min,
    meet_calendar_event_id: r.meet_calendar_event_id,
    teachers:
      r.teacher_nama === null
        ? null
        : { nama: r.teacher_nama, email_meet: r.teacher_email_meet },
  }));

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

      await sql`
        UPDATE slots SET
          meet_calendar_event_id = ${meeting.calendar_event_id},
          meet_join_url = ${meeting.join_url},
          meet_conference_id = ${meeting.conference_id},
          meet_host_email = ${meeting.host_email}
        WHERE id = ${s.id}
      `;

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
