-- ============================================================
-- Migration 0015 — HITS Darsyafii: tanya-jawab, penilaian rekaman,
--                  data anak tidak lagi diminta
-- ============================================================
-- Aman dijalankan SEBELUM kode baru dideploy: kode lama tetap mengisi
-- nama_anak/kelas_anak (sekarang boleh kosong), tidak menyentuh kolom
-- penilaian, dan tidak tahu tabel hits_pertanyaan. Sebaliknya kode baru
-- WAJIB didahului migrasi ini — ia menyisipkan pendaftaran tanpa data anak.

-- ------------------------------------------------------------
-- 1. Data anak tidak lagi diminta (keputusan 30 Sep 2026)
-- ------------------------------------------------------------
-- Kolom dipertahankan: pendaftar sejak 28 Sep sudah mengisinya dan admin
-- masih membacanya di halaman admin dan CSV.
ALTER TABLE hits_pendaftaran
  ALTER COLUMN nama_anak DROP NOT NULL,
  ALTER COLUMN kelas_anak DROP NOT NULL;

-- ------------------------------------------------------------
-- 2. Penilaian rekaman oleh lajnah (admin)
-- ------------------------------------------------------------
-- Meniru kolom "Penilaian oleh Lajnah" di spreadsheet lama: jumlah lahn
-- jaliy, jumlah lahn khofi, pilihan manual "Buta Huruf / Tidak Buta
-- Huruf/Pemula", dan keterangan. Hasil formula spreadsheet (jaliy > 5)
-- TIDAK disimpan — dihitung di lib/hits-dar-syafii.ts, supaya ambangnya
-- bisa diubah tanpa migrasi. Yang menentukan penempatan adalah pilihan
-- manual lajnah.
ALTER TABLE hits_pendaftaran
  ADD COLUMN IF NOT EXISTS lahn_jaliy           INT CHECK (lahn_jaliy BETWEEN 0 AND 999),
  ADD COLUMN IF NOT EXISTS lahn_khofi           INT CHECK (lahn_khofi BETWEEN 0 AND 999),
  ADD COLUMN IF NOT EXISTS buta_huruf           BOOLEAN,
  ADD COLUMN IF NOT EXISTS penilaian_keterangan TEXT CHECK (char_length(penilaian_keterangan) <= 500),
  ADD COLUMN IF NOT EXISTS dinilai_at           TIMESTAMPTZ,
  -- Nama admin untuk ditampilkan; id pelakunya ada di audit_logs.
  ADD COLUMN IF NOT EXISTS dinilai_oleh         TEXT;

ALTER TABLE hits_pendaftaran
  DROP CONSTRAINT IF EXISTS hits_pendaftaran_penilaian_utuh;
ALTER TABLE hits_pendaftaran
  ADD CONSTRAINT hits_pendaftaran_penilaian_utuh CHECK (
    -- Penilaian selalu lengkap atau kosong sama sekali; keterangan opsional.
    (lahn_jaliy IS NULL) = (lahn_khofi IS NULL)
    AND (lahn_jaliy IS NULL) = (buta_huruf IS NULL)
    AND (lahn_jaliy IS NULL) = (dinilai_at IS NULL)
  );

-- Pendaftar HITS Lanjutan yang dinilai buta huruf otomatis masuk HITS Dasar.
-- `level` tetap pilihan pendaftar; kelas yang sebenarnya dibaca dari sini.
ALTER TABLE hits_pendaftaran
  ADD COLUMN IF NOT EXISTS level_penempatan TEXT GENERATED ALWAYS AS (
    CASE WHEN level = 'lanjutan' AND buta_huruf IS TRUE THEN 'dasar' ELSE level END
  ) STORED;

-- ------------------------------------------------------------
-- 3. Tanya-jawab pengganti "tanya lewat WA admin"
-- ------------------------------------------------------------
-- Penanya mendapat tautan /daftar-hits/dar-syafii/tanya/<slug>. Slug adalah
-- satu-satunya kunci untuk membaca jawaban, jadi panjangnya mengikuti rapot
-- (nanoid 12). Saat admin menjawab, tautan itu dikirim lewat WhatsApp.
CREATE TABLE IF NOT EXISTS hits_pertanyaan (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE CHECK (slug ~ '^[A-Za-z0-9_-]{12}$'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  program      TEXT NOT NULL,
  angkatan     TEXT NOT NULL,

  nama         TEXT NOT NULL CHECK (char_length(nama) BETWEEN 2 AND 80),
  nomor_wa     TEXT NOT NULL CHECK (nomor_wa ~ '^62[0-9]{8,13}$'),
  pertanyaan   TEXT NOT NULL CHECK (char_length(pertanyaan) BETWEEN 5 AND 1000),

  jawaban      TEXT CHECK (char_length(jawaban) BETWEEN 1 AND 3000),
  dijawab_at   TIMESTAMPTZ,
  dijawab_oleh TEXT,
  -- Admin boleh menampilkan tanya-jawab umum di halaman pendaftaran. Nama
  -- dan nomor penanya tidak pernah ikut tampil.
  tampil_faq   BOOLEAN NOT NULL DEFAULT false,

  wa_sent_at   TIMESTAMPTZ,
  wa_error     TEXT,

  CONSTRAINT hits_pertanyaan_jawaban_utuh CHECK ((jawaban IS NULL) = (dijawab_at IS NULL)),
  CONSTRAINT hits_pertanyaan_faq_berjawab CHECK (NOT tampil_faq OR jawaban IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_hits_pertanyaan_program
  ON hits_pertanyaan (program, angkatan, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hits_pertanyaan_belum_dijawab
  ON hits_pertanyaan (program, created_at) WHERE jawaban IS NULL;
