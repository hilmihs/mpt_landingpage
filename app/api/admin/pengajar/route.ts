import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { hashPassword } from "@/auth";
import { normalizeWaNumber } from "@/lib/whatsapp";

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

  // Buat kredensial di auth_users. Nomor disimpan dalam format yang sama
  // dengan yang dipakai saat login (lihat normalizeWaNumber di lib/whatsapp.ts),
  // supaya pencarian saat login persis sama.
  let authUserId: string;
  try {
    const created = await sql<{ id: string }[]>`
      INSERT INTO auth_users (phone, password_hash)
      VALUES (${normalizeWaNumber(parsed.data.nomor_wa)}, ${await hashPassword(parsed.data.password)})
      RETURNING id
    `;
    if (!created[0]) throw new Error("Gagal membuat akun.");
    authUserId = created[0].id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal membuat akun.";
    return NextResponse.json(
      {
        error: "auth_create_failed",
        message: msg.includes("auth_users_phone_key")
          ? "Nomor WhatsApp ini sudah punya akun."
          : msg,
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
        ${authUserId},
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
    // Batalkan akun auth kalau baris pengajarnya gagal disimpan, supaya tidak
    // meninggalkan kredensial yatim yang bisa dipakai login tanpa profil.
    await sql`DELETE FROM auth_users WHERE id = ${authUserId}`.catch(() => {});
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
