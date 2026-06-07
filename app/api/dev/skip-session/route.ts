import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

export async function POST(req: Request) {
  const { slug } = (await req.json()) as { slug: string };
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const sb = supabaseService();

  const { data: rapot } = await sb
    .from("rapot")
    .select("submission_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!rapot) {
    return NextResponse.json({ error: "rapot not found" }, { status: 404 });
  }
  const submissionId = rapot.submission_id as string;

  const { data: enrollment } = await sb
    .from("cohort_enrollments")
    .select("id, completed_sessions, cohorts:cohort_id(id)")
    .eq("submission_id", submissionId)
    .neq("status", "dropped")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "no enrollment" }, { status: 404 });
  }

  const cohortId = (enrollment.cohorts as unknown as { id: string }).id;

  const { data: allSessions } = await sb
    .from("cohort_sessions")
    .select("id, session_number")
    .eq("cohort_id", cohortId)
    .order("session_number");

  if (!allSessions || allSessions.length === 0) {
    return NextResponse.json({ error: "no sessions" }, { status: 404 });
  }

  const { data: attended } = await sb
    .from("attendance")
    .select("cohort_session_id")
    .eq("submission_id", submissionId);

  const attendedIds = new Set(
    attended?.map((a) => a.cohort_session_id).filter(Boolean) ?? [],
  );

  const next = allSessions.find((s) => !attendedIds.has(s.id));
  if (!next) {
    return NextResponse.json({
      completed: allSessions.length,
      total: allSessions.length,
      done: true,
      message: "all sessions already attended",
    });
  }

  const { error } = await sb.from("attendance").insert({
    cohort_session_id: next.id,
    submission_id: submissionId,
    booking_id: null,
    attended: true,
    source: "manual",
    joined_at: new Date().toISOString(),
    duration_min: 90,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newCompleted = attendedIds.size + 1;
  return NextResponse.json({
    completed: newCompleted,
    total: allSessions.length,
    done: newCompleted >= allSessions.length,
    skipped_session: next.session_number,
  });
}
