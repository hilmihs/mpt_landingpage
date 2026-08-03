import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  nama: z.string().min(2).max(120),
  jenis_kelamin: z.enum(["ikhwan", "akhwat"]),
  nomor_wa: z.string().min(8).max(20),
  password: z.string().min(8).max(72),
  email_meet: z.string().email().optional().or(z.literal("")),
  bio: z.string().max(500).optional(),
});

function normalizeIndonesianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `+62${digits}`;
  return null;
}

function dbWaFormat(input: string): string | null {
  // teachers.nomor_wa CHECK regex: '^(\+62|0|62)[0-9]{8,13}$'
  const digits = input.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return digits;
  if (digits.startsWith("8")) return `+62${digits}`;
  return null;
}

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const phoneE164 = normalizeIndonesianPhone(parsed.data.nomor_wa);
  const phoneDB = dbWaFormat(parsed.data.nomor_wa);
  if (!phoneE164 || !phoneDB) {
    return NextResponse.json(
      { error: "invalid_phone", message: "Format nomor WhatsApp tidak valid." },
      { status: 400 },
    );
  }

  // Auth-only client — dipakai untuk sb.auth.admin.* saja. Diganti Auth.js di fase berikutnya.
  const sb = supabaseService();

  // Check uniqueness on WA
  const dupRows = await sql<{ id: string }[]>`
    SELECT id FROM teachers WHERE nomor_wa = ${phoneDB} LIMIT 1
  `;
  const dup = dupRows[0] ?? null;
  if (dup) {
    return NextResponse.json(
      {
        error: "duplicate_wa",
        message: "Nomor WhatsApp ini sudah terdaftar sebagai pengajar.",
      },
      { status: 409 },
    );
  }

  // Create Supabase Auth user with phone+password
  const { data: authUser, error: authErr } =
    await sb.auth.admin.createUser({
      phone: phoneE164,
      password: parsed.data.password,
      phone_confirm: true,
      user_metadata: { role: "teacher", nama: parsed.data.nama },
    });

  if (authErr || !authUser.user) {
    return NextResponse.json(
      {
        error: "auth_create_failed",
        message:
          authErr?.message ??
          "Gagal membuat akun auth. Pastikan phone provider sudah enabled di Supabase.",
      },
      { status: 500 },
    );
  }

  // Insert teachers row
  let teacherId: string;
  try {
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO teachers
        (auth_user_id, nama, jenis_kelamin, nomor_wa, email_meet, bio, status, activated_at)
      VALUES (
        ${authUser.user.id},
        ${parsed.data.nama},
        ${parsed.data.jenis_kelamin},
        ${phoneDB},
        ${parsed.data.email_meet || null},
        ${parsed.data.bio || null},
        ${"active"},
        ${new Date()}
      )
      RETURNING id
    `;
    if (!inserted[0]) throw new Error("Gagal menyimpan data pengajar.");
    teacherId = inserted[0].id;
  } catch (err) {
    // Rollback auth user if teachers insert failed
    await sb.auth.admin.deleteUser(authUser.user.id).catch(() => {});
    return NextResponse.json(
      {
        error: "db_error",
        message:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan data pengajar.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, teacher_id: teacherId });
}
