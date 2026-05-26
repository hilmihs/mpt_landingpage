import { supabaseService } from "@/lib/supabase";
import { listMeetingParticipants } from "@/lib/zoom/client";
import {
  matchParticipants,
  CONFIDENCE_THRESHOLD,
  type Candidate,
} from "@/lib/zoom/matcher";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export interface ReconcileResult {
  slot_id: string;
  zoom_meeting_id: string;
  bookings_total: number;
  attended_auto: number;
  attended_review: number;
  no_show: number;
  errors: string[];
}

/**
 * After a Zoom meeting ends, reconcile attendance:
 * 1. Pull participant list from Zoom past_meetings API
 * 2. Fuzzy-match each participant to a booking on this slot
 * 3. Upsert attendance rows (source=zoom_webhook if confident, ai_match if not)
 * 4. Mark unmatched bookings as no_show
 *
 * Idempotent: re-running won't duplicate attendance rows (upsert by booking_id).
 */
export async function reconcileSlotAttendance(
  zoomMeetingId: string,
): Promise<ReconcileResult> {
  const sb = supabaseService();
  const result: ReconcileResult = {
    slot_id: "",
    zoom_meeting_id: zoomMeetingId,
    bookings_total: 0,
    attended_auto: 0,
    attended_review: 0,
    no_show: 0,
    errors: [],
  };

  // Find the slot
  const { data: slot } = await sb
    .from("slots")
    .select("id, kind, scheduled_at")
    .eq("zoom_meeting_id", zoomMeetingId)
    .maybeSingle();

  if (!slot) {
    result.errors.push("Slot tidak ditemukan untuk meeting ID ini.");
    return result;
  }
  result.slot_id = (slot as { id: string }).id;

  // Find all non-cancelled bookings for this slot
  const { data: bookingsRaw } = await sb
    .from("bookings")
    .select("id, submission_id, status, submissions:submission_id(nama)")
    .eq("slot_id", result.slot_id)
    .neq("status", "cancelled");

  const bookings = (bookingsRaw ?? []) as unknown as {
    id: string;
    submission_id: string;
    status: string;
    submissions: { nama: string } | null;
  }[];

  result.bookings_total = bookings.length;

  if (bookings.length === 0) return result;

  const candidates: Candidate[] = bookings
    .filter((b) => b.submissions)
    .map((b) => ({
      booking_id: b.id,
      submission_id: b.submission_id,
      nama: b.submissions!.nama,
    }));

  // Pull Zoom participants
  let participants;
  try {
    participants = await listMeetingParticipants(zoomMeetingId);
  } catch (err) {
    result.errors.push(
      `Gagal ambil daftar participant Zoom: ${err instanceof Error ? err.message : "unknown"}`,
    );
    return result;
  }

  if (participants.length === 0) {
    // Meeting ended with no participants joined — mark all as no_show
    for (const c of candidates) {
      await markNoShow(c.booking_id, c.submission_id);
      result.no_show++;
    }
    return result;
  }

  const { matched, unmatched_bookings } = matchParticipants(
    participants.map((p) => ({
      zoom_participant_id: p.id,
      name: p.name,
      user_email: p.user_email,
      join_time: p.join_time,
      leave_time: p.leave_time,
      duration: p.duration,
    })),
    candidates,
  );

  for (const m of matched) {
    const isConfident = m.confidence >= CONFIDENCE_THRESHOLD;
    const source = isConfident ? "zoom_webhook" : "ai_match";
    const needReview = !isConfident;

    const payload = {
      booking_id: m.booking_id,
      submission_id: m.submission_id,
      attended: true,
      source,
      need_review: needReview,
      zoom_participant_id: m.zoom_participant.zoom_participant_id ?? null,
      zoom_participant_email: m.zoom_participant.user_email ?? null,
      zoom_participant_name: m.zoom_participant.name,
      ai_confidence: m.confidence,
      ai_reasoning: m.reasoning,
      joined_at: m.zoom_participant.join_time ?? null,
      left_at: m.zoom_participant.leave_time ?? null,
      duration_min: m.zoom_participant.duration
        ? Math.round(m.zoom_participant.duration / 60)
        : null,
    };

    const { data: existing } = await sb
      .from("attendance")
      .select("id, source")
      .eq("booking_id", m.booking_id)
      .maybeSingle();

    if (existing) {
      // Don't override manual attendance — admin/teacher decision wins
      if ((existing as { source: string }).source === "manual") continue;
      await sb
        .from("attendance")
        .update(payload)
        .eq("id", (existing as { id: string }).id);
    } else {
      await sb.from("attendance").insert(payload);
    }

    await sb
      .from("bookings")
      .update({ status: "attended" })
      .eq("id", m.booking_id);

    if (isConfident) result.attended_auto++;
    else result.attended_review++;

    await trackEvent({
      event_name: FUNNEL_EVENTS.ATTENDED_ASSESSMENT,
      submission_id: m.submission_id,
      metadata: { booking_id: m.booking_id, source, confidence: m.confidence },
    });
  }

  for (const c of unmatched_bookings) {
    await markNoShow(c.booking_id, c.submission_id);
    result.no_show++;
  }

  return result;
}

async function markNoShow(bookingId: string, submissionId: string) {
  const sb = supabaseService();

  const { data: existing } = await sb
    .from("attendance")
    .select("id, source")
    .eq("booking_id", bookingId)
    .maybeSingle();

  // Preserve manual override
  if (existing && (existing as { source: string }).source === "manual") return;

  const payload = {
    booking_id: bookingId,
    submission_id: submissionId,
    attended: false,
    source: "zoom_webhook" as const,
    need_review: false,
  };

  if (existing) {
    await sb.from("attendance").update(payload).eq("id", (existing as { id: string }).id);
  } else {
    await sb.from("attendance").insert(payload);
  }

  await sb.from("bookings").update({ status: "no_show" }).eq("id", bookingId);
}
