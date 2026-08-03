import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const { slug } = (await req.json()) as { slug: string };
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const rapotRows = await sql<{ submission_id: string }[]>`
    SELECT submission_id FROM rapot WHERE slug = ${slug} LIMIT 1
  `;
  const rapot = rapotRows[0] ?? null;
  if (!rapot) {
    return NextResponse.json({ error: "rapot not found" }, { status: 404 });
  }
  const submissionId = rapot.submission_id;

  const enrollmentRows = await sql<
    { id: string; completed_sessions: number; cohort_id: string }[]
  >`
    SELECT ce.id, ce.completed_sessions, ce.cohort_id
    FROM cohort_enrollments ce
    WHERE ce.submission_id = ${submissionId}
      AND ce.status <> ${"dropped"}
    ORDER BY ce.created_at DESC
    LIMIT 1
  `;
  const enrollment = enrollmentRows[0] ?? null;

  if (!enrollment) {
    return NextResponse.json({ error: "no enrollment" }, { status: 404 });
  }

  const cohortId = enrollment.cohort_id;

  const allSessions = await sql<{ id: string; session_number: number }[]>`
    SELECT id, session_number
    FROM cohort_sessions
    WHERE cohort_id = ${cohortId}
    ORDER BY session_number
  `;

  if (allSessions.length === 0) {
    return NextResponse.json({ error: "no sessions" }, { status: 404 });
  }

  const attended = await sql<{ cohort_session_id: string | null }[]>`
    SELECT cohort_session_id FROM attendance WHERE submission_id = ${submissionId}
  `;

  const attendedIds = new Set(
    attended.map((a) => a.cohort_session_id).filter(Boolean),
  );

  const next = allSessions.find((s) => !attendedIds.has(s.id));
  if (!next) {
    return NextResponse.json({
      completed: allSessions.length,
      total: allSessions.length,
      done: true,
      message: "all sessions already attended",
    });
  }

  try {
    await sql`
      INSERT INTO attendance
        (cohort_session_id, submission_id, booking_id, attended, source, joined_at, duration_min)
      VALUES (
        ${next.id},
        ${submissionId},
        ${null},
        ${true},
        ${"manual"},
        ${new Date()},
        ${90}
      )
    `;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  const newCompleted = attendedIds.size + 1;
  return NextResponse.json({
    completed: newCompleted,
    total: allSessions.length,
    done: newCompleted >= allSessions.length,
    skipped_session: next.session_number,
  });
}
