import { supabaseService } from "@/lib/supabase";
import { listMeetingParticipants } from "@/lib/google-meet/client";
import {
  matchParticipants,
  CONFIDENCE_THRESHOLD,
  type Candidate,
} from "@/lib/google-meet/matcher";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export interface ReconcileResult {
  slot_id: string;
  slot_kind: "assessment" | "tahsin" | null;
  meet_conference_id: string;
  targets_total: number;
  attended_auto: number;
  attended_review: number;
  no_show: number;
  errors: string[];
}

/**
 * After a Google Meet meeting ends, reconcile attendance for the slot.
 * Handles BOTH slot kinds:
 *   - assessment: candidates = bookings on that slot
 *   - tahsin: candidates = cohort_enrollments for the slot's bound cohort
 */
export async function reconcileSlotAttendance(
  slotId: string,
): Promise<ReconcileResult> {
  const sb = supabaseService();
  const result: ReconcileResult = {
    slot_id: slotId,
    slot_kind: null,
    meet_conference_id: "",
    targets_total: 0,
    attended_auto: 0,
    attended_review: 0,
    no_show: 0,
    errors: [],
  };

  const { data: slot } = await sb
    .from("slots")
    .select("id, kind, scheduled_at, meet_conference_id, meet_host_email")
    .eq("id", slotId)
    .maybeSingle();

  if (!slot) {
    result.errors.push("Slot tidak ditemukan.");
    return result;
  }
  const slotRow = slot as {
    id: string;
    kind: "assessment" | "tahsin";
    meet_conference_id: string | null;
    meet_host_email: string | null;
  };
  result.slot_kind = slotRow.kind;

  if (!slotRow.meet_conference_id || !slotRow.meet_host_email) {
    result.errors.push("Slot tidak memiliki Google Meet meeting.");
    return result;
  }
  result.meet_conference_id = slotRow.meet_conference_id;

  const context = await loadCandidates(slotRow.id, slotRow.kind);
  if (context.errors.length > 0) {
    result.errors.push(...context.errors);
    return result;
  }
  result.targets_total = context.candidates.length;
  if (context.candidates.length === 0) return result;

  let participants;
  try {
    participants = await listMeetingParticipants(
      slotRow.meet_conference_id,
      slotRow.meet_host_email,
    );
  } catch (err) {
    result.errors.push(
      `Gagal ambil daftar participant Meet: ${err instanceof Error ? err.message : "unknown"}`,
    );
    return result;
  }

  if (participants.length === 0) {
    for (const c of context.candidates) {
      await writeNoShow(c, slotRow.kind, context.cohortSessionId);
      result.no_show++;
    }
    return result;
  }

  const { matched, unmatched } = matchParticipants(
    participants.map((p) => ({
      display_name: p.display_name,
      email: p.email,
      join_time: p.join_time,
      leave_time: p.leave_time,
      duration_seconds: p.duration_seconds,
    })),
    context.candidates,
  );

  for (const m of matched) {
    const isConfident = m.confidence >= CONFIDENCE_THRESHOLD;
    const source = isConfident ? "zoom_webhook" : "ai_match"; // keep enum values for backward compat
    const needReview = !isConfident;

    const basePayload = {
      submission_id: m.submission_id,
      attended: true,
      source,
      need_review: needReview,
      meet_participant_email: m.participant.email ?? null,
      meet_participant_name: m.participant.display_name,
      ai_confidence: m.confidence,
      ai_reasoning: m.reasoning,
      joined_at: m.participant.join_time ?? null,
      left_at: m.participant.leave_time ?? null,
      duration_min: m.participant.duration_seconds
        ? Math.round(m.participant.duration_seconds / 60)
        : null,
    };

    const wrote = await upsertAttendance(
      slotRow.kind,
      m.key,
      m.submission_id,
      context.cohortSessionId,
      basePayload,
    );

    if (!wrote) continue;

    if (slotRow.kind === "assessment") {
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
        key: r.id,
        submission_id: r.submission_id,
        nama: r.submissions!.nama,
      }));
    return ctx;
  }

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
    .select("submission_id, status, submissions:submission_id(nama)")
    .eq("cohort_id", session.cohort_id)
    .neq("status", "dropped");

  const enrollRows = (enrollData ?? []) as unknown as {
    submission_id: string;
    submissions: { nama: string } | null;
  }[];

  ctx.candidates = enrollRows
    .filter((r) => r.submissions)
    .map((r) => ({
      key: r.submission_id,
      submission_id: r.submission_id,
      nama: r.submissions!.nama,
    }));

  return ctx;
}

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
