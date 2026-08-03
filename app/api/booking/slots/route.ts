import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  gender: z.enum(["ikhwan", "akhwat"]),
  kind: z.enum(["assessment", "tahsin"]).default("assessment"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    gender: searchParams.get("gender"),
    kind: searchParams.get("kind") ?? "assessment",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { gender, kind } = parsed.data;

  // Query slots via the v_slots_availability view (gracefully degrade if missing)
  let data: { available_capacity: number }[];
  try {
    data = await sql<{ available_capacity: number }[]>`
      SELECT id, kind, scheduled_at, duration_min, gender_target, capacity,
             reserved_count, available_capacity, status, meet_join_url,
             teacher_id, teacher_nama
      FROM v_slots_availability
      WHERE kind = ${kind}
        AND gender_target = ${gender}
        AND scheduled_at > ${new Date()}
      ORDER BY scheduled_at ASC
      LIMIT 60
    `;
  } catch (err) {
    const message = (err as Error).message;
    // If the view doesn't exist yet (migration not applied), return empty list
    // gracefully so the booking page can display a "coming soon" state.
    if (
      message.toLowerCase().includes("does not exist") ||
      message.toLowerCase().includes("relation")
    ) {
      return NextResponse.json({ slots: [], system_ready: false });
    }
    return NextResponse.json(
      { error: "db_error", message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    slots: data.filter((s) => s.available_capacity > 0),
    system_ready: true,
  });
}
