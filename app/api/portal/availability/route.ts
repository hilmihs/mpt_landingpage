import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";

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

  const sb = supabaseService();
  const { data, error } = await sb
    .from("teacher_availability")
    .insert({
      teacher_id: teacher.teacherId,
      day_of_week,
      start_time,
      end_time,
      kind,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
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

  const sb = supabaseService();
  // Soft-delete via is_active=false to preserve referential history
  const { error } = await sb
    .from("teacher_availability")
    .update({ is_active: false })
    .eq("id", id)
    .eq("teacher_id", teacher.teacherId);

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
