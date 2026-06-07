import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";
import { getCurrentTeacher } from "@/lib/auth/teacher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? "pending";

  const sb = supabaseService();
  const { data, error } = await sb
    .from("hits_recordings")
    .select(
      `id, audio_path, audio_duration_sec, status, assigned_tier, reviewer_notes,
       reviewed_at, created_at,
       submissions:submission_id(id, nama, jenis_kelamin, rapot_slug)`,
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" });

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => {
    const sub = r.submissions as Record<string, unknown> | null;
    return {
      id: r.id,
      audio_path: r.audio_path,
      audio_duration_sec: r.audio_duration_sec,
      status: r.status,
      assigned_tier: r.assigned_tier,
      reviewer_notes: r.reviewer_notes,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      peserta_nama: sub?.nama ?? "—",
      peserta_gender: sub?.jenis_kelamin ?? "—",
      peserta_slug: sub?.rapot_slug ?? null,
    };
  });

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

  const sb = supabaseService();
  const { error } = await sb
    .from("hits_recordings")
    .update({
      status: "classified",
      assigned_tier,
      reviewer_notes: reviewer_notes ?? null,
      reviewed_by: teacher.teacherId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", recording_id)
    .eq("status", "pending");

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
