import { supabaseService } from "@/lib/supabase";

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
  const sb = supabaseService();

  const { data: subRaw } = await sb
    .from("submissions")
    .select("id, nama, jenis_kelamin")
    .eq("id", submissionId)
    .maybeSingle();
  if (!subRaw) return null;
  const sub = subRaw as {
    id: string;
    nama: string;
    jenis_kelamin: "ikhwan" | "akhwat";
  };

  // 1. Attendance: did peserta attend an assessment session?
  const { data: attendedRaw } = await sb
    .from("attendance")
    .select(
      `id, attended, created_at,
       bookings:booking_id(slot_id, slots:slot_id(kind))`,
    )
    .eq("submission_id", submissionId)
    .eq("attended", true)
    .order("created_at", { ascending: false });

  const attendedAssessments = (attendedRaw ?? []) as unknown as {
    id: string;
    attended: boolean;
    created_at: string;
    bookings: {
      slot_id: string;
      slots: { kind: "assessment" | "tahsin" } | null;
    } | null;
  }[];

  const assessmentAttendance = attendedAssessments.find(
    (a) => a.bookings?.slots?.kind === "assessment",
  );

  // 2. Gate 1/2/3 responses
  const { data: interestRaw } = await sb
    .from("interest_responses")
    .select("gate, response")
    .eq("submission_id", submissionId);

  const responses = new Map<string, "yes" | "no" | "later">();
  for (const r of (interestRaw ?? []) as { gate: string; response: string }[]) {
    responses.set(r.gate, r.response as "yes" | "no" | "later");
  }

  // 3. ALL non-dropped enrollments — needed to compute ever_qualified.
  // We separately pick the most-recent one as the "current" cohort for UI.
  const { data: enrollRaw } = await sb
    .from("cohort_enrollments")
    .select(
      `id, created_at, status, completed_sessions, qualified_for_hits,
       cohorts:cohort_id(id, name, status, start_date, end_date)`,
    )
    .eq("submission_id", submissionId)
    .neq("status", "dropped")
    .order("created_at", { ascending: false });

  const enrollments = (enrollRaw ?? []) as unknown as {
    id: string;
    created_at: string;
    status: string;
    completed_sessions: number;
    qualified_for_hits: boolean;
    cohorts: {
      id: string;
      name: string;
      status: string;
      start_date: string;
      end_date: string;
    } | null;
  }[];

  const ever_qualified_for_hits = enrollments.some(
    (e) => e.qualified_for_hits,
  );

  // Pick most-recent enrollment as the "current" one for UI state. If user
  // has multiple, the newest wins (e.g., a re-enroll for review or a new
  // cohort after graduating).
  const current = enrollments[0];
  const enrolled_cohort =
    current && current.cohorts
      ? {
          id: current.cohorts.id,
          name: current.cohorts.name,
          status: current.cohorts.status,
          start_date: current.cohorts.start_date,
          end_date: current.cohorts.end_date,
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
    attended_assessment_at: assessmentAttendance?.created_at ?? null,
    enrolled_cohort,
    ever_qualified_for_hits,
    gate3_eligible,
    gate3_response: gate3Response,
  };
}

export async function getParticipantEligibilityBySlug(
  rapotSlug: string,
): Promise<ParticipantEligibility | null> {
  const sb = supabaseService();
  const { data } = await sb
    .from("rapot")
    .select("submission_id")
    .eq("slug", rapotSlug)
    .maybeSingle();
  if (!data) return null;
  return getParticipantEligibility(
    (data as { submission_id: string }).submission_id,
  );
}
