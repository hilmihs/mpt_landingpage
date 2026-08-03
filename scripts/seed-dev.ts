/**
 * Seed script for development / staging environments.
 *
 * Creates dummy admin + pengajar + full funnel demo data so the V2 flow
 * can be demo'd end-to-end without touching production data.
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   pnpm seed:dev          # create or skip if exists
 *   pnpm seed:reset        # delete existing dummies first, then seed
 *
 * Prerequisites:
 *   1. .env.local set with DATABASE_URL (data) + NEXT_PUBLIC_SUPABASE_URL +
 *      SUPABASE_SERVICE_ROLE_KEY (masih dipakai untuk auth sampai Fase 4)
 *   2. Semua migrasi sudah jalan: `pnpm db:migrate`
 *   3. Supabase Auth phone provider enabled (for pengajar phone login)
 */

import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { hashPassword } from "@/auth";
import { normalizeWaNumber } from "@/lib/whatsapp";

// ============================================================
// 1. Admin & Teacher data
// ============================================================

const ADMIN_EMAIL = "hilmisobandi@gmail.com";
const ADMIN_NAMA = "Hilmi Sobandi";
const ADMIN_ROLE: "super" | "staff" = "super";

const DUMMY_PASSWORD = "MPTtest2026!";

interface TeacherSeed {
  nama: string;
  jenis_kelamin: "ikhwan" | "akhwat";
  phone_e164: string;
  phone_db: string;
  email_meet: string;
  bio: string;
  windows: AvailabilityWindow[];
}

interface AvailabilityWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  kind: "assessment" | "tahsin";
}

const TEACHERS: TeacherSeed[] = [
  {
    nama: "Ustadz Ahmad Hidayat",
    jenis_kelamin: "ikhwan",
    phone_e164: "+6281200000001",
    phone_db: "081200000001",
    email_meet: "ahmad.hidayat.mpt.test@gmail.com",
    bio: "Pengajar tahsin dengan latar belakang Mahad Aly. Spesialisasi tartil dan ahkamul tilawah.",
    windows: [
      { day_of_week: 1, start_time: "19:30", end_time: "21:30", kind: "assessment" },
      { day_of_week: 4, start_time: "19:30", end_time: "21:30", kind: "tahsin" },
    ],
  },
  {
    nama: "Ustadz Yusuf Mahmud",
    jenis_kelamin: "ikhwan",
    phone_e164: "+6281200000002",
    phone_db: "081200000002",
    email_meet: "yusuf.mahmud.mpt.test@gmail.com",
    bio: "Hafidz 30 juz. Fokus mengajarkan makhraj dan sifat huruf untuk pemula.",
    windows: [
      { day_of_week: 2, start_time: "20:00", end_time: "22:00", kind: "assessment" },
      { day_of_week: 6, start_time: "08:00", end_time: "10:00", kind: "tahsin" },
    ],
  },
  {
    nama: "Ustadzah Aisyah Rahmawati",
    jenis_kelamin: "akhwat",
    phone_e164: "+6281200000003",
    phone_db: "081200000003",
    email_meet: "aisyah.rahmawati.mpt.test@gmail.com",
    bio: "Pengajar muslimah berpengalaman 8 tahun. Sabar dan detail dalam koreksi panjang-pendek.",
    windows: [
      { day_of_week: 1, start_time: "16:00", end_time: "18:00", kind: "assessment" },
      { day_of_week: 3, start_time: "16:00", end_time: "18:00", kind: "tahsin" },
      { day_of_week: 6, start_time: "09:00", end_time: "11:00", kind: "tahsin" },
    ],
  },
  {
    nama: "Ustadzah Fatimah Az-Zahra",
    jenis_kelamin: "akhwat",
    phone_e164: "+6281200000004",
    phone_db: "081200000004",
    email_meet: "fatimah.azzahra.mpt.test@gmail.com",
    bio: "Lulusan LIPIA. Fokus tahsin Al-Fatihah untuk muslimah pemula.",
    windows: [
      { day_of_week: 4, start_time: "16:00", end_time: "18:00", kind: "tahsin" },
      { day_of_week: 6, start_time: "16:00", end_time: "18:00", kind: "tahsin" },
    ],
  },
];

// ============================================================
// 2. Funnel demo data
// ============================================================

type Gender = "ikhwan" | "akhwat";

function demoId(prefix: string, n: number): string {
  const hex = n.toString(16).padStart(4, "0");
  return `${prefix}-${hex}-4000-8000-000000000000`;
}

const D = {
  slots: {
    assess_ikh_past: demoId("aaaaaaaa", 1),
    assess_akh_past: demoId("aaaaaaaa", 2),
    assess_ikh_fut: demoId("aaaaaaaa", 3),
    assess_akh_fut: demoId("aaaaaaaa", 4),
    assess_ikh_fut2: demoId("aaaaaaaa", 5),
    assess_ikh_fut3: demoId("aaaaaaaa", 6),
    assess_akh_fut2: demoId("aaaaaaaa", 7),
    assess_akh_fut3: demoId("aaaaaaaa", 8),
    tahsin_ikh_past: [1, 2, 3, 4].map((i) => demoId("aaaaaaaa", 10 + i)),
    tahsin_akh_past: [1, 2, 3, 4].map((i) => demoId("aaaaaaaa", 20 + i)),
    tahsin_ikh_fut: [1, 2, 3, 4].map((i) => demoId("aaaaaaaa", 30 + i)),
    tahsin_akh_fut: [1, 2, 3, 4].map((i) => demoId("aaaaaaaa", 40 + i)),
  },
  cohorts: {
    ikh_past: demoId("cccccccc", 1),
    akh_past: demoId("cccccccc", 2),
    ikh_fut: demoId("cccccccc", 3),
    akh_fut: demoId("cccccccc", 4),
  },
  cs: {
    ikh_past: [1, 2, 3, 4].map((i) => demoId("eeeeeeee", 10 + i)),
    akh_past: [1, 2, 3, 4].map((i) => demoId("eeeeeeee", 20 + i)),
    ikh_fut: [1, 2, 3, 4].map((i) => demoId("eeeeeeee", 30 + i)),
    akh_fut: [1, 2, 3, 4].map((i) => demoId("eeeeeeee", 40 + i)),
  },
};

interface ErrorItem {
  ayat: number;
  kata_idx: number;
  expected: string;
  actual: string;
  severity: "major" | "minor";
  note?: string;
}

interface ErrorSet {
  errors_harakat: ErrorItem[];
  errors_huruf: ErrorItem[];
  errors_panjang_pendek: ErrorItem[];
  errors_syaddah: ErrorItem[];
}

const ERRORS_SKOR_4: ErrorSet = {
  errors_harakat: [
    { ayat: 3, kata_idx: 1, expected: "ٱلرَّحِيمِ", actual: "ٱلرَّحِيمْ", severity: "minor", note: "Kasrah akhir terdengar samar" },
  ],
  errors_huruf: [],
  errors_panjang_pendek: [
    { ayat: 1, kata_idx: 2, expected: "ٱلرَّحْمَٰنِ", actual: "ٱلرَّحْمَانِ", severity: "minor", note: "Mad sedikit kurang panjang" },
  ],
  errors_syaddah: [],
};

