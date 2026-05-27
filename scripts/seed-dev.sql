-- ============================================================
-- Muhajir Project Tilawah — Development Seed (SQL fallback)
-- ============================================================
--
-- USE THIS ONLY IF you cannot run the TypeScript seed
-- (scripts/seed-dev.ts) — e.g., production Supabase where you
-- can't run scripts locally.
--
-- LIMITATION: SQL cannot create auth.users rows. You must
-- create the auth users FIRST (via Supabase Dashboard or API)
-- and replace the placeholder UUIDs below with real auth IDs.
--
-- STEPS:
--   1. Apply migration 0002_booking_v2.sql first.
--   2. At Supabase Dashboard → Authentication → Users:
--      - Click "Add user" → Send invite or Create new user
--      - Admin: email = your-email@example.com (uses magic link)
--      - Pengajar: phone = +6281200000001..0004 with password
--        (requires Phone provider enabled at Auth → Providers)
--   3. Copy the generated auth user IDs (UUID) into the
--      placeholders below ('REPLACE_ME_...').
--   4. Run this file at Supabase Dashboard → SQL Editor.
-- ============================================================

BEGIN;

-- ----------- 1. Admin ----------------------------------------
INSERT INTO admins (auth_user_id, nama, email, role, is_active)
VALUES (
  'REPLACE_ME_ADMIN_AUTH_UUID'::uuid,
  'Hilmi Sobandi',
  'hilmisobandi@gmail.com',
  'super',
  true
)
ON CONFLICT (auth_user_id) DO UPDATE
SET nama = EXCLUDED.nama,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- ----------- 2. Pengajar -------------------------------------
INSERT INTO teachers (auth_user_id, nama, jenis_kelamin, nomor_wa, email_zoom, bio, status, activated_at)
VALUES
  (
    'REPLACE_ME_TEACHER1_AUTH_UUID'::uuid,
    'Ustadz Ahmad Hidayat',
    'ikhwan',
    '081200000001',
    'ahmad.hidayat.mpt.test@gmail.com',
    'Pengajar tahsin dengan latar belakang Mahad Aly. Spesialisasi tartil dan ahkamul tilawah.',
    'active',
    now()
  ),
  (
    'REPLACE_ME_TEACHER2_AUTH_UUID'::uuid,
    'Ustadz Yusuf Mahmud',
    'ikhwan',
    '081200000002',
    'yusuf.mahmud.mpt.test@gmail.com',
    'Hafidz 30 juz. Fokus mengajarkan makhraj dan sifat huruf untuk pemula.',
    'active',
    now()
  ),
  (
    'REPLACE_ME_TEACHER3_AUTH_UUID'::uuid,
    'Ustadzah Aisyah Rahmawati',
    'akhwat',
    '081200000003',
    'aisyah.rahmawati.mpt.test@gmail.com',
    'Pengajar muslimah berpengalaman 8 tahun. Sabar dan detail dalam koreksi panjang-pendek.',
    'active',
    now()
  ),
  (
    'REPLACE_ME_TEACHER4_AUTH_UUID'::uuid,
    'Ustadzah Fatimah Az-Zahra',
    'akhwat',
    '081200000004',
    'fatimah.azzahra.mpt.test@gmail.com',
    'Lulusan LIPIA. Fokus tahsin Al-Fatihah untuk muslimah pemula.',
    'active',
    now()
  )
ON CONFLICT (auth_user_id) DO UPDATE
SET nama = EXCLUDED.nama,
    bio = EXCLUDED.bio,
    status = EXCLUDED.status;

-- ----------- 3. Availability windows -------------------------
-- Clean existing windows for these teachers first
DELETE FROM teacher_availability
WHERE teacher_id IN (
  SELECT id FROM teachers
  WHERE nomor_wa IN ('081200000001', '081200000002', '081200000003', '081200000004')
);

-- Ahmad: Senin malam (assessment), Kamis malam (tahsin)
INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time, kind, is_active)
SELECT id, 1, '19:30', '21:30', 'assessment', true FROM teachers WHERE nomor_wa = '081200000001'
UNION ALL
SELECT id, 4, '19:30', '21:30', 'tahsin', true FROM teachers WHERE nomor_wa = '081200000001';

-- Yusuf: Selasa malam (assessment), Sabtu pagi (tahsin)
INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time, kind, is_active)
SELECT id, 2, '20:00', '22:00', 'assessment', true FROM teachers WHERE nomor_wa = '081200000002'
UNION ALL
SELECT id, 6, '08:00', '10:00', 'tahsin', true FROM teachers WHERE nomor_wa = '081200000002';

-- Aisyah: Senin sore (assessment), Rabu sore + Sabtu pagi (tahsin)
INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time, kind, is_active)
SELECT id, 1, '16:00', '18:00', 'assessment', true FROM teachers WHERE nomor_wa = '081200000003'
UNION ALL
SELECT id, 3, '16:00', '18:00', 'tahsin', true FROM teachers WHERE nomor_wa = '081200000003'
UNION ALL
SELECT id, 6, '09:00', '11:00', 'tahsin', true FROM teachers WHERE nomor_wa = '081200000003';

-- Fatimah: Kamis sore + Sabtu sore (tahsin)
INSERT INTO teacher_availability (teacher_id, day_of_week, start_time, end_time, kind, is_active)
SELECT id, 4, '16:00', '18:00', 'tahsin', true FROM teachers WHERE nomor_wa = '081200000004'
UNION ALL
SELECT id, 6, '16:00', '18:00', 'tahsin', true FROM teachers WHERE nomor_wa = '081200000004';

COMMIT;

-- ----------- Verify ------------------------------------------
SELECT 'Admin' AS role, count(*) AS count FROM admins
UNION ALL
SELECT 'Pengajar', count(*) FROM teachers WHERE status = 'active'
UNION ALL
SELECT 'Availability windows', count(*) FROM teacher_availability WHERE is_active = true;
