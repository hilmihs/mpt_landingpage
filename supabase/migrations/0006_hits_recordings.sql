-- HITS Lanjutan recording submissions for pengajar classification
CREATE TABLE IF NOT EXISTS hits_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id),
  audio_path TEXT NOT NULL,
  audio_duration_sec NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'classified')),
  assigned_tier TEXT
    CHECK (assigned_tier IS NULL OR assigned_tier IN ('lanjutan_awal', 'lanjutan_menengah', 'lanjutan_expert')),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES teachers(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_hits_recordings_status ON hits_recordings(status);
CREATE INDEX idx_hits_recordings_submission ON hits_recordings(submission_id);
