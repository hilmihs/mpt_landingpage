-- ============================================================
-- Migration 0005 — Rename Zoom columns to Google Meet
-- ============================================================
-- Migrates from Zoom-specific column names to provider-agnostic
-- "meet_*" naming. Keeps the attendance_source enum values
-- unchanged for backward compatibility (zoom_webhook still means
-- "auto-detected via meeting platform webhook/cron").
-- ============================================================

-- Slots: rename Zoom columns
ALTER TABLE slots RENAME COLUMN zoom_meeting_id TO meet_calendar_event_id;
ALTER TABLE slots RENAME COLUMN zoom_join_url TO meet_join_url;
ALTER TABLE slots RENAME COLUMN zoom_host_email TO meet_host_email;
ALTER TABLE slots DROP COLUMN IF EXISTS zoom_password;
ALTER TABLE slots ADD COLUMN IF NOT EXISTS meet_conference_id TEXT;

-- Attendance: rename Zoom participant columns
ALTER TABLE attendance RENAME COLUMN zoom_participant_id TO meet_participant_id;
ALTER TABLE attendance RENAME COLUMN zoom_participant_email TO meet_participant_email;
ALTER TABLE attendance RENAME COLUMN zoom_participant_name TO meet_participant_name;

-- Teachers: rename email_zoom to email_meet
ALTER TABLE teachers RENAME COLUMN email_zoom TO email_meet;

-- Recreate index with new column name
DROP INDEX IF EXISTS idx_slots_zoom;
CREATE INDEX IF NOT EXISTS idx_slots_meet ON slots(meet_calendar_event_id)
  WHERE meet_calendar_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_slots_conference ON slots(meet_conference_id)
  WHERE meet_conference_id IS NOT NULL;

-- Update the v_slots_availability view to use new column names
CREATE OR REPLACE VIEW v_slots_availability AS
SELECT
  s.id,
  s.kind,
  s.scheduled_at,
  s.duration_min,
  s.capacity,
  s.reserved_count,
  s.gender_target,
  s.status,
  s.meet_join_url,
  s.meet_conference_id,
  t.id AS teacher_id,
  t.nama AS teacher_nama,
  t.jenis_kelamin AS teacher_gender
FROM slots s
JOIN teachers t ON t.id = s.teacher_id
WHERE s.status = 'scheduled'
  AND s.scheduled_at > now()
  AND t.status = 'active';
