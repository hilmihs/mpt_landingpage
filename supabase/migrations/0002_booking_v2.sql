-- Muhajir Project Tilawah — Phase 2 (V2) schema
-- Adds: teachers, availability, slots, bookings, cohorts, attendance, analytics, admins
-- Aligns with docs/ARCHITECTURE_V2.md
--
-- Apply via Supabase CLI: supabase db push
-- Or via SQL editor: paste entire file.

-- =====================================================
-- 1. ENUMS
-- =====================================================

CREATE TYPE meeting_kind AS ENUM ('assessment', 'tahsin');
CREATE TYPE slot_status  AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE booking_status AS ENUM ('reserved', 'confirmed', 'attended', 'no_show', 'cancelled');
CREATE TYPE cohort_status  AS ENUM ('open', 'closed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE enrollment_status AS ENUM ('enrolled', 'completed', 'dropped');
CREATE TYPE attendance_source AS ENUM ('zoom_webhook', 'manual', 'ai_match');
CREATE TYPE admin_role        AS ENUM ('super', 'staff');

-- =====================================================
-- 2. SUBMISSIONS — extend existing
-- =====================================================

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_narrative_generated_at TIMESTAMPTZ;

-- =====================================================
-- 3. RAPOT — extend existing
-- =====================================================

ALTER TABLE rapot
  ADD COLUMN IF NOT EXISTS ai_narrative TEXT,
  ADD COLUMN IF NOT EXISTS ai_narrative_model TEXT;

-- =====================================================
-- 4. TEACHERS
-- =====================================================

CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Auth link (Supabase Auth user id)
  auth_user_id UUID UNIQUE,

  -- Profile
  nama TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('ikhwan', 'akhwat')),
  nomor_wa TEXT NOT NULL UNIQUE,
  email_zoom TEXT,    -- email yang dipakai di Zoom (untuk match host)
  bio TEXT,
  foto_url TEXT,

  -- Operational
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'inactive', 'suspended')),
  activated_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  CONSTRAINT teachers_valid_wa CHECK (nomor_wa ~ '^(\+62|0|62)[0-9]{8,13}$')
);

CREATE INDEX idx_teachers_status ON teachers(status);
CREATE INDEX idx_teachers_gender ON teachers(jenis_kelamin) WHERE status = 'active';
CREATE INDEX idx_teachers_auth ON teachers(auth_user_id);

-- =====================================================
-- 5. TEACHER_AVAILABILITY — recurring weekly window
-- =====================================================

CREATE TABLE teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,

  -- 0=Sunday, 6=Saturday (ISO)
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),

  -- 24h time
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  kind meeting_kind NOT NULL,

  -- Effective date range (NULL = forever)
  effective_from DATE DEFAULT CURRENT_DATE,
  effective_until DATE,

  is_active BOOLEAN DEFAULT true,

  CONSTRAINT availability_time_order CHECK (end_time > start_time),
  CONSTRAINT availability_date_order CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE INDEX idx_avail_teacher ON teacher_availability(teacher_id, kind) WHERE is_active = true;
CREATE INDEX idx_avail_day ON teacher_availability(day_of_week, kind) WHERE is_active = true;

-- =====================================================
-- 6. SLOTS — concrete scheduled session instances
-- =====================================================

CREATE TABLE slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  kind meeting_kind NOT NULL,

  -- Schedule
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min SMALLINT NOT NULL,
  capacity SMALLINT NOT NULL DEFAULT 12,
  gender_target TEXT NOT NULL CHECK (gender_target IN ('ikhwan', 'akhwat')),

  -- Zoom integration
  zoom_meeting_id TEXT UNIQUE,
  zoom_join_url TEXT,
  zoom_host_email TEXT,
  zoom_password TEXT,

  -- Lifecycle
  status slot_status NOT NULL DEFAULT 'scheduled',
  meeting_started_at TIMESTAMPTZ,
  meeting_ended_at TIMESTAMPTZ,

  -- Derived count for fast UI (kept in sync via trigger below)
  reserved_count SMALLINT NOT NULL DEFAULT 0,

  -- Business constraints
  CONSTRAINT slot_duration_assessment CHECK (
    (kind = 'assessment' AND duration_min = 60) OR kind = 'tahsin'
  ),
  CONSTRAINT slot_duration_tahsin CHECK (
    (kind = 'tahsin' AND duration_min = 90) OR kind = 'assessment'
  ),
  CONSTRAINT slot_capacity_max CHECK (capacity > 0 AND capacity <= 12),
  CONSTRAINT slot_future CHECK (scheduled_at > created_at - interval '1 minute')
);

