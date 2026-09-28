-- ============================================================
-- Migration 0014 — Rekaman ujian masuk hanya untuk HITS Lanjutan
-- ============================================================
-- Keputusan program (28 Sep 2026): setoran rekaman Asy-Syura 1–6 hanya
-- diminta dari pendaftar HITS Lanjutan. HITS Dasar dan Alumni HITS
-- mendaftar tanpa rekaman, jadi kolom audio boleh kosong untuk mereka.
--
-- Baris lama tetap sah: semuanya punya rekaman, termasuk yang level
-- dasar/alumni (didaftarkan sebelum aturan ini).
--
-- Aman dijalankan sebelum kode baru dideploy — kode lama selalu mengisi
-- kolom audio, jadi constraint di bawah tidak menolaknya.

ALTER TABLE hits_pendaftaran
  ALTER COLUMN audio_path DROP NOT NULL,
  ALTER COLUMN audio_sumber DROP NOT NULL;

ALTER TABLE hits_pendaftaran
  DROP CONSTRAINT IF EXISTS hits_pendaftaran_rekaman_lanjutan;
ALTER TABLE hits_pendaftaran
  ADD CONSTRAINT hits_pendaftaran_rekaman_lanjutan CHECK (
    -- Lanjutan wajib berekaman.
    (level <> 'lanjutan' OR audio_path IS NOT NULL)
    -- Path dan sumber rekaman selalu terisi atau kosong bersamaan.
    AND ((audio_path IS NULL) = (audio_sumber IS NULL))
  );