const ERRORS_SKOR_3: ErrorSet = {
  errors_harakat: [
    { ayat: 2, kata_idx: 0, expected: "ٱلْحَمْدُ", actual: "ٱلْحَمْدِ", severity: "major", note: "Dhammah dibaca kasrah" },
  ],
  errors_huruf: [
    { ayat: 6, kata_idx: 1, expected: "ٱلصِّرَٰطَ", actual: "ٱلسِّرَاطَ", severity: "major", note: "Shad dibaca sin" },
  ],
  errors_panjang_pendek: [
    { ayat: 1, kata_idx: 2, expected: "ٱلرَّحْمَٰنِ", actual: "ٱلرَّحْمَنِ", severity: "major", note: "Mad wajib muttashil kurang panjang" },
  ],
  errors_syaddah: [
    { ayat: 5, kata_idx: 0, expected: "إِيَّاكَ", actual: "إِيَاكَ", severity: "minor", note: "Tasydid ya kurang tegas" },
  ],
};

const ERRORS_SKOR_2: ErrorSet = {
  errors_harakat: [
    { ayat: 1, kata_idx: 0, expected: "بِسْمِ", actual: "بَسْمِ", severity: "major", note: "Kasrah dibaca fathah" },
    { ayat: 2, kata_idx: 0, expected: "ٱلْحَمْدُ", actual: "ٱلْحَمْدِ", severity: "major", note: "Dhammah dibaca kasrah" },
    { ayat: 5, kata_idx: 3, expected: "نَسْتَعِينُ", actual: "نَسْتَعِينَ", severity: "minor", note: "Dhammah akhir kurang jelas" },
  ],
  errors_huruf: [
    { ayat: 6, kata_idx: 1, expected: "ٱلصِّرَٰطَ", actual: "ٱلسِّرَاطَ", severity: "major", note: "Shad dibaca sin" },
    { ayat: 7, kata_idx: 8, expected: "ٱلضَّآلِّينَ", actual: "ٱلدَّالِّينَ", severity: "major", note: "Dhad dibaca dal" },
  ],
  errors_panjang_pendek: [
    { ayat: 1, kata_idx: 2, expected: "ٱلرَّحْمَٰنِ", actual: "ٱلرَّحْمَنِ", severity: "major", note: "Mad kurang panjang" },
    { ayat: 3, kata_idx: 0, expected: "ٱلرَّحْمَٰنِ", actual: "ٱلرَّحْمَنِ", severity: "minor", note: "Mad alif sedikit pendek" },
  ],
  errors_syaddah: [
    { ayat: 1, kata_idx: 1, expected: "ٱللَّهِ", actual: "ٱلَهِ", severity: "major", note: "Syaddah lam hilang" },
    { ayat: 7, kata_idx: 8, expected: "ٱلضَّآلِّينَ", actual: "ٱلضَالِينَ", severity: "minor", note: "Syaddah lam kurang tegas" },
  ],
};

const ERRORS_SKOR_1: ErrorSet = {
  errors_harakat: [
    { ayat: 1, kata_idx: 0, expected: "بِسْمِ", actual: "بَسْمِ", severity: "major", note: "Kasrah dibaca fathah" },
    { ayat: 2, kata_idx: 0, expected: "ٱلْحَمْدُ", actual: "ٱلْحَمْدِ", severity: "major", note: "Dhammah dibaca kasrah" },
    { ayat: 4, kata_idx: 0, expected: "مَٰلِكِ", actual: "مَالِكَ", severity: "major", note: "Kasrah dibaca fathah" },
    { ayat: 5, kata_idx: 0, expected: "إِيَّاكَ", actual: "إِيَّاكِ", severity: "major", note: "Fathah dibaca kasrah" },
    { ayat: 5, kata_idx: 3, expected: "نَسْتَعِينُ", actual: "نَسْتَعِينَ", severity: "minor", note: "Dhammah akhir samar" },
  ],
  errors_huruf: [
    { ayat: 5, kata_idx: 1, expected: "نَعْبُدُ", actual: "نَأْبُدُ", severity: "major", note: "'Ain dibaca hamzah" },
    { ayat: 6, kata_idx: 1, expected: "ٱلصِّرَٰطَ", actual: "ٱلسِّرَاطَ", severity: "major", note: "Shad dibaca sin" },
    { ayat: 7, kata_idx: 8, expected: "ٱلضَّآلِّينَ", actual: "ٱلدَّالِّينَ", severity: "major", note: "Dhad dibaca dal" },
    { ayat: 6, kata_idx: 2, expected: "ٱلْمُسْتَقِيمَ", actual: "ٱلْمُسْتَكِيمَ", severity: "minor", note: "Qaf kurang jelas" },
  ],
  errors_panjang_pendek: [
    { ayat: 1, kata_idx: 2, expected: "ٱلرَّحْمَٰنِ", actual: "ٱلرَّحْمَنِ", severity: "major", note: "Mad wajib hilang" },
    { ayat: 1, kata_idx: 3, expected: "ٱلرَّحِيمِ", actual: "ٱلرَّحِمِ", severity: "major", note: "Mad terlalu pendek" },
    { ayat: 7, kata_idx: 8, expected: "ٱلضَّآلِّينَ", actual: "ٱلضَّالِّينَ", severity: "major", note: "Mad lazim kurang panjang" },
    { ayat: 3, kata_idx: 0, expected: "ٱلرَّحْمَٰنِ", actual: "ٱلرَّحْمَنِ", severity: "minor", note: "Mad alif pendek" },
  ],
  errors_syaddah: [
    { ayat: 1, kata_idx: 1, expected: "ٱللَّهِ", actual: "ٱلَهِ", severity: "major", note: "Syaddah lam hilang" },
    { ayat: 2, kata_idx: 2, expected: "رَبِّ", actual: "رَبِ", severity: "minor", note: "Syaddah ba kurang" },
  ],
};

function errorsBySkor(skor: number): ErrorSet {
  switch (skor) {
    case 4: return ERRORS_SKOR_4;
    case 3: return ERRORS_SKOR_3;
    case 2: return ERRORS_SKOR_2;
    case 1: return ERRORS_SKOR_1;
    default: return { errors_harakat: [], errors_huruf: [], errors_panjang_pendek: [], errors_syaddah: [] };
  }
}

const SEVERITY_WEIGHT = { major: 1, minor: 0.5 };
const SCORE_THRESHOLDS = [
  { min: 0, max: 0, skor: 5, label: "Bacaan Sempurna" },
  { min: 0.5, max: 2, skor: 4, label: "Bacaan Sangat Baik" },
  { min: 2.5, max: 5, skor: 3, label: "Bacaan Cukup Baik" },
  { min: 5.5, max: 10, skor: 2, label: "Bacaan Perlu Penguatan" },
  { min: 10.5, max: Infinity, skor: 1, label: "Bacaan Perlu Penguatan Dasar" },
];

