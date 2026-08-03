import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";
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

function dbErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unknown database error";
}

async function handleBookingAttendance(
  teacher: TeacherCtx,
  body: { booking_id: string; attended: boolean },
) {
  let booking:
    | {
        id: string;
        submission_id: string;
        slot_id: string;
        status: string;
        teacher_id: string;
        kind: string;
      }
    | null = null;
  try {
    const rows = await sql<
      {
        id: string;
        submission_id: string;
        slot_id: string;
        status: string;
        teacher_id: string;
        kind: string;
      }[]
    >`
      SELECT b.id, b.submission_id, b.slot_id, b.status,
             s.teacher_id, s.kind
        FROM bookings b
        JOIN slots s ON s.id = b.slot_id
       WHERE b.id = ${body.booking_id}
       LIMIT 1`;
    booking = rows[0] ?? null;
  } catch {
    booking = null;
  }

  if (!booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  if (booking.teacher_id !== teacher.teacherId) {
    return NextResponse.json({ error: "not_your_slot" }, { status: 403 });
  }
  if (booking.kind !== "assessment") {
    return NextResponse.json(
      {
        error: "wrong_kind",
        message:
          "Booking ini bukan Assessment. Gunakan endpoint cohort_session untuk Tahsin.",
      },
      { status: 400 },
    );
  }

  let existing: { id: string } | null = null;
  try {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM attendance WHERE booking_id = ${body.booking_id} LIMIT 1`;
    existing = rows[0] ?? null;
  } catch {
    existing = null;
  }

  const payload = {
    booking_id: body.booking_id,
    cohort_session_id: null,
    submission_id: booking.submission_id,
    attended: body.attended,
    source: "manual" as const,
    need_review: false,
    overridden_by: teacher.authUserId,
    overridden_at: new Date(),
  };

  try {
    if (existing) {
      await sql`UPDATE attendance SET ${sql(payload)} WHERE id = ${existing.id}`;
    } else {
      await sql`INSERT INTO attendance ${sql(payload)}`;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", message: dbErrorMessage(err) },
      { status: 500 },
    );
  }

  try {
    await sql`
      UPDATE bookings
         SET status = ${body.attended ? "attended" : "no_show"}
       WHERE id = ${body.booking_id}`;
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", message: dbErrorMessage(err) },
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
  // Verify session belongs to a cohort owned by this teacher
  let session:
    | {
        id: string;
        cohort_id: string;
        session_number: number;
        cohort_teacher_id: string;
        cohort_name: string;
      }
    | null = null;
  try {
    const rows = await sql<
      {
        id: string;
        cohort_id: string;
        session_number: number;
        cohort_teacher_id: string;
        cohort_name: string;
      }[]
    >`
      SELECT cs.id, cs.cohort_id, cs.session_number,
             c.teacher_id AS cohort_teacher_id,
             c.name       AS cohort_name
        FROM cohort_sessions cs
        JOIN cohorts c ON c.id = cs.cohort_id
        JOIN slots s ON s.id = cs.slot_id
       WHERE cs.id = ${body.cohort_session_id}
       LIMIT 1`;
    session = rows[0] ?? null;
  } catch {
    session = null;
  }

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.cohort_teacher_id !== teacher.teacherId) {
    return NextResponse.json({ error: "not_your_cohort" }, { status: 403 });
  }

  // Verify peserta is enrolled in this cohort (and not dropped)
  let enrollRow: { id: string; status: string } | null = null;
  try {
    const rows = await sql<{ id: string; status: string }[]>`
      SELECT id, status
        FROM cohort_enrollments
       WHERE cohort_id = ${session.cohort_id}
         AND submission_id = ${body.submission_id}
       LIMIT 1`;
    enrollRow = rows[0] ?? null;
  } catch {
    enrollRow = null;
  }

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

  let existing: { id: string } | null = null;
  try {
    const rows = await sql<{ id: string }[]>`
      SELECT id
        FROM attendance
       WHERE cohort_session_id = ${body.cohort_session_id}
         AND submission_id = ${body.submission_id}
       LIMIT 1`;
    existing = rows[0] ?? null;
  } catch {
    existing = null;
  }

  const payload = {
    booking_id: null,
    cohort_session_id: body.cohort_session_id,
    submission_id: body.submission_id,
    attended: body.attended,
    source: "manual" as const,
    need_review: false,
    overridden_by: teacher.authUserId,
    overridden_at: new Date(),
  };

  try {
    if (existing) {
      await sql`UPDATE attendance SET ${sql(payload)} WHERE id = ${existing.id}`;
    } else {
      await sql`INSERT INTO attendance ${sql(payload)}`;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", message: dbErrorMessage(err) },
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
