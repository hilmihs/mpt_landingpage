import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  kind: z.enum(["assessment", "tahsin"]),
});

function timeToMinutes(t: string): number {
  const parts = t.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { day_of_week, start_time, end_time, kind } = parsed.data;

  if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
    return NextResponse.json(
      { error: "invalid_range", message: "Jam selesai harus setelah jam mulai." },
      { status: 400 },
    );
  }

  try {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO teacher_availability
        (teacher_id, day_of_week, start_time, end_time, kind)
      VALUES
        (${teacher.teacherId}, ${day_of_week}, ${start_time}, ${end_time}, ${kind})
      RETURNING id`;
    // INSERT ... RETURNING selalu mengembalikan tepat satu baris.
    const [row] = rows;
    return NextResponse.json({ ok: true, id: row!.id });
  } catch (err) {
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "unknown database error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  // Soft-delete via is_active=false to preserve referential history
  try {
    await sql`
      UPDATE teacher_availability
         SET is_active = false
       WHERE id = ${id}
         AND teacher_id = ${teacher.teacherId}`;
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