function computeScoreInline(errors: ErrorSet) {
  const all = [
    ...errors.errors_harakat, ...errors.errors_huruf,
    ...errors.errors_panjang_pendek, ...errors.errors_syaddah,
  ];
  let major = 0, minor = 0, ws = 0;
  for (const e of all) {
    if (e.severity === "major") major++;
    else minor++;
    ws += SEVERITY_WEIGHT[e.severity];
  }
  const tier = SCORE_THRESHOLDS.find((t) => ws >= t.min && ws <= t.max) ?? SCORE_THRESHOLDS[4]!;
  return { skor: tier.skor, status_label: tier.label, weighted_score: ws, total_errors_major: major, total_errors_minor: minor };
}

function narrativeBySkor(skor: number): string {
  switch (skor) {
    case 5: return "Masha Allah, bacaan Al-Fatihah sudah sempurna. Tidak ditemukan kesalahan pada keempat indikator. Pertahankan kualitas bacaan ini.";
    case 4: return "Bacaan sudah sangat baik, Masha Allah. Hanya ditemukan sedikit kekurangan minor pada panjang-pendek bacaan. Dengan latihan rutin, bacaan bisa menjadi sempurna. Disarankan mengikuti program Tahsin Al-Fatihah untuk penyempurnaan.";
    case 3: return "Bacaan cukup baik secara keseluruhan. Ditemukan beberapa kesalahan pada harakat dan makhraj huruf yang perlu diperbaiki. Disarankan mengikuti program Tahsin Al-Fatihah untuk penguatan bacaan.";
    case 2: return "Bacaan perlu penguatan pada beberapa aspek, terutama harakat, makhraj huruf, dan panjang-pendek. Sangat disarankan mengikuti program Tahsin Al-Fatihah untuk memperbaiki fondasi bacaan Al-Fatihah.";
    case 1: return "Bacaan memerlukan penguatan dasar pada semua indikator: harakat, huruf, panjang-pendek, dan syaddah. Program Tahsin Al-Fatihah akan sangat membantu memperbaiki bacaan dari dasar. Jangan berkecil hati — setiap langkah menuju perbaikan bacaan adalah ibadah.";
    default: return "";
  }
}

interface PesertaSeed {
  nama: string;
  jenis_kelamin: Gender;
  nomor_wa: string;
  rapot_slug: string;
  target_skor: number;
  audio_duration_sec: number;
  gates: { gate: string; response: string }[];
  booking_status?: string;
  tahsin_sessions_attended?: number;
}

const PESERTA: PesertaSeed[] = [
  {
    nama: "Muhammad Rizki Pratama", jenis_kelamin: "ikhwan",
    nomor_wa: "089900000001", rapot_slug: "demo-rizki-01",
    target_skor: 3, audio_duration_sec: 52,
    gates: [{ gate: "gate1_post_rapot", response: "no" }],
  },
  {
    nama: "Siti Nur Halimah", jenis_kelamin: "akhwat",
    nomor_wa: "089900000002", rapot_slug: "demo-halimah-02",
    target_skor: 2, audio_duration_sec: 58,
    gates: [{ gate: "gate1_post_rapot", response: "later" }],
  },
  {
    nama: "Ahmad Fauzi Rahman", jenis_kelamin: "ikhwan",
    nomor_wa: "089900000003", rapot_slug: "demo-fauzi-03",
    target_skor: 4, audio_duration_sec: 45,
    gates: [{ gate: "gate1_post_rapot", response: "yes" }],
    booking_status: "confirmed",
  },
  {
    nama: "Aisyah Putri Ramadhani", jenis_kelamin: "akhwat",
    nomor_wa: "089900000004", rapot_slug: "demo-aisyah-04",
    target_skor: 3, audio_duration_sec: 55,
    gates: [{ gate: "gate1_post_rapot", response: "yes" }],
    booking_status: "reserved",
  },
  {
    nama: "Umar Faruq Habibi", jenis_kelamin: "ikhwan",
    nomor_wa: "089900000005", rapot_slug: "demo-umar-05",
    target_skor: 2, audio_duration_sec: 61,
    gates: [{ gate: "gate1_post_rapot", response: "yes" }],
    booking_status: "attended",
  },
  {
    nama: "Khadijah Aminah Zahra", jenis_kelamin: "akhwat",
    nomor_wa: "089900000006", rapot_slug: "demo-khadijah-06",
    target_skor: 3, audio_duration_sec: 48,
    gates: [
      { gate: "gate1_post_rapot", response: "yes" },
      { gate: "gate2_post_assessment", response: "yes" },
    ],
    booking_status: "attended",
    tahsin_sessions_attended: 0,
  },
  {
    nama: "Ibrahim Maulana Akbar", jenis_kelamin: "ikhwan",
    nomor_wa: "089900000007", rapot_slug: "demo-ibrahim-07",
    target_skor: 2, audio_duration_sec: 65,
    gates: [
      { gate: "gate1_post_rapot", response: "yes" },
      { gate: "gate2_post_assessment", response: "yes" },
    ],
    booking_status: "attended",
    tahsin_sessions_attended: 2,
  },
  {
    nama: "Fatimah Azzahra Putri", jenis_kelamin: "akhwat",
    nomor_wa: "089900000008", rapot_slug: "demo-fatimah-08",
    target_skor: 1, audio_duration_sec: 70,
    gates: [
      { gate: "gate1_post_rapot", response: "yes" },
      { gate: "gate2_post_assessment", response: "yes" },
    ],
    booking_status: "attended",
    tahsin_sessions_attended: 3,
  },
  {
    nama: "Bilal Abdurrahman", jenis_kelamin: "ikhwan",
    nomor_wa: "089900000009", rapot_slug: "demo-bilal-09",
    target_skor: 2, audio_duration_sec: 59,
    gates: [
      { gate: "gate1_post_rapot", response: "yes" },
      { gate: "gate2_post_assessment", response: "yes" },
      { gate: "gate3_post_tahsin", response: "yes" },
    ],
    booking_status: "attended",
    tahsin_sessions_attended: 4,
  },
  {
    nama: "Maryam Safira Utami", jenis_kelamin: "akhwat",
    nomor_wa: "089900000010", rapot_slug: "demo-maryam-10",
    target_skor: 1, audio_duration_sec: 72,
    gates: [
      { gate: "gate1_post_rapot", response: "yes" },
      { gate: "gate2_post_assessment", response: "yes" },
      { gate: "gate3_post_tahsin", response: "yes" },
    ],
    booking_status: "attended",
    tahsin_sessions_attended: 4,
  },
];

// ============================================================
// 3. Setup
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

const DATABASE_URL = requireEnv("DATABASE_URL");
const isReset = process.argv.includes("--reset");

function dbTarget(): string {
  try {
    const u = new URL(DATABASE_URL);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(DATABASE_URL tidak bisa di-parse)";
  }
}

// ============================================================
// 4. Helpers
// ============================================================