CREATE INDEX idx_slots_lookup ON slots(kind, gender_target, scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX idx_slots_teacher ON slots(teacher_id, scheduled_at DESC);
CREATE INDEX idx_slots_zoom ON slots(zoom_meeting_id) WHERE zoom_meeting_id IS NOT NULL;

-- =====================================================
-- 7. BOOKINGS — peserta book an assessment slot
-- =====================================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

  status booking_status NOT NULL DEFAULT 'reserved',
  reserved_until TIMESTAMPTZ DEFAULT now() + interval '15 minutes',

  -- Communication
  whatsapp_sent_at TIMESTAMPTZ,
  reminder_h1_sent_at TIMESTAMPTZ,
  reminder_h2_sent_at TIMESTAMPTZ,

  -- Notes
  notes_from_user TEXT,
  notes_from_teacher TEXT,

  -- AI summary (Phase 2)
  ai_summary TEXT,
  ai_summary_model TEXT,
  ai_summary_generated_at TIMESTAMPTZ,

  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- Cannot book same submission to same slot twice
  CONSTRAINT booking_unique_per_slot UNIQUE (slot_id, submission_id)
);

CREATE INDEX idx_bookings_slot ON bookings(slot_id) WHERE status IN ('reserved', 'confirmed');
CREATE INDEX idx_bookings_submission ON bookings(submission_id, created_at DESC);
CREATE INDEX idx_bookings_status ON bookings(status, created_at DESC);

-- =====================================================
-- 8. COHORTS — Tahsin Al-Fatihah (4 sessions unit)
-- =====================================================

CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,           -- e.g. "Tahsin Akhwat — Senin & Kamis Juni 2026"
  gender_target TEXT NOT NULL CHECK (gender_target IN ('ikhwan', 'akhwat')),

  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,     -- typically start_date + 14 days

  capacity SMALLINT NOT NULL DEFAULT 12 CHECK (capacity > 0 AND capacity <= 12),
  enrolled_count SMALLINT NOT NULL DEFAULT 0,

  status cohort_status NOT NULL DEFAULT 'open',

  CONSTRAINT cohort_date_order CHECK (end_date >= start_date)
);

CREATE INDEX idx_cohorts_lookup ON cohorts(gender_target, start_date)
  WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_cohorts_teacher ON cohorts(teacher_id, start_date DESC);

-- =====================================================
-- 9. COHORT_SESSIONS — 4 sessions per cohort
-- =====================================================

CREATE TABLE cohort_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE RESTRICT,
  session_number SMALLINT NOT NULL CHECK (session_number BETWEEN 1 AND 4),

  CONSTRAINT cohort_session_unique_number UNIQUE (cohort_id, session_number),
  CONSTRAINT cohort_session_unique_slot UNIQUE (slot_id)
);

CREATE INDEX idx_cohort_sessions_cohort ON cohort_sessions(cohort_id, session_number);

-- =====================================================
-- 10. COHORT_ENROLLMENTS
-- =====================================================

CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

  status enrollment_status NOT NULL DEFAULT 'enrolled',
  completed_sessions SMALLINT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,

  -- Was tahsin attended >= 3 of 4 sessions? Used to gate HITS offer
  qualified_for_hits BOOLEAN GENERATED ALWAYS AS (completed_sessions >= 3) STORED,

  CONSTRAINT enrollment_unique UNIQUE (cohort_id, submission_id)
);

CREATE INDEX idx_enrollments_submission ON cohort_enrollments(submission_id);
CREATE INDEX idx_enrollments_cohort ON cohort_enrollments(cohort_id, status);

-- =====================================================
-- 11. ATTENDANCE
-- =====================================================

CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Either booking (assessment) or cohort_session (tahsin)
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  cohort_session_id UUID REFERENCES cohort_sessions(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

  -- Attendance data
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  duration_min NUMERIC,
  attended BOOLEAN NOT NULL DEFAULT false,

  -- Source & traceability
  source attendance_source NOT NULL,
  need_review BOOLEAN NOT NULL DEFAULT false,    -- true when AI/zoom couldn't be sure
  zoom_participant_id TEXT,
  zoom_participant_email TEXT,
  zoom_participant_name TEXT,

  -- For AI matching
  ai_confidence NUMERIC CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  ai_reasoning TEXT,

  -- Manual override
  overridden_by UUID,   -- teacher's auth user id or admin's
  overridden_at TIMESTAMPTZ,

  CONSTRAINT attendance_target CHECK (
    (booking_id IS NOT NULL AND cohort_session_id IS NULL) OR
    (booking_id IS NULL AND cohort_session_id IS NOT NULL)
  )
);

