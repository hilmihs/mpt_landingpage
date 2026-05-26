import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  gate: z.enum(["gate1_post_rapot", "gate2_post_assessment", "gate3_post_tahsin"]),
  submission_id: z.string().uuid(),
});

const eventMap: Record<string, string> = {
  gate1_post_rapot: FUNNEL_EVENTS.GATE1_SHOWN,
  gate2_post_assessment: FUNNEL_EVENTS.GATE2_SHOWN,
  gate3_post_tahsin: FUNNEL_EVENTS.GATE3_SHOWN,
};

/**
 * Lightweight beacon endpoint for gate impression analytics. Called from
 * the client-side GateImpressionTracker component on mount.
 *
 * Best-effort: failures are silent (no auth, no rate limit — this is a
 * pure analytics signal).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const eventName = eventMap[parsed.data.gate];
  if (!eventName) return NextResponse.json({ ok: true });

  await trackEvent({
    event_name: eventName,
    submission_id: parsed.data.submission_id,
    metadata: { gate: parsed.data.gate },
  });

  return NextResponse.json({ ok: true });
}
