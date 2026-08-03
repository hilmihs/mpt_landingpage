import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

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

  // Validate teacher
  const teacherRows = await sql<
    { id: string; jenis_kelamin: "ikhwan" | "akhwat"; status: string }[]
  >`
    SELECT id, jenis_kelamin, status FROM teachers WHERE id = ${teacher_id} LIMIT 1
  `;
  const teacher = teacherRows[0] ?? null;
  if (!teacher) {
    return NextResponse.json(
      { error: "teacher_not_found" },
      { status: 404 },
    );
  }
  const t = teacher;
  if (t.status !== "active") {
    return NextResponse.json(
      { error: "teacher_inactive", message: "Pengajar tidak aktif." },
      { status: 400 },
    );
  }

  // Validate 4 slots: all tahsin, same teacher, not already bound to cohort
  const slotsRaw = await sql<
    {
      id: string;
      kind: "assessment" | "tahsin";
      teacher_id: string;
      scheduled_at: Date;
      gender_target: string;
      status: string;
    }[]
  >`
    SELECT id, kind, teacher_id, scheduled_at, gender_target, status
    FROM slots
    WHERE id = ANY(${slot_ids}::uuid[])
  `;
  const slots = slotsRaw.map((s) => ({
    ...s,
    scheduled_at: s.scheduled_at.toISOString(),
  }));

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
  const existingBindings = await sql<{ slot_id: string }[]>`
    SELECT slot_id FROM cohort_sessions WHERE slot_id = ANY(${slot_ids}::uuid[])
  `;

  if (existingBindings.length > 0) {
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
  let cohortId: string;
  try {
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO cohorts (teacher_id, name, gender_target, start_date, end_date, capacity, status)
      VALUES (${teacher_id}, ${name}, ${t.jenis_kelamin}, ${start_date}, ${end_date}, ${capacity}, ${"open"})
      RETURNING id
    `;
    if (!inserted[0]) throw new Error("Gagal membuat cohort.");
    cohortId = inserted[0].id;
  } catch (err) {
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "Gagal membuat cohort.",
      },
      { status: 500 },
    );
  }

  // Insert 4 cohort_sessions
  const sessionRows = sortedSlots.map((s, i) => ({
    cohort_id: cohortId,
    slot_id: s.id,
    session_number: i + 1,
  }));

  try {
    await sql`INSERT INTO cohort_sessions ${sql(
      sessionRows,
      "cohort_id",
      "slot_id",
      "session_number",
    )}`;
  } catch (err) {
    // Rollback cohort
    await sql`DELETE FROM cohorts WHERE id = ${cohortId}`;
    return NextResponse.json(
      {
        error: "session_bind_failed",
        message: err instanceof Error ? err.message : "Gagal mengikat sesi.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    cohort_id: cohortId,
  });
}
