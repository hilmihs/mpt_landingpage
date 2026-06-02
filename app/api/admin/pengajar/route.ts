import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  nama: z.string().min(2).max(120),
  jenis_kelamin: z.enum(["ikhwan", "akhwat"]),
  nomor_wa: z.string().min(8).max(20),
  password: z.string().min(8).max(72),
  email_zoom: z.string().email().optional().or(z.literal("")),
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

  const sb = supabaseService();

  // Check uniqueness on WA
  const { data: dup } = await sb
    .from("teachers")
    .select("id")
    .eq("nomor_wa", phoneDB)
    .maybeSingle();
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
  const { data: teacher, error: teacherErr } = await sb
    .from("teachers")
    .insert({
      auth_user_id: authUser.user.id,
      nama: parsed.data.nama,
      jenis_kelamin: parsed.data.jenis_kelamin,
      nomor_wa: phoneDB,
      email_zoom: parsed.data.email_zoom || null,
      bio: parsed.data.bio || null,
      status: "active",
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (teacherErr || !teacher) {
    // Rollback auth user if teachers insert failed
    await sb.auth.admin.deleteUser(authUser.user.id).catch(() => {});
    return NextResponse.json(
      {
        error: "db_error",
        message: teacherErr?.message ?? "Gagal menyimpan data pengajar.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, teacher_id: teacher.id });
}
