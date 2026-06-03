import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase";
import { trackEvent, FUNNEL_EVENTS } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  rapot_slug: z.string().min(6).max(64),
  slot_id: z.string().uuid(),
  notes_from_user: z.string().max(500).optional(),
});

export async function POST(req: Request) {
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

  const { rapot_slug, slot_id, notes_from_user } = parsed.data;
  const sb = supabaseService();

  // Look up submission via rapot slug
  const { data: rapotRaw } = await sb
    .from("rapot")
    .select("submission_id, submissions(jenis_kelamin)")
    .eq("slug", rapot_slug)
    .maybeSingle();

  const rapot = rapotRaw as
    | { submission_id: string; submissions: { jenis_kelamin: string } | null }
    | null;

  if (!rapot) {
    return NextResponse.json({ error: "rapot_not_found" }, { status: 404 });
  }

  const submission_id = rapot.submission_id;
  const userGender = rapot.submissions?.jenis_kelamin;
  if (!userGender) {
    return NextResponse.json({ error: "missing_gender" }, { status: 400 });
  }

  // Atomic booking via RPC — holds row lock on slot, checks capacity,
  // enforces one active booking per submission per slot kind.
  const { data: result, error: rpcErr } = await sb.rpc("create_booking", {
    p_slot_id: slot_id,
    p_submission_id: submission_id,
    p_jenis_kelamin: userGender,
    p_notes: notes_from_user ?? null,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: "db_error", message: rpcErr.message },
      { status: 500 },
    );
  }

  const rpcResult = result as {
    ok: boolean;
    reason?: string;
    booking_id?: string;
    reused?: boolean;
    existing_booking_id?: string;
  };

  if (!rpcResult.ok) {
    const statusMap: Record<string, { status: number; message: string }> = {
      slot_not_found: { status: 404, message: "Slot tidak ditemukan" },
      slot_unavailable: { status: 409, message: "Slot tidak tersedia" },
      gender_mismatch: { status: 409, message: "Slot tidak cocok dengan gender peserta" },
      slot_full: { status: 409, message: "Slot sudah penuh, silakan pilih waktu lain" },
      already_has_booking: { status: 409, message: "Anda sudah memiliki booking aktif di slot lain" },
    };
    const mapped = statusMap[rpcResult.reason ?? ""] ?? { status: 400, message: rpcResult.reason };
    return NextResponse.json(
      { error: rpcResult.reason, message: mapped.message },
      { status: mapped.status },
    );
  }

  await trackEvent({
    event_name: FUNNEL_EVENTS.BOOKING_CREATED,
    submission_id,
    metadata: { slot_id, rapot_slug },
  });

  return NextResponse.json({
    booking_id: rpcResult.booking_id,
    reused: rpcResult.reused ?? false,
  });
}
