-- ============================================================
-- Migration 0008 — Penilaian pengajar + penugasan rekaman
-- ============================================================
-- Mendukung alur yang diputuskan di rapat 3 Agustus 2026:
--   peserta rekam -> rekaman disimpan -> WA otomatis ke pengajar (rotasi,
--   gender ketat) -> pengajar menilai di panel Filament muhajirproject
--   -> nilainya ditarik balik ke sini lewat API dan DISIMPAN.
--
-- Kenapa nilainya disalin, bukan cuma dirujuk: Mas Agil minta AI kita tetap
-- jalan diam-diam sebagai pembanding selama Agustus-Desember. Perbandingan itu
-- cuma mungkin kalau nilai pengajar tersimpan di sisi kita.
--
-- Catatan skala: skor di sini 1-10 (Mumtaz/Jayyid/Dhoif), sedangkan rapot AI
-- kita 1-5. Dua skala berbeda, JANGAN dibandingkan langsung.
-- ============================================================

-- ------------------------------------------------------------
-- Penilaian pengajar, disalin dari API muhajirproject
-- ------------------------------------------------------------
CREATE TABLE teacher_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,

  -- Kode unik yang dipegang peserta untuk membuka rapotnya.
  kode_unik TEXT NOT NULL UNIQUE,
  external_uuid TEXT,
  external_created_at TIMESTAMPTZ,

  kegiatan TEXT,
  pemeriksa TEXT,
  asal_halaqah TEXT,
  nama_lengkap TEXT,

  -- Lima indikator, skala 1-10.
  score_harakat INT,          label_harakat TEXT,
  score_panjang_pendek INT,   label_panjang_pendek TEXT,
  score_tasydid INT,          label_tasydid TEXT,
  score_hukum_tajwid INT,     label_hukum_tajwid TEXT,
  score_ketepatan_huruf INT,  label_ketepatan_huruf TEXT,

  -- Indikator terlemah; sistem mereka memakainya sebagai skor keseluruhan.
  score_min INT,              label_min TEXT,

  -- Respons mentah, supaya perubahan bentuk API tidak menghilangkan data.
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT teacher_eval_score_range CHECK (
    (score_min IS NULL OR score_min BETWEEN 1 AND 10)
  )
);

CREATE INDEX idx_teacher_eval_submission ON teacher_evaluations(submission_id);
CREATE INDEX idx_teacher_eval_kode ON teacher_evaluations(kode_unik);

-- ------------------------------------------------------------
-- Penugasan rekaman ke pengajar + jejak notifikasi WhatsApp
-- ------------------------------------------------------------
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,

  -- NULL saat belum ada pengajar yang cocok; rekaman jatuh ke nomor fallback
  -- superadmin supaya tidak ada yang menggantung tanpa penilai.
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,

  -- Disalin saat penugasan supaya jejaknya tetap utuh walau pengajar dihapus,
  -- dan supaya pencocokan hasil ke API bisa pakai nama ini.
  teacher_nama TEXT,
  teacher_wa TEXT,

  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'notified', 'opened', 'completed', 'failed')),

  -- Jejak kirim WhatsApp lewat kirimi.id
  wa_sent_at TIMESTAMPTZ,
  wa_message_id TEXT,
  wa_error TEXT,
  wa_attempts INT NOT NULL DEFAULT 0,

  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_assignments_submission ON assignments(submission_id);
CREATE INDEX idx_assignments_teacher ON assignments(teacher_id, assigned_at DESC);
CREATE INDEX idx_assignments_open ON assignments(status)
  WHERE status NOT IN ('completed', 'failed');

-- Satu penugasan aktif per submission. Penugasan yang gagal boleh diulang,
-- jadi yang dibatasi hanya yang belum berakhir.
CREATE UNIQUE INDEX idx_assignments_one_active ON assignments(submission_id)
  WHERE status NOT IN ('completed', 'failed');

-- ------------------------------------------------------------
-- Notifikasi WhatsApp ke peserta
-- ------------------------------------------------------------
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS peserta_wa_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peserta_wa_error TEXT;

COMMENT ON TABLE teacher_evaluations IS 'Salinan penilaian pengajar dari API muhajirproject. Skala 1-10, beda dari rapot AI (1-5).';
COMMENT ON TABLE assignments IS 'Penugasan rekaman ke pengajar secara rotasi gender-ketat, plus jejak notifikasi WA.';
COMMENT ON COLUMN teacher_evaluations.score_min IS 'Indikator terlemah. Dipakai sistem muhajirproject sebagai skor keseluruhan.';
