import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  booking_id: z.string().uuid(),
  attended: z.boolean(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { booking_id, attended } = parsed.data;
  const sb = supabaseService();

  // Verify booking is in this teacher's slot
  const { data: bookingRaw } = await sb
    .from("bookings")
    .select(
      "id, submission_id, slot_id, status, slots:slot_id(teacher_id, kind)",
    )
    .eq("id", booking_id)
    .maybeSingle();

  const booking = bookingRaw as unknown as
    | {
        id: string;
        submission_id: string;
        slot_id: string;
        status: string;
        slots: { teacher_id: string; kind: string } | null;
      }
    | null;

  if (!booking || !booking.slots) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  if (booking.slots.teacher_id !== teacher.teacherId) {
    return NextResponse.json({ error: "not_your_slot" }, { status: 403 });
  }

  // Upsert attendance row
  const { data: existing } = await sb
    .from("attendance")
    .select("id")
    .eq("booking_id", booking_id)
    .maybeSingle();

  const attendancePayload = {
    booking_id,
    submission_id: booking.submission_id,
    attended,
    source: "manual" as const,
    need_review: false,
    overridden_by: teacher.authUserId,
    overridden_at: new Date().toISOString(),
  };

  if (existing) {
    await sb
      .from("attendance")
      .update(attendancePayload)
      .eq("id", (existing as { id: string }).id);
  } else {
    await sb.from("attendance").insert(attendancePayload);
  }

  // Bookings.status follows attendance
  await sb
    .from("bookings")
    .update({ status: attended ? "attended" : "no_show" })
    .eq("id", booking_id);

  if (attended && booking.slots.kind === "assessment") {
    await trackEvent({
      event_name: FUNNEL_EVENTS.ATTENDED_ASSESSMENT,
      submission_id: booking.submission_id,
      metadata: { booking_id, source: "manual" },
    });
  }

  return NextResponse.json({ ok: true });
}
