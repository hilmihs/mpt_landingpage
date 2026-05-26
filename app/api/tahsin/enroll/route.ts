import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";
import { enrollRatelimit, getClientIp } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rapot_slug: z.string().min(6).max(64),
  cohort_id: z.string().uuid(),
});

const REASON_MESSAGES: Record<string, string> = {
  cohort_not_found: "Cohort tidak ditemukan.",
  cohort_closed: "Cohort ini sudah tidak menerima pendaftaran.",
  gender_mismatch: "Cohort ini untuk gender yang berbeda.",
  cohort_full: "Cohort ini sudah penuh.",
  already_enrolled: "Anda sudah terdaftar di cohort ini.",
};

const REASON_STATUS: Record<string, number> = {
  cohort_not_found: 404,
  cohort_closed: 400,
  gender_mismatch: 400,
  cohort_full: 409,
  already_enrolled: 409,
};

export async function POST(req: Request) {
  try {
    const rl = await enrollRatelimit().limit(getClientIp(req));
    if (!rl.success) {
      return NextResponse.json(
        { error: "rate_limited", message: "Terlalu banyak request. Coba lagi sebentar." },
        { status: 429 },
      );
    }
  } catch {
    // fail-open
  }

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

  // Atomic enroll via stored procedure — eliminates TOCTOU between
  // capacity check and INSERT. See migration 0003.
  const sb = supabaseService();
  const { data: rpcData, error: rpcErr } = await sb.rpc("enroll_in_cohort", {
    p_cohort_id: cohort_id,
    p_submission_id: eligibility.submission_id,
    p_jenis_kelamin: eligibility.jenis_kelamin,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: "db_error", message: rpcErr.message },
      { status: 500 },
    );
  }

  const result = rpcData as
    | { ok: true; enrollment_id: string; cohort_name: string }
    | { ok: false; reason: string };

  if (!result.ok) {
    const reason = result.reason;
    return NextResponse.json(
      {
        error: reason,
        message: REASON_MESSAGES[reason] ?? "Gagal mendaftar cohort.",
      },
      { status: REASON_STATUS[reason] ?? 400 },
    );
  }

  // Record gate2='yes' so future eligibility checks see the explicit consent
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
    metadata: { cohort_id, cohort_name: result.cohort_name },
  });

  return NextResponse.json({ ok: true, cohort_id });
}
