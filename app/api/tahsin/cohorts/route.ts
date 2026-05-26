import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";

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

  const sb = supabaseService();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("cohorts")
    .select(
      `id, name, status, gender_target, start_date, end_date, capacity, enrolled_count,
       teachers:teacher_id(nama),
       cohort_sessions(slot_id, slots:slot_id(scheduled_at, duration_min))`,
    )
    .eq("status", "open")
    .eq("gender_target", eligibility.jenis_kelamin)
    .gte("start_date", todayStr)
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    status: string;
    gender_target: string;
    start_date: string;
    end_date: string;
    capacity: number;
    enrolled_count: number;
    teachers: { nama: string } | null;
    cohort_sessions: {
      slot_id: string;
      slots: { scheduled_at: string; duration_min: number } | null;
    }[];
  }[];

  const cohorts = rows
    .filter((c) => c.enrolled_count < c.capacity)
    .map((c) => ({
      id: c.id,
      name: c.name,
      start_date: c.start_date,
      end_date: c.end_date,
      capacity: c.capacity,
      enrolled_count: c.enrolled_count,
      teacher_nama: c.teachers?.nama ?? "—",
      sessions: c.cohort_sessions
        .filter((s) => s.slots)
        .map((s) => ({
          scheduled_at: s.slots!.scheduled_at,
          duration_min: s.slots!.duration_min,
        }))
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    }));

  return NextResponse.json({ cohorts });
}
