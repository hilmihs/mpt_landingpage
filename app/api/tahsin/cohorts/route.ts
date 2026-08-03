import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { todayJakartaISO } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List Tahsin cohorts available for this peserta to enroll in.
 * Filters: status=open, gender_target matches submission, capacity > enrolled,
 * start_date >= today.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "missing_slug" }, { status: 400 });
  }

  const eligibility = await getParticipantEligibilityBySlug(slug);
  if (!eligibility) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!eligibility.gate2_eligible) {
    return NextResponse.json(
      {
        error: "not_eligible",
        message:
          "Anda perlu menyelesaikan sesi assessment terlebih dahulu sebelum mendaftar Tahsin.",
      },
      { status: 403 },
    );
  }

  const todayStr = todayJakartaISO();

  // Sessions are aggregated in-query (already sorted by scheduled_at) so the
  // shape stays identical to the old nested-select response.
  let rows: {
    id: string;
    name: string;
    status: string;
    gender_target: string;
    start_date: string;
    end_date: string;
    capacity: number;
    enrolled_count: number;
    teacher_nama: string | null;
    sessions: { scheduled_at: string; duration_min: number }[];
  }[];

  try {
    rows = await sql`
      SELECT c.id, c.name, c.status, c.gender_target,
             c.start_date::text AS start_date,
             c.end_date::text AS end_date,
             c.capacity, c.enrolled_count,
             t.nama AS teacher_nama,
             COALESCE(
               (SELECT json_agg(
                         json_build_object(
                           'scheduled_at', sl.scheduled_at,
                           'duration_min', sl.duration_min
                         )
                         ORDER BY sl.scheduled_at
                       )
                FROM cohort_sessions cs
                JOIN slots sl ON sl.id = cs.slot_id
                WHERE cs.cohort_id = c.id),
               '[]'::json
             ) AS sessions
      FROM cohorts c
      LEFT JOIN teachers t ON t.id = c.teacher_id
      WHERE c.status = ${"open"}
        AND c.gender_target = ${eligibility.jenis_kelamin}
        AND c.start_date >= ${todayStr}
      ORDER BY c.start_date ASC
    `;
  } catch (err) {
    return NextResponse.json(
      { error: "db_error", message: (err as Error).message },
      { status: 500 },
    );
  }

  const cohorts = rows
    .filter((c) => c.enrolled_count < c.capacity)
    .map((c) => ({
      id: c.id,
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      capacity: c.capacity,
      enrolled_count: c.enrolled_count,
      teacher_nama: c.teacher_nama ?? "—",
      sessions: c.sessions,
    }));

  return NextResponse.json({ cohorts });
}
