import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  teacher_id: z.string().uuid(),
  name: z.string().min(3).max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  capacity: z.number().int().min(1).max(12).default(12),
  slot_ids: z.array(z.string().uuid()).length(4),
});

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

  const { teacher_id, name, start_date, end_date, capacity, slot_ids } =
    parsed.data;

  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json(
      { error: "invalid_dates", message: "Tanggal selesai tidak boleh sebelum mulai." },
      { status: 400 },
    );
  }

  const sb = supabaseService();

  // Validate teacher
  const { data: teacher } = await sb
    .from("teachers")
    .select("id, jenis_kelamin, status")
    .eq("id", teacher_id)
    .maybeSingle();
  if (!teacher) {
    return NextResponse.json(
      { error: "teacher_not_found" },
      { status: 404 },
    );
  }
  const t = teacher as { jenis_kelamin: "ikhwan" | "akhwat"; status: string };
  if (t.status !== "active") {
    return NextResponse.json(
      { error: "teacher_inactive", message: "Pengajar tidak aktif." },
      { status: 400 },
    );
  }

  // Validate 4 slots: all tahsin, same teacher, not already bound to cohort
  const { data: slotsRaw } = await sb
    .from("slots")
    .select("id, kind, teacher_id, scheduled_at, gender_target, status")
    .in("id", slot_ids);
  const slots = (slotsRaw ?? []) as {
    id: string;
    kind: "assessment" | "tahsin";
    teacher_id: string;
    scheduled_at: string;
    gender_target: string;
    status: string;
  }[];

  if (slots.length !== 4) {
    return NextResponse.json(
      {
        error: "slots_not_found",
        message: `Hanya ${slots.length} dari 4 slot ditemukan.`,
      },
      { status: 400 },
    );
  }

  for (const s of slots) {
    if (s.kind !== "tahsin") {
      return NextResponse.json(
        { error: "wrong_kind", message: `Slot ${s.id.slice(0, 8)} bukan Tahsin.` },
        { status: 400 },
      );
    }
    if (s.teacher_id !== teacher_id) {
      return NextResponse.json(
        {
          error: "teacher_mismatch",
          message: `Slot ${s.id.slice(0, 8)} bukan milik pengajar yang dipilih.`,
        },
        { status: 400 },
      );
    }
    if (s.gender_target !== t.jenis_kelamin) {
      return NextResponse.json(
        {
          error: "gender_mismatch",
          message: `Slot ${s.id.slice(0, 8)} gender tidak match.`,
        },
        { status: 400 },
      );
    }
    if (s.status !== "scheduled") {
      return NextResponse.json(
        {
          error: "slot_not_scheduled",
          message: `Slot ${s.id.slice(0, 8)} status ${s.status}.`,
        },
        { status: 400 },
      );
    }
  }

  // Check no slot is already in a cohort
  const { data: existingBindings } = await sb
    .from("cohort_sessions")
    .select("slot_id")
    .in("slot_id", slot_ids);

  if (existingBindings && existingBindings.length > 0) {
    return NextResponse.json(
      {
        error: "slot_already_bound",
        message: `${existingBindings.length} slot sudah terikat ke cohort lain.`,
      },
      { status: 409 },
    );
  }

  // Sort slots chronologically — session_number follows time order
  const sortedSlots = [...slots].sort((a, b) =>
    a.scheduled_at.localeCompare(b.scheduled_at),
  );

  // Insert cohort
  const { data: cohort, error: cohortErr } = await sb
    .from("cohorts")
    .insert({
      teacher_id,
      name,
      gender_target: t.jenis_kelamin,
      start_date,
      end_date,
      capacity,
      status: "open",
    })
    .select("id")
    .single();

  if (cohortErr || !cohort) {
    return NextResponse.json(
      {
        error: "db_error",
        message: cohortErr?.message ?? "Gagal membuat cohort.",
      },
      { status: 500 },
    );
  }

  // Insert 4 cohort_sessions
  const sessionRows = sortedSlots.map((s, i) => ({
    cohort_id: (cohort as { id: string }).id,
    slot_id: s.id,
    session_number: i + 1,
  }));

  const { error: sessionErr } = await sb
    .from("cohort_sessions")
    .insert(sessionRows);

  if (sessionErr) {
    // Rollback cohort
    await sb
      .from("cohorts")
      .delete()
      .eq("id", (cohort as { id: string }).id);
    return NextResponse.json(
      { error: "session_bind_failed", message: sessionErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    cohort_id: (cohort as { id: string }).id,
  });
}
