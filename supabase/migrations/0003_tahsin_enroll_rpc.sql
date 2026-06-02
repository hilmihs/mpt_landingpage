-- ============================================================
-- Migration 0003 — Atomic Tahsin enrollment + capacity guard
-- ============================================================
-- Replaces the application-level TOCTOU check in /api/tahsin/enroll
-- with a single SQL function that holds a row lock on the cohort
-- while validating capacity. Two concurrent enrollments can no
-- longer exceed the cohort's capacity.
--
-- Returns a structured result:
--   ok=true              → enrolled successfully
--   ok=false reason=...  → caller can map to a user-facing message
--
-- Reasons:
--   cohort_not_found  → cohort_id invalid
--   cohort_closed     → status != 'open'
--   cohort_full       → enrolled_count >= capacity
--   already_enrolled  → unique violation on (cohort_id, submission_id)
-- ============================================================

CREATE OR REPLACE FUNCTION enroll_in_cohort(
  p_cohort_id UUID,
  p_submission_id UUID,
  p_jenis_kelamin TEXT  -- caller has already verified eligibility; we re-check gender as defense in depth
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohort RECORD;
  v_enrollment_id UUID;
BEGIN
  -- Lock the cohort row to serialize parallel enrollments.
  SELECT id, status, capacity, enrolled_count, gender_target, name
  INTO v_cohort
  FROM cohorts
  WHERE id = p_cohort_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cohort_not_found');
  END IF;

  IF v_cohort.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cohort_closed');
  END IF;

  IF v_cohort.gender_target <> p_jenis_kelamin THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gender_mismatch');
  END IF;

  IF v_cohort.enrolled_count >= v_cohort.capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cohort_full');
  END IF;

  -- Insert is guarded by UNIQUE(cohort_id, submission_id) — if the
  -- caller tried to enroll twice, we return a friendly result.
  BEGIN
    INSERT INTO cohort_enrollments (cohort_id, submission_id, status)
    VALUES (p_cohort_id, p_submission_id, 'enrolled')
    RETURNING id INTO v_enrollment_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_enrolled');
  END;

  -- Re-read enrolled_count after the trigger has incremented it.
  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', v_enrollment_id,
    'cohort_name', v_cohort.name
  );
END;
$$;

-- Grant execute to anon + authenticated so the API route can call it
-- via supabase.rpc(). Service role bypasses this anyway.
GRANT EXECUTE ON FUNCTION enroll_in_cohort(UUID, UUID, TEXT) TO anon, authenticated, service_role;