CREATE INDEX idx_attendance_booking ON attendance(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_attendance_session ON attendance(cohort_session_id) WHERE cohort_session_id IS NOT NULL;
CREATE INDEX idx_attendance_submission ON attendance(submission_id);
CREATE INDEX idx_attendance_review ON attendance(need_review) WHERE need_review = true;

-- =====================================================
-- 12. INTEREST_RESPONSES — Gate 1 & Gate 2 tracking
-- =====================================================

CREATE TABLE interest_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  gate TEXT NOT NULL CHECK (gate IN ('gate1_post_rapot', 'gate2_post_assessment', 'gate3_post_tahsin')),
  response TEXT NOT NULL CHECK (response IN ('yes', 'no', 'later')),
  optional_note TEXT,

  CONSTRAINT interest_unique_per_gate UNIQUE (submission_id, gate)
);

CREATE INDEX idx_interest_gate ON interest_responses(gate, response);
CREATE INDEX idx_interest_submission ON interest_responses(submission_id);

-- =====================================================
-- 13. ANALYTICS_EVENTS — funnel tracking
-- =====================================================

CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_name TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  session_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_events_name_time ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX idx_events_submission ON analytics_events(submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX idx_events_session ON analytics_events(session_id) WHERE session_id IS NOT NULL;

-- =====================================================
-- 14. ADMINS
-- =====================================================

CREATE TABLE admins (
  auth_user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role admin_role NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_admins_active ON admins(is_active) WHERE is_active = true;

-- =====================================================
-- 15. AUDIT_LOGS — track admin/teacher actions
-- =====================================================

CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,
  actor_role TEXT,  -- 'admin'|'teacher'|'system'
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_audit_time ON audit_logs(occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, occurred_at DESC);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- =====================================================
-- 16. TRIGGERS — keep counters in sync
-- =====================================================

-- Update slots.reserved_count when bookings change
CREATE OR REPLACE FUNCTION sync_slot_reserved_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('reserved', 'confirmed', 'attended') THEN
      UPDATE slots SET reserved_count = reserved_count + 1 WHERE id = NEW.slot_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Decrease when leaving active states
    IF OLD.status IN ('reserved', 'confirmed', 'attended')
       AND NEW.status NOT IN ('reserved', 'confirmed', 'attended') THEN
      UPDATE slots SET reserved_count = reserved_count - 1 WHERE id = NEW.slot_id;
    -- Increase when entering active states
    ELSIF OLD.status NOT IN ('reserved', 'confirmed', 'attended')
          AND NEW.status IN ('reserved', 'confirmed', 'attended') THEN
      UPDATE slots SET reserved_count = reserved_count + 1 WHERE id = NEW.slot_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('reserved', 'confirmed', 'attended') THEN
      UPDATE slots SET reserved_count = GREATEST(0, reserved_count - 1) WHERE id = OLD.slot_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_slot_reserved
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION sync_slot_reserved_count();

-- Update cohorts.enrolled_count when enrollments change
CREATE OR REPLACE FUNCTION sync_cohort_enrolled_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'enrolled' THEN
      UPDATE cohorts SET enrolled_count = enrolled_count + 1 WHERE id = NEW.cohort_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'enrolled' AND NEW.status != 'enrolled' THEN
      UPDATE cohorts SET enrolled_count = enrolled_count - 1 WHERE id = NEW.cohort_id;
    ELSIF OLD.status != 'enrolled' AND NEW.status = 'enrolled' THEN
      UPDATE cohorts SET enrolled_count = enrolled_count + 1 WHERE id = NEW.cohort_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'enrolled' THEN
      UPDATE cohorts SET enrolled_count = GREATEST(0, enrolled_count - 1) WHERE id = OLD.cohort_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_cohort_enrolled
AFTER INSERT OR UPDATE OR DELETE ON cohort_enrollments
FOR EACH ROW EXECUTE FUNCTION sync_cohort_enrolled_count();

-- Update cohort_enrollments.completed_sessions when attendance recorded
CREATE OR REPLACE FUNCTION sync_enrollment_completed_sessions()
RETURNS TRIGGER AS $$
DECLARE
  v_cohort_id UUID;
  v_count SMALLINT;
BEGIN
  IF NEW.cohort_session_id IS NOT NULL AND NEW.attended = true THEN
    SELECT cohort_id INTO v_cohort_id
    FROM cohort_sessions WHERE id = NEW.cohort_session_id;

    IF v_cohort_id IS NULL THEN RETURN NULL; END IF;

    SELECT COUNT(*)::SMALLINT INTO v_count
    FROM attendance a
    JOIN cohort_sessions cs ON cs.id = a.cohort_session_id
    WHERE cs.cohort_id = v_cohort_id
      AND a.submission_id = NEW.submission_id
      AND a.attended = true;

    UPDATE cohort_enrollments
    SET completed_sessions = v_count,
        completed_at = CASE WHEN v_count >= 4 THEN now() ELSE completed_at END,
        status = CASE WHEN v_count >= 4 THEN 'completed'::enrollment_status ELSE status END
    WHERE cohort_id = v_cohort_id AND submission_id = NEW.submission_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_enrollment_completed
AFTER INSERT OR UPDATE ON attendance
FOR EACH ROW EXECUTE FUNCTION sync_enrollment_completed_sessions();

-- =====================================================
-- 17. RLS POLICIES
-- =====================================================

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins
    WHERE auth_user_id = auth.uid() AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is teacher (and return their teacher id)
CREATE OR REPLACE FUNCTION current_teacher_id()
RETURNS UUID AS $$
  SELECT id FROM teachers
  WHERE auth_user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- TEACHERS: pengajar baca dirinya, admin baca semua
CREATE POLICY teachers_self_read ON teachers
  FOR SELECT USING (auth_user_id = auth.uid() OR is_admin());
CREATE POLICY teachers_self_update ON teachers
  FOR UPDATE USING (auth_user_id = auth.uid() OR is_admin());
CREATE POLICY teachers_admin_write ON teachers
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY teachers_admin_delete ON teachers
  FOR DELETE USING (is_admin());

-- TEACHER_AVAILABILITY: pengajar manage punyanya, admin manage semua
CREATE POLICY avail_teacher_all ON teacher_availability
  FOR ALL USING (teacher_id = current_teacher_id() OR is_admin())
  WITH CHECK (teacher_id = current_teacher_id() OR is_admin());

-- SLOTS: public read (peserta perlu lihat untuk booking), teacher+admin write
CREATE POLICY slots_public_read ON slots
  FOR SELECT USING (true);
CREATE POLICY slots_teacher_admin_write ON slots
  FOR ALL USING (teacher_id = current_teacher_id() OR is_admin())
  WITH CHECK (teacher_id = current_teacher_id() OR is_admin());

-- BOOKINGS:
-- - Anonymous read by slug not via auth (handled server-side via service role)
-- - Teacher baca booking di slotnya
-- - Admin baca semua
CREATE POLICY bookings_teacher_read ON bookings
  FOR SELECT USING (
    is_admin() OR
    slot_id IN (SELECT id FROM slots WHERE teacher_id = current_teacher_id())
  );
CREATE POLICY bookings_teacher_update ON bookings
  FOR UPDATE USING (
    is_admin() OR
    slot_id IN (SELECT id FROM slots WHERE teacher_id = current_teacher_id())
  );

-- COHORTS: same pattern
CREATE POLICY cohorts_public_read ON cohorts
  FOR SELECT USING (true);
CREATE POLICY cohorts_teacher_admin_write ON cohorts
  FOR ALL USING (teacher_id = current_teacher_id() OR is_admin())
  WITH CHECK (teacher_id = current_teacher_id() OR is_admin());

-- COHORT_SESSIONS: readable for booking UI
CREATE POLICY cohort_sessions_read ON cohort_sessions
  FOR SELECT USING (true);
CREATE POLICY cohort_sessions_write ON cohort_sessions
  FOR ALL USING (
    is_admin() OR
    cohort_id IN (SELECT id FROM cohorts WHERE teacher_id = current_teacher_id())
  );

-- COHORT_ENROLLMENTS: teacher baca yang di cohort dia
CREATE POLICY enroll_teacher_read ON cohort_enrollments
  FOR SELECT USING (
    is_admin() OR
    cohort_id IN (SELECT id FROM cohorts WHERE teacher_id = current_teacher_id())
  );
CREATE POLICY enroll_admin_write ON cohort_enrollments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ATTENDANCE: teacher baca/tulis untuk slot/sessionnya, admin semua
CREATE POLICY attendance_teacher ON attendance
  FOR ALL USING (
    is_admin() OR
    booking_id IN (SELECT id FROM bookings WHERE slot_id IN
      (SELECT id FROM slots WHERE teacher_id = current_teacher_id())) OR
    cohort_session_id IN (SELECT id FROM cohort_sessions WHERE cohort_id IN
      (SELECT id FROM cohorts WHERE teacher_id = current_teacher_id()))
  )
  WITH CHECK (
    is_admin() OR
    booking_id IN (SELECT id FROM bookings WHERE slot_id IN
      (SELECT id FROM slots WHERE teacher_id = current_teacher_id())) OR
    cohort_session_id IN (SELECT id FROM cohort_sessions WHERE cohort_id IN
      (SELECT id FROM cohorts WHERE teacher_id = current_teacher_id()))
  );

-- INTEREST_RESPONSES: admin baca semua (server-side via service role untuk write user)
CREATE POLICY interest_admin_read ON interest_responses
  FOR SELECT USING (is_admin());

-- ANALYTICS_EVENTS: admin baca semua (server-side write via service role)
CREATE POLICY analytics_admin_read ON analytics_events
  FOR SELECT USING (is_admin());

-- ADMINS: admin baca semua admin, super-admin write
CREATE POLICY admins_admin_read ON admins
  FOR SELECT USING (is_admin());
CREATE POLICY admins_super_write ON admins
  FOR ALL USING (
    EXISTS (SELECT 1 FROM admins WHERE auth_user_id = auth.uid()
            AND role = 'super' AND is_active = true)
  );

-- AUDIT_LOGS: admin only
CREATE POLICY audit_admin_read ON audit_logs
  FOR SELECT USING (is_admin());

-- =====================================================
-- 18. VIEWS — convenience for admin dashboard
-- =====================================================

CREATE OR REPLACE VIEW v_funnel_metrics AS
SELECT
  (SELECT COUNT(*) FROM submissions)                              AS total_submissions,
  (SELECT COUNT(*) FROM submissions WHERE status = 'completed')   AS completed_assessments,
  (SELECT COUNT(*) FROM interest_responses
     WHERE gate = 'gate1_post_rapot' AND response = 'yes')        AS gate1_yes,
  (SELECT COUNT(*) FROM bookings WHERE status != 'cancelled')     AS total_bookings,
  (SELECT COUNT(*) FROM bookings WHERE status = 'attended')       AS attended_assessments,
  (SELECT COUNT(*) FROM cohort_enrollments)                       AS tahsin_enrollments,
  (SELECT COUNT(*) FROM cohort_enrollments
     WHERE status = 'completed')                                  AS tahsin_completed,
  (SELECT COUNT(*) FROM analytics_events
     WHERE event_name = 'hits_cta_clicked')                       AS hits_clicked;

CREATE OR REPLACE VIEW v_slots_availability AS
SELECT
  s.id,
  s.kind,
  s.scheduled_at,
  s.duration_min,
  s.gender_target,
  s.capacity,
  s.reserved_count,
  (s.capacity - s.reserved_count) AS available_capacity,
  s.status,
  s.zoom_join_url,
  t.id   AS teacher_id,
  t.nama AS teacher_nama,
  t.jenis_kelamin AS teacher_gender
FROM slots s
JOIN teachers t ON t.id = s.teacher_id
WHERE s.status = 'scheduled'
  AND s.scheduled_at > now()
  AND t.status = 'active';

-- =====================================================
-- 19. COMMENTS — documentation
-- =====================================================

COMMENT ON TABLE teachers IS 'Pengajar Assessment & Tahsin Al-Fatihah. Auth via Supabase phone+password.';
COMMENT ON TABLE slots IS 'Concrete scheduled session. Assessment: 60min/12 capacity. Tahsin: 90min/12 capacity.';
COMMENT ON TABLE cohorts IS 'Tahsin Al-Fatihah cohort: 4 sessions over 2 weeks (2x per week).';
COMMENT ON TABLE attendance IS 'Source preference: zoom_webhook (auto) > ai_match (fuzzy fallback) > manual (override).';
COMMENT ON COLUMN cohort_enrollments.qualified_for_hits IS 'Generated: true when peserta hadir >=3 dari 4 sesi tahsin (gate ke HITS).';
COMMENT ON VIEW v_funnel_metrics IS 'Admin dashboard KPI cards source. Order matches docs/ARCHITECTURE_V2.md section 7.2.';
