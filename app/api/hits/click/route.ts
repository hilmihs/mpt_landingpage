import { NextResponse } from "next/server";
import { getParticipantEligibilityBySlug } from "@/lib/eligibility";
import { sql } from "@/lib/db";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";
import { hitsClickRatelimit, getClientIp } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HITS_URL = "https://linktr.ee/muhajirprojecttilawah";

export async function POST(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.redirect(`${origin}/`, { status: 303 });
  }

  try {
    const rl = await hitsClickRatelimit().limit(getClientIp(req));
    if (!rl.success) {
      return NextResponse.redirect(`${origin}/rapot/${slug}?rate_limited=1`, {
        status: 303,
      });
    }
  } catch {
    // fail-open
  }

  const eligibility = await getParticipantEligibilityBySlug(slug);

  // Hard gate — uses ever_qualified (not current enrollment) so a graduate
  // who re-enrolled in a review cohort keeps HITS access.
  if (!eligibility?.ever_qualified_for_hits) {
    return NextResponse.redirect(`${origin}/rapot/${slug}?hits_locked=1`, {
      status: 303,
    });
  }

  // Record gate3=yes + emit click event.
  // Kegagalan tulis tidak boleh menahan redirect ke HITS (sama seperti sebelumnya).
  try {
    await sql`
      INSERT INTO interest_responses (submission_id, gate, response)
      VALUES (${eligibility.submission_id}, ${"gate3_post_tahsin"}, ${"yes"})
      ON CONFLICT (submission_id, gate)
      DO UPDATE SET response = EXCLUDED.response
    `;
  } catch {
    // fail-open
  }

  await trackEvent({
    event_name: FUNNEL_EVENTS.HITS_CTA_CLICKED,
    submission_id: eligibility.submission_id,
    metadata: { cohort_id: eligibility.enrolled_cohort?.id ?? null },
  });

  return NextResponse.redirect(HITS_URL, { status: 303 });
}
