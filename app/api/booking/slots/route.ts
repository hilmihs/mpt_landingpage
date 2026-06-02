import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";

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
  const sb = supabaseService();

  // Query slots via the v_slots_availability view (gracefully degrade if missing)
  const { data, error } = await sb
    .from("v_slots_availability")
    .select(
      "id, kind, scheduled_at, duration_min, gender_target, capacity, reserved_count, available_capacity, status, zoom_join_url, teacher_id, teacher_nama",
    )
    .eq("kind", kind)
    .eq("gender_target", gender)
    .gt("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(60);

  if (error) {
    // If the view doesn't exist yet (migration not applied), return empty list
    // gracefully so the booking page can display a "coming soon" state.
    if (
      error.message.toLowerCase().includes("does not exist") ||
      error.message.toLowerCase().includes("relation")
    ) {
      return NextResponse.json({ slots: [], system_ready: false });
    }
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    slots: (data ?? []).filter((s) => s.available_capacity > 0),
    system_ready: true,
  });
}
