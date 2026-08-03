import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getCurrentTeacher } from "@/lib/auth/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "pending";

  let data: {
    id: string;
    audio_path: string;
    audio_duration_sec: number | null;
    status: string;
    assigned_tier: string | null;
    reviewer_notes: string | null;
    reviewed_at: Date | null;
    created_at: Date;
    nama: string | null;
    jenis_kelamin: string | null;
    rapot_slug: string | null;
  }[];

  try {
    data = await sql`
      SELECT r.id,
             r.audio_path,
             r.audio_duration_sec::float8 AS audio_duration_sec,
             r.status,
             r.assigned_tier,
             r.reviewer_notes,
             r.reviewed_at,
             r.created_at,
             sub.nama,
             sub.jenis_kelamin,
             sub.rapot_slug
        FROM hits_recordings r
        LEFT JOIN submissions sub ON sub.id = r.submission_id
       WHERE r.status = ${status}
       ORDER BY r.created_at ${status === "pending" ? sql`ASC` : sql`DESC`}`;
  } catch (err) {
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "unknown database error",
      },
      { status: 500 },
    );
  }

  const rows = data.map((r) => ({
    id: r.id,
    audio_path: r.audio_path,
    audio_duration_sec: r.audio_duration_sec,
    status: r.status,
    assigned_tier: r.assigned_tier,
    reviewer_notes: r.reviewer_notes,
    reviewed_at: r.reviewed_at,
    created_at: r.created_at,
    peserta_nama: r.nama ?? "—",
    peserta_gender: r.jenis_kelamin ?? "—",
    peserta_slug: r.rapot_slug ?? null,
  }));

  return NextResponse.json({ recordings: rows });
}

const patchSchema = z.object({
  recording_id: z.string().uuid(),
  assigned_tier: z.enum([
    "lanjutan_awal",
    "lanjutan_menengah",
    "lanjutan_expert",
  ]),
  reviewer_notes: z.string().max(1000).optional(),
});

export async function PATCH(req: Request) {
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { recording_id, assigned_tier, reviewer_notes } = parsed.data;

  try {
    await sql`
      UPDATE hits_recordings
         SET status = ${"classified"},
             assigned_tier = ${assigned_tier},
             reviewer_notes = ${reviewer_notes ?? null},
             reviewed_by = ${teacher.teacherId},
             reviewed_at = ${new Date()}
       WHERE id = ${recording_id}
         AND status = ${"pending"}`;
  } catch (err) {
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "unknown database error",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
