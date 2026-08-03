-- ============================================================
-- Migration 0007 — auth_users (pengganti Supabase Auth)
-- ============================================================
-- Supabase Auth menyimpan user di schema auth-nya sendiri, dan
-- teachers.auth_user_id / admins.auth_user_id merujuk ke sana tanpa FK.
-- Tabel ini menggantikan peran itu di dalam database kita sendiri.
--
-- Nama kolom auth_user_id sengaja TIDAK diubah, supaya seluruh query
-- yang sudah ditulis ulang di Fase 2 tidak perlu disentuh lagi.
--
-- Tabel khusus Auth.js (verification_tokens untuk magic link, sessions,
-- accounts) BELUM dibuat di sini — menunggu keputusan adapter di Fase 4.
-- Lihat docs/MIGRATION_SUPABASE_TO_GCP.md Fase 4.
-- ============================================================

CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Pengajar masuk pakai nomor WA, admin pakai email magic link.
  -- Keduanya nullable, tapi minimal salah satu wajib ada.
  email TEXT UNIQUE,
  phone TEXT UNIQUE,

  -- Argon2id. NULL untuk akun yang hanya pakai magic link (admin).
  password_hash TEXT,

  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  CONSTRAINT auth_users_need_identifier
    CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT auth_users_valid_phone
    CHECK (phone IS NULL OR phone ~ '^(\+62|0|62)[0-9]{8,13}$')
);

CREATE INDEX idx_auth_users_email ON auth_users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_auth_users_phone ON auth_users(phone) WHERE phone IS NOT NULL;

-- ------------------------------------------------------------
-- FK dari tabel yang sudah ada
-- ------------------------------------------------------------

-- Pengajar: baris teachers tetap hidup kalau akun auth-nya dihapus,
-- supaya riwayat slot/booking tidak ikut hilang. Aksesnya mati sendiri
-- karena getCurrentTeacher() mencocokkan lewat auth_user_id.
ALTER TABLE teachers
  ADD CONSTRAINT teachers_auth_user_fk
  FOREIGN KEY (auth_user_id) REFERENCES auth_users(id) ON DELETE SET NULL;

-- Admin: auth_user_id adalah PRIMARY KEY jadi tidak boleh NULL.
-- Hapus akun auth berarti hapus adminnya.
ALTER TABLE admins
  ADD CONSTRAINT admins_auth_user_fk
  FOREIGN KEY (auth_user_id) REFERENCES auth_users(id) ON DELETE CASCADE;

COMMENT ON TABLE auth_users IS 'Kredensial pengajar + admin. Menggantikan Supabase Auth. Otorisasi ada di lib/auth/*.ts, bukan RLS.';
COMMENT ON COLUMN auth_users.password_hash IS 'Argon2id. NULL kalau akun hanya pakai magic link.';
