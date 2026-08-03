import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  status: z
    .enum(["open", "closed", "in_progress", "completed", "cancelled"])
    .optional(),
  capacity: z.number().int().min(1).max(12).optional(),
});

const idSchema = z.string().uuid();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updates: Record<string, string | number> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.capacity !== undefined)
    updates.capacity = parsed.data.capacity;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  // Capacity tightening: atomic check via conditional UPDATE
  if (updates.capacity !== undefined) {
    let rows: { id: string }[];
    try {
      rows = await sql<{ id: string }[]>`
        UPDATE cohorts SET ${sql(updates)}
        WHERE id = ${id} AND enrolled_count <= ${updates.capacity as number}
        RETURNING id
      `;
    } catch (err) {
      return NextResponse.json(
        {
          error: "db_error",
          message: err instanceof Error ? err.message : "db_error",
        },
        { status: 500 },
      );
    }
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "capacity_too_low",
          message: "Capacity tidak boleh < jumlah peserta sudah enroll.",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  try {
    await sql`UPDATE cohorts SET ${sql(updates)} WHERE id = ${id}`;
  } catch (err) {
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "db_error",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  // Soft-cancel: status='cancelled' so audit trail remains
  try {
    await sql`UPDATE cohorts SET status = ${"cancelled"} WHERE id = ${id}`;
  } catch (err) {
    return NextResponse.json(
      {
        error: "db_error",
        message: err instanceof Error ? err.message : "db_error",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
