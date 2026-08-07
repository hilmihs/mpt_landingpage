-- ============================================================
-- Migration 0011 — Catat usulan mesin yang ditampilkan ke pengajar
-- ============================================================
-- Mesin dipakai untuk PRA-ISI formulir pengajar. Supaya berguna, satu-satunya
-- pertanyaan yang harus dijawab adalah: dari usulan yang ditampilkan, berapa
-- yang dipertahankan pengajar? Itu tidak bisa dijawab kalau usulannya tidak
-- pernah dicatat — dan tidak bisa direkonstruksi belakangan, karena mesin bisa
-- diperbaiki dan usulannya berubah.
--
-- Kolom ini menyimpan daftar kalimat opsi katalog yang DITAMPILKAN. Presisi
-- lalu dihitung sebagai irisan dengan `ayat` (yang benar-benar dicentang
-- pengajar) dibagi jumlah yang ditampilkan.
--
-- NULL punya arti: pengajar TIDAK diberi usulan sama sekali — entah karena
-- rekaman ini masuk kelompok pembanding, atau karena mesin memang belum punya
-- hasil untuknya. Bedanya ada di `usulan_mesin_kelompok`.
--
-- KENAPA ADA KELOMPOK PEMBANDING
-- Ada dua pertanyaan berbeda dan cuma satu yang butuh pembanding:
--
--   Presisi   — cukup catat apa yang ditampilkan dan apa yang dicentang.
--   Anchoring — apakah usulan MENGGESER penilaian pengajar? Ini wajib punya
--               pembanding, dan inilah yang bisa meracuni keputusan Januari:
--               kalau pengajar cenderung menerima saja, penilaiannya jadi
--               sepakat dengan mesin secara konstruksi, dan kita tidak akan
--               pernah melihatnya di data.
--
-- Anchoring TIDAK BISA diretrofit. Penilaian yang sudah terkumpul tanpa
-- pembanding tidak bisa diperbaiki belakangan, jadi pembandingnya harus ada
-- sejak hari pertama walau volumenya masih kecil.
--
-- Kelompok ditentukan dari submission_id, bukan diundi saat tampil: hasilnya
-- sama setiap kali halaman dibuka, dan tetap sama kalau penugasan dialihkan ke
-- pengajar lain. Diacak per REKAMAN, bukan per pengajar, supaya pengajar yang
-- sama melihat keduanya dan kebiasaan pribadinya tidak mengacaukan pembanding.
-- ============================================================

ALTER TABLE teacher_evaluations
  ADD COLUMN IF NOT EXISTS usulan_mesin JSONB,
  ADD COLUMN IF NOT EXISTS usulan_mesin_kelompok TEXT
    CHECK (usulan_mesin_kelompok IN ('diberi_usulan', 'pembanding'));

COMMENT ON COLUMN teacher_evaluations.usulan_mesin IS
  'Kalimat opsi katalog yang ditampilkan mesin ke pengajar. NULL = tidak ada usulan yang ditampilkan.';
COMMENT ON COLUMN teacher_evaluations.usulan_mesin_kelompok IS
  'diberi_usulan = pengajar melihat usulan mesin; pembanding = sengaja tidak diberi, untuk mengukur pergeseran penilaian.';

CREATE INDEX IF NOT EXISTS idx_teacher_eval_kelompok
  ON teacher_evaluations(usulan_mesin_kelompok)
  WHERE usulan_mesin_kelompok IS NOT NULL;
