-- ============================================================
-- Migration 0013 — Pendaftaran HITS Darsyafii
-- ============================================================
-- Kelas HITS untuk orang tua/wali murid Darsyafii Islamic School. Isian
-- mengikuti Google Form HITS: data diri, jadwal, level kelas, dan satu rekaman
-- ujian masuk (Surat Asy-Syura ayat 1–6).
--
-- Sengaja TIDAK memakai tabel `submissions`. Baris di sana adalah assessment
-- Al-Fatihah: ditugaskan ke pengajar, dinilai lewat formulir penilaian, dan
-- dijalankan mesin. Pendaftar HITS tidak masuk alur itu sama sekali — kalau
-- ditaruh di sana, dispatch dan worker mesin akan ikut memprosesnya.
--
-- `program` + `angkatan` supaya tabel ini bisa dipakai lagi untuk angkatan
-- berikutnya (atau program HITS lain) tanpa migrasi baru. Nilainya diatur di
-- lib/hits-dar-syafii.ts.
--
-- `jadwal` menyimpan LABEL jadwal utuh, bukan id. Pilihan jadwal berubah tiap
-- angkatan dan tidak ada tabelnya; admin harus tetap bisa membaca pilihan
-- peserta walau jadwal itu sudah dihapus dari daftar.
--
-- Rekaman di prefix hits-pendaftaran/ dihapus lifecycle rule bucket GCS
-- setelah 14 hari (assessment tetap 7 hari) — lihat docs/DEPLOY_GCP.md §3.
-- `audio_path` tetap tercatat setelah objeknya terhapus; halaman admin
-- menandainya.

CREATE TABLE IF NOT EXISTS hits_pendaftaran (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  program            TEXT NOT NULL,
  angkatan           TEXT NOT NULL,

  email              TEXT NOT NULL,
  nama               TEXT NOT NULL,
  jenis_kelamin      TEXT NOT NULL CHECK (jenis_kelamin IN ('ikhwan', 'akhwat')),
  -- Selalu disimpan dalam bentuk 62xxxxxxxx (dinormalisasi di API), seperti
  -- yang diminta formulir lama.
  nomor_wa           TEXT NOT NULL CHECK (nomor_wa ~ '^62[0-9]{8,13}$'),
  usia               INT  NOT NULL CHECK (usia BETWEEN 15 AND 100),
  kota               TEXT NOT NULL,
  -- Program khusus wali murid Darsyafii; bisa lebih dari satu anak,
  -- dipisah koma, jadi disimpan apa adanya.
  nama_anak          TEXT NOT NULL,
  kelas_anak         TEXT NOT NULL,

  jadwal             TEXT NOT NULL,
  level              TEXT NOT NULL CHECK (level IN ('dasar', 'lanjutan', 'alumni')),

  audio_path         TEXT NOT NULL,
  audio_duration_sec NUMERIC,
  -- 'rekam' = direkam langsung di halaman; 'unggah' = berkas dari HP/komputer.
  audio_sumber       TEXT NOT NULL CHECK (audio_sumber IN ('rekam', 'unggah')),

  wa_sent_at         TIMESTAMPTZ,
  wa_error           TEXT,

  -- Satu nomor WA satu pendaftaran per angkatan. Menahan kiriman ganda saat
  -- peserta menekan "Kirim" dua kali atau mengulang setelah jaringan putus.
  CONSTRAINT hits_pendaftaran_wa_unik UNIQUE (program, angkatan, nomor_wa)
);

CREATE INDEX IF NOT EXISTS idx_hits_pendaftaran_angkatan
  ON hits_pendaftaran (program, angkatan, created_at DESC);
