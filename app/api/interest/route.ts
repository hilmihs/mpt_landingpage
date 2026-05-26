import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rapot_slug: z.string().min(6).max(64),
  gate: z.enum(["gate1_post_rapot", "gate2_post_assessment", "gate3_post_tahsin"]),
  response: z.enum(["yes", "no", "later"]),
  optional_note: z.string().max(500).optional(),
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

  const { rapot_slug, gate, response, optional_note } = parsed.data;
  const sb = supabaseService();

  const { data: rapot } = await sb
    .from("rapot")
    .select("submission_id")
    .eq("slug", rapot_slug)
    .maybeSingle();

  if (!rapot) {
    return NextResponse.json({ error: "rapot_not_found" }, { status: 404 });
  }

  const submission_id = rapot.submission_id as string;

  const { error: upsertErr } = await sb
    .from("interest_responses")
    .upsert(
      {
        submission_id,
        gate,
        response,
        optional_note: optional_note ?? null,
      },
      { onConflict: "submission_id,gate" },
    );

  if (upsertErr) {
    return NextResponse.json(
      { error: "db_error", message: upsertErr.message },
      { status: 500 },
    );
  }

  // Track funnel event
  const eventMap: Record<string, string> = {
    "gate1_post_rapot:yes": FUNNEL_EVENTS.GATE1_YES,
    "gate1_post_rapot:no": FUNNEL_EVENTS.GATE1_NO,
  };
  const eventName = eventMap[`${gate}:${response}`];
  if (eventName) {
    await trackEvent({
      event_name: eventName,
      submission_id,
      metadata: { rapot_slug },
    });
  }

  return NextResponse.json({ ok: true });
}
