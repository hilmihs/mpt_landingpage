import { NextResponse } from "next/server";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { supabaseService } from "@/lib/supabase";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HITS_URL = "https://linktr.ee/muhajirprojecttilawah";

export async function POST(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.redirect(`${origin}/`, { status: 303 });
  }

  const eligibility = await getParticipantEligibilityBySlug(slug);

  // Hard gate. If somehow ineligible, bounce to rapot.
  if (!eligibility?.enrolled_cohort?.qualified_for_hits) {
    return NextResponse.redirect(`${origin}/rapot/${slug}?hits_locked=1`, {
      status: 303,
    });
  }

  // Record gate3=yes + emit click event
  const sb = supabaseService();
  await sb
    .from("interest_responses")
    .upsert(
      {
        submission_id: eligibility.submission_id,
        gate: "gate3_post_tahsin",
        response: "yes",
      },
      { onConflict: "submission_id,gate" },
    );

  await trackEvent({
    event_name: FUNNEL_EVENTS.HITS_CTA_CLICKED,
    submission_id: eligibility.submission_id,
    metadata: { cohort_id: eligibility.enrolled_cohort.id },
  });

  return NextResponse.redirect(HITS_URL, { status: 303 });
}
