/**
 * Seed script for development / staging environments.
 *
 * Creates dummy admin + pengajar accounts so the V2 funnel can be smoke-tested
 * end-to-end without touching production data. Idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm seed:dev          # create or skip if exists
 *   pnpm seed:reset        # delete existing dummies first, then seed
 *
 * Prerequisites:
 *   1. .env.local set with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2. Migration 0002_booking_v2.sql applied to the target Supabase project
 *   3. Supabase Auth phone provider enabled (for pengajar phone login)
 *      — otherwise pengajar seed will fail with "Phone provider disabled"
 */

import { createClient } from "@supabase/supabase-js";

// ============================================================
// Dummy data — edit these to suit your testing needs.
// All emails/phones below are clearly fake to avoid collision
// with real users. Change ADMIN_EMAIL to your own email if you
// want to actually log in to the admin console.
// ============================================================

const ADMIN_EMAIL = "hilmisobandi@gmail.com";
const ADMIN_NAMA = "Hilmi Sobandi";
const ADMIN_ROLE: "super" | "staff" = "super";

const DUMMY_PASSWORD = "MPTtest2026!";

interface TeacherSeed {
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  phone_e164: string; // for Supabase Auth
  phone_db: string; // for teachers.nomor_wa (Indonesian format, matches CHECK)
  email_zoom: string;
  bio: string;
  windows: AvailabilityWindow[];
}

interface AvailabilityWindow {
  day_of_week: number; // 0=Min .. 6=Sab
  start_time: string; // HH:MM
  end_time: string;
  kind: "assessment" | "tahsin";
}

const TEACHERS: TeacherSeed[] = [
  {
    nama: "Ustadz Ahmad Hidayat",
    jenis_kelamin: "ikhwan",
    phone_e164: "+6281200000001",
    phone_db: "081200000001",
    email_zoom: "ahmad.hidayat.mpt.test@gmail.com",
    bio: "Pengajar tahsin dengan latar belakang Mahad Aly. Spesialisasi tartil dan ahkamul tilawah.",
    windows: [
      { day_of_week: 1, start_time: "19:30", end_time: "21:30", kind: "assessment" }, // Senin malam
      { day_of_week: 4, start_time: "19:30", end_time: "21:30", kind: "tahsin" }, // Kamis malam
    ],
  },
  {
    nama: "Ustadz Yusuf Mahmud",
    jenis_kelamin: "ikhwan",
    phone_e164: "+6281200000002",
    phone_db: "081200000002",
    email_zoom: "yusuf.mahmud.mpt.test@gmail.com",
    bio: "Hafidz 30 juz. Fokus mengajarkan makhraj dan sifat huruf untuk pemula.",
    windows: [
      { day_of_week: 2, start_time: "20:00", end_time: "22:00", kind: "assessment" }, // Selasa malam
      { day_of_week: 6, start_time: "08:00", end_time: "10:00", kind: "tahsin" }, // Sabtu pagi
    ],
  },
  {
    nama: "Ustadzah Aisyah Rahmawati",
    jenis_kelamin: "akhwat",
    phone_e164: "+6281200000003",
    phone_db: "081200000003",
    email_zoom: "aisyah.rahmawati.mpt.test@gmail.com",
    bio: "Pengajar muslimah berpengalaman 8 tahun. Sabar dan detail dalam koreksi panjang-pendek.",
    windows: [
      { day_of_week: 1, start_time: "16:00", end_time: "18:00", kind: "assessment" }, // Senin sore
      { day_of_week: 3, start_time: "16:00", end_time: "18:00", kind: "tahsin" }, // Rabu sore
      { day_of_week: 6, start_time: "09:00", end_time: "11:00", kind: "tahsin" }, // Sabtu pagi
    ],
  },
  {
    nama: "Ustadzah Fatimah Az-Zahra",
    jenis_kelamin: "akhwat",
    phone_e164: "+6281200000004",
    phone_db: "081200000004",
    email_zoom: "fatimah.azzahra.mpt.test@gmail.com",
    bio: "Lulusan LIPIA. Fokus tahsin Al-Fatihah untuk muslimah pemula.",
    windows: [
      { day_of_week: 4, start_time: "16:00", end_time: "18:00", kind: "tahsin" }, // Kamis sore
      { day_of_week: 6, start_time: "16:00", end_time: "18:00", kind: "tahsin" }, // Sabtu sore
    ],
  },
];

