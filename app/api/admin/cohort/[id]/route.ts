import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  status: z
    .enum(["open", "closed", "in_progress", "completed", "cancelled"])
    .optional(),
  capacity: z.number().int().min(1).max(12).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

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

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.capacity !== undefined)
    updates.capacity = parsed.data.capacity;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const sb = supabaseService();

  // Capacity tightening: ensure capacity >= enrolled_count
  if (updates.capacity !== undefined) {
    const { data: c } = await sb
      .from("cohorts")
      .select("enrolled_count")
      .eq("id", id)
      .maybeSingle();
    if (
      c &&
      typeof (c as { enrolled_count: number }).enrolled_count === "number" &&
      (updates.capacity as number) < (c as { enrolled_count: number }).enrolled_count
    ) {
      return NextResponse.json(
        {
          error: "capacity_too_low",
          message: `Capacity tidak boleh < jumlah peserta sudah enroll (${(c as { enrolled_count: number }).enrolled_count}).`,
        },
        { status: 400 },
      );
    }
  }

  const { error } = await sb.from("cohorts").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
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
  const sb = supabaseService();

  // Soft-cancel: status='cancelled' so audit trail remains
  const { error } = await sb
    .from("cohorts")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
