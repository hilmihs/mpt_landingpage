import { supabaseService } from "@/lib/supabase";

export interface ParticipantEligibility {
  submission_id: string;
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";

  // Gate 2 (post-assessment, pre-tahsin)
  gate2_eligible: boolean;
  gate2_response: "yes" | "no" | "later" | null;
  attended_assessment_at: string | null;

  // Tahsin enrollment state
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

  // 1. Did peserta attend an assessment?
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

  // 3. Tahsin enrollment (most recent, non-dropped)
  const { data: enrollRaw } = await sb
    .from("cohort_enrollments")
    .select(
      `id, status, completed_sessions, qualified_for_hits,
       cohorts:cohort_id(id, name, status, start_date, end_date)`,
    )
    .eq("submission_id", submissionId)
    .neq("status", "dropped")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const enrollment = enrollRaw as unknown as {
    id: string;
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
  } | null;

  const enrolled_cohort =
    enrollment && enrollment.cohorts
      ? {
          id: enrollment.cohorts.id,
          name: enrollment.cohorts.name,
          status: enrollment.cohorts.status,
          start_date: enrollment.cohorts.start_date,
          end_date: enrollment.cohorts.end_date,
          completed_sessions: enrollment.completed_sessions,
          qualified_for_hits: enrollment.qualified_for_hits,
          enrollment_status: enrollment.status,
        }
      : null;

  // Eligibility rules:
  // Gate 2: attended assessment, no active enrollment yet, no prior "no" response
  const gate2_eligible =
    !!assessmentAttendance &&
    !enrolled_cohort &&
    responses.get("gate2_post_assessment") !== "no";

  // Gate 3: enrolled in a cohort that qualifies for HITS (≥3 of 4 attended)
  const gate3_eligible =
    !!enrolled_cohort &&
    enrolled_cohort.qualified_for_hits &&
    responses.get("gate3_post_tahsin") !== "no";

  return {
    submission_id: sub.id,
    nama: sub.nama,
    jenis_kelamin: sub.jenis_kelamin,
    gate2_eligible,
    gate2_response: responses.get("gate2_post_assessment") ?? null,
    attended_assessment_at: assessmentAttendance?.created_at ?? null,
    enrolled_cohort,
    gate3_eligible,
    gate3_response: responses.get("gate3_post_tahsin") ?? null,
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
