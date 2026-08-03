import { sql } from "@/lib/db";
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

  let slotRow:
    | {
        id: string;
        kind: "assessment" | "tahsin";
        meet_conference_id: string | null;
        meet_host_email: string | null;
      }
    | null = null;
  try {
    const rows = await sql<
      {
        id: string;
        kind: "assessment" | "tahsin";
        meet_conference_id: string | null;
        meet_host_email: string | null;
      }[]
    >`
      SELECT id, kind, scheduled_at, meet_conference_id, meet_host_email
        FROM slots
       WHERE id = ${slotId}
       LIMIT 1`;
    slotRow = rows[0] ?? null;
  } catch {
    slotRow = null;
  }

  if (!slotRow) {
    result.errors.push("Slot tidak ditemukan.");
    return result;
  }
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
      await sql`UPDATE bookings SET status = ${"attended"} WHERE id = ${m.key}`;
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
  const ctx: CandidateContext = {
    candidates: [],
    cohortSessionId: null,
    errors: [],
  };

  if (kind === "assessment") {
    let rows: { id: string; submission_id: string; nama: string }[];
    try {
      rows = await sql`
        SELECT b.id, b.submission_id, sub.nama
          FROM bookings b
          JOIN submissions sub ON sub.id = b.submission_id
         WHERE b.slot_id = ${slotId}
           AND b.status <> 'cancelled'`;
    } catch {
      rows = [];
    }

    ctx.candidates = rows.map((r) => ({
      key: r.id,
      submission_id: r.submission_id,
      nama: r.nama,
    }));
    return ctx;
  }

  let session: { id: string; cohort_id: string } | null = null;
  try {
    const rows = await sql<{ id: string; cohort_id: string }[]>`
      SELECT id, cohort_id
        FROM cohort_sessions
       WHERE slot_id = ${slotId}
       LIMIT 1`;
    session = rows[0] ?? null;
  } catch {
    session = null;
  }

  if (!session) {
    ctx.errors.push("Tahsin slot tidak terikat ke cohort_session.");
    return ctx;
  }
  ctx.cohortSessionId = session.id;

  let enrollRows: { submission_id: string; nama: string }[];
  try {
    enrollRows = await sql`
      SELECT ce.submission_id, sub.nama
        FROM cohort_enrollments ce
        JOIN submissions sub ON sub.id = ce.submission_id
       WHERE ce.cohort_id = ${session.cohort_id}
         AND ce.status <> 'dropped'`;
  } catch {
    enrollRows = [];
  }

  ctx.candidates = enrollRows.map((r) => ({
    key: r.submission_id,
    submission_id: r.submission_id,
    nama: r.nama,
  }));

  return ctx;
}

/** Baris attendance yang sudah ada — dipakai untuk cek override manual. */
interface ExistingAttendance {
  id: string;
  source: string;
  overridden_by: string | null;
}

async function upsertAttendance(
  kind: "assessment" | "tahsin",
  key: string,
  submission_id: string,
  cohortSessionId: string | null,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (kind !== "assessment" && !cohortSessionId) return false;

  let existingRow: ExistingAttendance | null = null;
  try {
    const rows =
      kind === "assessment"
        ? await sql<ExistingAttendance[]>`
            SELECT id, source, overridden_by
              FROM attendance
             WHERE booking_id = ${key}
             LIMIT 1`
        : await sql<ExistingAttendance[]>`
            SELECT id, source, overridden_by
              FROM attendance
             WHERE cohort_session_id = ${cohortSessionId}
               AND submission_id = ${submission_id}
             LIMIT 1`;
    existingRow = rows[0] ?? null;
  } catch {
    existingRow = null;
  }

  if (existingRow && (existingRow.source === "manual" || existingRow.overridden_by)) {
    return false;
  }

  const fkFields: { booking_id: string | null; cohort_session_id: string | null } =
    kind === "assessment"
      ? { booking_id: key, cohort_session_id: null }
      : { booking_id: null, cohort_session_id: cohortSessionId };

  const fullPayload: Record<string, unknown> = { ...payload, ...fkFields };

  if (existingRow) {
    await sql`UPDATE attendance SET ${sql(fullPayload)} WHERE id = ${existingRow.id}`;
  } else {
    await sql`INSERT INTO attendance ${sql(fullPayload)}`;
  }
  return true;
}

async function writeNoShow(
  candidate: Candidate,
  kind: "assessment" | "tahsin",
  cohortSessionId: string | null,
): Promise<void> {
  if (kind !== "assessment" && !cohortSessionId) return;

  let existingRow: ExistingAttendance | null = null;
  try {
    const rows =
      kind === "assessment"
        ? await sql<ExistingAttendance[]>`
            SELECT id, source, overridden_by
              FROM attendance
             WHERE booking_id = ${candidate.key}
             LIMIT 1`
        : await sql<ExistingAttendance[]>`
            SELECT id, source, overridden_by
              FROM attendance
             WHERE cohort_session_id = ${cohortSessionId}
               AND submission_id = ${candidate.submission_id}
             LIMIT 1`;
    existingRow = rows[0] ?? null;
  } catch {
    existingRow = null;
  }

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
    await sql`UPDATE attendance SET ${sql(payload)} WHERE id = ${existingRow.id}`;
  } else {
    await sql`INSERT INTO attendance ${sql(payload)}`;
  }

  if (kind === "assessment") {
    await sql`UPDATE bookings SET status = ${"no_show"} WHERE id = ${candidate.key}`;
  }
}