/**
 * Akun disimpan langsung di auth_users, sumber kebenaran satu-satunya sejak
 * Auth.js menggantikan Supabase Auth.
 *
 * Nomor telepon disimpan lewat normalizeWaNumber() supaya bentuknya persis
 * sama dengan yang dicari saat login di auth.ts — kalau tidak, akun terbuat
 * tapi tidak pernah bisa dipakai masuk.
 */
async function upsertAuthUser(identity: {
  email?: string;
  phone?: string;
  password?: string;
}): Promise<string> {
  const email = identity.email?.toLowerCase() ?? null;
  const phone = identity.phone ? normalizeWaNumber(identity.phone) : null;
  const hash = identity.password ? await hashPassword(identity.password) : null;

  const existing = email
    ? await sql<{ id: string }[]>`SELECT id FROM auth_users WHERE lower(email) = ${email} LIMIT 1`
    : await sql<{ id: string }[]>`SELECT id FROM auth_users WHERE phone = ${phone} LIMIT 1`;

  if (existing[0]) {
    if (hash) {
      await sql`UPDATE auth_users SET password_hash = ${hash} WHERE id = ${existing[0].id}`;
    }
    return existing[0].id;
  }

  const created = await sql<{ id: string }[]>`
    INSERT INTO auth_users (email, phone, password_hash)
    VALUES (${email}, ${phone}, ${hash})
    RETURNING id
  `;
  return created[0]!.id;
}

async function deleteAuthUserByIdentity(identity: {
  email?: string;
  phone?: string;
}): Promise<void> {
  if (identity.email) {
    await sql`DELETE FROM auth_users WHERE lower(email) = ${identity.email.toLowerCase()}`;
  }
  if (identity.phone) {
    const phone = normalizeWaNumber(identity.phone);
    if (phone) await sql`DELETE FROM auth_users WHERE phone = ${phone}`;
  }
}

