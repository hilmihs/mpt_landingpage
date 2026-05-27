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
  slot_kind: "assessment" | "tahsin" | null;
  zoom_meeting_id: string;
  targets_total: number;
  attended_auto: number;
  attended_review: number;
  no_show: number;
  errors: string[];
}

/**
 * After a Zoom meeting ends, reconcile attendance for the slot bound to
 * the given Zoom meeting ID. Handles BOTH slot kinds:
 *   - assessment slots: candidates = bookings on that slot
 *   - tahsin slots: candidates = cohort_enrollments for the slot's bound cohort
 *
 * Idempotent: re-running won't duplicate rows. Manual overrides
 * (source='manual' or overridden_by IS NOT NULL) are preserved.
 */
export async function reconcileSlotAttendance(
  zoomMeetingId: string,
): Promise<ReconcileResult> {
  const sb = supabaseService();
  const result: ReconcileResult = {
    slot_id: "",
    slot_kind: null,
    zoom_meeting_id: zoomMeetingId,
    targets_total: 0,
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
  const slotRow = slot as { id: string; kind: "assessment" | "tahsin" };
  result.slot_id = slotRow.id;
  result.slot_kind = slotRow.kind;

  // Build candidates list based on slot kind
  const context = await loadCandidates(slotRow.id, slotRow.kind);
  if (context.errors.length > 0) {
    result.errors.push(...context.errors);
    return result;
  }
  result.targets_total = context.candidates.length;

  if (context.candidates.length === 0) return result;

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
    // Meeting ended with no participants joined (or Zoom past_meetings not
    // populated yet — should retry separately). Mark all targets no_show.
    for (const c of context.candidates) {
      await writeNoShow(c, slotRow.kind, context.cohortSessionId);
      result.no_show++;
    }
    return result;
  }

  const { matched, unmatched } = matchParticipants(
    participants.map((p) => ({
      zoom_participant_id: p.id,
      name: p.name,
      user_email: p.user_email,
      join_time: p.join_time,
      leave_time: p.leave_time,
      duration: p.duration,
    })),
    context.candidates,
  );

  for (const m of matched) {
    const isConfident = m.confidence >= CONFIDENCE_THRESHOLD;
    const source = isConfident ? "zoom_webhook" : "ai_match";
    const needReview = !isConfident;

    const basePayload = {
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

    const wrote = await upsertAttendance(
      slotRow.kind,
      m.key,
      m.submission_id,
      context.cohortSessionId,
      basePayload,
    );

    if (!wrote) continue; // preserved a manual override

    if (slotRow.kind === "assessment") {
      // For assessment, also flip booking status (bookings carry the
      // user-visible state on the rapot page).
      await sb
        .from("bookings")
        .update({ status: "attended" })
        .eq("id", m.key);
    }

    if (isConfident) result.attended_auto++;
    else result.attended_review++;

    await trackEvent({
      event_name:
        slotRow.kind === "assessment"
          ? FUNNEL_EVENTS.ATTENDED_ASSESSMENT
          : FUNNEL_EVENTS.TAHSIN_COMPLETED,
      submission_id: m.submission_id,
      metadata: {
        slot_id: slotRow.id,
        kind: slotRow.kind,
        source,
        confidence: m.confidence,
      },
    });
  }

  for (const c of unmatched) {
    await writeNoShow(c, slotRow.kind, context.cohortSessionId);
    result.no_show++;
  }

  return result;
}

interface CandidateContext {
  candidates: Candidate[];
  cohortSessionId: string | null;
  errors: string[];
}

async function loadCandidates(
  slotId: string,
  kind: "assessment" | "tahsin",
): Promise<CandidateContext> {
  const sb = supabaseService();
  const ctx: CandidateContext = {
    candidates: [],
    cohortSessionId: null,
    errors: [],
  };

  if (kind === "assessment") {
    const { data } = await sb
      .from("bookings")
      .select("id, submission_id, status, submissions:submission_id(nama)")
      .eq("slot_id", slotId)
      .neq("status", "cancelled");

    const rows = (data ?? []) as unknown as {
      id: string;
      submission_id: string;
      submissions: { nama: string } | null;
    }[];

    ctx.candidates = rows
      .filter((r) => r.submissions)
      .map((r) => ({
        key: r.id, // booking_id
        submission_id: r.submission_id,
        nama: r.submissions!.nama,
      }));
    return ctx;
  }

  // Tahsin: candidates = cohort_enrollments for the cohort that owns this slot
  const { data: sessionRaw } = await sb
    .from("cohort_sessions")
    .select("id, cohort_id")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (!sessionRaw) {
    ctx.errors.push("Tahsin slot tidak terikat ke cohort_session.");
    return ctx;
  }
  const session = sessionRaw as { id: string; cohort_id: string };
  ctx.cohortSessionId = session.id;

  const { data: enrollData } = await sb
    .from("cohort_enrollments")
    .select(
      "submission_id, status, submissions:submission_id(nama)",
    )
    .eq("cohort_id", session.cohort_id)
    .neq("status", "dropped");

  const enrollRows = (enrollData ?? []) as unknown as {
    submission_id: string;
    submissions: { nama: string } | null;
  }[];

  ctx.candidates = enrollRows
    .filter((r) => r.submissions)
    .map((r) => ({
      key: r.submission_id, // for tahsin, submission_id is the unique target key
      submission_id: r.submission_id,
      nama: r.submissions!.nama,
    }));

  return ctx;
}

/**
 * Returns true if a row was written/updated, false if a manual override was
 * preserved.
 */
async function upsertAttendance(
  kind: "assessment" | "tahsin",
  key: string,
  submission_id: string,
  cohortSessionId: string | null,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const sb = supabaseService();

  let query = sb.from("attendance").select("id, source, overridden_by");
  if (kind === "assessment") {
    query = query.eq("booking_id", key);
  } else {
    if (!cohortSessionId) return false;
    query = query
      .eq("cohort_session_id", cohortSessionId)
      .eq("submission_id", submission_id);
  }
  const { data: existing } = await query.maybeSingle();

  // Preserve manual override (source='manual' OR overridden_by IS NOT NULL)
  const existingRow = existing as
    | { id: string; source: string; overridden_by: string | null }
    | null;
  if (existingRow && (existingRow.source === "manual" || existingRow.overridden_by)) {
    return false;
  }

  const fkFields: { booking_id: string | null; cohort_session_id: string | null } =
    kind === "assessment"
      ? { booking_id: key, cohort_session_id: null }
      : { booking_id: null, cohort_session_id: cohortSessionId };

  const fullPayload: Record<string, unknown> = { ...payload, ...fkFields };

  if (existingRow) {
    await sb.from("attendance").update(fullPayload).eq("id", existingRow.id);
  } else {
    await sb.from("attendance").insert(fullPayload);
  }
  return true;
}

async function writeNoShow(
  candidate: Candidate,
  kind: "assessment" | "tahsin",
  cohortSessionId: string | null,
): Promise<void> {
  const sb = supabaseService();

  let query = sb.from("attendance").select("id, source, overridden_by");
  if (kind === "assessment") {
    query = query.eq("booking_id", candidate.key);
  } else {
    if (!cohortSessionId) return;
    query = query
      .eq("cohort_session_id", cohortSessionId)
      .eq("submission_id", candidate.submission_id);
  }
  const { data: existing } = await query.maybeSingle();

  const existingRow = existing as
    | { id: string; source: string; overridden_by: string | null }
    | null;

  // Preserve manual override
  if (existingRow && (existingRow.source === "manual" || existingRow.overridden_by)) {
    return;
  }

  const payload = {
    submission_id: candidate.submission_id,
    attended: false,
    source: "zoom_webhook" as const,
    need_review: false,
    booking_id: kind === "assessment" ? candidate.key : null,
    cohort_session_id: kind === "tahsin" ? cohortSessionId : null,
  };

  if (existingRow) {
    await sb.from("attendance").update(payload).eq("id", existingRow.id);
  } else {
    await sb.from("attendance").insert(payload);
  }

  if (kind === "assessment") {
    await sb
      .from("bookings")
      .update({ status: "no_show" })
      .eq("id", candidate.key);
  }
}
