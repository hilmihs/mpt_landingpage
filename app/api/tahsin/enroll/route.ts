import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rapot_slug: z.string().min(6).max(64),
  cohort_id: z.string().uuid(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { rapot_slug, cohort_id } = parsed.data;

  const eligibility = await getParticipantEligibilityBySlug(rapot_slug);
  if (!eligibility) {
    return NextResponse.json({ error: "rapot_not_found" }, { status: 404 });
  }
  if (eligibility.enrolled_cohort) {
    return NextResponse.json(
      {
        error: "already_enrolled",
        message: `Anda sudah terdaftar di cohort "${eligibility.enrolled_cohort.name}".`,
        cohort_id: eligibility.enrolled_cohort.id,
      },
      { status: 409 },
    );
  }
  if (!eligibility.gate2_eligible) {
    return NextResponse.json(
      {
        error: "not_eligible",
        message:
          "Anda perlu menghadiri sesi assessment lebih dulu sebelum mendaftar Tahsin.",
      },
      { status: 403 },
    );
  }

  const sb = supabaseService();

  // Atomic-ish check + insert. The DB has a UNIQUE(cohort_id, submission_id),
  // so a concurrent double-enroll fails with 23505. We also pre-check capacity
  // and gender for a friendlier error message.
  const { data: cohortRaw } = await sb
    .from("cohorts")
    .select("id, status, capacity, enrolled_count, gender_target, name")
    .eq("id", cohort_id)
    .maybeSingle();
  const cohort = cohortRaw as {
    id: string;
    status: string;
    capacity: number;
    enrolled_count: number;
    gender_target: string;
    name: string;
  } | null;

  if (!cohort) {
    return NextResponse.json({ error: "cohort_not_found" }, { status: 404 });
  }
  if (cohort.status !== "open") {
    return NextResponse.json(
      { error: "cohort_closed", message: "Cohort ini sudah tidak menerima pendaftaran." },
      { status: 400 },
    );
  }
  if (cohort.gender_target !== eligibility.jenis_kelamin) {
    return NextResponse.json(
      {
        error: "gender_mismatch",
        message: "Cohort ini untuk gender yang berbeda.",
      },
      { status: 400 },
    );
  }
  if (cohort.enrolled_count >= cohort.capacity) {
    return NextResponse.json(
      { error: "cohort_full", message: "Cohort ini sudah penuh." },
      { status: 409 },
    );
  }

  const { error: insertErr } = await sb.from("cohort_enrollments").insert({
    cohort_id,
    submission_id: eligibility.submission_id,
    status: "enrolled",
  });

  if (insertErr) {
    // 23505 = unique violation (race condition lost) → treat as already enrolled
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { ok: true, already_enrolled: true, cohort_id },
      );
    }
    return NextResponse.json(
      { error: "db_error", message: insertErr.message },
      { status: 500 },
    );
  }

  // Auto-record gate2 interest as 'yes'
  await sb
    .from("interest_responses")
    .upsert(
      {
        submission_id: eligibility.submission_id,
        gate: "gate2_post_assessment",
        response: "yes",
      },
      { onConflict: "submission_id,gate" },
    );

  await trackEvent({
    event_name: FUNNEL_EVENTS.TAHSIN_ENROLLED,
    submission_id: eligibility.submission_id,
    metadata: { cohort_id, cohort_name: cohort.name },
  });

  return NextResponse.json({ ok: true, cohort_id });
}
