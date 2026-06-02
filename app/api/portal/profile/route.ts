import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentTeacher } from "@/lib/auth/teacher";
import { supabaseService } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  nama: z.string().min(2).max(120).optional(),
  bio: z.string().max(500).optional(),
  email_zoom: z.string().email().optional().or(z.literal("")),
  foto_url: z.string().url().optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.nama !== undefined) updates.nama = parsed.data.nama;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio || null;
  if (parsed.data.email_zoom !== undefined)
    updates.email_zoom = parsed.data.email_zoom || null;
  if (parsed.data.foto_url !== undefined)
    updates.foto_url = parsed.data.foto_url || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const sb = supabaseService();
  const { error } = await sb
    .from("teachers")
    .update(updates)
    .eq("id", teacher.teacherId);

  if (error) {
    return NextResponse.json(
      { error: "db_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
