import { sql } from "@/lib/db";

export interface ParticipantEligibility {
  submission_id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";

  // Gate 2 (post-assessment, pre-tahsin)
  gate2_eligible: boolean;
  gate2_response: "yes" | "no" | "later" | null;
  attended_assessment_at: string | null;

  // Current Tahsin enrollment (active = not dropped, most recent).
  // Used to decide whether to show "you're enrolled" state in NextStepsGate.
  enrolled_cohort: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
    completed_sessions: number;
    qualified_for_hits: boolean;
    enrollment_status: string;
  } | null;

  // True if ANY non-dropped enrollment (current or past) has
  // qualified_for_hits=true. This is the source-of-truth for Gate 3 and
  // /hits/[slug] — a peserta who lulus once never loses HITS access by
  // enrolling in another cohort for review.
  ever_qualified_for_hits: boolean;

  // Gate 3 (post-tahsin, HITS unlock)
  gate3_eligible: boolean;
  gate3_response: "yes" | "no" | "later" | null;
}

/**
 * Centralized eligibility check for the post-assessment + post-Tahsin gates.
 * Source-of-truth for whether to show Gate 2 / Gate 3 sections on rapot page,
 * and for protecting /tahsin and /hits routes.
 */
export async function getParticipantEligibility(
  submissionId: string,
): Promise<ParticipantEligibility | null> {
  const subRows = await sql<
    { id: string; nama: string; jenis_kelamin: "ikhwan" | "akhwat" }[]
  >`
    SELECT id, nama, jenis_kelamin
      FROM submissions
     WHERE id = ${submissionId}
     LIMIT 1
  `;
  const sub = subRows[0];
  if (!sub) return null;

  // 1. Attendance: did peserta attend an assessment session?
  const attendedAssessments = await sql<
    {
      id: string;
      attended: boolean;
      created_at: Date | null;
      kind: "assessment" | "tahsin" | null;
    }[]
  >`
    SELECT a.id, a.attended, a.created_at, s.kind
      FROM attendance a
      LEFT JOIN bookings b ON b.id = a.booking_id
      LEFT JOIN slots s ON s.id = b.slot_id
     WHERE a.submission_id = ${submissionId}
       AND a.attended = true
     ORDER BY a.created_at DESC
  `;

  const assessmentAttendance = attendedAssessments.find(
    (a) => a.kind === "assessment",
  );

  // 2. Gate 1/2/3 responses
  const interestRows = await sql<{ gate: string; response: string }[]>`
    SELECT gate, response
      FROM interest_responses
     WHERE submission_id = ${submissionId}
  `;

  const responses = new Map<string, "yes" | "no" | "later">();
  for (const r of interestRows) {
    responses.set(r.gate, r.response as "yes" | "no" | "later");
  }

  // 3. ALL non-dropped enrollments — needed to compute ever_qualified.
  // We separately pick the most-recent one as the "current" cohort for UI.
  const enrollments = await sql<
    {
      id: string;
      status: string;
      completed_sessions: number;
      qualified_for_hits: boolean;
      cohort_id: string | null;
      cohort_name: string | null;
      cohort_status: string | null;
      start_date: string | null;
      end_date: string | null;
    }[]
  >`
    SELECT e.id, e.status, e.completed_sessions, e.qualified_for_hits,
           c.id AS cohort_id, c.name AS cohort_name, c.status AS cohort_status,
           c.start_date::text AS start_date, c.end_date::text AS end_date
      FROM cohort_enrollments e
      LEFT JOIN cohorts c ON c.id = e.cohort_id
     WHERE e.submission_id = ${submissionId}
       AND e.status <> 'dropped'
     ORDER BY e.created_at DESC
  `;

  const ever_qualified_for_hits = enrollments.some(
    (e) => e.qualified_for_hits,
  );

  // Pick most-recent enrollment as the "current" one for UI state. If user
  // has multiple, the newest wins (e.g., a re-enroll for review or a new
  // cohort after graduating).
  const current = enrollments[0];
  const enrolled_cohort =
    current && current.cohort_id
      ? {
          id: current.cohort_id,
          name: current.cohort_name as string,
          status: current.cohort_status as string,
          start_date: current.start_date as string,
          end_date: current.end_date as string,
          completed_sessions: current.completed_sessions,
          qualified_for_hits: current.qualified_for_hits,
          enrollment_status: current.status,
        }
      : null;

  const gate2Response = responses.get("gate2_post_assessment") ?? null;
  const gate3Response = responses.get("gate3_post_tahsin") ?? null;

  // Gate 2 eligible iff:
  //   - peserta attended assessment
  //   - no active enrollment yet
  //   - hasn't said 'no' OR 'later' (both treated as decided-not-yes;
  //     UI gives a change-mind affordance for both)
  const gate2_eligible =
    !!assessmentAttendance &&
    !enrolled_cohort &&
    gate2Response !== "no" &&
    gate2Response !== "later";

  // Gate 3 eligible iff ever qualified for HITS and not declined.
  // Note: uses ever_qualified, NOT current enrollment, so an alumnus
  // who re-enrolled in cohort B doesn't lose Gate 3 from cohort A.
  const gate3_eligible =
    ever_qualified_for_hits &&
    gate3Response !== "no" &&
    gate3Response !== "later";

  return {
    submission_id: sub.id,
    nama: sub.nama,
    jenis_kelamin: sub.jenis_kelamin,
    gate2_eligible,
    gate2_response: gate2Response,
    attended_assessment_at:
      assessmentAttendance?.created_at?.toISOString() ?? null,
    enrolled_cohort,
    ever_qualified_for_hits,
    gate3_eligible,
    gate3_response: gate3Response,
  };
}

export async function getParticipantEligibilityBySlug(
  rapotSlug: string,
): Promise<ParticipantEligibility | null> {
  const rows = await sql<{ submission_id: string }[]>`
    SELECT submission_id
      FROM rapot
     WHERE slug = ${rapotSlug}
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return getParticipantEligibility(row.submission_id);
}