// ============================================================
// Setup
// ============================================================

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ Missing env var: ${name}`);
    console.error("  Make sure .env.local has it set, and you ran via pnpm seed:dev");
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isReset = process.argv.includes("--reset");

// ============================================================
// Helpers
// ============================================================

async function findAuthUserByEmail(email: string): Promise<string | null> {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
}

async function findAuthUserByPhone(phoneE164: string): Promise<string | null> {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.phone === phoneE164.replace(/^\+/, ""))?.id ?? null;
}

async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error && !error.message.includes("not found")) throw error;
}

// ============================================================
// Reset (--reset flag)
// ============================================================

async function reset() {
  console.log("⟲ Reset: deleting existing dummy admin + pengajar...");

  // Delete teachers + their auth users
  for (const t of TEACHERS) {
    const authId = await findAuthUserByPhone(t.phone_e164);
    if (authId) {
      // Availability rows + teacher row cascade via FK on auth user? No — they
      // cascade via teacher_id. Delete teacher row first, then auth user.
      await sb.from("teachers").delete().eq("auth_user_id", authId);
      await deleteAuthUser(authId);
      console.log(`  ✓ Removed pengajar ${t.nama} + auth user`);
    }
  }

  // Delete admin
  const adminAuthId = await findAuthUserByEmail(ADMIN_EMAIL);
  if (adminAuthId) {
    await sb.from("admins").delete().eq("auth_user_id", adminAuthId);
    await deleteAuthUser(adminAuthId);
    console.log(`  ✓ Removed admin ${ADMIN_EMAIL} + auth user`);
  }
}

// ============================================================
// Seed: Admin
// ============================================================

async function seedAdmin() {
  console.log(`\n→ Seeding admin: ${ADMIN_EMAIL}`);

  let authId = await findAuthUserByEmail(ADMIN_EMAIL);

  if (authId) {
    console.log(`  · Auth user already exists (${authId.slice(0, 8)}...)`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: ADMIN_EMAIL,
      email_confirm: true,
      user_metadata: { role: "admin", nama: ADMIN_NAMA },
    });
    if (error) {
      console.error(`  ✗ Failed to create auth user: ${error.message}`);
      return;
    }
    authId = data.user.id;
    console.log(`  ✓ Auth user created (${authId.slice(0, 8)}...)`);
  }

  // Upsert admins row
  const { error: dbError } = await sb.from("admins").upsert(
    {
      auth_user_id: authId,
      nama: ADMIN_NAMA,
      email: ADMIN_EMAIL.toLowerCase(),
      role: ADMIN_ROLE,
      is_active: true,
    },
    { onConflict: "auth_user_id" },
  );

  if (dbError) {
    console.error(`  ✗ Failed to upsert admins row: ${dbError.message}`);
    return;
  }
  console.log(`  ✓ admins row ready (role=${ADMIN_ROLE})`);
  console.log(`    → Login at /admin/login with email ${ADMIN_EMAIL} (magic link)`);
}

// ============================================================
// Seed: Pengajar
// ============================================================

async function seedTeacher(t: TeacherSeed) {
  console.log(`\n→ Seeding pengajar: ${t.nama} (${t.jenis_kelamin})`);

  let authId = await findAuthUserByPhone(t.phone_e164);

  if (authId) {
    console.log(`  · Auth user already exists (${authId.slice(0, 8)}...)`);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      phone: t.phone_e164,
      password: DUMMY_PASSWORD,
      phone_confirm: true,
      user_metadata: { role: "teacher", nama: t.nama },
    });
    if (error) {
      console.error(`  ✗ Failed to create auth user: ${error.message}`);
      if (error.message.toLowerCase().includes("phone provider")) {
        console.error(
          "    Hint: enable Phone provider at Supabase Dashboard → Authentication → Providers",
        );
      }
      return;
    }
    authId = data.user.id;
    console.log(`  ✓ Auth user created (${authId.slice(0, 8)}...)`);
  }

  // Upsert teachers row
  const { data: teacher, error: dbError } = await sb
    .from("teachers")
    .upsert(
      {
        auth_user_id: authId,
        nama: t.nama,
        jenis_kelamin: t.jenis_kelamin,
        nomor_wa: t.phone_db,
        email_zoom: t.email_zoom,
        bio: t.bio,
        status: "active",
        activated_at: new Date().toISOString(),
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (dbError || !teacher) {
    console.error(`  ✗ Failed to upsert teachers row: ${dbError?.message}`);
    return;
  }
  console.log(`  ✓ teachers row ready (id=${teacher.id.slice(0, 8)}...)`);
  console.log(`    → Login at /portal-mpt-x7/login`);
  console.log(`      WA: ${t.phone_db}   Password: ${DUMMY_PASSWORD}`);

  // Replace availability windows (delete + insert for clean state)
  await sb.from("teacher_availability").delete().eq("teacher_id", teacher.id);
  const windowRows = t.windows.map((w) => ({
    teacher_id: teacher.id,
    day_of_week: w.day_of_week,
    start_time: w.start_time,
    end_time: w.end_time,
    kind: w.kind,
    is_active: true,
  }));
  const { error: availErr } = await sb.from("teacher_availability").insert(windowRows);
  if (availErr) {
    console.error(`  ✗ Failed to insert availability: ${availErr.message}`);
    return;
  }
  console.log(`  ✓ ${windowRows.length} availability window(s) set`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Muhajir Project Tilawah — Development Seed");
  console.log(`  Target: ${SUPABASE_URL}`);
  console.log(`  Mode:   ${isReset ? "RESET + SEED" : "SEED (idempotent)"}`);
  console.log("═══════════════════════════════════════════════════════");

  // Sanity check: verify migration is applied by querying a V2 table
  const { error: sanityErr } = await sb
    .from("teachers")
    .select("id", { count: "exact", head: true });
  if (sanityErr) {
    console.error("\n✗ Cannot query teachers table:");
    console.error(`  ${sanityErr.message}`);
    console.error("\n  Likely cause: migration 0002_booking_v2.sql not applied yet.");
    console.error("  Run it first at Supabase Dashboard → SQL Editor, then retry seed.");
    process.exit(1);
  }

  if (isReset) {
    await reset();
  }

  await seedAdmin();

  for (const t of TEACHERS) {
    await seedTeacher(t);
  }

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✓ Seed complete");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log(`  1. Login admin: ${SUPABASE_URL.replace("//", "//app.")}/admin/login`);
  console.log(`     (use ${ADMIN_EMAIL}, then click magic link in inbox)`);
  console.log(`  2. Login pengajar: /portal-mpt-x7/login`);
  console.log(`     (use any of the phone numbers above + ${DUMMY_PASSWORD})`);
  console.log(`  3. Admin → /admin/jadwal → klik "Generate Slot" untuk buat slot konkret`);
  console.log(`  4. Admin → /admin/cohort → "Buat Cohort Baru" untuk Tahsin cohort`);
}

main().catch((err) => {
  console.error("\n✗ Seed failed with unhandled error:");
  console.error(err);
  process.exit(1);
});
