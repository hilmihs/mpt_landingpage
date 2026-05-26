import { NextResponse } from "next/server";
import { verifyZoomSignature, computeValidationResponse } from "@/lib/zoom/verify";
import { supabaseService } from "@/lib/supabase";
import { reconcileSlotAttendance } from "@/lib/zoom/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Zoom webhook receiver.
 *
 * Subscribe in Zoom Marketplace app to:
 *   - endpoint.url_validation  (one-time setup)
 *   - meeting.started
 *   - meeting.ended
 *
 * (Participant join/leave events are optional. We rely on past_meetings API
 * called from meeting.ended to get the full participant list.)
 */
export async function POST(req: Request) {
  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (!secretToken) {
    console.error("[zoom-webhook] ZOOM_WEBHOOK_SECRET_TOKEN not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get("x-zm-request-timestamp");
  const signature = req.headers.get("x-zm-signature");

  let parsed: { event?: string; payload?: Record<string, unknown> };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // URL validation challenge — Zoom sends this once when setting up the webhook.
  // Must respond synchronously with HMAC-encrypted plainToken.
  if (parsed.event === "endpoint.url_validation") {
    const plainToken = (parsed.payload as { plainToken?: string } | undefined)
      ?.plainToken;
    if (!plainToken) {
      return NextResponse.json({ error: "missing_plain_token" }, { status: 400 });
    }
    return NextResponse.json(
      computeValidationResponse(plainToken, secretToken),
    );
  }

  // All other events: verify signature
  if (!verifyZoomSignature(rawBody, timestamp, signature, secretToken)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const event = parsed.event;
  const payload = (parsed.payload ?? {}) as {
    object?: {
      id?: string | number;
      uuid?: string;
      start_time?: string;
      end_time?: string;
      topic?: string;
    };
  };

  const meetingId = payload.object?.id ? String(payload.object.id) : null;
  if (!meetingId) {
    return NextResponse.json({ ok: true, skipped: "no_meeting_id" });
  }

  try {
    switch (event) {
      case "meeting.started":
        await handleStarted(meetingId, payload.object?.start_time);
        break;
      case "meeting.ended":
        await handleEnded(meetingId, payload.object?.end_time);
        break;
      default:
        // Ignore other events
        break;
    }
  } catch (err) {
    console.error(`[zoom-webhook] ${event} failed`, err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

async function handleStarted(meetingId: string, startTime?: string) {
  const sb = supabaseService();
  await sb
    .from("slots")
    .update({
      status: "in_progress",
      meeting_started_at: startTime ?? new Date().toISOString(),
    })
    .eq("zoom_meeting_id", meetingId);
}

async function handleEnded(meetingId: string, endTime?: string) {
  const sb = supabaseService();
  await sb
    .from("slots")
    .update({
      status: "completed",
      meeting_ended_at: endTime ?? new Date().toISOString(),
    })
    .eq("zoom_meeting_id", meetingId);

  // Zoom needs a few seconds before past_meetings API is populated. We retry
  // with backoff in the reconcile loop, but in production prefer queuing via
  // BullMQ for the participant pull. For now, reconcile inline.
  // Delay briefly to give Zoom time to flush participants list.
  await new Promise((r) => setTimeout(r, 5_000));

  const result = await reconcileSlotAttendance(meetingId);
  console.log("[zoom-webhook] reconcile:", JSON.stringify(result));
}
