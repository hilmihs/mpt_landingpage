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

  // Zoom's past_meetings API can take 5-30+ seconds to populate after a
  // meeting ends. Retry the reconcile with backoff: if listMeetingParticipants
  // returns empty (which would otherwise mark everyone no_show), wait and
  // retry up to 4 times.
  //
  // Total worst case: 5 + 10 + 15 + 20 = 50s, fits within maxDuration=60.
  const backoffMs = [5_000, 10_000, 15_000, 20_000];
  let lastResult = null;
  for (let attempt = 0; attempt < backoffMs.length; attempt++) {
    await new Promise((r) => setTimeout(r, backoffMs[attempt]));

    const result = await reconcileSlotAttendance(meetingId);
    lastResult = result;

    // If anyone was actually marked attended, Zoom data was ready — done.
    if (result.attended_auto > 0 || result.attended_review > 0) {
      console.log(
        `[zoom-webhook] reconcile attempt ${attempt + 1} succeeded:`,
        JSON.stringify(result),
      );
      return;
    }

    // If there were no candidates at all (slot had no bookings/enrollments),
    // also done — nothing to retry.
    if (result.targets_total === 0) {
      console.log("[zoom-webhook] reconcile: no targets, exit", JSON.stringify(result));
      return;
    }

    // Otherwise: all targets marked no_show (or hit errors). This is the
    // suspicious case — likely past_meetings not populated yet. Try again.
    console.warn(
      `[zoom-webhook] reconcile attempt ${attempt + 1} found 0 attendees out of ${result.targets_total}; retrying`,
    );
  }

  console.error(
    "[zoom-webhook] reconcile exhausted retries — Zoom past_meetings may have been unavailable. Last result:",
    JSON.stringify(lastResult),
  );
}
