-- ============================================================
-- Migration 0012 — Papan antara hasil inferensi mentah
-- ============================================================
-- GPU dinyalakan seperlunya, tidak jalan terus (~$125/bulan kalau jalan terus,
-- untuk pekerjaan beberapa menit sehari). Konsekuensinya Cloud Run tidak bisa
-- memanggil ML server lewat HTTP: alamat VM berubah tiap dinyalakan, dan
-- sebagian besar waktu VM-nya mati.
--
-- Keduanya bertemu di tabel ini saja:
--
--   VM GPU       menulis temuan MENTAH ke sini, lalu mati.
--   Cloud Run    membacanya, memproyeksikan ke instrumen pengajar, menulis
--                ai_evaluations.
--
-- Pembagian itu mengikuti bahasa masing-masing. Proyeksi ke instrumen pengajar
-- sudah ada di lib/ai-eval/ dan memakai computeEvaluation milik pengajar;
-- menuliskannya ulang dalam Python berarti dua implementasi yang akan
-- menyimpang diam-diam.
--
-- Lihat docs/BATCH_INFERENSI.md.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_inference_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ErrorItem[] apa adanya dari decoder, kelima indikator digabung. Tiap item
  -- membawa `kategori` sendiri supaya bisa dikelompokkan lagi di sisi Next.js.
  findings JSONB NOT NULL,

  ml_model_version TEXT NOT NULL,
  ml_confidence NUMERIC,
  ml_raw_output JSONB,

  -- Diisi begitu barisnya sudah diproyeksikan jadi ai_evaluations. NULL berarti
  -- belum diproses — itulah yang dicari worker.
  diproses_at TIMESTAMPTZ
);

-- Worker hanya mencari yang belum diproses, jadi indeksnya parsial.
CREATE INDEX IF NOT EXISTS idx_inference_raw_belum
  ON ai_inference_raw(created_at)
  WHERE diproses_at IS NULL;

COMMENT ON TABLE ai_inference_raw IS
  'Papan antara: VM GPU menulis temuan mentah, worker Next.js memproyeksikannya jadi ai_evaluations.';
COMMENT ON COLUMN ai_inference_raw.diproses_at IS
  'NULL = belum diproyeksikan. Worker memakai kolom ini sebagai antrean.';
