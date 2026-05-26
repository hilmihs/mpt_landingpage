import { NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_NAMES = Object.values(FUNNEL_EVENTS) as [string, ...string[]];

const schema = z.object({
  event_name: z.enum(EVENT_NAMES),
  submission_id: z.string().uuid().optional().nullable(),
  session_id: z.string().max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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

  await trackEvent(parsed.data);
  return NextResponse.json({ ok: true });
}
