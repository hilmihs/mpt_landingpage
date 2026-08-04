-- ============================================================
-- Migration 0009 — Penilaian pengajar diisi di aplikasi ini
-- ============================================================
-- Sampai sekarang penilaian lahir di panel luar lalu disalin ke sini lewat
-- kode unik. Panel itu tidak bisa di-embed (X-Frame-Options SAMEORIGIN) dan
-- API-nya read-only (POST dijawab 405), sehingga pengajar terpaksa pindah tab
-- dan tidak bisa mendengarkan rekaman sambil menilai.
--
-- Mulai sekarang penilaian diisi langsung di portal. Konsekuensinya di skema:
--
--   kode_unik  tidak lagi wajib — baris yang lahir di sini tidak punya padanan
--              di sistem luar, jadi tidak ada kode yang bisa diisikan.
--   teacher_id menggantikan peran `pemeriksa` yang selama ini hanya teks bebas.
--              Nama bebas itulah sebabnya penilaian lama tidak pernah bisa
--              ditautkan otomatis ke pengajarnya.
--   ayat       menyimpan temuan MENTAH per segmen. Skor hanyalah turunan, jadi
--              rumusnya bisa direvisi kapan saja tanpa kehilangan penilaian
--              yang sudah masuk.
-- ============================================================

ALTER TABLE teacher_evaluations ALTER COLUMN kode_unik DROP NOT NULL;

ALTER TABLE teacher_evaluations
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'external'
    CHECK (source IN ('external', 'native')),
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ayat JSONB,
  ADD COLUMN IF NOT EXISTS score_ayat JSONB,
  ADD COLUMN IF NOT EXISTS rekomendasi_program TEXT;

CREATE INDEX IF NOT EXISTS idx_teacher_eval_source ON teacher_evaluations(source);
CREATE INDEX IF NOT EXISTS idx_teacher_eval_teacher ON teacher_evaluations(teacher_id);

COMMENT ON COLUMN teacher_evaluations.source IS
  'native = diisi di portal ini; external = disalin dari panel muhajirproject.';
COMMENT ON COLUMN teacher_evaluations.ayat IS
  'Temuan mentah per segmen: {ayat_1: {jaliy: [], khafiy: []}, …}. Skor adalah turunan.';
COMMENT ON COLUMN teacher_evaluations.score_ayat IS
  'Skor tiap segmen skala 1-10. Skor kepala (score_min) adalah yang terendah di antaranya.';
