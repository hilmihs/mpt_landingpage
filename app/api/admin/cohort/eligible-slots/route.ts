import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

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

  // 1. Get all bound slot_ids
  const boundRaw = await sql<{ slot_id: string }[]>`
    SELECT slot_id FROM cohort_sessions
  `;
  const boundSlotIds = new Set(boundRaw.map((r) => r.slot_id));

  // 2. Fetch eligible slots
  const slots = await sql<
    {
      id: string;
      scheduled_at: Date;
      duration_min: number;
      gender_target: string;
      meet_join_url: string | null;
    }[]
  >`
    SELECT id, scheduled_at, duration_min, gender_target, meet_join_url
    FROM slots
    WHERE teacher_id = ${teacherId}
      AND kind = ${"tahsin"}
      AND status = ${"scheduled"}
      AND scheduled_at > ${new Date()}
    ORDER BY scheduled_at ASC
  `;

  const eligible = slots
    .filter((s) => !boundSlotIds.has(s.id))
    .map((s) => ({ ...s, scheduled_at: s.scheduled_at.toISOString() }));

  return NextResponse.json({ slots: eligible });
}
