import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import {
  generateSlotsForTeacher,
  generateSlotsForAllTeachers,
} from "@/lib/slots/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  teacher_id: z.string().uuid().optional(),
  weeks_ahead: z.number().int().min(1).max(12).default(4),
});

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // body is optional
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { teacher_id, weeks_ahead } = parsed.data;

  if (teacher_id) {
    const result = await generateSlotsForTeacher(teacher_id, weeks_ahead);
    return NextResponse.json({ ok: true, results: [result] });
  }

  const results = await generateSlotsForAllTeachers(weeks_ahead);
  return NextResponse.json({
    ok: true,
    results,
    summary: {
      teachers: results.length,
      total_created: results.reduce((s, r) => s + r.slots_created, 0),
      total_skipped: results.reduce((s, r) => s + r.slots_skipped, 0),
      zoom_created: results.reduce((s, r) => s + r.zoom_meetings_created, 0),
      zoom_errors: results.reduce((s, r) => s + r.zoom_errors, 0),
    },
  });
}
