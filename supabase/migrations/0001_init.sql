-- Muhajir Project Tilawah — Phase 1 schema
-- Run via Supabase SQL editor atau Supabase CLI:
--   supabase db push (untuk CLI)

-- Peserta submission
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Form data
  nama TEXT NOT NULL,
  jenis_kelamin TEXT NOT NULL CHECK (jenis_kelamin IN ('ikhwan', 'akhwat')),
  nomor_wa TEXT NOT NULL,

  -- Audio
  audio_path TEXT NOT NULL,
  audio_duration_sec NUMERIC,

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,

  -- Reference ke rapot
  rapot_slug TEXT UNIQUE,

  CONSTRAINT valid_wa CHECK (nomor_wa ~ '^(\+62|0|62)[0-9]{8,13}$')
);

-- Hasil rapot
CREATE TABLE rapot (
  slug TEXT PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Skor utama 1-5
  skor INT NOT NULL CHECK (skor BETWEEN 1 AND 5),
  status_label TEXT NOT NULL,

  -- Errors per 4 indikator (JSONB array of { ayat, kata_idx, expected, actual, severity, note? })
  errors_harakat JSONB DEFAULT '[]'::jsonb,
  errors_huruf JSONB DEFAULT '[]'::jsonb,
  errors_panjang_pendek JSONB DEFAULT '[]'::jsonb,
  errors_syaddah JSONB DEFAULT '[]'::jsonb,

  -- Aggregate stats
  total_errors_major INT NOT NULL DEFAULT 0,
  total_errors_minor INT NOT NULL DEFAULT 0,
  weighted_score NUMERIC,

  -- ML metadata
  ml_model_version TEXT,
  ml_confidence NUMERIC,
  ml_raw_output JSONB
);

CREATE INDEX idx_submissions_status ON submissions(status) WHERE status != 'completed';
CREATE INDEX idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX idx_rapot_submission ON rapot(submission_id);
