import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({
    booking_id: z.string().uuid(),
    attended: z.boolean(),
  }),
  z.object({
    cohort_session_id: z.string().uuid(),
    submission_id: z.string().uuid(),
    attended: z.boolean(),
  }),
]);

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

  if ("booking_id" in parsed.data) {
    return handleBookingAttendance(teacher, parsed.data);
  }
  return handleCohortSessionAttendance(teacher, parsed.data);
}

interface TeacherCtx {
  teacherId: string;
  authUserId: string;
}

async function handleBookingAttendance(
  teacher: TeacherCtx,
  body: { booking_id: string; attended: boolean },
) {
  const sb = supabaseService();

  const { data: bookingRaw } = await sb
    .from("bookings")
    .select(
      "id, submission_id, slot_id, status, slots:slot_id(teacher_id, kind)",
    )
    .eq("id", body.booking_id)
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
  if (booking.slots.kind !== "assessment") {
    return NextResponse.json(
      {
        error: "wrong_kind",
        message:
          "Booking ini bukan Assessment. Gunakan endpoint cohort_session untuk Tahsin.",
      },
      { status: 400 },
    );
  }

  const { data: existing } = await sb
    .from("attendance")
    .select("id")
    .eq("booking_id", body.booking_id)
    .maybeSingle();

  const payload = {
    booking_id: body.booking_id,
    cohort_session_id: null,
    submission_id: booking.submission_id,
    attended: body.attended,
    source: "manual" as const,
    need_review: false,
    overridden_by: teacher.authUserId,
    overridden_at: new Date().toISOString(),
  };

  const write = existing
    ? await sb
        .from("attendance")
        .update(payload)
        .eq("id", (existing as { id: string }).id)
    : await sb.from("attendance").insert(payload);

  if (write.error) {
    return NextResponse.json(
      { error: "db_error", message: write.error.message },
      { status: 500 },
    );
  }

  const { error: bookingErr } = await sb
    .from("bookings")
    .update({ status: body.attended ? "attended" : "no_show" })
    .eq("id", body.booking_id);

  if (bookingErr) {
    return NextResponse.json(
      { error: "db_error", message: bookingErr.message },
      { status: 500 },
    );
  }

  if (body.attended) {
    await trackEvent({
      event_name: FUNNEL_EVENTS.ATTENDED_ASSESSMENT,
      submission_id: booking.submission_id,
      metadata: { booking_id: body.booking_id, source: "manual" },
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleCohortSessionAttendance(
  teacher: TeacherCtx,
  body: { cohort_session_id: string; submission_id: string; attended: boolean },
) {
  const sb = supabaseService();

  // Verify session belongs to a cohort owned by this teacher
  const { data: sessionRaw } = await sb
    .from("cohort_sessions")
    .select(
      `id, cohort_id, session_number,
       cohorts:cohort_id(teacher_id, name),
       slots:slot_id(scheduled_at, kind, teacher_id)`,
    )
    .eq("id", body.cohort_session_id)
    .maybeSingle();

  const session = sessionRaw as unknown as
    | {
        id: string;
        cohort_id: string;
        session_number: number;
        cohorts: { teacher_id: string; name: string } | null;
        slots: { scheduled_at: string; kind: string; teacher_id: string } | null;
      }
    | null;

  if (!session || !session.cohorts || !session.slots) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.cohorts.teacher_id !== teacher.teacherId) {
    return NextResponse.json({ error: "not_your_cohort" }, { status: 403 });
  }

  // Verify peserta is enrolled in this cohort (and not dropped)
  const { data: enrollment } = await sb
    .from("cohort_enrollments")
    .select("id, status")
    .eq("cohort_id", session.cohort_id)
    .eq("submission_id", body.submission_id)
    .maybeSingle();

  const enrollRow = enrollment as { id: string; status: string } | null;
  if (!enrollRow) {
    return NextResponse.json(
      {
        error: "not_enrolled",
        message: "Peserta tidak terdaftar di cohort ini.",
      },
      { status: 404 },
    );
  }
  if (enrollRow.status === "dropped") {
    return NextResponse.json(
      {
        error: "peserta_dropped",
        message: "Peserta sudah drop dari cohort ini.",
      },
      { status: 400 },
    );
  }

  const { data: existing } = await sb
    .from("attendance")
    .select("id")
    .eq("cohort_session_id", body.cohort_session_id)
    .eq("submission_id", body.submission_id)
    .maybeSingle();

  const payload = {
    booking_id: null,
    cohort_session_id: body.cohort_session_id,
    submission_id: body.submission_id,
    attended: body.attended,
    source: "manual" as const,
    need_review: false,
    overridden_by: teacher.authUserId,
    overridden_at: new Date().toISOString(),
  };

  const write = existing
    ? await sb
        .from("attendance")
        .update(payload)
        .eq("id", (existing as { id: string }).id)
    : await sb.from("attendance").insert(payload);

  if (write.error) {
    return NextResponse.json(
      { error: "db_error", message: write.error.message },
      { status: 500 },
    );
  }

  if (body.attended) {
    await trackEvent({
      event_name: FUNNEL_EVENTS.TAHSIN_COMPLETED,
      submission_id: body.submission_id,
      metadata: {
        cohort_session_id: body.cohort_session_id,
        session_number: session.session_number,
        source: "manual",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
