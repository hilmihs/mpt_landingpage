-- ============================================================
-- Migration 0004 — Atomic booking creation + capacity guard
-- ============================================================
-- Replaces the application-level TOCTOU check in /api/booking/create
-- with a single SQL function that holds a row lock on the slot while
-- validating capacity. Also enforces one active booking per submission
-- per slot kind (prevents a user from reserving multiple assessment
-- slots simultaneously).
--
-- Returns a structured result:
--   ok=true              → booked successfully
--   ok=false reason=...  → caller can map to a user-facing message
--
-- Reasons:
--   slot_not_found    → slot_id invalid
--   slot_unavailable  → status != 'scheduled'
--   gender_mismatch   → slot gender_target != user gender
--   slot_full         → reserved_count >= capacity
--   already_booked    → active booking already exists for this slot
--   already_has_booking → active booking exists on another slot of same kind
-- ============================================================

CREATE OR REPLACE FUNCTION create_booking(
  p_slot_id UUID,
  p_submission_id UUID,
  p_jenis_kelamin TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_existing RECORD;
  v_other RECORD;
  v_booking_id UUID;
BEGIN
  -- Lock the slot row to serialize parallel bookings.
  SELECT id, kind, status, gender_target, capacity, reserved_count
  INTO v_slot
  FROM slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_not_found');
  END IF;

  IF v_slot.status <> 'scheduled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_unavailable');
  END IF;

  IF v_slot.gender_target <> p_jenis_kelamin THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gender_mismatch');
  END IF;

  IF v_slot.reserved_count >= v_slot.capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slot_full');
  END IF;

  -- Check for existing booking on the same slot (idempotency).
  SELECT id, status INTO v_existing
  FROM bookings
  WHERE slot_id = p_slot_id AND submission_id = p_submission_id;

  IF FOUND AND v_existing.status <> 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'booking_id', v_existing.id, 'reused', true);
  END IF;

  -- Check for active booking on another slot of the same kind.
  SELECT b.id INTO v_other
  FROM bookings b
  JOIN slots s ON s.id = b.slot_id
  WHERE b.submission_id = p_submission_id
    AND s.kind = v_slot.kind
    AND b.status IN ('reserved', 'confirmed')
    AND b.slot_id <> p_slot_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_has_booking',
      'existing_booking_id', v_other.id);
  END IF;

  IF FOUND AND v_existing.status = 'cancelled' THEN
    -- Resurrect cancelled booking on the same slot.
    UPDATE bookings SET
      status = 'reserved',
      reserved_until = now() + interval '15 minutes',
      notes_from_user = p_notes,
      cancelled_at = NULL,
      cancellation_reason = NULL
    WHERE id = v_existing.id
    RETURNING id INTO v_booking_id;
  ELSE
    INSERT INTO bookings (slot_id, submission_id, status, notes_from_user)
    VALUES (p_slot_id, p_submission_id, 'reserved', p_notes)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'reused', false);
END;
$$;

-- Dipanggil dari API route via SELECT create_booking(...). Lihat catatan di 0003.
