-- ============================================================
-- Migration 0010 — Penilaian mesin memakai instrumen pengajar
-- ============================================================
-- Mesin dijalankan paralel Agustus–Desember dengan satu tujuan: menjadi
-- pembanding penilaian pengajar, supaya Januari ada dasar untuk memutuskan
-- apakah ia cukup akurat. Peserta tidak pernah melihatnya.
--
-- Tujuan itu selama ini tidak tercapai. Mesin menilai dengan empat indikator
-- pada skala 1-5 dan agregasi berbobot; pengajar dengan lima indikator pada
-- skala 1-10 dan agregasi minimum. Dua angka dari dua instrumen berbeda tidak
-- bisa dibandingkan — yang bisa dilakukan hanya menaruh "3/5" di sebelah "6/10"
-- sambil memasang peringatan bahwa keduanya tidak boleh disandingkan. Data yang
-- terkumpul dengan cara itu tidak menjawab pertanyaan apa pun.
--
-- Tabel ini menyimpan penilaian mesin dalam bentuk yang SAMA PERSIS dengan
-- teacher_evaluations: delapan segmen, lima indikator, skala 1-10, skor kepala
-- dari segmen terlemah. Angkanya dihitung oleh fungsi yang sama
-- (computeEvaluation di lib/teacher-eval/scoring.ts), bukan oleh rumus terpisah
-- — jadi kalau rubrik pengajar direvisi, skor mesin ikut dan keduanya tetap
-- sebanding.
--
-- KENAPA TABEL BARU, BUKAN MENUMPANG DI `rapot`
-- `rapot` terikat instrumen lama: kolom `skor` punya CHECK BETWEEN 1 AND 5 dan
-- NOT NULL. Memakainya berarti tetap menghitung skor 1-5 semata demi memenuhi
-- constraint. `rapot` juga milik jalur peserta, sedangkan tabel ini murni
-- internal. Baris `rapot` lama dibiarkan apa adanya.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Temuan mentah per segmen, bentuk identik dengan teacher_evaluations.ayat.
  ayat JSONB NOT NULL,
  score_ayat JSONB NOT NULL,

  -- Skor kepala = segmen terlemah, sama seperti sisi pengajar.
  score_min INT NOT NULL CHECK (score_min BETWEEN 1 AND 10),
  label_min TEXT NOT NULL,

  -- Lima indikator, skala 1-10.
  score_harakat INT CHECK (score_harakat BETWEEN 1 AND 10),
  label_harakat TEXT,
  score_ketepatan_huruf INT CHECK (score_ketepatan_huruf BETWEEN 1 AND 10),
  label_ketepatan_huruf TEXT,
  score_panjang_pendek INT CHECK (score_panjang_pendek BETWEEN 1 AND 10),
  label_panjang_pendek TEXT,
  score_tasydid INT CHECK (score_tasydid BETWEEN 1 AND 10),
  label_tasydid TEXT,
  score_hukum_tajwid INT CHECK (score_hukum_tajwid BETWEEN 1 AND 10),
  label_hukum_tajwid TEXT,

  total_jaliy INT NOT NULL DEFAULT 0,
  total_khafiy INT NOT NULL DEFAULT 0,

  -- Temuan per kata sebelum digabung — catatan riset. Proyeksi ke segmen
  -- menggabungkan beberapa fonem yang meleset dalam satu kata menjadi satu
  -- temuan; kolom ini menyimpan yang belum digabung supaya keputusan itu bisa
  -- ditinjau ulang tanpa menjalankan model lagi.
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,

  ml_model_version TEXT NOT NULL,
  ml_confidence NUMERIC,
  ml_raw_output JSONB
);

CREATE INDEX IF NOT EXISTS idx_ai_eval_submission ON ai_evaluations(submission_id);
CREATE INDEX IF NOT EXISTS idx_ai_eval_created ON ai_evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_eval_model ON ai_evaluations(ml_model_version);

COMMENT ON TABLE ai_evaluations IS
  'Penilaian mesin dalam instrumen pengajar. Internal — tidak pernah ditampilkan ke peserta.';
COMMENT ON COLUMN ai_evaluations.ayat IS
  'Temuan per segmen: {ayat_1: {jaliy: [], khafiy: []}, …}. Bentuk sama dengan teacher_evaluations.ayat supaya bisa dibandingkan kolom-lawan-kolom.';
COMMENT ON COLUMN ai_evaluations.total_khafiy IS
  'Selama head sifa model belum jalan, kolom ini selalu 0 dan mesin tampak lebih longgar daripada pengajar. Cek ml_raw_output->>''sifa_available'' sebelum menafsirkan.';
COMMENT ON COLUMN ai_evaluations.findings IS
  'ErrorItem[] mentah dari ML server, sebelum digabung per kata.';

-- ============================================================
-- Status pipeline mesin dipisahkan dari status peserta
-- ============================================================
-- `submissions.status` dipakai alur pengajar: `completed` berarti pengajar
-- sudah menilai dan peserta sudah dikirimi rapot. Worker mesin selama ini
-- menulis kolom yang sama, sehingga satu rekaman bisa berubah jadi
-- 'processing' atau 'failed' karena urusan mesin — padahal dari sisi peserta
-- tidak terjadi apa-apa. Mesin sekarang punya kolomnya sendiri.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS ai_error_message TEXT,
  ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_submissions_ai_status
  ON submissions(ai_status) WHERE ai_status = 'pending';

COMMENT ON COLUMN submissions.ai_status IS
  'Status pipeline mesin, terpisah dari submissions.status milik alur pengajar. skipped = ML server tidak dikonfigurasi.';