/** sql.json() dengan tipe longgar — ErrorItem punya field opsional, JSONValue tidak menerimanya. */
function jsonb(value: unknown) {
  return sql.json(value as Parameters<typeof sql.json>[0]);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function nextDayOfWeek(dow: number, hour: number, minute: number): Date {
  const d = new Date();
  const diff = (dow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ============================================================
// 5. Reset
// ============================================================

const ALL_SLOT_IDS = [
  D.slots.assess_ikh_past, D.slots.assess_akh_past,
  D.slots.assess_ikh_fut, D.slots.assess_akh_fut,
  D.slots.assess_ikh_fut2, D.slots.assess_ikh_fut3,
  D.slots.assess_akh_fut2, D.slots.assess_akh_fut3,
  ...D.slots.tahsin_ikh_past, ...D.slots.tahsin_akh_past,
  ...D.slots.tahsin_ikh_fut, ...D.slots.tahsin_akh_fut,
];
const ALL_COHORT_IDS = Object.values(D.cohorts);
const ALL_CS_IDS = [...D.cs.ikh_past, ...D.cs.akh_past, ...D.cs.ikh_fut, ...D.cs.akh_fut];
const DEMO_WA_PATTERN = "08990000%";

async function resetFunnelData() {
  console.log("\n⟲ Reset: deleting funnel demo data...");

  const subs = await sql<{ id: string }[]>`
    SELECT id FROM submissions WHERE nomor_wa LIKE ${DEMO_WA_PATTERN}
  `;
  const subIds = subs.map((r) => r.id);

  if (subIds.length > 0) {
    await sql`DELETE FROM analytics_events WHERE submission_id = ANY(${subIds}::uuid[])`;
    await sql`DELETE FROM interest_responses WHERE submission_id = ANY(${subIds}::uuid[])`;
    await sql`DELETE FROM attendance WHERE submission_id = ANY(${subIds}::uuid[])`;
    console.log("  ✓ Cleared attendance, interest, analytics");
  }

  if (ALL_COHORT_IDS.length > 0) {
    await sql`DELETE FROM cohort_enrollments WHERE cohort_id = ANY(${ALL_COHORT_IDS}::uuid[])`;
    await sql`DELETE FROM cohort_sessions WHERE cohort_id = ANY(${ALL_COHORT_IDS}::uuid[])`;
    await sql`DELETE FROM cohorts WHERE id = ANY(${ALL_COHORT_IDS}::uuid[])`;
    console.log("  ✓ Cleared cohorts + sessions + enrollments");
  }

  if (subIds.length > 0) {
    await sql`DELETE FROM bookings WHERE submission_id = ANY(${subIds}::uuid[])`;
    console.log("  ✓ Cleared bookings");
  }

  if (ALL_SLOT_IDS.length > 0) {
    await sql`DELETE FROM slots WHERE id = ANY(${ALL_SLOT_IDS}::uuid[])`;
    console.log("  ✓ Cleared slots");
  }

  await sql`DELETE FROM rapot WHERE slug LIKE ${"demo-%"}`;
  if (subIds.length > 0) {
    await sql`DELETE FROM submissions WHERE id = ANY(${subIds}::uuid[])`;
  }
  console.log("  ✓ Cleared submissions + rapot");
}

async function reset() {
  console.log("⟲ Reset: deleting existing dummy admin + pengajar...");
  for (const t of TEACHERS) {
    await sql`
      DELETE FROM teacher_availability
      WHERE teacher_id IN (SELECT id FROM teachers WHERE nomor_wa = ${t.phone_db})
    `;
    await sql`DELETE FROM teachers WHERE nomor_wa = ${t.phone_db}`;
    await deleteAuthUserByIdentity({ phone: t.phone_e164 });
    console.log(`  ✓ Removed pengajar ${t.nama} + akun auth`);
  }
  await sql`DELETE FROM admins WHERE email = ${ADMIN_EMAIL.toLowerCase()}`;
  await deleteAuthUserByIdentity({ email: ADMIN_EMAIL });
  console.log(`  ✓ Removed admin ${ADMIN_EMAIL} + akun auth`);

  // Sapu kredensial yatim. Format nomor pernah berubah (+62… menjadi 62…), dan
  // baris lama yang tidak dirujuk siapa pun tetap bisa dipakai login seandainya
  // punya password — jangan ditinggal menggantung.
  const orphans = await sql`
    DELETE FROM auth_users u
    WHERE NOT EXISTS (SELECT 1 FROM teachers t WHERE t.auth_user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM admins a WHERE a.auth_user_id = u.id)
  `;
  if (orphans.count > 0) {
    console.log(`  ✓ ${orphans.count} akun auth yatim dibersihkan`);
  }
}

// ============================================================
// 6. Seed: Admin
// ============================================================

async function seedAdmin() {
  console.log(`\n→ Seeding admin: ${ADMIN_EMAIL}`);
  let authId: string;
  try {
    authId = await upsertAuthUser({ email: ADMIN_EMAIL, password: DUMMY_PASSWORD });
    await sql`
      INSERT INTO admins (auth_user_id, nama, email, role, is_active)
      VALUES (${authId}, ${ADMIN_NAMA}, ${ADMIN_EMAIL.toLowerCase()}, ${ADMIN_ROLE}, ${true})
      ON CONFLICT (auth_user_id) DO UPDATE SET
        nama = EXCLUDED.nama,
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active
    `;
  } catch (err) {
    console.error(`  ✗ Failed to upsert admins row: ${(err as Error).message}`);
    return;
  }
  console.log(`  ✓ admin siap (role=${ADMIN_ROLE}, password=${DUMMY_PASSWORD})`);
}

// ============================================================
// 7. Seed: Pengajar
// ============================================================

async function seedTeacher(t: TeacherSeed) {
  console.log(`\n→ Seeding pengajar: ${t.nama} (${t.jenis_kelamin})`);
  const authId = await upsertAuthUser({
    phone: t.phone_e164,
    password: DUMMY_PASSWORD,
  });

  let teacherId: string;
  try {
    const rows = await sql<{ id: string }[]>`
      INSERT INTO teachers
        (auth_user_id, nama, jenis_kelamin, nomor_wa, email_meet, bio, status, activated_at)
      VALUES (
        ${authId}, ${t.nama}, ${t.jenis_kelamin}, ${t.phone_db},
        ${t.email_meet}, ${t.bio}, ${"active"}, ${new Date()}
      )
      ON CONFLICT (nomor_wa) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        nama = EXCLUDED.nama,
        jenis_kelamin = EXCLUDED.jenis_kelamin,
        email_meet = EXCLUDED.email_meet,
        bio = EXCLUDED.bio,
        status = EXCLUDED.status,
        activated_at = EXCLUDED.activated_at
      RETURNING id
    `;
    if (!rows[0]) throw new Error("no row returned");
    teacherId = rows[0].id;
  } catch (err) {
    console.error(`  ✗ Failed to upsert teachers row: ${(err as Error).message}`);
    return;
  }
  console.log(`  ✓ teachers row ready (id=${teacherId.slice(0, 8)}...)`);
  console.log(`    → Login: /portal-mpt-x7/login  WA: ${t.phone_db}  Pwd: ${DUMMY_PASSWORD}`);

  await sql`DELETE FROM teacher_availability WHERE teacher_id = ${teacherId}`;
  const windowRows = t.windows.map((w) => ({
    teacher_id: teacherId, day_of_week: w.day_of_week,
    start_time: w.start_time, end_time: w.end_time, kind: w.kind, is_active: true,
  }));
  try {
    await sql`INSERT INTO teacher_availability ${sql(
      windowRows,
      "teacher_id", "day_of_week", "start_time", "end_time", "kind", "is_active",
    )}`;
  } catch (err) {
    console.error(`  ✗ Failed to insert availability: ${(err as Error).message}`);
    return;
  }
  console.log(`  ✓ ${windowRows.length} availability window(s) set`);
}

// ============================================================
// 8. Seed: Funnel demo data
// ============================================================

async function seedFunnelData() {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Seeding funnel demo data...");
  console.log("═══════════════════════════════════════════════════════");

  // ---- Look up teacher IDs ----
  const tRows = await sql<
    { id: string; nomor_wa: string; jenis_kelamin: string }[]
  >`
    SELECT id, nomor_wa, jenis_kelamin FROM teachers
    WHERE nomor_wa = ANY(${TEACHERS.map((t) => t.phone_db)}::text[])
  `;

  if (tRows.length < 4) {
    console.error("  ✗ Could not find all 4 teachers. Run teacher seed first.");
    return;
  }

  const tMap: Record<string, { id: string; g: string }> = {};
  for (const r of tRows) {
    tMap[r.nomor_wa] = { id: r.id, g: r.jenis_kelamin };
  }
  const ahmad = tMap["081200000001"]!;
  const yusuf = tMap["081200000002"]!;
  const aisyah = tMap["081200000003"]!;
  const fatimah = tMap["081200000004"]!;

  // ---- 1. Submissions ----
  console.log("\n→ Seeding submissions...");
  const subData = PESERTA.map((p) => ({
    nama: p.nama, jenis_kelamin: p.jenis_kelamin, nomor_wa: p.nomor_wa,
    audio_path: "demo/placeholder.webm", audio_duration_sec: p.audio_duration_sec,
    status: "completed" as const, processed_at: daysAgo(42),
    rapot_slug: p.rapot_slug,
  }));
  let subRows: { id: string; rapot_slug: string }[];
  try {
    // Insert dan SELECT dipisah: menggabungkan generic baris hasil dengan
    // helper sql(rows, ...cols) di satu query bikin inferensi tipe postgres.js
    // runtuh (helper-nya jadi tidak cocok dengan ParameterOrFragment<never>).
    await sql`
      INSERT INTO submissions ${sql(
        subData,
        "nama", "jenis_kelamin", "nomor_wa", "audio_path",
        "audio_duration_sec", "status", "processed_at", "rapot_slug",
      )}
      ON CONFLICT (rapot_slug) DO UPDATE SET
        nama = EXCLUDED.nama,
        jenis_kelamin = EXCLUDED.jenis_kelamin,
        nomor_wa = EXCLUDED.nomor_wa,
        audio_path = EXCLUDED.audio_path,
        audio_duration_sec = EXCLUDED.audio_duration_sec,
        status = EXCLUDED.status,
        processed_at = EXCLUDED.processed_at
    `;
    subRows = await sql<{ id: string; rapot_slug: string }[]>`
      SELECT id, rapot_slug FROM submissions
      WHERE rapot_slug IN ${sql(PESERTA.map((p) => p.rapot_slug))}
    `;
  } catch (err) { console.error(`  ✗ submissions: ${(err as Error).message}`); return; }
  const slugToId: Record<string, string> = {};
  for (const r of subRows) slugToId[r.rapot_slug] = r.id;
  console.log(`  ✓ ${subRows.length} submissions`);

  // ---- 2. Rapot ----
  console.log("→ Seeding rapot...");
  const rapotData = PESERTA.map((p, i) => {
    const errors = errorsBySkor(p.target_skor);
    const score = computeScoreInline(errors);
    return {
      slug: p.rapot_slug, submission_id: slugToId[p.rapot_slug]!,
      skor: score.skor, status_label: score.status_label,
      // Kolom jsonb — harus lewat sql.json(), kalau tidak dikirim sebagai array Postgres.
      errors_harakat: jsonb(errors.errors_harakat),
      errors_huruf: jsonb(errors.errors_huruf),
      errors_panjang_pendek: jsonb(errors.errors_panjang_pendek),
      errors_syaddah: jsonb(errors.errors_syaddah),
      total_errors_major: score.total_errors_major, total_errors_minor: score.total_errors_minor,
      weighted_score: score.weighted_score,
      ml_model_version: "muaalem-v3_2", ml_confidence: 0.82 + i * 0.015,
      ai_narrative: narrativeBySkor(p.target_skor), ai_narrative_model: "claude-sonnet-4-6",
    };
  });
  try {
    await sql`
      INSERT INTO rapot ${sql(
        rapotData,
        "slug", "submission_id", "skor", "status_label",
        "errors_harakat", "errors_huruf", "errors_panjang_pendek", "errors_syaddah",
        "total_errors_major", "total_errors_minor", "weighted_score",
        "ml_model_version", "ml_confidence", "ai_narrative", "ai_narrative_model",
      )}
      ON CONFLICT (slug) DO UPDATE SET
        submission_id = EXCLUDED.submission_id,
        skor = EXCLUDED.skor,
        status_label = EXCLUDED.status_label,
        errors_harakat = EXCLUDED.errors_harakat,
        errors_huruf = EXCLUDED.errors_huruf,
        errors_panjang_pendek = EXCLUDED.errors_panjang_pendek,
        errors_syaddah = EXCLUDED.errors_syaddah,
        total_errors_major = EXCLUDED.total_errors_major,
        total_errors_minor = EXCLUDED.total_errors_minor,
        weighted_score = EXCLUDED.weighted_score,
        ml_model_version = EXCLUDED.ml_model_version,
        ml_confidence = EXCLUDED.ml_confidence,
        ai_narrative = EXCLUDED.ai_narrative,
        ai_narrative_model = EXCLUDED.ai_narrative_model
    `;
  } catch (err) { console.error(`  ✗ rapot: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${rapotData.length} rapot`);

  // ---- 3. Slots ----
  console.log("→ Seeding slots...");

  const assessIkhPast = daysAgo(21); assessIkhPast.setHours(19, 30, 0, 0);
  const assessAkhPast = daysAgo(14); assessAkhPast.setHours(16, 0, 0, 0);
  // NOTE: assessment future slots use daysFromNow (not nextDayOfWeek) so they stay
  // comfortably in the future and don't decay to "past" within days of seeding.
  // Kept inside the ~14-day horizon of v_slots_availability. Three options per gender.
  const assessIkhFut = daysFromNow(4); assessIkhFut.setHours(19, 30, 0, 0);
  const assessIkhFut2 = daysFromNow(8); assessIkhFut2.setHours(19, 30, 0, 0);
  const assessIkhFut3 = daysFromNow(12); assessIkhFut3.setHours(19, 30, 0, 0);
  const assessAkhFut = daysFromNow(5); assessAkhFut.setHours(16, 0, 0, 0);
  const assessAkhFut2 = daysFromNow(9); assessAkhFut2.setHours(16, 0, 0, 0);
  const assessAkhFut3 = daysFromNow(13); assessAkhFut3.setHours(16, 0, 0, 0);

  const tahsinIkhPastDates = [35, 28, 21, 14].map((d) => { const dt = daysAgo(d); dt.setHours(19, 30, 0, 0); return dt; });
  const tahsinAkhPastDates = [33, 26, 19, 12].map((d) => { const dt = daysAgo(d); dt.setHours(16, 0, 0, 0); return dt; });
  const tahsinIkhFutDates = [10, 17, 24, 31].map((d) => { const dt = daysFromNow(d); dt.setHours(8, 0, 0, 0); return dt; });
  const tahsinAkhFutDates = [11, 18, 25, 32].map((d) => { const dt = daysFromNow(d); dt.setHours(16, 0, 0, 0); return dt; });

  function mkSlot(id: string, teacherId: string, kind: "assessment" | "tahsin", at: Date, gender: Gender, past: boolean) {
    return {
      id, teacher_id: teacherId, kind,
      // Slot lampau butuh created_at sebelum scheduled_at supaya CHECK slot_future
      // tidak menolak. Slot mendatang cukup now() — sama dengan DEFAULT kolomnya.
      created_at: past ? new Date(at.getTime() - 86_400_000) : new Date(),
      scheduled_at: at, duration_min: kind === "assessment" ? 60 : 90,
      capacity: 12, gender_target: gender,
      status: past ? "completed" : "scheduled",
      meet_join_url: `https://meet.google.com/demo-${id.slice(0, 8)}-${id.slice(9, 13)}`,
      meet_calendar_event_id: id,
    };
  }

  const slotRows = [
    mkSlot(D.slots.assess_ikh_past, ahmad.id, "assessment", assessIkhPast, "ikhwan", true),
    mkSlot(D.slots.assess_akh_past, aisyah.id, "assessment", assessAkhPast, "akhwat", true),
    mkSlot(D.slots.assess_ikh_fut, ahmad.id, "assessment", assessIkhFut, "ikhwan", false),
    mkSlot(D.slots.assess_ikh_fut2, ahmad.id, "assessment", assessIkhFut2, "ikhwan", false),
    mkSlot(D.slots.assess_ikh_fut3, ahmad.id, "assessment", assessIkhFut3, "ikhwan", false),
    mkSlot(D.slots.assess_akh_fut, aisyah.id, "assessment", assessAkhFut, "akhwat", false),
    mkSlot(D.slots.assess_akh_fut2, aisyah.id, "assessment", assessAkhFut2, "akhwat", false),
    mkSlot(D.slots.assess_akh_fut3, aisyah.id, "assessment", assessAkhFut3, "akhwat", false),
    ...tahsinIkhPastDates.map((dt, i) => mkSlot(D.slots.tahsin_ikh_past[i]!, ahmad.id, "tahsin", dt, "ikhwan", true)),
    ...tahsinAkhPastDates.map((dt, i) => mkSlot(D.slots.tahsin_akh_past[i]!, aisyah.id, "tahsin", dt, "akhwat", true)),
    ...tahsinIkhFutDates.map((dt, i) => mkSlot(D.slots.tahsin_ikh_fut[i]!, yusuf.id, "tahsin", dt, "ikhwan", false)),
    ...tahsinAkhFutDates.map((dt, i) => mkSlot(D.slots.tahsin_akh_fut[i]!, fatimah.id, "tahsin", dt, "akhwat", false)),
  ];

  try {
    await sql`
      INSERT INTO slots ${sql(
        slotRows,
        "id", "teacher_id", "kind", "created_at", "scheduled_at", "duration_min",
        "capacity", "gender_target", "status", "meet_join_url", "meet_calendar_event_id",
      )}
      ON CONFLICT (id) DO UPDATE SET
        teacher_id = EXCLUDED.teacher_id,
        kind = EXCLUDED.kind,
        created_at = EXCLUDED.created_at,
        scheduled_at = EXCLUDED.scheduled_at,
        duration_min = EXCLUDED.duration_min,
        capacity = EXCLUDED.capacity,
        gender_target = EXCLUDED.gender_target,
        status = EXCLUDED.status,
        meet_join_url = EXCLUDED.meet_join_url,
        meet_calendar_event_id = EXCLUDED.meet_calendar_event_id
    `;
  } catch (err) { console.error(`  ✗ slots: ${(err as Error).message}`); return; }
  const pastCount = slotRows.filter((s) => s.status === "completed").length;
  console.log(`  ✓ ${slotRows.length} slots (${pastCount} past, ${slotRows.length - pastCount} future)`);

  // ---- 4. Cohorts ----
  console.log("→ Seeding cohorts...");
  const cohortRows = [
    {
      id: D.cohorts.ikh_past, teacher_id: ahmad.id, name: "Tahsin Ikhwan — Batch Demo",
      gender_target: "ikhwan", start_date: daysAgo(35).toISOString().slice(0, 10),
      end_date: daysAgo(7).toISOString().slice(0, 10), capacity: 12, status: "in_progress",
    },
    {
      id: D.cohorts.akh_past, teacher_id: aisyah.id, name: "Tahsin Akhwat — Batch Demo",
      gender_target: "akhwat", start_date: daysAgo(33).toISOString().slice(0, 10),
      end_date: daysAgo(5).toISOString().slice(0, 10), capacity: 12, status: "in_progress",
    },
    {
      id: D.cohorts.ikh_fut, teacher_id: yusuf.id, name: "Tahsin Ikhwan — Batch Baru",
      gender_target: "ikhwan", start_date: daysFromNow(10).toISOString().slice(0, 10),
      end_date: daysFromNow(31).toISOString().slice(0, 10), capacity: 12, status: "open",
    },
    {
      id: D.cohorts.akh_fut, teacher_id: fatimah.id, name: "Tahsin Akhwat — Batch Baru",
      gender_target: "akhwat", start_date: daysFromNow(11).toISOString().slice(0, 10),
      end_date: daysFromNow(32).toISOString().slice(0, 10), capacity: 12, status: "open",
    },
  ];
  try {
    await sql`
      INSERT INTO cohorts ${sql(
        cohortRows,
        "id", "teacher_id", "name", "gender_target",
        "start_date", "end_date", "capacity", "status",
      )}
      ON CONFLICT (id) DO UPDATE SET
        teacher_id = EXCLUDED.teacher_id,
        name = EXCLUDED.name,
        gender_target = EXCLUDED.gender_target,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        capacity = EXCLUDED.capacity,
        status = EXCLUDED.status
    `;
  } catch (err) { console.error(`  ✗ cohorts: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${cohortRows.length} cohorts`);

  // ---- 5. Cohort sessions ----
  console.log("→ Seeding cohort sessions...");
  const csRows = [
    ...D.cs.ikh_past.map((id, i) => ({ id, cohort_id: D.cohorts.ikh_past, slot_id: D.slots.tahsin_ikh_past[i]!, session_number: i + 1 })),
    ...D.cs.akh_past.map((id, i) => ({ id, cohort_id: D.cohorts.akh_past, slot_id: D.slots.tahsin_akh_past[i]!, session_number: i + 1 })),
    ...D.cs.ikh_fut.map((id, i) => ({ id, cohort_id: D.cohorts.ikh_fut, slot_id: D.slots.tahsin_ikh_fut[i]!, session_number: i + 1 })),
    ...D.cs.akh_fut.map((id, i) => ({ id, cohort_id: D.cohorts.akh_fut, slot_id: D.slots.tahsin_akh_fut[i]!, session_number: i + 1 })),
  ];
  try {
    await sql`
      INSERT INTO cohort_sessions ${sql(csRows, "id", "cohort_id", "slot_id", "session_number")}
      ON CONFLICT (id) DO UPDATE SET
        cohort_id = EXCLUDED.cohort_id,
        slot_id = EXCLUDED.slot_id,
        session_number = EXCLUDED.session_number
    `;
  } catch (err) { console.error(`  ✗ cohort_sessions: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${csRows.length} cohort sessions`);

  // ---- 6. Bookings ----
  console.log("→ Seeding bookings...");
  const bookedPeserta = PESERTA.filter((p) => p.booking_status);
  const bookingRows = bookedPeserta.map((p) => {
    const isPast = p.booking_status === "attended" || p.booking_status === "no_show";
    const slotId = p.jenis_kelamin === "ikhwan"
      ? (isPast ? D.slots.assess_ikh_past : D.slots.assess_ikh_fut)
      : (isPast ? D.slots.assess_akh_past : D.slots.assess_akh_fut);
    return {
      slot_id: slotId,
      submission_id: slugToId[p.rapot_slug]!,
      status: p.booking_status!,
      reserved_until: isPast ? daysAgo(20) : daysFromNow(7),
    };
  });
  try {
    await sql`
      INSERT INTO bookings ${sql(bookingRows, "slot_id", "submission_id", "status", "reserved_until")}
      ON CONFLICT (slot_id, submission_id) DO UPDATE SET
        status = EXCLUDED.status,
        reserved_until = EXCLUDED.reserved_until
    `;
  } catch (err) { console.error(`  ✗ bookings: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${bookingRows.length} bookings`);

  // Look up booking IDs for attendance
  const demoSubIds = Object.values(slugToId);
  const bookingLookup = await sql<
    { id: string; slot_id: string; submission_id: string }[]
  >`
    SELECT id, slot_id, submission_id FROM bookings
    WHERE submission_id = ANY(${demoSubIds}::uuid[])
  `;
  const bookingMap: Record<string, string> = {};
  for (const b of bookingLookup) {
    bookingMap[`${b.slot_id}:${b.submission_id}`] = b.id;
  }

  // ---- 7. Cohort enrollments ----
  console.log("→ Seeding cohort enrollments...");
  const enrolledPeserta = PESERTA.filter((p) => p.tahsin_sessions_attended !== undefined);
  const enrollRows = enrolledPeserta.map((p) => ({
    cohort_id: p.jenis_kelamin === "ikhwan" ? D.cohorts.ikh_past : D.cohorts.akh_past,
    submission_id: slugToId[p.rapot_slug]!,
  }));
  try {
    await sql`
      INSERT INTO cohort_enrollments ${sql(enrollRows, "cohort_id", "submission_id")}
      ON CONFLICT (cohort_id, submission_id) DO NOTHING
    `;
  } catch (err) { console.error(`  ✗ cohort_enrollments: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${enrollRows.length} enrollments`);

  // ---- 8. Attendance ----
  console.log("→ Seeding attendance...");
  const attendanceRows: {
    id: string;
    booking_id: string | null;
    cohort_session_id: string | null;
    submission_id: string;
    attended: boolean;
    source: string;
    joined_at: Date;
    duration_min: number;
  }[] = [];
  let attIdx = 0;

  // Assessment attendance (P5–P10: status='attended')
  for (const p of PESERTA.filter((p) => p.booking_status === "attended")) {
    attIdx++;
    const subId = slugToId[p.rapot_slug]!;
    const slotId = p.jenis_kelamin === "ikhwan" ? D.slots.assess_ikh_past : D.slots.assess_akh_past;
    const bookingId = bookingMap[`${slotId}:${subId}`];
    if (!bookingId) continue;
    const joinedAt = p.jenis_kelamin === "ikhwan" ? daysAgo(21) : daysAgo(14);
    joinedAt.setHours(joinedAt.getHours(), joinedAt.getMinutes() + 2, 0, 0);
    attendanceRows.push({
      id: demoId("dddddddd", attIdx),
      booking_id: bookingId, cohort_session_id: null,
      submission_id: subId, attended: true,
      source: "manual", joined_at: joinedAt, duration_min: 55,
    });
  }

  // Tahsin attendance
  for (const p of PESERTA.filter((p) => (p.tahsin_sessions_attended ?? 0) > 0)) {
    const subId = slugToId[p.rapot_slug]!;
    const sessions = p.jenis_kelamin === "ikhwan" ? D.cs.ikh_past : D.cs.akh_past;
    const slotDates = p.jenis_kelamin === "ikhwan" ? tahsinIkhPastDates : tahsinAkhPastDates;
    for (let s = 0; s < p.tahsin_sessions_attended!; s++) {
      attIdx++;
      const joinedAt = new Date(slotDates[s]!);
      joinedAt.setMinutes(joinedAt.getMinutes() + 3);
      attendanceRows.push({
        id: demoId("dddddddd", 100 + attIdx),
        booking_id: null, cohort_session_id: sessions[s]!,
        submission_id: subId, attended: true,
        source: "manual", joined_at: joinedAt, duration_min: 85,
      });
    }
  }

  try {
    await sql`
      INSERT INTO attendance ${sql(
        attendanceRows,
        "id", "booking_id", "cohort_session_id", "submission_id",
        "attended", "source", "joined_at", "duration_min",
      )}
      ON CONFLICT (id) DO UPDATE SET
        booking_id = EXCLUDED.booking_id,
        cohort_session_id = EXCLUDED.cohort_session_id,
        submission_id = EXCLUDED.submission_id,
        attended = EXCLUDED.attended,
        source = EXCLUDED.source,
        joined_at = EXCLUDED.joined_at,
        duration_min = EXCLUDED.duration_min
    `;
  } catch (err) { console.error(`  ✗ attendance: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${attendanceRows.length} attendance records`);

  // ---- 9. Interest responses ----
  console.log("→ Seeding interest responses...");
  const gateRows: { submission_id: string; gate: string; response: string }[] = [];
  for (const p of PESERTA) {
    for (const g of p.gates) {
      gateRows.push({ submission_id: slugToId[p.rapot_slug]!, gate: g.gate, response: g.response });
    }
  }
  try {
    await sql`
      INSERT INTO interest_responses ${sql(gateRows, "submission_id", "gate", "response")}
      ON CONFLICT (submission_id, gate) DO NOTHING
    `;
  } catch (err) { console.error(`  ✗ interest_responses: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${gateRows.length} gate responses`);

  // ---- 10. Analytics events ----
  console.log("→ Seeding analytics events...");
  await sql`DELETE FROM analytics_events WHERE submission_id = ANY(${demoSubIds}::uuid[])`;
  const eventRows: { event_name: string; submission_id: string; occurred_at: Date }[] = [];
  for (const p of PESERTA) {
    const subId = slugToId[p.rapot_slug]!;
    const base = daysAgo(42);
    eventRows.push({ event_name: "submission_created", submission_id: subId, occurred_at: base });
    eventRows.push({ event_name: "rapot_viewed", submission_id: subId, occurred_at: new Date(base.getTime() + 60_000) });
    if (p.booking_status) {
      eventRows.push({ event_name: "booking_created", submission_id: subId, occurred_at: new Date(base.getTime() + 120_000) });
    }
    if (p.booking_status === "attended") {
      eventRows.push({ event_name: "assessment_attended", submission_id: subId, occurred_at: daysAgo(21) });
    }
    if (p.tahsin_sessions_attended !== undefined) {
      eventRows.push({ event_name: "tahsin_enrolled", submission_id: subId, occurred_at: daysAgo(35) });
    }
    if (p.gates.some((g) => g.gate === "gate3_post_tahsin" && g.response === "yes")) {
      eventRows.push({ event_name: "hits_cta_clicked", submission_id: subId, occurred_at: daysAgo(3) });
    }
  }
  try {
    await sql`
      INSERT INTO analytics_events ${sql(eventRows, "event_name", "submission_id", "occurred_at")}
    `;
  } catch (err) { console.error(`  ✗ analytics_events: ${(err as Error).message}`); return; }
  console.log(`  ✓ ${eventRows.length} analytics events`);

  // ---- Summary ----
  console.log("\n  ✓ Funnel demo data seeded!");
  console.log("\n  Demo peserta:");
  for (const p of PESERTA) {
    const stage =
      (p.tahsin_sessions_attended ?? -1) >= 3 ? "HITS qualified" :
      (p.tahsin_sessions_attended ?? -1) >= 0 ? `tahsin (${p.tahsin_sessions_attended}/4)` :
      p.booking_status === "attended" ? "post-assessment" :
      p.booking_status ? `booked (${p.booking_status})` : "rapot only";
    console.log(`    /rapot/${p.rapot_slug}  skor=${p.target_skor}  ${stage}  (${p.jenis_kelamin})`);
  }
}

// ============================================================
// 9. Main
// ============================================================

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Muhajir Project Tilawah — Development Seed");
  console.log(`  Target: ${dbTarget()}`);
  console.log(`  Auth:   auth_users (Auth.js), password dummy=${DUMMY_PASSWORD}`);
  console.log(`  Mode:   ${isReset ? "RESET + SEED" : "SEED (idempotent)"}`);
  console.log("═══════════════════════════════════════════════════════");

  try {
    await sql`SELECT id FROM teachers LIMIT 1`;
  } catch (err) {
    console.error("\n✗ Cannot query teachers table:");
    console.error(`  ${(err as Error).message}`);
    console.error("\n  Likely cause: migrations not applied yet.");
    console.error("  Run `pnpm db:migrate`, then retry seed.");
    process.exit(1);
  }

  if (isReset) {
    await resetFunnelData();
    await reset();
  }

  await seedAdmin();
  for (const t of TEACHERS) {
    await seedTeacher(t);
  }
  await seedFunnelData();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✓ Seed complete");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log(`  1. Admin login: /admin/login (email: ${ADMIN_EMAIL}, pwd: ${DUMMY_PASSWORD})`);
  console.log(`  2. Pengajar login: /portal-mpt-x7/login (WA: 081200000001, pwd: ${DUMMY_PASSWORD})`);
  console.log("  3. Demo rapot pages:");
  console.log("     /rapot/demo-rizki-01   — skor 3, gate1=no (stopped)");
  console.log("     /rapot/demo-fauzi-03   — skor 4, gate1=yes → booking flow");
  console.log("     /rapot/demo-umar-05    — skor 2, attended assessment");
  console.log("     /rapot/demo-ibrahim-07 — skor 2, tahsin 2/4 sessions");
  console.log("     /rapot/demo-bilal-09   — skor 2, tahsin 4/4 → HITS qualified");
  console.log("  4. Admin → /admin/jadwal untuk lihat slots");
  console.log("  5. Admin → /admin/cohort untuk lihat tahsin cohorts");
}

main()
  .catch((err) => {
    console.error("\n✗ Seed failed with unhandled error:");
    console.error(err);
    process.exitCode = 1;
  })
  // Tanpa ini pool postgres.js menahan proses tetap hidup setelah seed selesai.
  .finally(() => sql.end());
